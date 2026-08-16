import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import './index.css'
import App from './App.tsx'
import theme from './theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Light for a first-time visitor, whatever their OS is set to; an explicit
        choice from the toggle is persisted under `mui-mode` and wins from then
        on. Changing this means changing index.css too: the pre-paint rules
        there have to default to the same scheme, or the page paints one and
        then swaps to the other as React mounts. */}
    <ThemeProvider theme={theme} defaultMode="light">
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
