import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import App from './App'
import './index.css'
import { GlobalErrorBoundary } from './components/errors/GlobalErrorBoundary'
import { startRuntimeMonitor } from './lib/runtimeMonitor'

startRuntimeMonitor()

// ── Restore dark mode preference & init theme color ──────────────────
;(() => {
  const metaTheme = document.createElement('meta')
  metaTheme.name = 'theme-color'
  document.head.appendChild(metaTheme)

  const applyThemeColor = (isDark) => {
    metaTheme.content = isDark ? '#111318' : '#F6F8FA'
  }

  const stored = localStorage.getItem('kosha-theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = stored === 'dark' || (!stored && prefersDark)
  
  if (isDark) {
    document.documentElement.classList.add('dark')
  }
  applyThemeColor(isDark)

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        applyThemeColor(document.documentElement.classList.contains('dark'))
      }
    })
  })
  observer.observe(document.documentElement, { attributes: true })
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
)
