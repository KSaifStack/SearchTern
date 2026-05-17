import React from 'react';
import { Badge } from '@mantine/core';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { JobStatus, TrackedJob } from './TrackerContext';

export const STATUS_COLORS: Record<JobStatus, string> = {
    'Saved': 'gray',
    'Applied': 'blue',
    'Interview': 'yellow',
    'Offer': 'green',
    'Rejected': 'red'
};

export const JobCard = ({ job, onClick }: { job: TrackedJob, onClick?: () => void }) => {
    return (
        <div className="tracker-card" onClick={onClick}>
            <h4 className="card-company">{job.company}</h4>
            <p className="card-role">{job.role}</p>
            <div className="card-footer">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{job.location}</span>
                <Badge color={STATUS_COLORS[job.status]} size="sm" variant="light">{job.status}</Badge>
            </div>
        </div>
    );
};

export const SortableJobCard = ({ job, onEdit }: { job: TrackedJob, onEdit: (job: TrackedJob) => void }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: job.id,
        data: {
            type: 'Job',
            job
        }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <JobCard job={job} onClick={() => {
                if (!isDragging) onEdit(job);
            }} />
        </div>
    );
};

export const Column = ({ status, jobs, onEdit, onAdd }: { status: JobStatus, jobs: TrackedJob[], onEdit: (job: TrackedJob) => void, onAdd: (status: JobStatus) => void }) => {
    const { setNodeRef } = useDroppable({
        id: status,
        data: {
            type: 'Column',
            status
        }
    });

    return (
        <div className="tracker-column">
            <div className="column-header">
                <span>{status}</span>
                <span className="column-count">{jobs.length}</span>
            </div>
            
            <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
                <div ref={setNodeRef} style={{ flexGrow: 1, minHeight: '150px' }}>
                    {jobs.map(job => (
                        <SortableJobCard key={job.id} job={job} onEdit={onEdit} />
                    ))}
                    {jobs.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)', fontSize: '14px' }}>
                            No applications yet
                        </div>
                    )}
                </div>
            </SortableContext>
            <button className="add-card-btn" onClick={() => onAdd(status)}>+ Add a job</button>
        </div>
    );
};
