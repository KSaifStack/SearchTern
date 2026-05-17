import React, { createContext, useContext, useState, useEffect } from 'react';

export type JobStatus = 'Saved' | 'Applied' | 'Interview' | 'Offer' | 'Rejected';

export interface TrackedJob {
    id: string | number;
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
    addJob: (job: Omit<TrackedJob, 'status' | 'dateAdded'>, status?: JobStatus) => void;
    updateJobStatus: (id: string | number, newStatus: JobStatus) => void;
    editJob: (id: string | number, updatedFields: Partial<TrackedJob>) => void;
    removeJob: (id: string | number) => void;
    isJobTracked: (id: string | number) => boolean;
}

const TrackerContext = createContext<TrackerContextType | undefined>(undefined);

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [trackedJobs, setTrackedJobs] = useState<TrackedJob[]>(() => {
        const stored = localStorage.getItem('searchtern_tracker');
        return stored ? JSON.parse(stored) : [];
    });

    const [activityLog, setActivityLog] = useState<ActivityEvent[]>(() => {
        const stored = localStorage.getItem('searchtern_activity');
        return stored ? JSON.parse(stored) : [];
    });

    useEffect(() => {
        localStorage.setItem('searchtern_tracker', JSON.stringify(trackedJobs));
    }, [trackedJobs]);

    useEffect(() => {
        localStorage.setItem('searchtern_activity', JSON.stringify(activityLog));
    }, [activityLog]);

    const logActivity = (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
        setActivityLog(prev => {
            // Deduplicate: skip if same type+company+to was logged within 2 seconds
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

    const addJob = (job: Omit<TrackedJob, 'status' | 'dateAdded'>, status: JobStatus = 'Saved') => {
        setTrackedJobs(prev => {
            if (prev.some(j => j.id === job.id)) return prev;
            return [...prev, { ...job, status, dateAdded: new Date().toISOString() }];
        });
        logActivity({ type: 'added', company: job.company, role: job.role, to: status });
    };

    const updateJobStatus = (id: string | number, newStatus: JobStatus) => {
        setTrackedJobs(prev => prev.map(job => {
            if (job.id === id) {
                logActivity({ type: 'status_change', company: job.company, role: job.role, from: job.status, to: newStatus });
                return { ...job, status: newStatus };
            }
            return job;
        }));
    };

    const editJob = (id: string | number, updatedFields: Partial<TrackedJob>) => {
        setTrackedJobs(prev => prev.map(job => {
            if (job.id === id) {
                if (updatedFields.status && updatedFields.status !== job.status) {
                    logActivity({ type: 'status_change', company: job.company, role: job.role, from: job.status, to: updatedFields.status });
                }
                return { ...job, ...updatedFields };
            }
            return job;
        }));
    };

    const removeJob = (id: string | number) => {
        const job = trackedJobs.find(j => j.id === id);
        if (job) logActivity({ type: 'removed', company: job.company, role: job.role });
        setTrackedJobs(prev => prev.filter(job => job.id !== id));
    };

    const isJobTracked = (id: string | number) => {
        return trackedJobs.some(job => job.id === id);
    };

    return (
        <TrackerContext.Provider value={{ trackedJobs, activityLog, addJob, updateJobStatus, editJob, removeJob, isJobTracked }}>
            {children}
        </TrackerContext.Provider>
    );
};

export const useTracker = () => {
    const context = useContext(TrackerContext);
    if (!context) throw new Error("useTracker must be used within a TrackerProvider");
    return context;
};
