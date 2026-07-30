import { useState, useEffect, useRef, useMemo } from "react"
import { Table, Pagination, Popover, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { checkHealth } from "../api/internships"
import { BookmarkSimpleIcon } from '@phosphor-icons/react';
import "../styles/Table.css"
import { getRecent, clearCache, getSecondsUntilNextHour } from "../services/internshipmanager"
import { useTracker } from "../components/TrackerContext"
import { makeJobFingerprint } from "../utils/jobFingerprint"

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

function Jobs() {
  const [allJobs, setAllJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const { addJob, removeJob, isJobTracked } = useTracker()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [healthStatus, setHealthStatus] = useState<any>(null)
  const [popoverOpened, setPopoverOpened] = useState(false)
  const [refreshCountdown, setRefreshCountdown] = useState(() => getSecondsUntilNextHour())
  const debounceRef = useRef<number | undefined>(undefined)
  const [searchText, setSearchText] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const [typeFilters, setTypeFilters] = useState({ internship: true, offseason: true, newgrad: true })
  const [filterOpen, setFilterOpen] = useState(false)
  const [draftSort, setDraftSort] = useState('newest')
  const [draftType, setDraftType] = useState({ internship: true, offseason: true, newgrad: true })

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

  const filtered = useMemo(() => {
    let jobs = allJobs.filter(j => j && j.company)
    if (searchText) {
      const q = searchText.toLowerCase()
      jobs = jobs.filter(j =>
        j.company.toLowerCase().includes(q) ||
        j.role.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q)
      )
    }
    if (!typeFilters.internship) jobs = jobs.filter(j => j.type === 'newgrad')
    if (!typeFilters.newgrad) jobs = jobs.filter(j => j.type !== 'newgrad')
    if (!typeFilters.offseason) jobs = jobs.filter(j => j.season !== 'offseason')
    return [...jobs].sort((a, b) => {
      if (sortOrder === 'company-az') return a.company.localeCompare(b.company)
      if (sortOrder === 'company-za') return b.company.localeCompare(a.company)
      const aNum = parseFloat(String(a.date)) || 999
      const bNum = parseFloat(String(b.date)) || 999
      return sortOrder === 'newest' ? aNum - bNum : bNum - aNum
    })
  }, [allJobs, searchText, sortOrder, typeFilters])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / perPage)), [filtered])
  const paginated = useMemo(() => filtered.slice((page - 1) * perPage, page * perPage), [filtered, page])

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

  const formatRelativeDate = (val: string | number) => {
    if (typeof val === 'number') return "N/A";
    const parsed = parseFloat(val);
    const days = !isNaN(parsed) ? parsed : 999;
    if (days === 999) return "N/A";
    if (days === 0) return "24 hours ago ";
    if (days > 0 && days < 1) return "< 1 day ago";
    if (days === 1) return "1 day ago";
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
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <p className="result-count" style={{ margin: 0 }}>Refreshes in: {String(Math.floor(refreshCountdown / 60)).padStart(2, '0')}:{String(refreshCountdown % 60).padStart(2, '0')}</p>
          <Popover width={250} position="bottom-start" withArrow shadow="md" opened={popoverOpened} onChange={setPopoverOpened}>
            <Popover.Target>
              <button className="health_btn" onClick={() => {
                if (!popoverOpened) checkHealth().then(setHealthStatus)
                setPopoverOpened((o) => !o)
              }}>...</button>
            </Popover.Target>
            <Popover.Dropdown>
              {healthStatus ? (
                <>
                  <Text size="xs">Status: <span style={{ color: healthStatus.status === 'ok' ? 'green' : 'red' }}>{healthStatus.status}</span></Text>
                  <Text size="xs">Next Update: {healthStatus.next_scrape !== 'unknown' ? new Date(healthStatus.next_scrape.replace(' ', 'T')).toLocaleDateString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true }) : 'Unknown'}</Text>
                  <Text size="xs" mt={5} c="dimmed">Data Sources: SimplifyJobs, SearchTern-Listings</Text>
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
          <p className="result-count">{loading ? 'Loading...' : `${filtered.length} internships found`}</p>
          <Popover opened={filterOpen} onChange={setFilterOpen} width={220} position="bottom-end" withArrow shadow="md">
            <Popover.Target>
              <button className="sort_btn" onClick={() => {
                setDraftSort(sortOrder)
                setDraftType({ ...typeFilters })
                setFilterOpen(o => !o)
              }}>
                Sort & Filter
              </button>
            </Popover.Target>
            <Popover.Dropdown>
              <div style={{ padding: '4px 0', fontSize: '13px' }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: '#495057' }}>Sort By</div>
                {['newest', 'oldest', 'company-az', 'company-za'].map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="sort"
                      checked={draftSort === opt}
                      onChange={() => setDraftSort(opt)}
                    />
                    {opt === 'newest' ? 'Newest' : opt === 'oldest' ? 'Oldest' : opt === 'company-az' ? 'Company (A-Z)' : 'Company (Z-A)'}
                  </label>
                ))}
                <div style={{ borderTop: '1px solid #e9ecef', marginTop: 8, paddingTop: 8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: '#495057' }}>Type</div>
                  {[
                    { key: 'internship' as const, label: 'Internship' },
                    { key: 'newgrad' as const, label: 'New Grad' },
                    { key: 'offseason' as const, label: 'Off-Season' },
                  ].map(t => (
                    <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={draftType[t.key]}
                        onChange={() => setDraftType(prev => ({ ...prev, [t.key]: !prev[t.key] }))}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setSortOrder(draftSort)
                    setTypeFilters(draftType)
                    setPage(1)
                    setFilterOpen(false)
                  }}
                  style={{ width: '100%', marginTop: 10, padding: '6px 0', fontWeight: 600, fontSize: 13, background: 'var(--primary-green)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  Apply
                </button>
              </div>
            </Popover.Dropdown>
          </Popover>
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
              paginated.map(job => (
                <Table.Tr key={job.id}>
                  <Table.Td className="company-cell" data-label="Company">
                    <BookmarkSimpleIcon
                      size={25}
                      className="bookmark-icon"
                      weight={isJobTracked(job.company, job.role, job.location) ? "fill" : "regular"}
                      color={isJobTracked(job.company, job.role, job.location) ? "var(--accent-color)" : "currentColor"}
                      onClick={() => toggleSave(job)}
                    />
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${job.company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.com&sz=32`}
                      style={{ width: '16px', height: '16px', borderRadius: '2px' }}
                      onError={(e) => e.currentTarget.style.display = 'none'}
                      alt=""
                    />
                    {job.company}
                  </Table.Td>
                  <Table.Td data-label="Role">
                    <a href={job.link} target="_blank" rel="noreferrer" className="apply-link">
                      {job.role}
                    </a>
                  </Table.Td>
                  <Table.Td data-label="Location">{job.location}</Table.Td>
                  <Table.Td data-label="Date">{formatRelativeDate(job.date)}</Table.Td>
                </Table.Tr>
              ))
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