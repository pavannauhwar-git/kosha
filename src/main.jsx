import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import App from './App'
import './index.css'
import { GlobalErrorBoundary } from './components/errors/GlobalErrorBoundary'
import { startRuntimeMonitor } from './lib/runtimeMonitor'

startRuntimeMonitor()

// ── Restore dark mode preference ────────────────────────────────────────
;(() => {
  const stored = localStorage.getItem('kosha-theme')
  if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
)
