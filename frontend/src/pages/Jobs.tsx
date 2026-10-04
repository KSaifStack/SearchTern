import { useState, useEffect, useRef, useMemo } from "react"
import { Table, Pagination, Popover, Text, Select, Badge } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { checkHealth, fetchSources } from "../api/internships"
import { BookmarkSimpleIcon, FunnelSimple, CaretLeft, CaretRight } from '@phosphor-icons/react';
import "../styles/Table.css"
import { getRecent, clearCache, getSecondsUntilNextHour } from "../services/internshipmanager"
import { useTracker } from "../components/TrackerContext"
import { makeJobFingerprint } from "../utils/jobFingerprint"
import { parseLocation, US_STATES, trimLocations } from "../utils/locationFilter"
import type { ParsedLocation } from "../utils/locationFilter"
import { matchCompanyMeta, EMPLOYEE_BUCKETS, inEmployeeBucket } from "../utils/companyMeta"

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
const RECENCY_OPTIONS = [
  { days: 0, label: 'Any time' },
  { days: 7, label: 'Past 7 days' },
  { days: 14, label: 'Past 14 days' },
  { days: 30, label: 'Past 30 days' },
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'company-az', label: 'Company A-Z' },
  { value: 'company-za', label: 'Company Z-A' },
]

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'swe', label: 'Software Engineering' },
  { value: 'data', label: 'Data / ML' },
  { value: 'cyber', label: 'Cybersecurity' },
  { value: 'devops', label: 'DevOps / Cloud' },
  { value: 'hardware', label: 'Hardware / Embedded' },
  { value: 'product', label: 'Product Management' },
]

