// PostgREST caps a single response (1,000 rows on Supabase). `buildQuery`
// must return a fresh, fully ordered query each call so pages don't overlap.
// `maxRows` stops early once that many rows are loaded.
export async function fetchAllPages(buildQuery, { pageSize = 1000, maxPages = 100, maxRows = Infinity } = {}) {
  const rows = []
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize
    const size = Math.min(pageSize, maxRows - from)
    const { data, error } = await buildQuery().range(from, from + size - 1)
    if (error) throw error
    const batch = data || []
    rows.push(...batch)
    if (batch.length < size || rows.length >= maxRows) return rows
  }
  throw new Error('Too many rows to load at once. Narrow the filters and try again.')
}
