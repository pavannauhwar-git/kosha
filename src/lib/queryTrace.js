function isQueryTraceEnabled() {
  if (!import.meta.env.DEV) return false
  if (typeof window === 'undefined') return false
  return window.localStorage?.getItem('kosha:trace-queries') === '1'
}

export async function traceQuery(label, fn) {
  if (!isQueryTraceEnabled()) {
    return fn()
  }

  const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
  try {
    return await fn()
  } finally {
    const ended = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const durationMs = Math.round(ended - started)
    console.debug(`[Kosha][QueryTrace] ${label}: ${durationMs}ms`)
  }
}
