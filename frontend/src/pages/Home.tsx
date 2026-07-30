import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Text, Divider, RingProgress } from '@mantine/core';
import { getRecent } from '../services/internshipmanager';
import { useTracker } from '../components/TrackerContext';
import type { ActivityEvent } from '../components/TrackerContext';
import '../styles/Home.css';

interface Job {
    id: number;
    company: string;
    role: string;
    location: string;
    date: string;
    link: string;
    type?: string;
    season?: string;
}

function formatTimeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function activityDescription(event: ActivityEvent): string {
    if (event.type === 'added') return `Saved ${event.company} to tracker`;
    if (event.type === 'removed') return `Removed ${event.company} from tracker`;
    if (event.type === 'status_change') return `Moved ${event.company} → ${event.to}`;
    return '';
}

function Home() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const { trackedJobs, activityLog } = useTracker();

    useEffect(() => {
        getRecent().then(res => {
            if (res.success) setJobs(res.data);
            setLoading(false);
        });
    }, []);

    // Tracker status breakdown for the ring chart
    const total = trackedJobs.length;
    const ringData = total > 0 ? [
        { value: Math.round((trackedJobs.filter(j => j.status === 'Saved').length / total) * 100), color: 'gray', tooltip: `Saved: ${trackedJobs.filter(j => j.status === 'Saved').length}` },
        { value: Math.round((trackedJobs.filter(j => j.status === 'Applied').length / total) * 100), color: 'blue', tooltip: `Applied: ${trackedJobs.filter(j => j.status === 'Applied').length}` },
        { value: Math.round((trackedJobs.filter(j => j.status === 'Interview').length / total) * 100), color: 'yellow', tooltip: `Interview: ${trackedJobs.filter(j => j.status === 'Interview').length}` },
        { value: Math.round((trackedJobs.filter(j => j.status === 'Offer').length / total) * 100), color: 'green', tooltip: `Offer: ${trackedJobs.filter(j => j.status === 'Offer').length}` },
        { value: Math.round((trackedJobs.filter(j => j.status === 'Rejected').length / total) * 100), color: 'red', tooltip: `Rejected: ${trackedJobs.filter(j => j.status === 'Rejected').length}` },
    ].filter(s => s.value > 0) : [{ value: 100, color: '#e9ecef', tooltip: 'No data yet' }];

    // Show jobs from past 48 hours
    const recentJobs = jobs
        .filter(j => {
            const d = parseFloat(String(j.date));
            return d >= 0 && d < 2; // Last 48 hours
        })
        .sort((a, b) => {
            const aNum = parseFloat(String(a.date));
            const bNum = parseFloat(String(b.date));
            return aNum - bNum; // Newest first
        })
        .slice(0, 6);

    const recentActivity = activityLog.slice(0, 6);
    const todayCount = jobs.filter(j => parseFloat(String(j.date)) === 0).length;
    const internshipCount = jobs.filter(j => j.type !== 'newgrad').length;
    const newgradCount = jobs.filter(j => j.type === 'newgrad').length;



    return (
        <div className="standard-layout home-layout">

            {/* ── Stat Bar ── */}
            <section className="feature stat-bar">
                <div className="stat-item">
                    <Text className="stat-item-title" c="dimmed" size="xs" tt="uppercase" fw={600} mb={6}>Total Listings</Text>
                    <Text className="stat-item-value" fw={800} c="var(--text-dark)">
                        {loading ? '—' : jobs.length}
                    </Text>
                    {!loading && internshipCount > 0 && newgradCount > 0 && (
                        <Text size="xs" c="dimmed" mt={2}>
                            {internshipCount} internships, {newgradCount} new grad
                        </Text>
                    )}
                </div>
                <Divider orientation="vertical" className="stat-divider" />
                <div className="stat-item">
                    <Text className="stat-item-title" c="dimmed" size="xs" tt="uppercase" fw={600} mb={6}>Added Today</Text>
                    <Text className="stat-item-value" fw={800} c="var(--text-dark)">
                        {loading ? '—' : todayCount}
                    </Text>
                </div>
                <Divider orientation="vertical" className="stat-divider" />
                <div className="stat-item">
                    <Text className="stat-item-title" c="dimmed" size="xs" tt="uppercase" fw={600} mb={6}>Tracked Apps</Text>
                    <Text className="stat-item-value" fw={800} c="var(--text-dark)">
                        {trackedJobs.length}
                    </Text>
                </div>
                <Divider orientation="vertical" className="stat-divider" />
                <div className="stat-ring-container">
                    <RingProgress
                        size={110}
                        thickness={10}
                        roundCaps
                        sections={ringData}
                        label={
                            <div className="stat-ring-label">
                                <Text fw={800} size="xl" lh={1}>{total > 0 ? total : 0}</Text>
                                <Text c="dimmed" size="xs" tt="uppercase" fw={700} mt={2}>Total</Text>
                            </div>
                        }
                    />
                    <div className="stat-ring-legend">
                        {ringData.filter(d => d.tooltip !== 'No data yet').map((item, idx) => (
                            <div key={idx} className="stat-ring-legend-item">
                                <div className="stat-ring-legend-dot" style={{ backgroundColor: item.color === 'gray' ? '#868e96' : item.color === 'blue' ? '#228be6' : item.color === 'yellow' ? '#fab005' : item.color === 'green' ? '#40c057' : '#fa5252' }} />
                                <Text size="xs" c="dimmed" fw={600}>{item.tooltip}</Text>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Two-column grid ── */}
            <div className="home-columns">

                {/* Recent Jobs Card */}
                <section className="feature home-card">
                    <div className="home-card-header">
                        <Text className="home-card-title" fw={700}>Recent Jobs</Text>
                        <Link to="/jobs" className="home-card-link">View all →</Link>
                    </div>

                    {loading ? (
                        <p className="home-empty">Loading...</p>
                    ) : recentJobs.length === 0 ? (
                        <div className="home-empty-enhanced">
                            <p>No recent listings in the last 48 hours.</p>
                            <p className="mt-4">
                                <strong>Try these:</strong>
                            </p>
                            <ul className="mt-2 space-y-1 text-sm">
                                <li>Visit the <Link to="/jobs" className="home-card-link">full job board</Link> for all listings</li>
                                <li>Check back later for hourly updates</li>
                                <li>Use filters to narrow your search</li>
                            </ul>
                        </div>
                    ) : (
                        recentJobs.map(job => (
                            <a key={job.id} href={job.link} target="_blank" rel="noreferrer" className="recent-job-row">
                                <div className="recent-job-company-container">
                                    <img
                                        src={`https://www.google.com/s2/favicons?domain=${job.company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.com&sz=32`}
                                        className="recent-job-company-icon"
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                        alt=""
                                    />
                                    <span className="recent-job-company">{job.company}</span>
                                </div>
                                <span className="recent-job-role">{job.role}</span>
                                <span className="recent-job-location">{job.location}</span>
                            </a>
                        ))
                    )}
                </section>

                {/* Recent Activity Card */}
                <section className="feature home-card">
                    <div className="home-card-header">
                        <Text className="home-card-title" fw={700}>Recent Activity</Text>
                        <Link to="/tracker" className="home-card-link">Open tracker →</Link>
                    </div>

                    {recentActivity.length === 0 ? (
                        <p className="home-empty">No activity yet.<br />Start tracking applications to see updates here!</p>
                    ) : (
                        <div className="activity-list-container">
                            {recentActivity.map(event => (
                                <div key={event.id} className="activity-row">
                                    <div className="activity-row-content">
                                        <p className="activity-text">
                                            {activityDescription(event)}
                                        </p>
                                        <p className="activity-time">{formatTimeAgo(event.timestamp)}</p>
                                    </div>
                                </div>
                            ))}
                            {recentActivity.length < 6 && (
                                <div className="activity-caught-up">
                                    <p>You're all caught up!</p>
                                </div>
                            )}
                        </div>
                    )}
                </section>

            </div>

            {/* ── Footer ── */}
            <footer className="home-footer">
                <p className="home-footer-text">© 2026 SearchTern</p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'center' }}>
                    <a href="https://github.com/KSaifStack/SearchTern" target="_blank" rel="noopener noreferrer" className="home-footer-link">
                        GitHub
                    </a>
                    <Link to="/privacy" className="home-footer-link">
                        Privacy Policy
                    </Link>
                </div>
            </footer>
        </div>
    );
}

export default Home;