import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ThemeProvider, useTheme } from './components/ThemeContext'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import App from './App.tsx'
import { CHUNK_ERROR_RE, reloadOnceForNewBuild } from './App.tsx'

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

// The route boundary in App.tsx only sees chunks imported through React.lazy.
// Mantine pulls in its own chunks for modals and icon components, and a deploy
// takes those out from under an open tab just as effectively. Those rejections
// never reach a React boundary, so watch for them globally. Same one-shot
// guard, so the two hooks cannot stack into a reload loop.
window.addEventListener('unhandledrejection', (event) => {
  const { reason } = event
  if (reason instanceof Error && CHUNK_ERROR_RE.test(reason.message)) {
    event.preventDefault()
    reloadOnceForNewBuild()
  }
})

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <Root />
  </ThemeProvider>,
)
