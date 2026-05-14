import { useState, useEffect } from "react"
import { Table, Pagination,Menu, Button, MenuDropdown } from '@mantine/core'
//import { GearSixIcon, MagnifyingGlassIcon, ImageIcon, ChatCircleIcon, TrashIcon, IconArrowsLeftRight } from '@phosphor-icons/react';
import "../styles/Table.css"
import { getRecent } from "../services/internshipmanager"

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
  const [saved, setSaved] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const perPage = 15 // Jobs per page

  useEffect(() => {
  getRecent().then(res => {
    console.log(res) 
    if(res.success) setJobs(res.data)
    setLoading(false)
  })
}, [])

  const filtered = jobs.filter(job =>
    job.company.toLowerCase().includes(search.toLowerCase()) ||
    job.role.toLowerCase().includes(search.toLowerCase()) ||
    job.location.toLowerCase().includes(search.toLowerCase())
  )

  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  function toggleSave(job: Job) {
    setSaved(prev => {
      const next = new Set(prev)
      next.has(job.id) ? next.delete(job.id) : next.add(job.id)
      return next
    })
  }

  return (
    <>
      <section className="feature">
        <p>Refreshes in: 1:00:00</p>
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
            <button className="sort_btn">Sort By: </button>
          </Menu.Target>
          <MenuDropdown>
            <Menu.Item>
              Newest Listing
            </Menu.Item>
            <Menu.Item>
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
              <Table.Th>Apply</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={6} className="empty-state">Loading...</Table.Td>
              </Table.Tr>
            ) : paginated.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} className="empty-state">No internships found! check your internet connection.</Table.Td>
              </Table.Tr>
            ) : (
              paginated.map(job => (
                <Table.Tr key={job.id}>
              
                  <Table.Td>{job.company}</Table.Td>
                  <Table.Td>{job.role}</Table.Td>
                  <Table.Td>{job.location}</Table.Td>
                  <Table.Td>{job.date}</Table.Td>
                  <Table.Td>
                    <a href={job.link} target="_blank" rel="noreferrer" className="apply-link">
                      <button className="apply_btn">➜</button>
                    </a>
                  </Table.Td>
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