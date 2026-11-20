import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Drawer, NumberInput, Switch } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  BookmarkSimpleIcon, CheckIcon, EnvelopeSimpleIcon, PencilSimpleIcon, SparkleIcon, WarningCircleIcon,
} from '@phosphor-icons/react'
import { useAuth } from './AuthContext'
import { useForYou } from './ForYouContext'
import { useTracker } from './TrackerContext'
import { CompanyFavicon } from './CompanyFavicon'
import { trimLocations } from '../utils/locationFilter'
import {
  clampDailyCount, DAILY_COUNT_MAX, DAILY_COUNT_MIN, JOB_TYPE_OPTIONS, ROLE_OPTIONS, WORK_AUTH_OPTIONS,
} from '../utils/forYou'
import type { Match, MatchableJob } from '../utils/forYou'
import '../styles/ForYou.css'

/** A listings row: the tracker's Job plus the id/link the match list links to. */
export interface FeedJob extends MatchableJob {
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

/** Mirrors backend/foryou.py's render_email: the user's top `count` matches. */
function EmailPreview({ matches, count, to }: { matches: Match<FeedJob>[]; count: number; to: string }) {
  const picked = matches.slice(0, count)
  if (!picked.length) return <p className="fy-muted">No match to send yet. Your next email goes out when one appears.</p>
  const subject = picked.length === 1
    ? `Your SearchTern match today: ${picked[0].job.company}`
    : `${picked.length} new SearchTern matches for you`
  return (
    <div className="fy-email">
      <div className="fy-email-meta">
        <span><b>To:</b> {to}</span>
        <span><b>Subject:</b> {subject}</span>
      </div>
      <div className="fy-email-body">
        <div className="fy-email-brand">Search<span>Tern</span></div>
        <p>{picked.length === 1 ? "Here's today's best match for you:" : `Here are your top ${picked.length} matches today:`}</p>
        {picked.map(({ job, reasons }) => (
          <div className="fy-email-job" key={`${job.id}-${job.link}`}>
            <div className="fy-email-company">{job.company}</div>
            <div>{job.role}</div>
            <div className="fy-muted">{trimLocations(job.location)}</div>
            <div className="fy-email-why">Why: {reasons.join(' · ')}</div>
            <span className="fy-email-btn">View &amp; apply</span>
          </div>
        ))}
        <p className="fy-email-foot">You're getting this because you turned on daily matches. Unsubscribe</p>
      </div>
    </div>
  )
}

interface Props {
  opened: boolean
  onClose: () => void
  /** Listings already ranked against the profile, best first. */
  matches: Match<FeedJob>[]
  loading: boolean
}

export default function ForYouDrawer({ opened, onClose, matches, loading }: Props) {
  const { user } = useAuth()
  const { actorId, profile, saveProfile, openOnboarding } = useForYou()
  const { addJob, isJobTracked } = useTracker()
  const [shown, setShown] = useState(PAGE)
  const [digestBusy, setDigestBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const toggleDigest = async (on: boolean) => {
    if (!profile) return
    setDigestBusy(true)
    const res = await saveProfile({ ...profile, digestOptIn: on })
    setDigestBusy(false)
    if (!res.ok) {
      notifications.show({ title: 'Could not update email setting', message: res.error, color: 'red', icon: <WarningCircleIcon size={18} /> })
    }
  }

  const setDailyCount = async (v: number | string) => {
    if (!profile) return
    const n = clampDailyCount(v)
    if (n === profile.dailyCount) return
    setDigestBusy(true)
    const res = await saveProfile({ ...profile, dailyCount: n })
    setDigestBusy(false)
    if (!res.ok) {
      notifications.show({ title: 'Could not save matches per email', message: res.error, color: 'red', icon: <WarningCircleIcon size={18} /> })
    }
  }

  const roleLabels = profile?.roles.map(r => ROLE_OPTIONS.find(o => o.value === r)?.label).filter(Boolean) ?? []
  const typeLabels = profile?.jobTypes.map(t => JOB_TYPE_OPTIONS.find(o => o.value === t)?.label).filter(Boolean) ?? []
  const profileLine = profile ? [
    profile.college && `${profile.college}${profile.gradMonth ? ` · ${gradLabel(profile.gradMonth)}` : ''}`,
    roleLabels.join(', '),
    typeLabels.join(', '),
    [...profile.metros, ...(profile.remoteOk ? ['Remote'] : [])].join(', '),
    WORK_AUTH_OPTIONS.find(o => o.value === profile.workAuth)?.label,
  ].filter(Boolean).join(' · ') : ''
  const digestTo = user?.email ?? profile?.email ?? ''

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(460px, 100%)"
      title={<span className="fy-drawer-title"><SparkleIcon size={18} weight="fill" /> For You</span>}
      classNames={{ content: 'fy-drawer', header: 'fy-drawer-header', body: 'fy-drawer-body' }}
    >
      {!actorId ? (
        <div className="fy-none">
          <p>Create a free account and we'll match internships and new-grad roles to your school, grad date and interests.</p>
          <Button component={Link} to="/auth?tab=signup" size="xs">Create an account</Button>
        </div>
      ) : !profile ? (
        <div className="fy-none">
          <p>Answer a few questions and every listing here gets ranked against them.</p>
          <Button size="xs" onClick={openOnboarding}>Set up your feed</Button>
        </div>
      ) : (
        <>
          <div className="fy-drawer-top">
            <p className="fy-summary" title={profileLine}>{profileLine}</p>
            <Button
              variant="default"
              size="compact-xs"
              leftSection={<PencilSimpleIcon size={14} />}
              onClick={openOnboarding}
              aria-label="Edit your For You preferences"
            >
              Edit
            </Button>
          </div>

          <div className="fy-tools">
            <div className="fy-tools-row">
              <EnvelopeSimpleIcon size={16} weight="bold" className="fy-tools-icon" aria-hidden="true" />
              <Switch
                size="xs"
                checked={profile.digestOptIn}
                disabled={digestBusy}
                onChange={e => toggleDigest(e.currentTarget.checked)}
                aria-label="Daily match email"
                label={profile.digestOptIn ? 'Daily email on' : 'Daily email off'}
              />
              {profile.digestOptIn && (
                <span className="fy-daily-count">
                  <NumberInput
                    size="xs"
                    w={62}
                    min={DAILY_COUNT_MIN}
                    max={DAILY_COUNT_MAX}
                    allowDecimal={false}
                    clampBehavior="strict"
                    value={profile.dailyCount}
                    onChange={setDailyCount}
                    disabled={digestBusy}
                    aria-label="Matches per daily email"
                  />
                  <span className="fy-muted">matches a day</span>
                </span>
              )}
              <button className="fy-link-btn" onClick={() => setPreviewOpen(o => !o)}>
                {previewOpen ? 'Hide preview' : "Preview today's email"}
              </button>
            </div>
          </div>

          {previewOpen && <EmailPreview matches={matches} count={profile.dailyCount} to={digestTo} />}

          <p className="fy-muted fy-drawer-count">
            {loading ? 'Finding matches…' : `${matches.length.toLocaleString()}${matches.length === 200 ? '+' : ''} of ${'the latest'} listings match your profile, best first.`}
          </p>

          {loading ? (
            <p className="fy-muted fy-loading">Loading listings…</p>
          ) : matches.length === 0 ? (
            <div className="fy-none">
              <p>No current listings match every preference.</p>
              <p className="fy-muted">Try adding a location, allowing remote, or picking more role types.</p>
              <Button variant="light" size="xs" onClick={openOnboarding}>Adjust preferences</Button>
            </div>
          ) : (
            <>
              {matches.slice(0, shown).map(({ job, reasons }) => {
                const tracked = isJobTracked(job.company, job.role, job.location)
                return (
                  <article key={`${job.id}-${job.link}`} className="fy-row">
                    <CompanyFavicon company={job.company} size={28} />
                    <div className="fy-row-main">
                      <Link to={`/jobs/${job.id}`} className="fy-row-company" onClick={onClose}>{job.company}</Link>
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
                        size="compact-xs"
                        variant={tracked ? 'light' : 'default'}
                        leftSection={tracked ? <CheckIcon size={12} /> : <BookmarkSimpleIcon size={12} />}
                        disabled={tracked}
                        onClick={() => addJob({ company: job.company, role: job.role, location: job.location, link: job.link }, 'Saved')}
                      >
                        {tracked ? 'Saved' : 'Save'}
                      </Button>
                      <Button size="compact-xs" component="a" href={job.link} target="_blank" rel="noreferrer">Apply</Button>
                    </div>
                  </article>
                )
              })}
              {shown < matches.length && (
                <Button variant="subtle" fullWidth mt="sm" size="xs" onClick={() => setShown(s => s + PAGE)}>
                  Show more matches
                </Button>
              )}
            </>
          )}
        </>
      )}
    </Drawer>
  )
}
