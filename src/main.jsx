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

// ── Android 14+ Predictive Back gesture listener ─────────────────────
if (typeof window !== 'undefined' && 'navigation' in window) {
  window.navigation.addEventListener('navigate', (event) => {
    if (event.navigationType === 'traverse' && event.canIntercept) {
      // Standard Chromium back-navigation gesture integration
    }
  })
}

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
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const prefersDark = mql.matches
  const isDark = stored === 'dark' || (!stored && prefersDark)

  if (isDark) document.documentElement.classList.add('dark')
  applyThemeColor(isDark)

  // React to OS-level changes only when the user has no explicit preference.
  mql.addEventListener('change', (e) => {
    if (readLocalStorage('kosha-theme', null)) return
    if (e.matches) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    applyThemeColor(e.matches)
  })

  // Expose the apply function so the in-app dark-mode toggle can call it
  // directly when it writes localStorage.
  window.__koshaApplyThemeColor = applyThemeColor
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
)
