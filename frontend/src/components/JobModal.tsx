import React, { useState, useEffect } from 'react';
import { Modal, TextInput, Select, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import type { JobStatus, TrackedJob } from './TrackerContext';

import '../styles/JobModal.css';

export const STATUSES: JobStatus[] = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

interface JobModalProps {
    opened: boolean;
    onClose: () => void;
    editingJob: TrackedJob | null;
    initialStatus: JobStatus;
    onSave: (job: Partial<TrackedJob>, isNew: boolean) => void;
    onDelete: (id: string) => void;
}

export const JobModal: React.FC<JobModalProps> = ({ opened, onClose, editingJob, initialStatus, onSave, onDelete }) => {
    const [formData, setFormData] = useState({
        company: '',
        role: '',
        location: '',
        status: 'Saved' as JobStatus,
        dateApplied: null as Date | null,
        notes: '',
        link: ''
    });

    const [errors, setErrors] = useState({ company: false, role: false });

    useEffect(() => {
        if (opened) {
            setErrors({ company: false, role: false });
            if (editingJob) {
                setFormData({
                    company: editingJob.company || '',
                    role: editingJob.role || '',
                    location: editingJob.location || '',
                    status: editingJob.status || 'Saved',
                    dateApplied: editingJob.dateApplied ? new Date(editingJob.dateApplied) : null,
                    notes: editingJob.notes || '',
                    link: editingJob.link || ''
                });
            } else {
                setFormData({
                    company: '',
                    role: '',
                    location: '',
                    status: initialStatus || 'Saved',
                    dateApplied: new Date(),
                    notes: '',
                    link: ''
                });
            }
        }
    }, [opened, editingJob, initialStatus]);

    const handleSave = () => {
        const companyError = !formData.company.trim();
        const roleError = !formData.role.trim();
        
        if (companyError || roleError) {
            setErrors({ company: companyError, role: roleError });
            return;
        }

        onSave({
            company: formData.company,
            role: formData.role,
            location: formData.location,
            status: formData.status,
            dateApplied: formData.dateApplied ? formData.dateApplied.toISOString().split('T')[0] : '',
            notes: formData.notes,
            link: formData.link
        }, !editingJob);
    };

    return (
        <Modal 
            opened={opened} 
            onClose={onClose} 
            title={editingJob ? "Edit Application" : "Add Application"}
            size="lg"
        >
            <div className="modal-form-container">
                <TextInput 
                    label="Company Name" 
                    placeholder="e.g. Google" 
                    value={formData.company} 
                    onChange={e => {
                        setFormData({ ...formData, company: e.target.value });
                        if (e.target.value.trim()) setErrors({ ...errors, company: false });
                    }} 
                    error={errors.company ? "Company name is required" : null}
                    required 
                />
                <TextInput 
                    label="Role" 
                    placeholder="e.g. Software Engineer Intern" 
                    value={formData.role} 
                    onChange={e => {
                        setFormData({ ...formData, role: e.target.value });
                        if (e.target.value.trim()) setErrors({ ...errors, role: false });
                    }} 
                    error={errors.role ? "Role is required" : null}
                    required 
                />
                <TextInput label="Location" placeholder="e.g. Remote, or New York, NY" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                
                <div className="group grow">
                    <Select
                        label="Status"
                        data={STATUSES}
                        value={formData.status}
                        onChange={(val) => setFormData({ ...formData, status: val as JobStatus })}
                    />
                    <DateInput 
                        label="Date Applied" 
                        value={formData.dateApplied} 
                        onChange={(val) => setFormData({ ...formData, dateApplied: val ? new Date(val) : null })} 
                        clearable 
                    />
                </div>

                <TextInput label="Job Link" placeholder="https://..." value={formData.link} onChange={e => setFormData({ ...formData, link: e.target.value })} />
                
                <Textarea 
                    label="Notes" 
                    placeholder="Interview questions, recruiter names, salary, etc." 
                    minRows={4} 
                    value={formData.notes} 
                    onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                />

                <div className="modal-footer">
                    {editingJob ? (
                        <button className="btn-delete" onClick={() => onDelete(editingJob.id)}>Delete</button>
                    ) : <span />}
                    <div className="group">
                        <button className="btn-cancel" onClick={onClose}>Cancel</button>
                        <button className="btn-save" onClick={handleSave}>Save</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
