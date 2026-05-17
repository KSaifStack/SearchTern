import { useState, useEffect } from "react"
import { Table, Pagination,Menu, MenuDropdown } from '@mantine/core'
import {BookmarkSimpleIcon}  from '@phosphor-icons/react';
import "../styles/Table.css"
import { getRecent } from "../services/internshipmanager"
import { useTracker } from "../components/TrackerContext"

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
  const perPage = 15; 

  
  useEffect(() => {
  getRecent().then(res => {
    if(res.success) setJobs([...res.data])
    console.log("Sample job dates:", res.data.slice(0, 5).map(j => j.date));
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

const filtered = jobs
  .filter((job: any) => job && job.company)
  .filter(job =>
    job.company.toLowerCase().includes(search.toLowerCase()) ||
    job.role.toLowerCase().includes(search.toLowerCase()) ||
    job.location.toLowerCase().includes(search.toLowerCase())
  )
  .sort((a, b) => {
    const aNum = DatetoNum(a.date);
    const bNum = DatetoNum(b.date);
    return sortOrder === 'newest' ? aNum - bNum : bNum - aNum;
  });

  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  function toggleSave(job: Job) {
    if (isJobTracked(job.id)) {
      removeJob(job.id);
    } else {
      addJob({ id: job.id, company: job.company, role: job.role, location: job.location, link: job.link }, 'Saved');
    }
  }

  
  

  return (
    <>
      <section className="feature">
        <p className="result-count">Refreshes in: {timeRemaining}</p>
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
              
                  <Table.Td className="company-cell">
                    <BookmarkSimpleIcon 
                      size={25} 
                      className="bookmark-icon" 
                      weight={isJobTracked(job.id) ? "fill" : "regular"}
                      color={isJobTracked(job.id) ? "var(--accent-color)" : "currentColor"}
                      onClick={() => toggleSave(job)}
                    />
                    {job.company}
                  </Table.Td>
                  <Table.Td>
                    <a href={job.link} target="_blank" rel="noreferrer" className="apply-link">
                    {job.role}
                    </a>
                    </Table.Td>
                  <Table.Td>{job.location}</Table.Td>
                  <Table.Td>{formatRelativeDate(job.date)}</Table.Td>
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