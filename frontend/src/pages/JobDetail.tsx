import { useEffect, useRef, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { Text, Badge, Divider } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { ArrowUpRight, Buildings, MapPin, Copy, BookmarkSimple, ShareNetwork } from "@phosphor-icons/react"
import { pullJob, pullCount, pullCompany, type Job } from "../api/internships"
import { usePageMeta } from "../utils/seo"
import { useAuth } from "../components/AuthContext"
import { useTracker } from "../components/TrackerContext"
import { matchCompanyMeta, type CompanyMatch } from "../utils/companyMeta"
import { activeResumeText, getLocalResumes } from "../services/resumeStorage"
import "../styles/Home.css"

const STALE_DAYS = 21


function formatPosted(dateValue: string | number): string {
    const parsed = parseFloat(String(dateValue))
    if (isNaN(parsed)) return ""
    if (parsed === 0) return "Today"
    if (parsed === 1) return "Yesterday"
    return `${Math.floor(parsed)} days ago`
}

function postedDate(dateValue: string | number): string | undefined {
    const days = parseFloat(String(dateValue))
    if (isNaN(days)) return undefined
    return new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10)
}

function JobDetail() {
    const { id } = useParams()
    const [job, setJob] = useState<Job | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const fetchToken = useRef(0)
    const { user } = useAuth()
    const { addJob, isJobTracked } = useTracker()
    const [hasResume, setHasResume] = useState(false)
    const [listingCount, setListingCount] = useState<number | null>(null)
    const [siblings, setSiblings] = useState<Job[]>([])
    const [meta, setMeta] = useState<CompanyMatch | null>(null)

    useEffect(() => {
        let mounted = true
        getLocalResumes().then(r => { if (mounted) setHasResume(r.length > 0) })
        pullCount().then(c => { if (mounted) setListingCount(c) })
        return () => { mounted = false }
    }, [])

    const copyResume = async () => {
        try {
            const text = await activeResumeText()
            if (text === null) {
                notifications.show({
                    title: 'No resume yet',
                    message: 'Add one in Settings → Resumes, then use this to paste it into applications.',
                    color: 'orange',
                    icon: <Copy size={18} />,
                })
                return
            }
            if (text.trim().length === 0) {
                notifications.show({
                    title: 'Nothing to copy',
                    message: 'No text could be extracted from your resume.',
                    color: 'orange',
                    icon: <Copy size={18} />,
                })
                return
            }
            await navigator.clipboard.writeText(text)
            notifications.show({
                title: 'Resume copied',
                message: 'Paste it into the application fields.',
                color: 'teal',
                icon: <Copy size={18} />,
            })
        } catch {
            notifications.show({
                title: 'Copy failed',
                message: 'Clipboard access was blocked by the browser.',
                color: 'red',
                icon: <Copy size={18} />,
            })
        }
    }

    useEffect(() => {
        const token = ++fetchToken.current
        setJob(null)
        pullJob(id!).then(res => {
            if (token !== fetchToken.current) return
            if (res) {
                setJob(res)
                setMeta(matchCompanyMeta(res.company))
                pullCompany(res.company).then(rows => {
                    if (token !== fetchToken.current) return
                    setSiblings(rows.filter(s => s.id !== res.id).slice(0, 5))
                })
            } else {
                setNotFound(true)
            }
            setLoading(false)
        })
    }, [id])

    const saveToTracker = (job: Job) => {
        const loc = job.location ?? ''
        const fp = { company: job.company, role: job.role, location: job.location ?? '', link: job.link }
        const already = isJobTracked(job.company, job.role, loc)
        if (!already) {
            addJob(fp, 'Saved')
            notifications.show({
                title: 'Saved',
                message: `${job.company} added to your tracker`,
                color: 'teal',
                icon: <BookmarkSimple size={18} weight="fill" />,
                autoClose: 3000,
            })
        } else {
            notifications.show({
                title: 'Already tracked',
                message: `${job.company} is already in your tracker`,
                color: 'blue',
                autoClose: 2500,
            })
        }
    }

    usePageMeta(job ? {
        title: `${job.role} | ${job.company} | SearchTern`,
        description: `${job.role} in ${job.location || 'remote/US'}. Apply directly through ${job.company}.`,
        path: `/jobs/${job.id}`,
        jsonLd: {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            title: job.role,
            description: `${job.role} in ${job.location || 'remote/US'}. Apply directly through ${job.company}.`,
            hiringOrganization: { "@type": "Organization", name: job.company },
            jobLocation: {
                "@type": "Place",
                address: {
                    "@type": "PostalAddress",
                    addressLocality: /remote|anywhere|telecommute/i.test(job.location ?? '') ? undefined : (job.location ?? '').split(',')[0],
                    addressRegion: /remote|anywhere|telecommute/i.test(job.location ?? '') ? undefined : (job.location ?? '').split(',')[1]?.trim(),
                    addressCountry: "US",
                },
            },
            jobLocationType: /remote|anywhere|telecommute/i.test(job.location ?? '') ? "TELECOMMUTE" : undefined,
            directApply: true,
            employmentType: job.type === 'newgrad' ? "FULL_TIME" : job.type === 'internship' ? "INTERN" : undefined,
            datePosted: postedDate(job.date),
        } as Record<string, unknown>,
    } : {
        title: loading ? "Job Listing | SearchTern" : "Job Not Found | SearchTern",
        description: "Browse active software engineering internships and new-grad roles tracked by SearchTern.",
        path: `/jobs/${id}`,
    })

    if (loading) {
        return <section className="feature"><p className="home-empty">Loading...</p></section>
    }

    if (notFound || !job) {
        return (
            <section className="feature" style={{ textAlign: 'center', padding: '60px 30px' }}>
                <Text fw={800} size="xl" mb={8}>Job Not Found</Text>
                <Text c="dimmed" size="sm" mb={24}>This listing may have expired or the link is wrong.</Text>
                <Link to="/jobs" className="home-card-link">Browse all internships →</Link>
            </section>
        )
    }

    return (
        <section className="feature" style={{ padding: '40px 44px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Link to="/jobs" className="home-card-link">← Back to all internships</Link>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {listingCount !== null && (
                        <Badge color="green" variant="transparent" size="lg" tt="none">{listingCount.toLocaleString()}+ internships</Badge>
                    )}
                    {(() => {
                        const parsed = parseFloat(String(job.date))
                        return !isNaN(parsed) && parsed >= STALE_DAYS
                    })() && <Badge color="gray" variant="light" size="lg">Likely filled</Badge>}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '6px 0 14px' }}>
                <img
                    src={`https://www.google.com/s2/favicons?domain=${job.company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.com&sz=64`}
                    style={{ width: '28px', height: '28px', borderRadius: '4px' }}
                    onError={(e) => e.currentTarget.style.display = 'none'}
                    alt=""
                />
                <Text fw={800} size="lg" c="var(--text-dark)">{job.company}</Text>
                {meta?.faang && <Badge color="green" variant="light" size="sm">FAANG+</Badge>}
            </div>
            <Text fw={700} size="2.2rem" c="var(--text-dark)" lh={1.2} style={{ marginBottom: 8 }}>{job.role}</Text>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', margin: '8px 0 4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 14 }}>
                    <MapPin size={16} weight="bold" /> {job.location}
                </span>
                {formatPosted(job.date) && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 14 }}>
                        <Buildings size={16} weight="bold" /> {job.type === 'newgrad' ? 'New Grad' : 'Internship'} · Posted {formatPosted(job.date)}
                    </span>
                )}
            </div>

            <Divider my={24} />

            <Text c="var(--text-muted)" size="sm" mb={16}>
                This role is aggregated from public postings by <Link to="/" className="home-card-link" style={{ color: 'var(--primary-green)', fontWeight: 600 }}>SearchTern</Link>. Apply directly on the employer's site.
            </Text>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href={job.link} target="_blank" rel="noreferrer" className="home-card-link"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', background: 'var(--button-color)', color: '#fff', borderRadius: 6, fontWeight: 700 }}>
                    Apply on employer site <ArrowUpRight size={18} weight="bold" />
                </a>
                    <button
                        onClick={() => void (async () => {
                            try {
                                await navigator.clipboard.writeText(window.location.href)
                                notifications.show({ title: 'Share link copied', message: 'Paste it in a group chat, Slack, or your notes. Anyone can open it — no account needed.', color: 'teal', icon: <ShareNetwork size={18} weight="bold" />, autoClose: 2500 })
                            } catch {
                                notifications.show({ title: 'Copy failed', message: 'Clipboard was blocked by the browser. Copy the URL from the address bar instead.', color: 'red', icon: <ShareNetwork size={18} weight="bold" />, autoClose: 2500 })
                            }
                        })()}
                        className="home-card-link"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', background: 'transparent', color: 'var(--button-color)', borderRadius: 6, fontWeight: 700, border: '1px solid var(--button-color)', cursor: 'pointer' }}>
                        <ShareNetwork size={18} weight="bold" /> Share
                    </button>

                {user && (
                    <button
                        onClick={() => saveToTracker(job)}
                        className="home-card-link"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', background: 'transparent', color: 'var(--button-color)', borderRadius: 6, fontWeight: 700, border: '1px solid var(--button-color)', cursor: 'pointer' }}>
                        <BookmarkSimple size={18} weight={isJobTracked(job.company, job.role, job.location ?? '') ? 'fill' : 'regular'} /> {isJobTracked(job.company, job.role, job.location ?? '') ? 'In tracker' : 'Save to tracker'}
                    </button>
                )}
                {(user || hasResume) && (
                    <button
                        onClick={() => void copyResume()}
                        className="home-card-link"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', background: 'transparent', color: 'var(--button-color)', borderRadius: 6, fontWeight: 700, border: '1px solid var(--button-color)', cursor: 'pointer' }}>
                        <Copy size={18} weight="bold" /> Copy resume text
                    </button>
                )}
            </div>

            {!user && (
                <div style={{ marginTop: 28, padding: 18, border: '1px solid var(--primary-green)', borderRadius: 8, background: 'color-mix(in srgb, var(--primary-green) 6%, transparent)', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <Text fw={700} size="md" c="var(--text-dark)" mb={4} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BookmarkSimple size={18} weight="fill" color="var(--primary-green)" /> Apply once, track everywhere
                        </Text>
                        <Text c="var(--text-muted)" size="sm" m={0}>
                            Save this job free, then move it Applied → Interview → Offer as you go. Never lose a link in the hunt.
                        </Text>
                    </div>
                    <Link to="/auth?tab=signup" className="home-card-link"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--primary-green)', color: '#fff', borderRadius: 6, fontWeight: 700, textDecoration: 'none' }}>
                        Create free account · 10 seconds
                    </Link>
                </div>
            )}

            <div className="job-detail-panels">
                {siblings.length > 0 && (
                    <div className="job-detail-panel job-detail-panel-wide">
                        <div className="job-detail-panel-title"><Buildings size={18} weight="bold" /> More roles at {job.company}</div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                            {siblings.map(s => (
                                <li key={s.id}>
                                    <Link to={`/jobs/${s.id}`} className="home-card-link">{s.role} · {s.location}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    )
}

export default JobDetail