import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { makeJobFingerprint } from '../utils/jobFingerprint';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type JobStatus = 'Saved' | 'Applied' | 'Interview' | 'Offer' | 'Rejected';

export interface TrackedJob {
    /** Stable content-based fingerprint — immune to backend ID rotation. */
    id: string;
    company: string;
    role: string;
    location: string;
    link?: string;
    status: JobStatus;
    dateAdded: string;
    dateApplied?: string;
    notes?: string;
}

export interface ActivityEvent {
    id: string;
    type: 'status_change' | 'added' | 'removed';
    company: string;
    role: string;
    from?: JobStatus;
    to?: JobStatus;
    timestamp: string;
}

interface TrackerContextType {
    trackedJobs: TrackedJob[];
    activityLog: ActivityEvent[];
    syncing: boolean;
    /**
     * Add a job to the tracker. The stable fingerprint id is computed
     * internally from company + role + location — do NOT pass a DB id.
     */
    addJob: (job: Omit<TrackedJob, 'id' | 'status' | 'dateAdded'>, status?: JobStatus) => void;
    updateJobStatus: (id: string, newStatus: JobStatus) => void;
    editJob: (id: string, updatedFields: Partial<TrackedJob>) => void;
    removeJob: (id: string) => void;
    /** Returns true if a job with the same company+role+location fingerprint is tracked. */
    isJobTracked: (company: string, role: string, location: string) => boolean;
}

const TrackerContext = createContext<TrackerContextType | undefined>(undefined);

// ── Local storage helpers ──────────────────────────────────────────────────────
const LS_JOBS = 'searchtern_tracker_v2';
const LS_ACTIVITY = 'searchtern_activity';

function loadLocal<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

// ── Row shape from Supabase ────────────────────────────────────────────────────
interface DbRow {
    fingerprint: string;
    company: string;
    role: string;
    location: string;
    link: string | null;
    status: string;
    date_added: string;
    date_applied: string | null;
    notes: string | null;
}

function dbRowToJob(row: DbRow): TrackedJob {
    return {
        id: row.fingerprint,
        company: row.company,
        role: row.role,
        location: row.location,
        link: row.link ?? undefined,
        status: row.status as JobStatus,
        dateAdded: row.date_added,
        dateApplied: row.date_applied ?? undefined,
        notes: row.notes ?? undefined,
    };
}

