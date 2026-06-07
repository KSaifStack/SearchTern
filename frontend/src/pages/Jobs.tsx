import { useState, useEffect } from "react"
import { Table, Pagination, Menu, MenuDropdown, Popover, Text } from '@mantine/core'
import { checkHealth } from "../api/internships"
import { BookmarkSimpleIcon } from '@phosphor-icons/react';
import "../styles/Table.css"
import { getRecent } from "../services/internshipmanager"
import { useTracker } from "../components/TrackerContext"
import { makeJobFingerprint } from "../utils/jobFingerprint"

interface Job {
  id: number
  company: string
  role: string
  location: string
  date: string
  link: string
}

function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const { addJob, removeJob, isJobTracked } = useTracker()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState("1:00:00")
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [healthStatus, setHealthStatus] = useState<any>(null)
  const [popoverOpened, setPopoverOpened] = useState(false)

  const perPage = 15;

  const fetchHealth = async () => {
    if (!popoverOpened) {
      const data = await checkHealth()
      setHealthStatus(data)
    }
    setPopoverOpened((o) => !o)
  }

  const formatNextUpdate = (dateString: string) => {
    if (!dateString || dateString === 'unknown') return 'Unknown';
    try {
      const d = new Date(dateString.replace(' ', 'T'));
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) {
      return dateString;
    }
  }


  useEffect(() => {
    getRecent().then(res => {
      if (res.success) {
        setJobs([...res.data])

      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const getSecondsUntilNextHour = () => {
      const now = new Date()
      const secondsElapsed = now.getMinutes() * 60 + now.getSeconds()
      return 3600 - secondsElapsed
    }
    let seconds = getSecondsUntilNextHour()

    const format = (s: number) => {
      const m = Math.floor(s / 60).toString().padStart(2, '0')
      const sec = (s % 60).toString().padStart(2, '0')
      return `${m}:${sec}`
    }



    setTimeRemaining(format(seconds))
    const interval = setInterval(async () => {
      seconds -= 1
      if (seconds <= 0) {
        seconds = getSecondsUntilNextHour()
        const res = await getRecent()
        if (res.success) setJobs([...res.data])
      }
      setTimeRemaining(format(seconds))
    }, 1000)

    return () => clearInterval(interval)

  }, [])

  const DatetoNum = (val: string | number) => {
    if (typeof val === 'number') return val;
    const parsed = parseFloat(val);
    return !isNaN(parsed) ? parsed : 999;
  }

  // Filter jobs based on active filters
  const applyFilters = (jobs: Job[]): Job[] => {
    return jobs
      .filter((job: any) => job && job.company)
      .filter(job => {
        // Text search
        return job.company.toLowerCase().includes(search.toLowerCase()) ||
          job.role.toLowerCase().includes(search.toLowerCase()) ||
          job.location.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const aNum = DatetoNum(a.date);
        const bNum = DatetoNum(b.date);
        return sortOrder === 'newest' ? aNum - bNum : bNum - aNum;
      });
  };

  const formatRelativeDate = (val: string | number) => {
    const days = DatetoNum(val);

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

  const filtered = applyFilters(jobs);

  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  function toggleSave(job: Job) {
    const fingerprint = makeJobFingerprint(job.company, job.role, job.location);
    if (isJobTracked(job.company, job.role, job.location)) {
      removeJob(fingerprint);
    } else {
      addJob({ company: job.company, role: job.role, location: job.location, link: job.link }, 'Saved');
    }
  }




  return (
    <>
      <section className="feature">
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <p className="result-count" style={{ margin: 0 }}>Refreshes in: {timeRemaining}</p>
          <Popover width={250} position="bottom-start" withArrow shadow="md" opened={popoverOpened} onChange={setPopoverOpened}>
            <Popover.Target>
              <button className="health_btn" onClick={fetchHealth}>...</button>
            </Popover.Target>
            <Popover.Dropdown>
              {healthStatus ? (
                <>
                  <Text size="xs">Status: <span style={{ color: healthStatus.status === 'ok' ? 'green' : 'red' }}>{healthStatus.status}</span></Text>
                  <Text size="xs">Next Update: {formatNextUpdate(healthStatus.next_scrape)}</Text>
                  <Text size="xs" mt={5} c="dimmed">Data Source: SimplifyJobs</Text>
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
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />

        <div className="results-header">
          <p className="result-count">{filtered.length} internships found</p>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <button className="sort_btn">
                Sort By: {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
              </button>
            </Menu.Target>
            <MenuDropdown>
              <Menu.Item onClick={() => setSortOrder('newest')}>
                Newest Listing
              </Menu.Item>
              <Menu.Item onClick={() => setSortOrder('oldest')}>
                Oldest Listing
              </Menu.Item>
            </MenuDropdown>
          </Menu>
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
                <Table.Td colSpan={5} className="empty-state">Loading...</Table.Td>
              </Table.Tr>
            ) : paginated.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5} className="empty-state">No internships found!</Table.Td>
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
          total={Math.ceil(filtered.length / perPage)}
          value={page}
          onChange={setPage}
          mt="md"
        />
      </section>
    </>
  )
}

export default Jobs