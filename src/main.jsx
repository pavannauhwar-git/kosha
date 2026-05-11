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
  let metaTheme = document.querySelector('meta[name="theme-color"]')
  if (!metaTheme) {
    metaTheme = document.createElement('meta')
    metaTheme.name = 'theme-color'
    document.head.appendChild(metaTheme)
  }

  const applyThemeColor = (isDark) => {
    metaTheme.content = isDark ? '#0B0C0F' : '#FFFFFF'
  }

  const stored = localStorage.getItem('kosha-theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = stored === 'dark' || (!stored && prefersDark)
  
  if (isDark) {
    document.documentElement.classList.add('dark')
  }
  applyThemeColor(isDark)

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        applyThemeColor(document.documentElement.classList.contains('dark'))
        break
      }
    }
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
