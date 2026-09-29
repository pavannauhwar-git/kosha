export const MUTATION_RETRY = (failureCount, error) => {
  if (failureCount >= 2) return false
  if (error?.name === 'OfflineError' || error?.code === 'OFFLINE') return false
  const status = error?.status || error?.code
  if (status === 401 || status === 403 || status === 404) return false
  if (String(error?.message || '').includes('Not signed in')) return false
  // Postgres data/constraint/permission/raise errors are final.
  if (error?.code && /^(22|23|42|P0)/.test(String(error.code))) return false
  return true
}
