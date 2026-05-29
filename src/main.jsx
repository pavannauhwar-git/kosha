// Suppress Lit's "dev mode" console warning emitted by @material/web components.
// Lit checks globalThis.litIssuedWarnings before printing; adding 'dev-mode' here
// (before any Lit module is imported) tells it the warning was already shown.
// https://lit.dev/msg/dev-mode
// eslint-disable-next-line no-undef
if (import.meta.env.DEV) {
  ;(globalThis.litIssuedWarnings ??= new Set()).add('dev-mode')
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import App from './App'
import './index.css'
import { GlobalErrorBoundary } from './components/errors/GlobalErrorBoundary'
import { startRuntimeMonitor } from './lib/runtimeMonitor'
import { readLocalStorage } from './lib/safeStorage'

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

  const stored = readLocalStorage('kosha-theme', null)
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
