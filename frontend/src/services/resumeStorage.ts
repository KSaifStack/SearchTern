// Resume storage — local-first (IndexedDB) with optional Supabase Storage sync,
// mirroring the pattern used by TrackerContext: guests and local-only installs
// get a fully working feature, signed-in users get it synced across devices.
import { supabase } from '../lib/supabase';

export interface ResumeRecord {
    name: string;
    type: string;
    size: number;
    uploadedAt: string;
    blob: Blob;
}

const DB_NAME = 'searchtern';
const STORE = 'resumes';
const KEY = 'current';
const BUCKET = 'resumes';

export const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

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

function idbPut(record: ResumeRecord): Promise<void> {
    return openDb().then(db => new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(record, KEY);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    }));
}

function idbGet(): Promise<ResumeRecord | null> {
    return openDb().then(db => new Promise<ResumeRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => {
            const value = req.result as ResumeRecord | undefined;
            db.close();
            resolve(value ?? null);
        };
        req.onerror = () => { db.close(); reject(req.error); };
    }));
}

function idbDelete(): Promise<void> {
    return openDb().then(db => new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    }));
}

export function fileToRecord(file: File, uploadedAt = new Date().toISOString()): ResumeRecord {
    return {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt,
        blob: file,
    };
}

export async function getLocalResume(): Promise<ResumeRecord | null> {
    return idbGet();
}

export async function saveLocalResume(record: ResumeRecord): Promise<void> {
    return idbPut(record);
}

export async function clearLocalResume(): Promise<void> {
    return idbDelete();
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
    const prefix = `${userId}/`;
    const { data, error } = await supabase.storage.from(BUCKET).list(userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, names: (data ?? []).map(f => `${prefix}${f.name}`) };
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

/**
 * Converge local and cloud copies in one direction: cloud wins if it exists,
 * otherwise push the local copy up. Call after sign-in and after each mutation.
 */
export async function syncResumeWithCloud(userId: string): Promise<void> {
    if (!supabase) return;
    const local = await getLocalResume();
    const cloud = await listCloudResumes(userId);
    if (!cloud.ok) return;
    if (cloud.names.length > 0) {
        const pulled = await pullResumeFromCloud(userId, cloud.names[0]);
        if (pulled.ok && pulled.record.blob.size > 0) {
            await saveLocalResume(pulled.record);
        }
    } else if (local) {
        await pushResumeToCloud(userId, local);
    }
}