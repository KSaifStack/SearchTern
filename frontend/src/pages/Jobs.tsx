import { useState, useEffect, useRef, useMemo } from "react"
import { Link } from "react-router-dom"
import { Pagination, Popover, Text, Select, Badge, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { checkHealth, fetchSources } from "../api/internships"
import { BookmarkSimpleIcon, FunnelSimple, CaretLeft, CaretRight, ArrowSquareOut, ListBullets, SquaresFour, MapPin, Clock, Briefcase, Tag, CurrencyDollar, SparkleIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import "../styles/Table.css"
import { getRecent, clearCache, getSecondsUntilNextHour } from "../services/internshipmanager"
import { useTracker } from "../components/TrackerContext"
import { useAuth } from "../components/AuthContext"
import { makeJobFingerprint } from "../utils/jobFingerprint"
import {
  loadLocalJobFilters, saveLocalJobFilters, accountJobFilters, saveAccountJobFilters, sameJobFilters,
} from "../utils/jobFilterPrefs"
import type { JobFilterPrefs } from "../utils/jobFilterPrefs"
import { parseLocation, US_STATES, trimLocations } from "../utils/locationFilter"
import type { ParsedLocation } from "../utils/locationFilter"
import { matchCompanyMeta, EMPLOYEE_BUCKETS, inEmployeeBucket } from "../utils/companyMeta"
import { CompanyFavicon } from "../components/CompanyFavicon"
import { estimateSalary } from "../utils/salaryEstimate"
import { rankJobs } from "../utils/forYou"
import { useForYou } from "../components/ForYouContext"
import ForYouDrawer from "../components/ForYouDrawer"
import type { FeedJob } from "../components/ForYouDrawer"

interface Job {
  id: number
  company: string
  role: string
  location: string
  date: string
  link: string
  type?: string
  season?: string
  category?: string
  visa_sponsor?: boolean
  has_overview?: boolean
}

const STALE_DAYS = 21
const RECENCY_OPTIONS = [
  { days: 0, label: 'Any time' },
  { days: 7, label: 'Past 7 days' },
  { days: 14, label: 'Past 14 days' },
  { days: 30, label: 'Past 30 days' },
]

// Explorer-style layouts. Tiles trade density for detail, so each view carries
// its own page size: the compact list shows more listings per page.
type ViewMode = 'tiles' | 'list'
const VIEW_MODES: { value: ViewMode; label: string; hint: string; perPage: number; icon: Icon }[] = [
  { value: 'tiles', label: 'Tiles', hint: 'Full details, 24 per page', perPage: 24, icon: SquaresFour },
  { value: 'list', label: 'List', hint: 'Compact, 60 per page', perPage: 60, icon: ListBullets },
]
const VIEW_STORAGE_KEY = 'searchtern-jobs-view'

function readStoredView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY)
    if (VIEW_MODES.some(m => m.value === v)) return v as ViewMode
  } catch {
    // Blocked storage: fall through to the default layout.
  }
  return 'tiles'
}

function formatSeason(season?: string): string | null {
  if (!season || season === 'searchtern') return null
  if (season === 'offseason') return 'Off-season'
  return /^\d{4}$/.test(season) ? `Summer ${season}` : season
}


const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'company-az', label: 'Company A-Z' },
  { value: 'company-za', label: 'Company Z-A' },
]



function daysAgo(date: string | number): number {
  const parsed = parseFloat(String(date))
  return isNaN(parsed) ? 999 : parsed
}
function isStale(j: Job): boolean {
  return daysAgo(j.date) >= STALE_DAYS
}
function jobKey(c: string, r: string, l: string): string {
  return [c, r, l].map(s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()).join('|')
}

