import React, { useMemo, useState } from 'react';
import { RingProgress, Text, Divider } from '@mantine/core';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useTracker } from '../components/TrackerContext';
import type { JobStatus, TrackedJob } from '../components/TrackerContext';
import { Column, JobCard } from '../components/JobCard';
import { JobModal, STATUSES } from '../components/JobModal';
import "../styles/Tracker.css";

function Tracker() {
    const { trackedJobs, updateJobStatus, addJob, editJob, removeJob } = useTracker();
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const [activeColumn, setActiveColumn] = useState<JobStatus>('Saved');
    const [columnSearch, setColumnSearch] = useState<Record<JobStatus, string>>({
        Saved: '', Applied: '', Interview: '', Offer: '', Rejected: ''
    });

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState<TrackedJob | null>(null);
    const [initialStatus, setInitialStatus] = useState<JobStatus>('Saved');

    const openModal = (jobOrStatus?: TrackedJob | JobStatus) => {
        if (jobOrStatus && typeof jobOrStatus === 'object') {
            setEditingJob(jobOrStatus as TrackedJob);
        } else {
            setEditingJob(null);
            setInitialStatus((jobOrStatus as JobStatus) || 'Saved');
        }
        setModalOpen(true);
    };

    const handleSave = (jobData: Partial<TrackedJob>, isNew: boolean) => {
        if (!isNew && editingJob) {
            editJob(editingJob.id, jobData);
        } else {
            addJob({
                company: jobData.company || '',
                role: jobData.role || '',
                location: jobData.location || '',
                dateApplied: jobData.dateApplied || '',
                notes: jobData.notes || '',
                link: jobData.link || ''
            }, jobData.status);
        }
        setModalOpen(false);
    };

    const handleDelete = (id: string) => {
        removeJob(id);
        setModalOpen(false);
    };

    const columnCounts = useMemo(() => {
        const counts: Record<JobStatus, number> = { Saved: 0, Applied: 0, Interview: 0, Offer: 0, Rejected: 0 };
        trackedJobs.forEach(job => counts[job.status]++);
        return counts;
    }, [trackedJobs]);

    const columns = useMemo(() => {
        const cols: Record<JobStatus, TrackedJob[]> = {
            Saved: [], Applied: [], Interview: [], Offer: [], Rejected: []
        };
        trackedJobs.forEach(job => {
            const q = columnSearch[job.status].toLowerCase()
            if (!q ||
                job.company.toLowerCase().includes(q) ||
                job.role.toLowerCase().includes(q) ||
                job.location.toLowerCase().includes(q)
            ) {
                cols[job.status].push(job)
            }
        });
        return cols;
    }, [trackedJobs, columnSearch]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const onDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const onDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;

        const activeJob = trackedJobs.find(j => j.id === active.id);
        const overId = over.id;

        if (!activeJob) return;

        // If dropped directly on an empty column
        if (STATUSES.includes(overId as JobStatus)) {
            if (activeJob.status !== overId) {
                updateJobStatus(active.id as string, overId as JobStatus);
            }
            return;
        }

        // If dropped over another job
        const overJob = trackedJobs.find(j => j.id === overId);
        if (overJob && activeJob.status !== overJob.status) {
            updateJobStatus(active.id as string, overJob.status);
        }
    };

    const activeJob = useMemo(() => trackedJobs.find(j => j.id === activeId), [activeId, trackedJobs]);

    // Statistics
    const totalTracked = trackedJobs.length;
    const totalApplied = trackedJobs.filter(j => j.status !== 'Saved').length;
    const offers = trackedJobs.filter(j => j.status === 'Offer').length;
    const responses = trackedJobs.filter(j => ['Interview', 'Offer', 'Rejected'].includes(j.status)).length;
    const responseRate = totalApplied > 0 ? Math.round((responses / totalApplied) * 100) : 0;

    const stats = {
        saved: trackedJobs.filter(j => j.status === 'Saved').length,
        applied: trackedJobs.filter(j => j.status === 'Applied').length,
        interview: trackedJobs.filter(j => j.status === 'Interview').length,
        offer: trackedJobs.filter(j => j.status === 'Offer').length,
        rejected: trackedJobs.filter(j => j.status === 'Rejected').length,
    };

    const ringData = totalTracked > 0 ? [
        { value: (stats.saved / totalTracked) * 100, color: 'gray', tooltip: `Saved: ${stats.saved}` },
        { value: (stats.applied / totalTracked) * 100, color: 'blue', tooltip: `Applied: ${stats.applied}` },
        { value: (stats.interview / totalTracked) * 100, color: 'yellow', tooltip: `Interview: ${stats.interview}` },
        { value: (stats.offer / totalTracked) * 100, color: 'green', tooltip: `Offer: ${stats.offer}` },
        { value: (stats.rejected / totalTracked) * 100, color: 'red', tooltip: `Rejected: ${stats.rejected}` },
    ].filter(segment => segment.value > 0) : [{ value: 100, color: '#f1f3f5', tooltip: 'No data yet' }];

    const exportToCSV = () => {
        if (!trackedJobs || trackedJobs.length === 0) {
            return;
        }

        const headers = ["Company", "Role", "Location", "Status", "Date Applied", "Link", "Notes"];
        const rows = trackedJobs.map(job => [
            `"${(job.company || '').replace(/"/g, '""')}"`,
            `"${(job.role || '').replace(/"/g, '""')}"`,
            `"${(job.location || '').replace(/"/g, '""')}"`,
            `"${job.status || ''}"`,
            `"${job.dateApplied || ''}"`,
            `"${(job.link || '').replace(/"/g, '""')}"`,
            `"${(job.notes || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "\uFEFF" + [
            headers.join(","),
            ...rows.map(row => row.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "searchtern_applications.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{ width: '100%', maxWidth: '1580px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '10px' }}>
                <Text size="xl" fw={800} c="var(--text-dark)" style={{ fontSize: '1.75rem' }}>Application Tracker</Text>
                <button onClick={() => openModal()} style={{ padding: '10px 24px', fontWeight: 600 }}>+ Add Application</button>
            </div>

            <section className="feature tracker-stats" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px', margin: '0 0 20px 0', boxSizing: 'border-box' }}>
                <div className="tracker-stats-numbers" style={{ display: 'flex', flexGrow: 1, justifyContent: 'space-around', paddingRight: '40px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <Text c="dimmed" size="xs" fw={700}>Applied</Text>
                        <Text fw={700} size="xl">{totalApplied}</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <Text c="dimmed" size="xs" fw={700}>Reply Rate</Text>
                        <Text fw={700} size="xl">{responseRate}%</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <Text c="dimmed" size="xs" fw={700}>Offers</Text>
                        <Text fw={700} size="xl" c="green">{offers}</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <Text c="dimmed" size="xs" fw={700}>Rejected</Text>
                        <Text fw={700} size="xl" c="red">{stats.rejected}</Text>
                    </div>
                </div>

                <Divider orientation="vertical" className="tracker-divider" />

                <div className="tracker-ring" style={{ paddingLeft: '40px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <RingProgress
                        size={120}
                        thickness={12}
                        roundCaps
                        sections={ringData}
                        label={
                            <div style={{ textAlign: 'center', marginTop: '-4px' }}>
                                <Text fw={800} size="xl" lh={1}>{totalTracked > 0 ? totalTracked : 0}</Text>
                                <Text c="dimmed" size="xs" fw={700} mt={2}>Total</Text>
                            </div>
                        }
                    />
                    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {ringData.filter(d => d.tooltip !== 'No data yet').map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color === 'gray' ? '#868e96' : item.color === 'blue' ? '#228be6' : item.color === 'yellow' ? '#fab005' : item.color === 'green' ? '#40c057' : '#fa5252' }} />
                                <Text size="xs" c="dimmed" fw={600}>{item.tooltip}</Text>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <div className="tracker-board-scroll">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                >
                <div className="tracker-tab-strip">
                    {STATUSES.map(status => (
                        <button
                            key={status}
                            className={`tracker-tab ${activeColumn === status ? 'active' : ''}`}
                            onClick={() => setActiveColumn(status)}
                        >
                            {status}
                            <span className="tab-count">{columns[status].length}</span>
                        </button>
                    ))}
                </div>
                <div className="tracker-board">
                    {STATUSES.map(status => (
                        <div key={status} className={`tracker-column-wrapper ${activeColumn === status ? 'active' : ''}`}>
                            <Column
                                status={status}
                                jobs={columns[status]}
                                onEdit={openModal}
                                onAdd={openModal}
                                searchValue={columnSearch[status]}
                                onSearchChange={val => setColumnSearch(prev => ({ ...prev, [status]: val }))}
                                totalCount={columnCounts[status]}
                            />
                        </div>
                    ))}
                </div>

                    <DragOverlay>
                        {activeJob ? <JobCard job={activeJob} /> : null}
                    </DragOverlay>
                </DndContext>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingRight: '10px' }}>
                <button 
                    onClick={exportToCSV}
                    style={{ backgroundColor: 'transparent', color: 'var(--text-light)', border: 'none', fontSize: '12px', textDecoration: 'underline', padding: 0, margin: 0, boxShadow: 'none' }}
                >
                    Export tracking data to CSV
                </button>
            </div>

            <JobModal 
                opened={modalOpen} 
                onClose={() => setModalOpen(false)} 
                editingJob={editingJob} 
                initialStatus={initialStatus} 
                onSave={handleSave} 
                onDelete={handleDelete} 
            />
        </div>
    );
}

export default Tracker;