// ponytail: naive substring match on the title — "Engineer" swallows roles that
// belong in another bucket, and short keywords like "ml" over-match. Good enough
// to cut a list down; replace with a per-role keyword column if it gets annoying.
const ROLE_KEYWORDS: Record<string, string[]> = {
  swe: ['software', 'engineer', 'sde', 'developer', 'full stack', 'fullstack', 'front end', 'frontend', 'back end', 'backend', 'web dev', 'mobile', 'ios', 'android'],
  data: ['data', 'machine learning', 'ml', 'artificial intelligence', 'analytics', 'scientist', 'nlp', 'llm', 'deep learning'],
  cyber: ['security', 'cyber', 'appsec', 'infosec', 'penetration', 'threat', 'forensic'],
  devops: ['devops', 'sre', 'site reliability', 'cloud', 'infrastructure', 'platform', 'kubernetes', 'aws', 'azure', 'gcp'],
  hardware: ['hardware', 'embedded', 'firmware', 'electrical', 'ece', 'asic', 'vlsi', 'robotics', 'semiconductor', 'chip'],
  product: ['product'],
}

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
  const [sortOrder, setSortOrder] = useState('newest')
  const [roleFilter, setRoleFilter] = useState('')
  const [typeFilters, setTypeFilters] = useState({ internship: true, newgrad: true })
  const [sortOpen, setSortOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [countryFilter, setCountryFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [faangOnly, setFaangOnly] = useState(false)
  const [employeeBucket, setEmployeeBucket] = useState<string>('')
  const [recencyDays, setRecencyDays] = useState(0)
  const [hideStale, setHideStale] = useState(() => {
    try {
      return localStorage.getItem('searchtern-hide-stale') === '1'
    } catch {
      // Private mode / blocked storage: the filter is a preference, not a
      // requirement, so fall back to the default rather than failing the render.
      return false
    }
  })

  const perPage = 15;

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
    if (roleFilter) {
      const keywords = ROLE_KEYWORDS[roleFilter] || []
      jobs = jobs.filter(j => {
        const title = (j.role || '').toLowerCase()
        return keywords.some(k => title.includes(k))
      })
    }
    if (!typeFilters.internship) jobs = jobs.filter(j => j.type === 'newgrad')
    if (!typeFilters.newgrad) jobs = jobs.filter(j => j.type !== 'newgrad')
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
  }, [allJobs, searchText, sortOrder, roleFilter, typeFilters, countryFilter, stateFilter, parsedLocations, faangOnly, employeeBucket, hideStale, recencyDays])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / perPage)), [filtered])
  const paginated = useMemo(() => filtered.slice((page - 1) * perPage, page * perPage), [filtered, page])

  const activeFilterCount =
    (recencyDays > 0 ? 1 : 0) +
    (hideStale ? 1 : 0) +
    (typeFilters.internship && typeFilters.newgrad ? 0 : 1) +
    (countryFilter ? 1 : 0) +
    (stateFilter ? 1 : 0) +
    (faangOnly ? 1 : 0) +
    (employeeBucket ? 1 : 0)

  function clearFilters() {
    setRecencyDays(0)
    setHideStale(false)
    setTypeFilters({ internship: true, newgrad: true })
    setCountryFilter('')
    setStateFilter('')
    setFaangOnly(false)
    setEmployeeBucket('')
    try {
      localStorage.setItem('searchtern-hide-stale', '0')
    } catch {
      // Preference just won't survive the session.
    }
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
          <Popover width={250} position="bottom-start" withArrow shadow="md" opened={popoverOpened} onChange={setPopoverOpened}>
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
                <button className="sort_btn" onClick={() => setRoleOpen(o => !o)} title="Role filter">
                  Role <span aria-hidden="true">▾</span>
                </button>
              </Popover.Target>
              <Popover.Dropdown>
                <div className="filter-option-list">
                  {ROLE_OPTIONS.map(opt => (
                    <label key={opt.value} className="filter-option">
                      <input
                        type="radio"
                        name="role"
                        checked={roleFilter === opt.value}
                        onChange={() => { setRoleFilter(opt.value); setRoleOpen(false); setPage(1) }}
                      />
                      {opt.label}
                    </label>
                  ))}
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
                            try {
                              localStorage.setItem('searchtern-hide-stale', hideStale ? '0' : '1')
                            } catch {
                              // Preference just won't survive the session.
                            }
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
                    <Select
                      placeholder="Any size"
                      size="xs"
                      clearable
                      data={EMPLOYEE_BUCKETS.map(b => ({ value: b.label, label: b.label }))}
                      value={employeeBucket || null}
                      onChange={val => { setEmployeeBucket(val || ''); setPage(1) }}
                      maxDropdownHeight={220}
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
          </div>
        </div>
        <Table striped highlightOnHover mt="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Company</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={4} className="empty-state">Loading...</Table.Td>
              </Table.Tr>
            ) : paginated.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4} className="empty-state">No listings found!</Table.Td>
              </Table.Tr>
            ) : (
              paginated.map(job => {
                const stale = isStale(job)
                const repost = (freshness.get(jobKey(job.company, job.role, job.location)) || 0) > 1
                return (
                  <Table.Tr key={job.id} style={{ opacity: stale ? 0.55 : 1 }}>
                    <Table.Td className="company-cell" data-label="Company">
                      <BookmarkSimpleIcon
                        size={25}
                        className="bookmark-icon"
                        weight={isJobTracked(job.company, job.role, job.location) ? "fill" : "regular"}
                        color={isJobTracked(job.company, job.role, job.location) ? "var(--accent-color)" : "currentColor"}
                        onClick={() => toggleSave(job)}
                      />
                      <div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${job.company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.com&sz=32`}
                            style={{ width: '16px', height: '16px', borderRadius: '2px' }}
                            onError={(e) => e.currentTarget.style.display = 'none'}
                            alt=""
                          />
                          {job.company}
                        </span>
                        {(stale || repost) && (
                          <span style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                            {stale && <Badge size="xs" variant="light" color="gray">Likely filled</Badge>}
                            {repost && <Badge size="xs" variant="light" color="yellow">Reposted</Badge>}
                          </span>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td data-label="Role">
                      <a href={job.link} target="_blank" rel="noreferrer" className="apply-link">
                        {job.role}
                      </a>
                    </Table.Td>
                    <Table.Td data-label="Location">{trimLocations(job.location)}</Table.Td>
                    <Table.Td data-label="Date">{formatRelativeDate(job.date)}</Table.Td>
                  </Table.Tr>
                )
              })
            )}
          </Table.Tbody>
        </Table>

        <Pagination
          total={totalPages}
          value={Math.min(page, totalPages)}
          onChange={setPage}
          mt="md"
        />
      </section>
    </>
  )
}

export default Jobs