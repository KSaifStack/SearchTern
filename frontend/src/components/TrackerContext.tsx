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

interface TrackerContextType {
    trackedJobs: TrackedJob[];
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

    useEffect(() => {
        localStorage.setItem('searchtern_tracker', JSON.stringify(trackedJobs));
    }, [trackedJobs]);

    const addJob = (job: Omit<TrackedJob, 'status' | 'dateAdded'>, status: JobStatus = 'Saved') => {
        setTrackedJobs(prev => {
            if (prev.some(j => j.id === job.id)) return prev;
            return [...prev, { ...job, status, dateAdded: new Date().toISOString() }];
        });
    };

    const updateJobStatus = (id: string | number, newStatus: JobStatus) => {
        setTrackedJobs(prev => prev.map(job => 
            job.id === id ? { ...job, status: newStatus } : job
        ));
    };

    const editJob = (id: string | number, updatedFields: Partial<TrackedJob>) => {
        setTrackedJobs(prev => prev.map(job => 
            job.id === id ? { ...job, ...updatedFields } : job
        ));
    };

    const removeJob = (id: string | number) => {
        setTrackedJobs(prev => prev.filter(job => job.id !== id));
    };

    const isJobTracked = (id: string | number) => {
        return trackedJobs.some(job => job.id === id);
    };

    return (
        <TrackerContext.Provider value={{ trackedJobs, addJob, updateJobStatus, editJob, removeJob, isJobTracked }}>
            {children}
        </TrackerContext.Provider>
    );
};

export const useTracker = () => {
    const context = useContext(TrackerContext);
    if (!context) throw new Error("useTracker must be used within a TrackerProvider");
    return context;
};
