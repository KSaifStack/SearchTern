// Resume storage — local-first (IndexedDB) with optional Supabase Storage sync,
// mirroring the pattern used by TrackerContext: guests get a fully working
// feature, signed-in users get resumes synced across devices.
//
// A user can hold many resumes. Exactly one is "active" — the one shown in the
// preview and the one agents are told to use. Active is stored locally and
// mirrored to a small `_active` marker file in the user's cloud bucket so the
// backend can tell agents which resume is current.
import { supabase } from '../lib/supabase';

export interface ResumeRecord {
    id: string;
    name: string;
    type: string;
    size: number;
    uploadedAt: string;
    blob: Blob;
}

const DB_NAME = 'searchtern';
const STORE = 'resumes';
const ACTIVE_KEY = 'active';
const BUCKET = 'resumes';
const ACTIVE_MARKER = '_active';

export const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

function generateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE);
            }
        };
        req.onsuccess = () => resolve(req.result as IDBDatabase);
        req.onerror = () => reject(req.error);
    });
}

function idbPut(key: string, value: unknown): Promise<void> {
    return openDb().then(db => new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    }));
}

function idbGet<T>(key: string): Promise<T | null> {
    return openDb().then(db => new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => {
            const value = req.result as T | undefined;
            db.close();
            resolve(value ?? null);
        };
        req.onerror = () => { db.close(); reject(req.error); };
    }));
}

function idbDelete(key: string): Promise<void> {
    return openDb().then(db => new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    }));
}

function idbAll(): Promise<unknown[]> {
    return openDb().then(db => new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => {
            db.close();
            resolve(req.result as unknown[]);
        };
        req.onerror = () => { db.close(); reject(req.error); };
    }));
}

export function fileToRecord(file: File, uploadedAt = new Date().toISOString()): ResumeRecord {
    return {
        id: generateId(),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt,
        blob: file,
    };
}

/** If `preferred` collides with an existing name, append " (2)", " (3)", … */
export function uniqueResumeName(names: string[], preferred: string): string {
    const lower = (n: string) => n.toLowerCase();
    if (!names.some(n => lower(n) === lower(preferred))) return preferred;
    const dot = preferred.lastIndexOf('.');
    const base = dot > 0 ? preferred.slice(0, dot) : preferred;
    const ext = dot > 0 ? preferred.slice(dot) : '';
    let i = 2;
    while (names.some(n => lower(n) === lower(`${base} (${i})${ext}`))) i++;
    return `${base} (${i})${ext}`;
}

function isRecord(v: unknown): v is ResumeRecord {
    return Boolean(v && typeof v === 'object' && 'blob' in v && 'id' in v);
}

export async function getLocalResumes(): Promise<ResumeRecord[]> {
    const rows = await idbAll();
    const resumes = rows.filter(isRecord);
    return resumes.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function getActiveResumeId(): Promise<string | null> {
    return idbGet<string>(ACTIVE_KEY);
}

export async function setActiveResumeId(id: string): Promise<void> {
    return idbPut(ACTIVE_KEY, id);
}

export async function upsertLocalResume(record: ResumeRecord): Promise<void> {
    return idbPut(record.id, record);
}

export async function removeLocalResume(id: string): Promise<void> {
    await idbDelete(id);
    if ((await getActiveResumeId()) === id) {
        await idbDelete(ACTIVE_KEY);
    }
}

export function isValidResumeFile(file: File): string | null {
    const lower = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some(ext => lower.endsWith(ext))) {
        return 'Unsupported file type. Accepted formats: PDF, DOC, DOCX, TXT.';
    }
    if (file.size > MAX_RESUME_BYTES) {
        return 'Resume must be under 5 MB.';
    }
    return null;
}

// ── Cloud sync (Supabase Storage) ────────────────────────────────────────────

export function cloudAvailable(): boolean {
    return Boolean(supabase);
}

function resumePath(userId: string, name: string): string {
    return `${userId}/${name}`;
}

