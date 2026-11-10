// After a deploy, an open tab can ask for a page chunk that no longer exists.
// React caches the failed lazy import, so the only fix is a full reload.
const RELOAD_KEY = 'kosha-chunk-reload-at'
const LOOP_WINDOW_MS = 30_000

export function isChunkLoadError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return error?.name === 'ChunkLoadError'
    || message.includes('loading chunk')
    || message.includes('loading css chunk')
    || message.includes('unable to preload css')
    || message.includes('failed to fetch dynamically imported module') // Chrome, Edge
    || message.includes('error loading dynamically imported module') // Firefox
    || message.includes('importing a module script failed') // Safari
}

// Reloads once. Returns false (and does nothing) if the page already reloaded
// for this reason in the last 30 seconds, so a broken deploy can't loop.
export function reloadForChunkError() {
  if (typeof window === 'undefined') return false
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < LOOP_WINDOW_MS) return false
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // No sessionStorage: reload anyway; the browser's own error page stops a loop.
  }
  window.location.reload()
  return true
}
