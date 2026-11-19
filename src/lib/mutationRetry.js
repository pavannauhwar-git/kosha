export const MUTATION_RETRY = (failureCount, error) => {
  if (failureCount >= 2) return false
  if (error?.message === 'OPTIMISTIC_BUSY') return false
  if (error?.name === 'OfflineError' || error?.code === 'OFFLINE') return false
  const status = error?.status || error?.code
  if (status === 401 || status === 403 || status === 404) return false
  if (String(error?.message || '').includes('Not signed in')) return false
  // Postgres data/constraint/permission/raise errors are final.
  if (error?.code && /^(22|23|42|P0)/.test(String(error.code))) return false
  return true
}

// For commits that run on their own timer (an undoable delete) rather than a
// tap: if another action on the same cache holds the optimistic lock, wait
// for it instead of failing.
export async function retryWhileBusy(fn, { attempts = 10, delayMs = 300 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      if (error?.message !== 'OPTIMISTIC_BUSY' || attempt >= attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}
