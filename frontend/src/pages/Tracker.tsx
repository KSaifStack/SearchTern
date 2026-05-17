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
    const [activeId, setActiveId] = React.useState<string | number | null>(null);

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
                id: Date.now().toString(),
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

    const handleDelete = (id: string | number) => {
        removeJob(id);
        setModalOpen(false);
    };

    const columns = useMemo(() => {
        const cols: Record<JobStatus, TrackedJob[]> = {
            Saved: [], Applied: [], Interview: [], Offer: [], Rejected: []
        };
        trackedJobs.forEach(job => cols[job.status].push(job));
        return cols;
    }, [trackedJobs]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const onDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id);
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
                updateJobStatus(active.id, overId as JobStatus);
            }
            return;
        }

        // If dropped over another job
        const overJob = trackedJobs.find(j => j.id === overId);
        if (overJob && activeJob.status !== overJob.status) {
            updateJobStatus(active.id, overJob.status);
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
        { value: (stats.saved / totalTracked) * 100, color: 'gray' },
        { value: (stats.applied / totalTracked) * 100, color: 'blue' },
        { value: (stats.interview / totalTracked) * 100, color: 'yellow' },
        { value: (stats.offer / totalTracked) * 100, color: 'green' },
        { value: (stats.rejected / totalTracked) * 100, color: 'red' },
    ].filter(segment => segment.value > 0) : [{ value: 100, color: '#f1f3f5' }];

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
        <div style={{ width: 'max-content', maxWidth: '100%', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                    <button onClick={() => openModal()}>+ Add Application</button>
                    <button 
                        onClick={exportToCSV}
                        style={{ backgroundColor: 'transparent', color: 'var(--font-color)', border: '1px solid var(--border-medium)' }}
                    >
                        Export CSV
                    </button>
                </div>
            </div>

            <section className="feature" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px', margin: '0 0 20px 0', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', flexGrow: 1, justifyContent: 'space-around', paddingRight: '40px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Total</Text>
                        <Text fw={700} size="xl">{totalTracked}</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Applied</Text>
                        <Text fw={700} size="xl">{totalApplied}</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Reply Rate</Text>
                        <Text fw={700} size="xl">{responseRate}%</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Offers</Text>
                        <Text fw={700} size="xl" c="green">{offers}</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Rejected</Text>
                        <Text fw={700} size="xl" c="red">{stats.rejected}</Text>
                    </div>
                </div>

                <Divider orientation="vertical" />

                <div style={{ paddingLeft: '40px' }}>
                    <RingProgress
                        size={100}
                        thickness={12}
                        roundCaps
                        sections={ringData}
                        label={
                            <Text c="dimmed" ta="center" size="xs" fw={700}>
                                {totalTracked > 0 ? 'Stats' : 'No Data'}
                            </Text>
                        }
                    />
                </div>
            </section>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
            >
                <div className="tracker-board" style={{ width: '100%', maxWidth: 'none', margin: 0 }}>
                    {STATUSES.map(status => (
                        <Column key={status} status={status} jobs={columns[status]} onEdit={openModal} onAdd={openModal} />
                    ))}
                </div>

                <DragOverlay>
                    {activeJob ? <JobCard job={activeJob} /> : null}
                </DragOverlay>
            </DndContext>

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