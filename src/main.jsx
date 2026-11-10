// Suppress Lit's "dev mode" console warning emitted by @material/web components.
// Lit checks globalThis.litIssuedWarnings before printing; adding 'dev-mode' here
// (before any Lit module is imported) tells it the warning was already shown.
// https://lit.dev/msg/dev-mode
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
import { reloadForChunkError } from './lib/chunkReload'
import { initErrorReporting } from './lib/errorReporting'

// Defensive: the avatar URL cache is keyed by storage path, not by user. Clear
// it on every cold start so a previous user's signed URLs can never be read by
// the next person on a shared device before the auth purge runs.
try { localStorage.removeItem('kosha:avatar-urls') } catch { /* storage unavailable */ }

startRuntimeMonitor()

// A chunk from an older deploy failed to preload: reload once to get the new
// build. If we already reloaded, let the error reach the route error screen.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForChunkError()) event.preventDefault()
})

// ── Restore dark mode preference & init theme color ──────────────────
;(() => {
  let metaTheme = document.querySelector('meta[name="theme-color"]')
  if (!metaTheme) {
    metaTheme = document.createElement('meta')
    metaTheme.name = 'theme-color'
    document.head.appendChild(metaTheme)
  }

  // The status bar matches the page surface defined in index.css.
  const applyThemeColor = () => {
    const surface = getComputedStyle(document.documentElement).getPropertyValue('--ds-surface').trim()
    if (surface) metaTheme.content = surface
  }

  const stored = readLocalStorage('kosha-theme', null)
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = stored === 'dark' || (!stored && prefersDark)
  
  if (isDark) {
    document.documentElement.classList.add('dark')
  }
  applyThemeColor()

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        applyThemeColor()
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

// Sentry loads once the first screen is up, so it isn't in the start-up download.
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(() => { void initErrorReporting() }, { timeout: 4000 })
} else {
  window.setTimeout(() => { void initErrorReporting() }, 2000)
}

// Older builds cached Supabase responses in the service worker. Nothing reads
// that cache any more, so remove it from phones that still have it.
if ('caches' in window) {
  void caches.delete('supabase-data').catch(() => {})
}
