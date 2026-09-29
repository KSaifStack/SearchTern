import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
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
    const [pendingMerge, setPendingMerge] = useState<{ local: TrackedJob[], cloud: TrackedJob[], userId: string } | null>(null);

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

            // Merge logic: Check if there are local-only jobs
            const cloudIds = new Set(cloudJobs.map(j => j.id));
            setTrackedJobs(prev => {
                const localOnly = prev.filter(j => !cloudIds.has(j.id));
                if (localOnly.length > 0) {
                    // Instead of automatic upload, ask the user
                    setPendingMerge({ local: localOnly, cloud: cloudJobs, userId });
                    // Return prev for now while the modal is open
                    return prev;
                }
                // If no local data, just load cloud data
                return cloudJobs;
            });
        }
    }, []);

    useEffect(() => {
        if (user?.id) {
            fetchFromSupabase(user.id);
        } else {
            // Clear pending merge if the user logs out during the prompt
            setPendingMerge(null);
        }
    }, [user?.id, fetchFromSupabase]);

    // Poll for external changes (agent auto-apply, other devices) so the board
    // stays in sync without a hard reload. Skip while a merge prompt is open.
    useEffect(() => {
        if (!user?.id || pendingMerge) return;
        const id = window.setInterval(() => {
            fetchFromSupabase(user.id);
        }, 15000);
        return () => window.clearInterval(id);
    }, [user?.id, pendingMerge, fetchFromSupabase]);

    const handleMerge = () => {
        if (!pendingMerge || !supabase) return;
        const { local, cloud, userId } = pendingMerge;

        // Upload local data to Supabase
        supabase
            .from('tracked_jobs')
            .upsert(local.map(j => jobToDbRow(j, userId)), { onConflict: 'user_id,fingerprint' })
            .then(({ error }) => {
                if (error) console.error('Error uploading merged jobs to Supabase:', error);
            });

        setTrackedJobs([...cloud, ...local]);
        setPendingMerge(null);
    };

    const handleDiscard = () => {
        if (!pendingMerge) return;
        // Just overwrite with cloud data
        setTrackedJobs(pendingMerge.cloud);
        setPendingMerge(null);
    };

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
        if (!job) return;

        logActivity({ type: 'removed', company: job.company, role: job.role });
        setTrackedJobs(prev => prev.filter(j => j.id !== id));

        if (supabase && user?.id) {
            supabase
                .from('tracked_jobs')
                .delete()
                .eq('user_id', user.id)
                .eq('fingerprint', id)
                .then(({ error }) => { if (error) console.error('Supabase removeJob error:', error); });
        }

        const notificationId = `remove-${job.id}-${Date.now()}`;
        notifications.show({
            id: notificationId,
            title: 'Removed',
            color: 'gray',
            autoClose: 5000,
            message: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: '14px' }}>{job.company} removed from tracker.</span>
                    <button
                        style={{ padding: '6px 14px', fontSize: '13px', minHeight: 'unset', margin: 0 }}
                        onClick={() => {
                            setTrackedJobs(prev => {
                                if (prev.some(j => j.id === job.id)) return prev;
                                return [...prev, job];
                            });
                            logActivity({ type: 'added', company: job.company, role: job.role, to: job.status });
                            if (supabase && user?.id) {
                                supabase
                                    .from('tracked_jobs')
                                    .upsert(jobToDbRow(job, user.id), { onConflict: 'user_id,fingerprint' })
                                    .then(({ error }) => { if (error) console.error('Supabase restoreJob error:', error); });
                            }
                            notifications.hide(notificationId);
                            notifications.show({
                                title: 'Restored',
                                message: `${job.company} has been restored.`,
                                color: 'teal',
                                autoClose: 3000
                            });
                        }}
                    >
                        Undo
                    </button>
                </div>
            )
        });
    };

    const isJobTracked = (company: string, role: string, location: string) => {
        const fingerprint = makeJobFingerprint(company, role, location);
        return trackedJobs.some(job => job.id === fingerprint);
    };

    return (
        <TrackerContext.Provider value={{ trackedJobs, activityLog, syncing, addJob, updateJobStatus, editJob, removeJob, isJobTracked }}>
            {children}
            <Modal
                opened={pendingMerge !== null}
                onClose={() => { }}
                title={<Text fw={700} size="lg">Merge Saved Jobs?</Text>}
                withCloseButton={false}
                closeOnClickOutside={false}
                closeOnEscape={false}
                centered
            >
                <Text size="sm" mb="lg">
                    You have <b>{pendingMerge?.local.length}</b> job(s) saved on this device. Would you like to merge them into your account, or discard them and load your account's saved jobs?
                </Text>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                    <button style={{ backgroundColor: '#fa5252', color: 'white' }} onClick={handleDiscard}>
                        Discard Local Data
                    </button>
                    <button style={{ backgroundColor: '#20c997', color: 'white' }} onClick={handleMerge}>
                        Keep & Merge
                    </button>
                </div>
            </Modal>
        </TrackerContext.Provider>
    );
};

export const useTracker = () => {
    const context = useContext(TrackerContext);
    if (!context) throw new Error("useTracker must be used within a TrackerProvider");
    return context;
};