function Jobs() {
  const [allJobs, setAllJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const { addJob, removeJob, isJobTracked } = useTracker()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [healthStatus, setHealthStatus] = useState<any>(null)
  const [sources, setSources] = useState<{ name: string; type: string; season: string; count?: number; url?: string }[]>([])
  const [popoverOpened, setPopoverOpened] = useState(false)
  const [sourcePage, setSourcePage] = useState(1)
  const [refreshCountdown, setRefreshCountdown] = useState(() => getSecondsUntilNextHour())
  const debounceRef = useRef<number | undefined>(undefined)
  const [searchText, setSearchText] = useState('')
  const [sortOpen, setSortOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [forYouOpen, setForYouOpen] = useState(false)

  // For You lives here instead of its own page: the same ranking the daily
  // email uses, surfaced over the listings the user is already looking at.
  const { profile: forYouProfile } = useForYou()
  const forYouMatches = useMemo(
    () => (forYouProfile ? rankJobs(allJobs as FeedJob[], forYouProfile, 200) : []),
    [allJobs, forYouProfile]
  )

  // Filter/sort settings are remembered: this browser's copy seeds the first
  // render, and a signed-in user's account copy replaces it (see below).
  const { user } = useAuth()
  const [initialFilters] = useState(loadLocalJobFilters)
  const [sortOrder, setSortOrder] = useState(initialFilters.sortOrder)
  const [categoryFilters, setCategoryFilters] = useState<string[]>(initialFilters.categoryFilters)
  const [typeFilters, setTypeFilters] = useState(initialFilters.typeFilters)
  const [countryFilter, setCountryFilter] = useState(initialFilters.countryFilter)
  const [stateFilter, setStateFilter] = useState(initialFilters.stateFilter)
  const [faangOnly, setFaangOnly] = useState(initialFilters.faangOnly)
  const [visaSponsorOnly, setVisaSponsorOnly] = useState(initialFilters.visaSponsorOnly)
  const [employeeBucket, setEmployeeBucket] = useState<string>(initialFilters.employeeBucket)
  const [recencyDays, setRecencyDays] = useState(initialFilters.recencyDays)
  const [hideStale, setHideStale] = useState(initialFilters.hideStale)

  // Key order matches JobFilterPrefs so sameJobFilters' JSON compare is stable.
  const filterPrefs = useMemo<JobFilterPrefs>(() => ({
    sortOrder, categoryFilters, typeFilters, countryFilter, stateFilter,
    faangOnly, visaSponsorOnly, employeeBucket, recencyDays, hideStale,
  }), [sortOrder, categoryFilters, typeFilters, countryFilter, stateFilter, faangOnly, visaSponsorOnly, employeeBucket, recencyDays, hideStale])

  // On sign-in, the account's saved settings win over this browser's. Done
  // during render (not in an effect) so the first committed render already
  // shows them and the save effect below never sees the stale local copy.
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null)
  const currentUserId = user?.id ?? null
  if (currentUserId !== hydratedUserId) {
    setHydratedUserId(currentUserId)
    const saved = user ? accountJobFilters(user) : null
    if (saved) {
      setSortOrder(saved.sortOrder)
      setCategoryFilters(saved.categoryFilters)
      setTypeFilters(saved.typeFilters)
      setCountryFilter(saved.countryFilter)
      setStateFilter(saved.stateFilter)
      setFaangOnly(saved.faangOnly)
      setVisaSponsorOnly(saved.visaSponsorOnly)
      setEmployeeBucket(saved.employeeBucket)
      setRecencyDays(saved.recencyDays)
      setHideStale(saved.hideStale)
      setPage(1)
    }
  }

  useEffect(() => { saveLocalJobFilters(filterPrefs) }, [filterPrefs])

  // Account copy: debounced so clicking through several checkboxes is one
  // request. If they navigate away mid-debounce, flush it on unmount.
  const pendingAccountSave = useRef<JobFilterPrefs | null>(null)
  useEffect(() => {
    pendingAccountSave.current = null
    if (!user || sameJobFilters(accountJobFilters(user), filterPrefs)) return
    pendingAccountSave.current = filterPrefs
    const t = window.setTimeout(() => {
      pendingAccountSave.current = null
      void saveAccountJobFilters(filterPrefs)
    }, 800)
    return () => clearTimeout(t)
  }, [user, filterPrefs])
  useEffect(() => () => {
    if (pendingAccountSave.current) void saveAccountJobFilters(pendingAccountSave.current)
  }, [])

  const [viewMode, setViewMode] = useState<ViewMode>(readStoredView)
  const activeView = VIEW_MODES.find(m => m.value === viewMode) ?? VIEW_MODES[0]
  const perPage = activeView.perPage

  // Keep the first listing on screen visible across a layout change instead of
  // jumping back to page 1 (or past the end, since page sizes differ).
  function changeView(next: ViewMode) {
    const nextPer = VIEW_MODES.find(m => m.value === next)!.perPage
    const firstIndex = (page - 1) * perPage
    setViewMode(next)
    setPage(Math.floor(firstIndex / nextPer) + 1)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      // Preference just won't survive the session.
    }
  }

  useEffect(() => {
    getRecent().then(res => {
      if (res.success) setAllJobs(res.data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getSecondsUntilNextHour()
      if (remaining >= 3599) {
        clearCache()
        getRecent().then(res => {
          if (res.success) setAllJobs(res.data)
        })
      }
      setRefreshCountdown(remaining)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const parsedLocations = useMemo(() => {
    const map = new Map<number, ParsedLocation>()
    for (const j of allJobs) map.set(j.id, parseLocation(j.location))
    return map
  }, [allJobs])

  const freshness = useMemo(() => {
    const counts = new Map<string, number>()
    for (const j of allJobs) {
      const k = jobKey(j.company, j.role, j.location)
      counts.set(k, (counts.get(k) || 0) + 1)
    }
    return counts
  }, [allJobs])

  const countryOptions = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const parsed of parsedLocations.values()) {
      for (const c of parsed.countries) counts[c] = (counts[c] || 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [parsedLocations])

  const stateOptions = useMemo(() => {
    if (countryFilter !== 'United States') return []
    const counts: Record<string, number> = {}
    for (const parsed of parsedLocations.values()) {
      for (const s of parsed.states) counts[s] = (counts[s] || 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([abbr]) => abbr)
  }, [parsedLocations, countryFilter])

  // Older API builds don't ship visa_sponsor at all, and filtering on the
  // missing field silently returns zero rows for every query. The active flag
  // is derived rather than reset in an effect, so the checkbox and the results
  // agree within the same render and nothing cascades.
  const visaSponsorDataMissing = !loading && allJobs.length > 0 &&
    !allJobs.some(job => typeof job.visa_sponsor === 'boolean')
  const visaSponsorActive = visaSponsorOnly && !visaSponsorDataMissing

  const categoryOptions = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const j of allJobs) {
      const c = (j.category || '').trim()
      if (c) counts[c] = (counts[c] || 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
  }, [allJobs])

  // A saved role category can disappear from the feed. It would then have no
  // checkbox to untick yet still filter everything out, so once listings have
  // loaded, only categories that still exist count.
  const activeCategoryFilters = useMemo(
    () => categoryOptions.length ? categoryFilters.filter(c => categoryOptions.includes(c)) : categoryFilters,
    [categoryFilters, categoryOptions]
  )

  const filtered = useMemo(() => {
    let jobs = allJobs.filter(j => j && j.company)
    jobs = jobs.filter(j => {
      const link = (j.link ?? '').trim()
      return link.length > 0 && !/^n\/?a$/i.test(link)
    })
    if (searchText) {
      const q = searchText.toLowerCase()
      jobs = jobs.filter(j =>
        j.company.toLowerCase().includes(q) ||
        j.role.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q)
      )
    }
    if (countryFilter) jobs = jobs.filter(j => parsedLocations.get(j.id)?.countries.includes(countryFilter))
    if (stateFilter) jobs = jobs.filter(j => parsedLocations.get(j.id)?.states.includes(stateFilter))
    if (activeCategoryFilters.length) jobs = jobs.filter(j => j.category && activeCategoryFilters.includes(j.category))
    if (!typeFilters.internship) jobs = jobs.filter(j => j.type === 'newgrad')
    if (!typeFilters.newgrad) jobs = jobs.filter(j => j.type !== 'newgrad')
    // === true, not truthy: a stringified "false" must never match.
    if (visaSponsorActive) jobs = jobs.filter(j => j.visa_sponsor === true)
    if (faangOnly || employeeBucket) {
      jobs = jobs.filter(j => {
        const meta = matchCompanyMeta(j.company)
        if (!meta) return false
        if (faangOnly && !meta.faang) return false
        if (employeeBucket) {
          const bucket = EMPLOYEE_BUCKETS.find(b => b.label === employeeBucket)
          if (bucket && !inEmployeeBucket(meta.employees, bucket)) return false
        }
        return true
      })
    }
    if (hideStale) jobs = jobs.filter(j => !isStale(j))
    if (recencyDays > 0) jobs = jobs.filter(j => daysAgo(j.date) <= recencyDays)
    return [...jobs].sort((a, b) => {
      if (sortOrder === 'company-az') return a.company.localeCompare(b.company)
      if (sortOrder === 'company-za') return b.company.localeCompare(a.company)
      const aParsed = parseFloat(String(a.date))
      const bParsed = parseFloat(String(b.date))
      const aNum = isNaN(aParsed) ? 999 : aParsed
      const bNum = isNaN(bParsed) ? 999 : bParsed
      return sortOrder === 'newest' ? aNum - bNum : bNum - aNum
    })
  }, [allJobs, searchText, sortOrder, categoryFilters, typeFilters, countryFilter, stateFilter, parsedLocations, faangOnly, visaSponsorActive, employeeBucket, hideStale, recencyDays])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / perPage)), [filtered, perPage])
  const paginated = useMemo(() => filtered.slice((page - 1) * perPage, page * perPage), [filtered, page, perPage])

  const activeFilterCount =
    (recencyDays > 0 ? 1 : 0) +
    (hideStale ? 1 : 0) +
    (typeFilters.internship && typeFilters.newgrad ? 0 : 1) +
    (countryFilter ? 1 : 0) +
    (stateFilter ? 1 : 0) +
    (faangOnly ? 1 : 0) +
    (visaSponsorActive ? 1 : 0) +
    (employeeBucket ? 1 : 0)

  function clearFilters() {
    setRecencyDays(0)
    setHideStale(false)
    setTypeFilters({ internship: true, newgrad: true })
    setCountryFilter('')
    setStateFilter('')
    setFaangOnly(false)
    setVisaSponsorOnly(false)
    setEmployeeBucket('')
    setPage(1)
  }

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [totalPages, page])


  const onSearchChange = (val: string) => {
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchText(val)
      setPage(1)
    }, 200)
  }

  // A pending debounce that fires after unmount writes state to a dead component.
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const formatRelativeDate = (val: string | number) => {
    if (typeof val === 'number') return "N/A";
    const parsed = parseFloat(val);
    const days = !isNaN(parsed) ? parsed : 999;
    if (days === 999) return "N/A";
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days >= 30) {
      const months = Math.floor(days / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    }
    return `${days} days ago`;
  }

  function toggleSave(job: Job) {
    const fingerprint = makeJobFingerprint(job.company, job.role, job.location);
    if (isJobTracked(job.company, job.role, job.location)) {
      removeJob(fingerprint);
    } else {
      addJob({ company: job.company, role: job.role, location: job.location, link: job.link }, 'Saved');
      notifications.show({
        title: 'Saved',
        message: `${job.company} added to tracker`,
        color: 'teal',
        icon: <BookmarkSimpleIcon size={18} weight="fill" />,
        autoClose: 3000,
      });
    }
  }

  function renderSaveButton(job: Job, size: number) {
    const tracked = isJobTracked(job.company, job.role, job.location)
    return (
      <button
        type="button"
        className="job-card-save"
        onClick={(e) => { e.stopPropagation(); toggleSave(job) }}
        aria-pressed={tracked}
        aria-label={tracked ? `Remove ${job.company} from tracker` : `Save ${job.company} to tracker`}
        title={tracked ? 'Saved to tracker' : 'Save to tracker'}
      >
        <BookmarkSimpleIcon
          size={size}
          weight={tracked ? 'fill' : 'regular'}
          color={tracked ? 'var(--accent-color)' : 'currentColor'}
        />
      </button>
    )
  }

  function renderCardViews() {
    if (loading) return <p className="empty-state job-view-empty">Loading...</p>
    if (paginated.length === 0) return <p className="empty-state job-view-empty">No listings found!</p>

    if (viewMode === 'list') {
      return (
        <ul className="job-list">
          {paginated.map(job => (
            <li key={job.id} className="job-list-item" style={{ opacity: isStale(job) ? 0.55 : 1 }}>
              {renderSaveButton(job, 18)}
              <CompanyFavicon company={job.company} />
              <span className="job-list-main">
                <span className="job-list-company">{job.company}</span>
                <a
                  href={job.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="apply-link job-list-role"
                  title={`${job.role} — apply at ${job.company}`}
                >
                  {job.role}
                </a>
              </span>
              <span className="job-list-date">{formatRelativeDate(job.date)}</span>
            </li>
          ))}
        </ul>
      )
    }

    return (
      <div className="job-grid">
        {paginated.map(job => {
          const stale = isStale(job)
          const repost = (freshness.get(jobKey(job.company, job.role, job.location)) || 0) > 1
          const meta = matchCompanyMeta(job.company)
          const season = formatSeason(job.season)
          const typeLabel = job.type === 'newgrad' ? 'New Grad' : 'Internship'
          const salary = estimateSalary({
            category: job.category,
            type: job.type,
            topTier: meta?.faang === true,
            inUS: parsedLocations.get(job.id)?.countries.includes('United States') === true,
          })
          return (
            <article key={job.id} className="job-card" style={{ opacity: stale ? 0.6 : 1 }}>
              {/* A <div>, not a <header>: index.css styles every <header> as the
                  site nav bar (fill, shadow, 0 20px padding), which painted a
                  floating rectangle around the company, role row and bookmark. */}
              <div className="job-card-header">
                <CompanyFavicon company={job.company} />
                <span className="job-card-company" title={job.company}>{job.company}</span>
                {renderSaveButton(job, 20)}
              </div>

              <a
                href={job.link}
                target="_blank"
                rel="noopener noreferrer"
                className="apply-link job-card-role"
                title={`Apply at ${job.company} — opens the employer's site`}
              >
                {job.role}
              </a>

              {/* Only render the pay pill when there is a figure to show. */}
              {salary && (
                <span className="job-card-salary" title={salary.explanation}>
                  <CurrencyDollar size={14} weight="bold" aria-hidden="true" />
                  {salary.label}
                  <span className="visually-hidden-text"> ({salary.explanation})</span>
                </span>
              )}

              <ul className="job-card-facts">
                <li title={job.location}>
                  <MapPin size={14} weight="bold" aria-hidden="true" />
                  <span className="job-card-fact-text">{trimLocations(job.location) || 'Location not listed'}</span>
                </li>
                <li>
                  <Clock size={14} weight="bold" aria-hidden="true" />
                  <span className="job-card-fact-text">
                    {formatRelativeDate(job.date) === 'N/A' ? 'Post date unknown' : `Posted ${formatRelativeDate(job.date).toLowerCase()}`}
                  </span>
                </li>
                <li>
                  <Briefcase size={14} weight="bold" aria-hidden="true" />
                  <span className="job-card-fact-text">{typeLabel}{season ? ` · ${season}` : ''}</span>
                </li>
                {job.category && (
                  <li>
                    <Tag size={14} weight="bold" aria-hidden="true" />
                    <span className="job-card-fact-text">{job.category}</span>
                  </li>
                )}
              </ul>

              {(stale || repost || job.visa_sponsor === true || meta?.faang) && (
                <div className="job-card-badges">
                  {job.visa_sponsor === true && <Badge size="xs" variant="light" color="teal">H-1B sponsor</Badge>}
                  {meta?.faang && <Badge size="xs" variant="light" color="blue">FAANG+</Badge>}
                  {repost && <Badge size="xs" variant="light" color="yellow">Reposted</Badge>}
                  {stale && <Badge size="xs" variant="light" color="gray">Likely filled</Badge>}
                </div>
              )}

              <footer className="job-card-footer">
                <a href={job.link} target="_blank" rel="noreferrer" className="inline-job-detail-apply">
                  Apply <ArrowSquareOut size={14} weight="bold" />
                </a>
                <Link to={`/jobs/${job.id}`} className="inline-job-detail-link">
                  {job.has_overview ? 'View overview →' : 'View listing →'}
                </Link>
              </footer>
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <section className="feature">
        <div className="jobs-status-row">
          <div className="jobs-status-summary">
            <p className="result-count" style={{ margin: 0 }}>Refreshes in: {String(Math.floor(refreshCountdown / 60)).padStart(2, '0')}:{String(refreshCountdown % 60).padStart(2, '0')}</p>
            <p className="result-count jobs-mobile-result-count">
              {loading ? 'Loading...' : `${filtered.length.toLocaleString()} listings found`}
            </p>
          </div>
          <Popover width={280} position="bottom-start" withArrow shadow="md" opened={popoverOpened} onChange={setPopoverOpened} classNames={{ dropdown: 'health-popover' }}>
            <Popover.Target>
              <button className="health_btn" onClick={() => {
                if (!popoverOpened) {
                  checkHealth().then(setHealthStatus)
                  fetchSources().then(s => { setSources(s); setSourcePage(1) })
                }
                setPopoverOpened((o) => !o)
              }}>...</button>
            </Popover.Target>
            <Popover.Dropdown>
              {healthStatus ? (
                <>
                  <Text size="xs">Status: <span style={{ color: healthStatus.status === 'Active' ? 'green' : 'red' }}>{healthStatus.status}</span></Text>
                  <Text size="xs">Next Update: {healthStatus.next_scrape !== 'unknown' ? new Date(healthStatus.next_scrape.replace(' ', 'T')).toLocaleDateString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true }) : 'Unknown'}</Text>
                  <Text size="xs" mt={5} c="dimmed">Data Sources ({sources.length || '—'}):</Text>
                  {sources.length > 0 ? (
                    <div style={{ marginTop: 4 }}>
                      {sources.slice((sourcePage - 1) * 5, sourcePage * 5).map((s) => (
                        <Text key={s.name} size="xs" c="dimmed" style={{ paddingLeft: 8, paddingTop: 2 }}>
                          • {s.name}
                          {s.count ? <span style={{ color: 'var(--text-muted)' }}> ({s.count.toLocaleString()})</span> : null}
                          <span style={{ color: 'var(--text-muted)' }}> ({s.type}{s.season && s.season !== 'searchtern' ? ` · ${s.season}` : ''})</span>
                        </Text>
                      ))}
                      {sources.length > 5 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, marginLeft: 6 }}>
                          {sourcePage > 1 && (
                            <button
                              onClick={() => setSourcePage(p => p - 1)}
                              style={{ display: 'flex', alignItems: 'center', padding: '2px 8px', background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                            >
                              <CaretLeft size={13} weight="bold" />
                            </button>
                          )}
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {sourcePage} / {Math.ceil(sources.length / 5)}
                          </span>
                          {sourcePage * 5 < sources.length && (
                            <button
                              onClick={() => setSourcePage(p => p + 1)}
                              style={{ display: 'flex', alignItems: 'center', padding: '2px 8px', background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                            >
                              <CaretRight size={13} weight="bold" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Text size="xs" c="dimmed" style={{ paddingLeft: 8 }}>Unavailable</Text>
                  )}
                </>
              ) : (
                <Text size="xs">Loading...</Text>
              )}
            </Popover.Dropdown>
          </Popover>
        </div>

        <input
          className="search-input"
          placeholder="Search by company, role, or location..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />

        <div className="results-header">
          <p className="result-count desktop-result-count">{loading ? 'Loading...' : `${filtered.length.toLocaleString()} listings found`}</p>
          <div className="results-controls">
            <button
              className={`sort_btn foryou-btn${forYouProfile ? ' foryou-btn-on' : ''}`}
              onClick={() => setForYouOpen(true)}
              title="Internships ranked against your For You preferences"
            >
              <SparkleIcon size={16} weight="fill" />
              For You
              {forYouMatches.length > 0 && (
                <Badge size="xs" variant="filled" color="teal" className="filters-count">
                  {forYouMatches.length >= 200 ? '200+' : forYouMatches.length}
                </Badge>
              )}
            </button>

            <Popover opened={sortOpen} onChange={setSortOpen} width={180} position="bottom-end" withArrow shadow="md">
              <Popover.Target>
                <button className="sort_btn" onClick={() => setSortOpen(o => !o)}>
                  <span aria-hidden="true">⇅</span>
                  {SORT_OPTIONS.find(o => o.value === sortOrder)?.label ?? 'Newest'}
                </button>
              </Popover.Target>
              <Popover.Dropdown>
                <div className="filter-option-list">
                  {SORT_OPTIONS.map(opt => (
                    <label key={opt.value} className="filter-option">
                      <input
                        type="radio"
                        name="sort"
                        checked={sortOrder === opt.value}
                        onChange={() => { setSortOrder(opt.value); setSortOpen(false) }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </Popover.Dropdown>
            </Popover>

            <Popover opened={roleOpen} onChange={setRoleOpen} width={200} position="bottom-end" withArrow shadow="md">
              <Popover.Target>
                <button className="sort_btn" onClick={() => setRoleOpen(o => !o)} title="Filter by role category">
                  Roles
                  {activeCategoryFilters.length > 0 && (
                    <Badge size="xs" variant="filled" color="teal" className="filters-count">
                      {activeCategoryFilters.length}
                    </Badge>
                  )}
                  <span aria-hidden="true">▾</span>
                </button>
              </Popover.Target>
              <Popover.Dropdown>
                <div className="filter-option-list">
                  {categoryOptions.map(name => {
                    const checked = activeCategoryFilters.includes(name)
                    return (
                      <label key={name} className="filter-option">
                        <input
                          type="checkbox"
                          name="role"
                          checked={checked}
                          onChange={() => { setCategoryFilters(checked ? activeCategoryFilters.filter(x => x !== name) : [...activeCategoryFilters, name]); setPage(1) }}
                        />
                        {name}
                      </label>
                    )
                  })}
                </div>
              </Popover.Dropdown>
            </Popover>

            <Popover opened={filtersOpen} onChange={setFiltersOpen} width={300} position="bottom-end" withArrow shadow="md">
              <Popover.Target>
                <button className="sort_btn" onClick={() => setFiltersOpen(o => !o)}>
                  <FunnelSimple size={16} weight="bold" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge size="xs" variant="filled" color="teal" className="filters-count">
                      {activeFilterCount}
                    </Badge>
                  )}
                </button>
              </Popover.Target>
              <Popover.Dropdown>
                <div className="filters-panel">
                  <div className="filters-section">
                    <span className="filters-section-label">Date posted</span>
                    <div className="filter-option-list">
                      {RECENCY_OPTIONS.map(opt => (
                        <label key={opt.days} className="filter-option">
                          <input
                            type="radio"
                            name="recency"
                            checked={recencyDays === opt.days}
                            onChange={() => { setRecencyDays(opt.days); setPage(1) }}
                          />
                          {opt.label}
                        </label>
                      ))}
                      <label className="filter-option">
                        <input
                          type="checkbox"
                          checked={hideStale}
                          onChange={() => {
                            setHideStale(!hideStale)
                            setPage(1)
                          }}
                        />
                        Hide likely-filled ({STALE_DAYS}+ days)
                      </label>
                    </div>
                  </div>

                  <div className="filters-section">
                    <span className="filters-section-label">Type</span>
                    {[
                      { key: 'internship' as const, label: 'Internship' },
                      { key: 'newgrad' as const, label: 'New Grad' },
                    ].map(t => (
                      <label key={t.key} className="filter-option">
                        <input
                          type="checkbox"
                          checked={typeFilters[t.key]}
                          onChange={() => {
                            setTypeFilters(prev => ({ ...prev, [t.key]: !prev[t.key] }))
                            setPage(1)
                          }}
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>

                  <div className="filters-section">
                    <span className="filters-section-label">Location</span>
                    <Select
                      placeholder="All countries"
                      size="xs"
                      searchable
                      clearable
                      data={countryOptions.map(o => ({ value: o.name, label: `${o.name} (${o.count})` }))}
                      value={countryFilter || null}
                      onChange={val => { setCountryFilter(val || ''); setStateFilter(''); setPage(1) }}
                      maxDropdownHeight={220}
                      comboboxProps={{ withinPortal: false }}
                    />
                    {countryFilter === 'United States' && (
                      <Select
                        placeholder="All states"
                        size="xs"
                        searchable
                        clearable
                        data={stateOptions.map(s => ({ value: s, label: `${US_STATES[s] || s} (${s})` }))}
                        value={stateFilter || null}
                        onChange={val => { setStateFilter(val || ''); setPage(1) }}
                        maxDropdownHeight={220}
                        comboboxProps={{ withinPortal: false }}
                      />
                    )}
                  </div>

                  <div className="filters-section">
                    <span className="filters-section-label">Company</span>
                    <label className="filter-option">
                      <input
                        type="checkbox"
                        checked={faangOnly}
                        onChange={() => { setFaangOnly(!faangOnly); setPage(1) }}
                      />
                      FAANG+ only
                    </label>
                    <label className="filter-option">
                      <input
                        type="checkbox"
                        checked={visaSponsorActive}
                        disabled={visaSponsorDataMissing}
                        onChange={() => { setVisaSponsorOnly(!visaSponsorOnly); setPage(1) }}
                      />
                      H-1B sponsor history
                    </label>
                    {visaSponsorDataMissing && (
                      <span role="status" className="filter-note">
                        Sponsorship data isn't in this listings feed, so this filter is unavailable right now.
                      </span>
                    )}
                    <Select
                      placeholder="Any size"
                      size="xs"
                      clearable
                      data={EMPLOYEE_BUCKETS.map(b => ({ value: b.label, label: b.label }))}
                      value={employeeBucket || null}
                      onChange={val => { setEmployeeBucket(val || ''); setPage(1) }}
                      maxDropdownHeight={220}
                      comboboxProps={{ withinPortal: false }}
                    />
                  </div>

                  {activeFilterCount > 0 && (
                    <button className="btn-clear" onClick={clearFilters}>
                      Clear all filters
                    </button>
                  )}
                </div>
              </Popover.Dropdown>
            </Popover>

            <div className="view-toggle" role="radiogroup" aria-label="Listing layout">
              {VIEW_MODES.map(mode => {
                const isActive = viewMode === mode.value
                return (
                  <Tooltip
                    key={mode.value}
                    label={`${mode.label} — ${mode.hint}`}
                    position="bottom"
                    withArrow
                    openDelay={120}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={`${mode.label} — ${mode.hint}`}
                      className={`sort_btn view_toggle_btn${isActive ? ' view_toggle_btn-active' : ''}`}
                      onClick={() => changeView(mode.value)}
                    >
                      <mode.icon size={18} weight={isActive ? 'fill' : 'regular'} />
                    </button>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        </div>
        {renderCardViews()}

        <Pagination
          total={totalPages}
          value={Math.min(page, totalPages)}
          onChange={setPage}
          mt="md"
        />
      </section>

      <ForYouDrawer
        opened={forYouOpen}
        onClose={() => setForYouOpen(false)}
        matches={forYouMatches}
        loading={loading}
      />
    </>
  )
}

export default Jobs
