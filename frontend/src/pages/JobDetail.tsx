import { useEffect, useRef, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { Text, Badge, Divider } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { ArrowUpRight, Buildings, MapPin, Copy, BookmarkSimple } from "@phosphor-icons/react"
import { pullJob, pullCount } from "../api/internships"
import { usePageMeta } from "../utils/seo"
import { useAuth } from "../components/AuthContext"
import { activeResumeText, getLocalResumes } from "../services/resumeStorage"
import "../styles/Home.css"

interface Job {
    id: number
    company: string
    role: string
    location: string
    date: string
    link: string
    type?: string
    season?: string
}

const STALE_DAYS = 21

function formatPosted(dateValue: string | number): string {
    const parsed = parseFloat(String(dateValue))
    if (isNaN(parsed)) return ""
    if (parsed === 0) return "Today"
    if (parsed === 1) return "Yesterday"
    return `${Math.floor(parsed)} days ago`
}

function JobDetail() {
    const { id } = useParams()
    const [job, setJob] = useState<Job | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const fetchToken = useRef(0)
    const { user } = useAuth()
    const [hasResume, setHasResume] = useState(false)
    const [listingCount, setListingCount] = useState<number | null>(null)

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
            } else {
                setNotFound(true)
            }
            setLoading(false)
        })
    }, [id])

    usePageMeta(job ? {
        title: `${job.role} at ${job.company} | SearchTern`,
        description: `${job.role} internship or new-grad role at ${job.company} — ${job.location || 'remote/US'}. Tracked in SearchTern's internship tracker.`,
        path: `/jobs/${job.id}`,
        jsonLd: {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            title: job.role,
            hiringOrganization: { "@type": "Organization", name: job.company },
            jobLocation: {
                "@type": "Place",
                address: { "@type": "PostalAddress", addressLocality: job.location },
            },
            directApply: true,
            employmentType: job.type === 'newgrad' ? "FULL_TIME" : job.type === 'internship' ? "INTERN" : undefined,
            datePosted: undefined,
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

            <Text fw={800} size="lg" c="var(--text-dark)">{job.company}</Text>
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
        </section>
    )
}

export default JobDetail