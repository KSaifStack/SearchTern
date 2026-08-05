import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={{
    fontFamily: "'Lexend', sans-serif",
    colors: {
      brand: [
        '#ebf7f0',
        '#d8ecdf',
        '#b1d8be',
        '#87c49b',
        '#62b37d',
        '#49a667',
        '#379e59',
        '#2d7a4f',
        '#227b40',
        '#166a34',
      ]
    },
    primaryColor: 'brand',
    primaryShade: 7
  }}>
    <Notifications position="bottom-right" />
    <App />
  </MantineProvider>,
)
