import React from 'react';
import { Badge } from '@mantine/core';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { JobStatus, TrackedJob } from './TrackerContext';

export const STATUS_COLORS: Record<JobStatus, string> = {
    'Saved': '#94a3b8',
    'Applied': '#3b82f6',
    'Interview': '#f59e0b',
    'Offer': '#22c55e',
    'Rejected': '#ef4444'
};

export const JobCard = ({ job, onClick }: { job: TrackedJob, onClick?: () => void }) => {
    const companyDomain = `${job.company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.com`;
    return (
        <div className={`tracker-card card-status-${job.status.toLowerCase()}`} onClick={onClick}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <img 
                    src={`https://www.google.com/s2/favicons?domain=${companyDomain}&sz=32`}
                    style={{ width: '16px', height: '16px', borderRadius: '2px' }}
                    onError={(e) => e.currentTarget.style.display = 'none'}
                    alt=""
                />
                <h4 className="card-company" style={{ margin: 0 }}>{job.company}</h4>
            </div>
            <p className="card-role">{job.role}</p>
            <div className="card-footer">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{job.location}</span>
                <span style={{ color: 'var(--text-light)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                    {job.dateApplied ? new Date(job.dateApplied).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Added today'}
                </span>
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
            <div className="column-header" style={{ color: STATUS_COLORS[status] }}>
                <span>{status}</span>
                <span className="column-count" style={{ backgroundColor: `${STATUS_COLORS[status]}22`, color: STATUS_COLORS[status] }}>{jobs.length}</span>
            </div>
            
            <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
                <div ref={setNodeRef} style={{ flexGrow: 1, minHeight: '150px' }}>
                    {jobs.map(job => (
                        <SortableJobCard key={job.id} job={job} onEdit={onEdit} />
                    ))}
                    {jobs.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-light)', fontSize: '13px', border: '1px dashed var(--border-medium)', borderRadius: '6px', margin: '10px 0' }}>
                            {status === 'Saved' ? 'Drop jobs here to track later' : 'No applications here'}
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
};
