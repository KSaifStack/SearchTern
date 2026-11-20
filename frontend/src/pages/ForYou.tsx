import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Switch } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  BookmarkSimpleIcon, CheckIcon, EnvelopeSimpleIcon, PencilSimpleIcon, SparkleIcon, WarningCircleIcon,
} from '@phosphor-icons/react'
import { getRecent } from '../services/internshipmanager'
import { useTracker } from '../components/TrackerContext'
import { useForYou } from '../components/ForYouContext'
import { useAuth } from '../components/AuthContext'
import { CompanyFavicon } from '../components/CompanyFavicon'
import { trimLocations } from '../utils/locationFilter'
import { JOB_TYPE_OPTIONS, ROLE_OPTIONS, WORK_AUTH_OPTIONS, rankJobs } from '../utils/forYou'
import type { MatchableJob, Match } from '../utils/forYou'
import '../styles/ForYou.css'

interface FeedJob extends MatchableJob {
  id: number
  location: string
  link: string
}

const PAGE = 20

function gradLabel(ym: string) {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function EmailPreview({ match, to }: { match: Match<FeedJob> | undefined; to: string }) {
  if (!match) return <p className="fy-muted">No match to send yet. Your next email goes out when one appears.</p>
  const { job, reasons } = match
  return (
    <div className="fy-email">
      <div className="fy-email-meta">
        <span><b>To:</b> {to}</span>
        <span><b>Subject:</b> Your SearchTern match today: {job.company}</span>
      </div>
      <div className="fy-email-body">
        <div className="fy-email-brand">Search<span>Tern</span></div>
        <p>Here's today's best match for you:</p>
        <div className="fy-email-job">
          <div className="fy-email-company">{job.company}</div>
          <div>{job.role}</div>
          <div className="fy-muted">{trimLocations(job.location)}</div>
          <div className="fy-email-why">Why: {reasons.join(' · ')}</div>
          <span className="fy-email-btn">View &amp; apply</span>
        </div>
        <p className="fy-email-foot">You're getting this because you turned on daily matches. Unsubscribe</p>
      </div>
    </div>
  )
}

export default function ForYou() {
  const { user } = useAuth()
  const { actorId, profile, saveProfile, openOnboarding } = useForYou()
  const { addJob, isJobTracked } = useTracker()
  const [jobs, setJobs] = useState<FeedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [shown, setShown] = useState(PAGE)
  const [digestBusy, setDigestBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    getRecent().then(res => {
      if (res.success) setJobs(res.data as unknown as FeedJob[])
      setLoading(false)
    })
  }, [])

  const matches = useMemo(() => (profile ? rankJobs(jobs, profile, 200) : []), [jobs, profile])

  if (!actorId) {
    return (
      <div className="fy-empty feature">
        <SparkleIcon size={36} weight="duotone" className="fy-empty-icon" />
        <h1>Your For You feed</h1>
        <p>Create a free account, answer a few questions, and we'll curate internships and new-grad roles that fit you.</p>
        <Button component={Link} to="/auth?tab=signup">Create an account</Button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="fy-empty feature">
        <SparkleIcon size={36} weight="duotone" className="fy-empty-icon" />
        <h1>Let's set up your feed</h1>
        <p>Tell us your school, graduation date, and what you're looking for. It takes about a minute.</p>
        <Button onClick={openOnboarding}>Get started</Button>
      </div>
    )
  }

  const toggleDigest = async (on: boolean) => {
    setDigestBusy(true)
    const res = await saveProfile({ ...profile, digestOptIn: on })
    setDigestBusy(false)
    if (!res.ok) {
      notifications.show({ title: 'Could not update email setting', message: res.error, color: 'red', icon: <WarningCircleIcon size={18} /> })
    }
  }

  const roleLabels = profile.roles.map(r => ROLE_OPTIONS.find(o => o.value === r)?.label).filter(Boolean)
  const typeLabels = profile.jobTypes.map(t => JOB_TYPE_OPTIONS.find(o => o.value === t)?.label).filter(Boolean)
  const auth = WORK_AUTH_OPTIONS.find(o => o.value === profile.workAuth)?.label
  const digestTo = user?.email ?? profile.email

  return (
    <div className="fy-page">
      <div className="fy-header">
        <div>
          <h1 className="fy-title"><SparkleIcon size={26} weight="fill" /> For You</h1>
          <p className="fy-muted">
            {loading ? 'Finding matches…' : `${matches.length.toLocaleString()}${matches.length === 200 ? '+' : ''} roles match your profile, best first.`}
          </p>
        </div>
        <Button variant="default" leftSection={<PencilSimpleIcon size={16} />} onClick={openOnboarding}>Edit preferences</Button>
      </div>

      <div className="fy-grid">
        <section className="feature fy-feed">
          {loading ? (
            <p className="fy-muted">Loading listings…</p>
          ) : matches.length === 0 ? (
            <div className="fy-none">
              <p>No current listings match every preference.</p>
              <p className="fy-muted">Try adding a location, allowing remote, or picking more role types.</p>
              <Button variant="light" onClick={openOnboarding}>Adjust preferences</Button>
            </div>
          ) : (
            <>
              {matches.slice(0, shown).map(({ job, reasons }) => {
                const tracked = isJobTracked(job.company, job.role, job.location)
                return (
                  <article key={`${job.id}-${job.link}`} className="fy-row">
                    <CompanyFavicon company={job.company} size={28} />
                    <div className="fy-row-main">
                      <Link to={`/jobs/${job.id}`} className="fy-row-company">{job.company}</Link>
                      <div className="fy-row-role">{job.role}</div>
                      <div className="fy-row-loc">{trimLocations(job.location)}</div>
                      <div className="fy-row-reasons">
                        {reasons.map(r => (
                          <Badge key={r} size="xs" variant="light" color={r === 'Sponsors H-1B' ? 'teal' : 'brand'}>{r}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="fy-row-actions">
                      <Button
                        size="xs"
                        variant={tracked ? 'light' : 'default'}
                        leftSection={tracked ? <CheckIcon size={14} /> : <BookmarkSimpleIcon size={14} />}
                        disabled={tracked}
                        onClick={() => addJob({ company: job.company, role: job.role, location: job.location, link: job.link }, 'Saved')}
                      >
                        {tracked ? 'Saved' : 'Save'}
                      </Button>
                      <Button size="xs" component="a" href={job.link} target="_blank" rel="noreferrer">Apply</Button>
                    </div>
                  </article>
                )
              })}
              {shown < matches.length && (
                <Button variant="subtle" fullWidth mt="sm" onClick={() => setShown(s => s + PAGE)}>Show more matches</Button>
              )}
            </>
          )}
        </section>

        <aside className="fy-side">
          <section className="feature fy-card">
            <div className="fy-card-title"><EnvelopeSimpleIcon size={18} weight="bold" /> Daily match email</div>
            <Switch
              checked={profile.digestOptIn}
              disabled={digestBusy}
              onChange={e => toggleDigest(e.currentTarget.checked)}
              label={profile.digestOptIn ? 'On: one match a day' : 'Off'}
              description={`Sent to ${digestTo}`}
            />
            <button className="fy-link-btn" onClick={() => setPreviewOpen(o => !o)}>
              {previewOpen ? 'Hide preview' : "Preview today's email"}
            </button>
            {previewOpen && <EmailPreview match={matches[0]} to={digestTo} />}
          </section>

          <section className="feature fy-card">
            <div className="fy-card-title">Your profile</div>
            <dl className="fy-profile">
              <dt>School</dt><dd>{profile.college}{profile.gradMonth && ` · ${gradLabel(profile.gradMonth)}`}</dd>
              <dt>Roles</dt><dd>{roleLabels.join(', ') || '—'}</dd>
              <dt>Type</dt><dd>{typeLabels.join(', ') || '—'}</dd>
              <dt>Locations</dt><dd>{[...profile.metros, ...(profile.remoteOk ? ['Remote'] : [])].join(', ') || '—'}</dd>
              <dt>Work auth</dt><dd>{auth ?? '—'}</dd>
              <dt>Resume</dt><dd>{profile.resumeName ? <Link to="/settings">{profile.resumeName}</Link> : '—'}</dd>
              <dt>Contact</dt><dd>{[profile.email, profile.phone].filter(Boolean).join(' · ')}</dd>
              {(profile.linkedin || profile.links.length > 0) && (
                <>
                  <dt>Links</dt>
                  <dd className="fy-links">
                    {[profile.linkedin, ...profile.links].filter(Boolean).map(l => (
                      <a key={l} href={/^https?:\/\//.test(l) ? l : `https://${l}`} target="_blank" rel="noreferrer">{l.replace(/^https?:\/\/(www\.)?/, '')}</a>
                    ))}
                  </dd>
                </>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}