function jobToDbRow(job: TrackedJob, userId: string) {
    return {
        user_id: userId,
        fingerprint: job.id,
        company: job.company,
        role: job.role,
        location: job.location,
        link: job.link ?? null,
        status: job.status,
        date_added: job.dateAdded,
        date_applied: job.dateApplied ?? null,
        notes: job.notes ?? null,
    };
}

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();

    const [trackedJobs, setTrackedJobs] = useState<TrackedJob[]>(() => loadLocal<TrackedJob[]>(LS_JOBS, []));
    const [activityLog, setActivityLog] = useState<ActivityEvent[]>(() => loadLocal<ActivityEvent[]>(LS_ACTIVITY, []));
    const [syncing, setSyncing] = useState(false);

    // ── Persist to localStorage whenever jobs change (guest fallback) ──────────
    useEffect(() => {
        localStorage.setItem(LS_JOBS, JSON.stringify(trackedJobs));
    }, [trackedJobs]);

    useEffect(() => {
        localStorage.setItem(LS_ACTIVITY, JSON.stringify(activityLog));
    }, [activityLog]);

    // ── Fetch all jobs from Supabase when user logs in ─────────────────────────
    const fetchFromSupabase = useCallback(async (userId: string) => {
        if (!supabase) return;
        setSyncing(true);
        const { data, error } = await supabase
            .from('tracked_jobs')
            .select('*')
            .eq('user_id', userId);
        setSyncing(false);
        if (error) {
            console.error('Error fetching tracked jobs from Supabase:', error);
            return;
        }
        if (data) {
            const cloudJobs = (data as DbRow[]).map(dbRowToJob);

            // Merge: start with cloud jobs, then layer in any local-only jobs
            setTrackedJobs(prev => {
                const cloudIds = new Set(cloudJobs.map(j => j.id));
                const localOnly = prev.filter(j => !cloudIds.has(j.id));
                // Upload local-only jobs to the cloud
                if (localOnly.length > 0 && supabase) {
                    supabase
                        .from('tracked_jobs')
                        .upsert(localOnly.map(j => jobToDbRow(j, userId)), { onConflict: 'user_id,fingerprint' })
                        .then(({ error }) => {
                            if (error) console.error('Error uploading local jobs to Supabase:', error);
                        });
                }
                return [...cloudJobs, ...localOnly];
            });
        }
    }, []);

    useEffect(() => {
        if (user?.id) {
            fetchFromSupabase(user.id);
        }
    }, [user?.id, fetchFromSupabase]);

    // ── Activity log helper ────────────────────────────────────────────────────
    const logActivity = (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
        setActivityLog(prev => {
            const recent = prev[0];
            if (
                recent &&
                recent.type === event.type &&
                recent.company === event.company &&
                recent.to === event.to &&
                Date.now() - new Date(recent.timestamp).getTime() < 2000
            ) {
                return prev;
            }
            const entry: ActivityEvent = {
                ...event,
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
            };
            return [entry, ...prev].slice(0, 20);
        });
    };

    // ── CRUD helpers (optimistic local + async cloud) ──────────────────────────
    const addJob = (job: Omit<TrackedJob, 'id' | 'status' | 'dateAdded'>, status: JobStatus = 'Saved') => {
        const fingerprint = makeJobFingerprint(job.company, job.role, job.location);
        const newJob: TrackedJob = { ...job, id: fingerprint, status, dateAdded: new Date().toISOString() };

        setTrackedJobs(prev => {
            if (prev.some(j => j.id === fingerprint)) return prev;
            return [...prev, newJob];
        });
        logActivity({ type: 'added', company: job.company, role: job.role, to: status });

        if (supabase && user?.id) {
            supabase
                .from('tracked_jobs')
                .upsert(jobToDbRow(newJob, user.id), { onConflict: 'user_id,fingerprint' })
                .then(({ error }) => { if (error) console.error('Supabase addJob error:', error); });
        }
    };

    const updateJobStatus = (id: string, newStatus: JobStatus) => {
        setTrackedJobs(prev => prev.map(job => {
            if (job.id === id) {
                logActivity({ type: 'status_change', company: job.company, role: job.role, from: job.status, to: newStatus });
                const updated = { ...job, status: newStatus };
                if (supabase && user?.id) {
                    supabase
                        .from('tracked_jobs')
                        .update({ status: newStatus })
                        .eq('user_id', user.id)
                        .eq('fingerprint', id)
                        .then(({ error }) => { if (error) console.error('Supabase updateStatus error:', error); });
                }
                return updated;
            }
            return job;
        }));
    };

    const editJob = (id: string, updatedFields: Partial<TrackedJob>) => {
        setTrackedJobs(prev => prev.map(job => {
            if (job.id === id) {
                if (updatedFields.status && updatedFields.status !== job.status) {
                    logActivity({ type: 'status_change', company: job.company, role: job.role, from: job.status, to: updatedFields.status });
                }
                const updated = { ...job, ...updatedFields };
                if (supabase && user?.id) {
                    supabase
                        .from('tracked_jobs')
                        .update(jobToDbRow(updated, user.id))
                        .eq('user_id', user.id)
                        .eq('fingerprint', id)
                        .then(({ error }) => { if (error) console.error('Supabase editJob error:', error); });
                }
                return updated;
            }
            return job;
        }));
    };

    const removeJob = (id: string) => {
        const job = trackedJobs.find(j => j.id === id);
        if (job) logActivity({ type: 'removed', company: job.company, role: job.role });
        setTrackedJobs(prev => prev.filter(job => job.id !== id));

        if (supabase && user?.id) {
            supabase
                .from('tracked_jobs')
                .delete()
                .eq('user_id', user.id)
                .eq('fingerprint', id)
                .then(({ error }) => { if (error) console.error('Supabase removeJob error:', error); });
        }
    };

    const isJobTracked = (company: string, role: string, location: string) => {
        const fingerprint = makeJobFingerprint(company, role, location);
        return trackedJobs.some(job => job.id === fingerprint);
    };

    return (
        <TrackerContext.Provider value={{ trackedJobs, activityLog, syncing, addJob, updateJobStatus, editJob, removeJob, isJobTracked }}>
            {children}
        </TrackerContext.Provider>
    );
};

export const useTracker = () => {
    const context = useContext(TrackerContext);
    if (!context) throw new Error("useTracker must be used within a TrackerProvider");
    return context;
};