export async function listCloudResumes(
    userId: string,
): Promise<{ ok: true; names: string[] } | { ok: false; error: string }> {
    if (!supabase) return { ok: false, error: 'Cloud sync unavailable.' };
    const { data, error } = await supabase.storage.from(BUCKET).list(userId);
    if (error) return { ok: false, error: error.message };
    const names = (data ?? [])
        .map(f => f.name)
        .filter(name => !name.startsWith('_'));
    return { ok: true, names: names.map(name => `${userId}/${name}`) };
}

export async function pushResumeToCloud(
    userId: string,
    record: ResumeRecord,
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!supabase) return { ok: false, error: 'Cloud sync unavailable.' };
    const path = resumePath(userId, record.name);
    const { error } = await supabase.storage.from(BUCKET).upload(path, record.blob, {
        upsert: true,
        contentType: record.type,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

export async function pullResumeFromCloud(
    userId: string,
    path: string,
): Promise<{ ok: true; record: ResumeRecord } | { ok: false; error: string }> {
    if (!supabase) return { ok: false, error: 'Cloud sync unavailable.' };
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) return { ok: false, error: error?.message ?? 'Resume not found.' };
    const name = path.replace(`${userId}/`, '');
    return {
        ok: true,
        record: {
            id: generateId(),
            name,
            type: data.type || 'application/pdf',
            size: data.size,
            uploadedAt: new Date().toISOString(),
            blob: data,
        },
    };
}

export async function removeResumeFromCloud(
    userId: string,
    record: ResumeRecord,
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!supabase) return { ok: true };
    const path = resumePath(userId, record.name);
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

export async function getCloudActive(userId: string): Promise<string | null> {
    if (!supabase) return null;
    const path = resumePath(userId, ACTIVE_MARKER);
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) return null;
    const name = (await data.text()).trim();
    return name || null;
}

export async function setCloudActive(userId: string, name: string): Promise<void> {
    if (!supabase) return;
    const path = resumePath(userId, ACTIVE_MARKER);
    await supabase.storage.from(BUCKET).upload(path, new Blob([name], { type: 'text/plain' }), {
        upsert: true,
        contentType: 'text/plain',
    });
}

/**
 * Converge local and cloud in both directions (merge by filename), then resolve
 * the active resume: cloud marker wins, otherwise keep the local active choice.
 */
export async function syncResumeWithCloud(userId: string, current: ResumeRecord[]): Promise<void> {
    if (!supabase) return;
    const cloud = await listCloudResumes(userId);
    if (!cloud.ok) return;

    const cloudNames = new Set(cloud.names.map(p => p.replace(`${userId}/`, '')));
    const result = [...current];
    let changed = false;

    for (const path of cloud.names) {
        const name = path.replace(`${userId}/`, '');
        if (!current.some(r => r.name === name)) {
            const pulled = await pullResumeFromCloud(userId, path);
            if (pulled.ok) {
                result.push(pulled.record);
                changed = true;
            }
        }
    }
    for (const record of current) {
        if (!cloudNames.has(record.name)) {
            await pushResumeToCloud(userId, record);
        }
    }

    const activeName = await getCloudActive(userId);
    const activeId = await getActiveResumeId();
    let resolvedId: string | null = null;
    if (activeName) {
        const match = result.find(r => r.name === activeName);
        if (match) resolvedId = match.id;
    }
    if (!resolvedId && activeId && result.some(r => r.id === activeId)) {
        resolvedId = activeId;
    }
    if (!resolvedId && result.length > 0) {
        resolvedId = result[0].id;
    }

    if (changed) {
        for (const record of result) {
            await upsertLocalResume(record);
        }
    }
    if (resolvedId) {
        await setActiveResumeId(resolvedId);
        const chosen = result.find(r => r.id === resolvedId);
        if (chosen && chosen.name !== activeName) {
            await setCloudActive(userId, chosen.name);
        }
    }
    return;
}

export async function removeFromCloudAndLocal(
    userId: string,
    record: ResumeRecord,
): Promise<void> {
    if (supabase) {
        await removeResumeFromCloud(userId, record);
    }
    await removeLocalResume(record.id);
}

export async function setActiveEverywhere(
    userId: string,
    record: ResumeRecord,
): Promise<void> {
    await setActiveResumeId(record.id);
    if (supabase) {
        await setCloudActive(userId, record.name);
        await pushResumeToCloud(userId, record);
    }
}