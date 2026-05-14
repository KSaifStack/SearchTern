import { Table, TextInput, Pagination, Badge } from '@mantine/core'
import "../styles/Table.css"
function Tracker() {
  return (
    <>
      <section className="feature">
        {/* Job Tracker Section */}
        <h2>Job Tracker</h2>
        
        <button>+ Add Application</button>
        <button>Export CSV</button>

        <Table striped highlightOnHover mt="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Company</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Date Applied</Table.Th>
              <Table.Th>Link</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                No applications found. Add an application or save a job to get started!
            </Table.Td>
            {/* rows will go here */}

          </Table.Tbody>
        </Table>
      </section>
    </>
  )
}

export default Tracker