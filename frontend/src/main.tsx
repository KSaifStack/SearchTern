import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <MantineProvider>
    <Notifications position="bottom-right" />
    <App />
  </MantineProvider>,
)
