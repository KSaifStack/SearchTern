import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ThemeProvider, useTheme } from './components/ThemeContext'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import App from './App.tsx'

const mantineTheme = {
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
    ] as const
  },
  primaryColor: 'brand' as const,
  primaryShade: 7 as const
}

function Root() {
  const { theme } = useTheme()
  return (
    <MantineProvider forceColorScheme={theme} theme={mantineTheme}>
      <Notifications position="bottom-right" />
      <App />
    </MantineProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <Root />
  </ThemeProvider>,
)
