import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// CACHE
// Structure in localStorage: { data: ..., ts: epoch_ms }
// TTL: 5 minutes before a cache entry is considered stale (still served
// instantly, then refreshed in background via stale-while-revalidate).
// Hard expiry: 24 hours — after that, data is considered too stale to show.
//
// Why localStorage and not IndexedDB?
// localStorage is synchronous — getCached() returns immediately on the
// critical render path. IndexedDB is async, which would require an extra
// render cycle before cached data appears. For ~10KB of financial data,
// localStorage is the right tool.
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_PREFIX  = 'kosha_cache_'
const SOFT_TTL      =   5 * 60 * 1000       //  5 min  — serve fresh from network
const HARD_TTL      =  24 * 60 * 60 * 1000  // 24 hrs — serve stale from cache

function getCached(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > HARD_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return { data, ts }
  } catch {
    return null
  }
}

function setCached(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    // localStorage full (unlikely with financial data) — fail silently
  }
}

function isFresh(entry) {
  return entry && (Date.now() - entry.ts < SOFT_TTL)
}

export function invalidateCache(pattern) {
  // If pattern provided, only clear matching keys — otherwise clear all Kosha cache
  try {
    const keys = Object.keys(localStorage)
    keys.forEach(k => {
      if (!k.startsWith(CACHE_PREFIX)) return
      const suffix = k.slice(CACHE_PREFIX.length)
      if (!pattern || suffix.startsWith(pattern)) {
        localStorage.removeItem(k)
      }
    })
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEBOUNCE — used by Transactions search
// ─────────────────────────────────────────────────────────────────────────────
export function useDebounce(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// ─────────────────────────────────────────────────────────────────────────────
// VISIBILITY REFETCH — re-fetches when app returns from background
// ─────────────────────────────────────────────────────────────────────────────
function useVisibilityRefetch(refetch) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') refetch(true)
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [refetch])
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE WRITE TIMEOUT — 8 seconds max on every write
// ─────────────────────────────────────────────────────────────────────────────
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Check your connection.')), ms)
    ),
  ])
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION HELPER
// ─────────────────────────────────────────────────────────────────────────────
async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('Not signed in')
  return session.user.id
}

// ─────────────────────────────────────────────────────────────────────────────
// PREFETCH REGISTRY
// External tabs/pages can call prefetch() to warm the cache before mounting.
// The nav bar calls this on pointerDown — data starts loading before the
// finger lifts, making tab switches feel instant.
// ─────────────────────────────────────────────────────────────────────────────
const prefetchFns = new Map()

export function registerPrefetch(key, fn) {
  prefetchFns.set(key, fn)
}

export function prefetch(key) {
  const fn = prefetchFns.get(key)
  if (fn) fn()
}

// ─────────────────────────────────────────────────────────────────────────────
// useTransactions
// ─────────────────────────────────────────────────────────────────────────────
export function useTransactions({ type, category, search, limit } = {}) {
  const [data,    setData]    = useState(() => {
    // Initialise from cache synchronously — zero loading flash on return visits
    const cached = getCached(`txns:${type}:${category}:${search}:${limit}`)
    return cached?.data || []
  })
  const [loading, setLoading] = useState(() => {
    const cached = getCached(`txns:${type}:${category}:${search}:${limit}`)
    return !cached  // only show loading spinner if nothing in cache
  })
  const [error, setError] = useState(null)

  const fetch = useCallback(async (force = false) => {
    const key    = `txns:${type}:${category}:${search}:${limit}`
    const cached = getCached(key)

    // Serve cache immediately (stale-while-revalidate)
    if (cached) {
      setData(cached.data)
      setLoading(false)
      if (!force && isFresh(cached)) return   // fresh — skip network
    } else {
      setLoading(true)
    }

    try {
      let q = supabase
        .from('transactions')
        // Only fetch columns we actually use — avoids pulling notes/created_at etc.
        .select('id, date, type, description, amount, category, investment_vehicle, is_repayment, payment_mode')
        .order('date',       { ascending: false })
        .order('created_at', { ascending: false })

      if (type)     q = q.eq('type',     type)
      if (category) q = q.eq('category', category)
      if (search)   q = q.ilike('description', `%${search}%`)
      if (limit)    q = q.limit(limit)

      const { data: rows, error: err } = await q
      if (err) { setError(err); setLoading(false); return }

      const result = rows || []
      setCached(key, result)
      setData(result)
      setLoading(false)
    } catch (e) {
      setError(e)
      setLoading(false)
    }
  }, [type, category, search, limit])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  const refetch = useCallback(() => { invalidateCache('txns:'); fetch(true) }, [fetch])

  // ── Optimistic prepend ────────────────────────────────────────────────
  // Instantly inserts a new transaction at the top of the list with a temp id.
  // Called BEFORE the network save starts — zero latency UI.
  // When refetch() is called after save, the real server row replaces it.
  const prependOptimistic = useCallback((txn) => {
    const tempTxn = {
      ...txn,
      id:         '__optimistic__' + Date.now(),
      created_at: new Date().toISOString(),
    }
    setData(prev => [tempTxn, ...prev].slice(0, limit || 999))
  }, [limit])

  // ── Optimistic replace ────────────────────────────────────────────────
  // Instantly swaps an existing row's data in-place for edits.
  // Called BEFORE the network update starts — zero latency UI.
  // When refetch() is called after save, the real server row confirms it.
  const replaceOptimistic = useCallback((id, updatedFields) => {
    setData(prev => prev.map(t => t.id === id ? { ...t, ...updatedFields } : t))
  }, [])

  // ── Optimistic remove ─────────────────────────────────────────────────
  // Instantly removes a row from the list for deletes.
  // Called BEFORE the network delete starts — zero latency UI.
  // If the delete fails, refetch() restores the row from server state.
  const removeOptimistic = useCallback((id) => {
    setData(prev => prev.filter(t => t.id !== id))
  }, [])

  return { data, loading, error, refetch, prependOptimistic, replaceOptimistic, removeOptimistic }
}

// ─────────────────────────────────────────────────────────────────────────────
// useMonthSummary
// ─────────────────────────────────────────────────────────────────────────────
export function useMonthSummary(year, month) {
  const cacheKey = `month:${year}:${month}`

  const [data,    setData]    = useState(() => getCached(cacheKey)?.data || null)
  const [loading, setLoading] = useState(() => !getCached(cacheKey))

  const fetch = useCallback(async (force = false) => {
    const cached = getCached(cacheKey)
    if (cached) {
      setData(cached.data)
      setLoading(false)
      if (!force && isFresh(cached)) return
    } else {
      setLoading(true)
    }

    try {
      const pad  = String(month).padStart(2, '0')
      const days = new Date(year, month, 0).getDate()

      const { data: rows } = await supabase
        .from('transactions')
        .select('type, amount, category, investment_vehicle, is_repayment')
        .gte('date', `${year}-${pad}-01`)
        .lte('date', `${year}-${pad}-${days}`)

      if (!rows) { setLoading(false); return }

      const earned     = rows.filter(r => r.type === 'income' && !r.is_repayment).reduce((s, r) => s + +r.amount, 0)
      const repayments = rows.filter(r => r.type === 'income' &&  r.is_repayment).reduce((s, r) => s + +r.amount, 0)
      const expense    = rows.filter(r => r.type === 'expense'   ).reduce((s, r) => s + +r.amount, 0)
      const investment = rows.filter(r => r.type === 'investment').reduce((s, r) => s + +r.amount, 0)

      const byCategory = {}
      rows.filter(r => r.type === 'expense').forEach(r => {
        byCategory[r.category] = (byCategory[r.category] || 0) + +r.amount
      })
      const byVehicle = {}
      rows.filter(r => r.type === 'investment').forEach(r => {
        const k = r.investment_vehicle || 'Other'
        byVehicle[k] = (byVehicle[k] || 0) + +r.amount
      })

      const result = { earned, repayments, expense, investment, byCategory, byVehicle,
                       balance: earned + repayments - expense - investment }
      setCached(cacheKey, result)
      setData(result)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [year, month, cacheKey])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  return { data, loading }
}

// ─────────────────────────────────────────────────────────────────────────────
// useYearSummary
// ─────────────────────────────────────────────────────────────────────────────
export function useYearSummary(year) {
  const cacheKey = `year:${year}`

  const [data,    setData]    = useState(() => getCached(cacheKey)?.data || null)
  const [loading, setLoading] = useState(() => !getCached(cacheKey))

  const fetch = useCallback(async (force = false) => {
    const cached = getCached(cacheKey)
    if (cached) {
      setData(cached.data)
      setLoading(false)
      if (!force && isFresh(cached)) return
    } else {
      setLoading(true)
    }

    try {
      const { data: rows } = await supabase
        .from('transactions')
        .select('date, type, amount, category, investment_vehicle, is_repayment')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)

      if (!rows) { setLoading(false); return }

      // Build monthly buckets
      // Field names use 'income'/'expense'/'investment' to match what Analytics.jsx reads
      const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1, income: 0, expense: 0, investment: 0, net: 0,
      }))
      rows.forEach(r => {
        const m = new Date(r.date).getMonth()  // 0-indexed
        if (r.type === 'income'     && !r.is_repayment) months[m].income     += +r.amount
        if (r.type === 'expense')                        months[m].expense    += +r.amount
        if (r.type === 'investment')                     months[m].investment += +r.amount
      })
      months.forEach(m => { m.net = m.income - m.expense - m.investment })

      const totEarned  = months.reduce((s, m) => s + m.income,     0)
      const totExpense = months.reduce((s, m) => s + m.expense,    0)
      const totInvest  = months.reduce((s, m) => s + m.investment, 0)

      // Top 5 expense categories
      const catMap = {}
      rows.filter(r => r.type === 'expense').forEach(r => {
        catMap[r.category] = (catMap[r.category] || 0) + +r.amount
      })
      const topCategories = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)

      // Also expose the field names Analytics.jsx reads from this hook
      const avgSavings = totEarned > 0
        ? Math.round(((totEarned - totExpense) / totEarned) * 100)
        : 0

      // byCategory and byVehicle for Analytics spending/portfolio sections
      const byCategory = {}
      const byVehicle  = {}
      rows.filter(r => r.type === 'expense').forEach(r => {
        byCategory[r.category] = (byCategory[r.category] || 0) + +r.amount
      })
      rows.filter(r => r.type === 'investment').forEach(r => {
        const k = r.investment_vehicle || 'Other'
        byVehicle[k] = (byVehicle[k] || 0) + +r.amount
      })

      const result = {
        // names used internally / by other hooks
        months, totEarned, totExpense, totInvest, topCategories,
        // names Analytics.jsx reads
        monthly:         months,           // data?.monthly
        totalIncome:     totEarned,        // data?.totalIncome
        totalExpense:    totExpense,        // data?.totalExpense
        totalInvestment: totInvest,        // data?.totalInvestment
        avgSavings,                        // data?.avgSavings
        byCategory,                        // data?.byCategory
        byVehicle,                         // data?.byVehicle
      }
      setCached(cacheKey, result)
      setData(result)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [year, cacheKey])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  return { data, loading }
}

// ─────────────────────────────────────────────────────────────────────────────
// useRunningBalance
// Returns the running balance up to and including the given month.
// Sums all transactions from the beginning of time to end of that month.
// ─────────────────────────────────────────────────────────────────────────────
export function useRunningBalance(year, month) {
  const cacheKey = `balance:${year}:${month}`

  const [balance, setBalance] = useState(() => getCached(cacheKey)?.data ?? null)
  const [loading, setLoading] = useState(() => !getCached(cacheKey))

  const fetch = useCallback(async (force = false) => {
    const cached = getCached(cacheKey)
    if (cached) {
      setBalance(cached.data)
      setLoading(false)
      if (!force && isFresh(cached)) return
    } else {
      setLoading(true)
    }

    try {
      const pad  = String(month).padStart(2, '0')
      const days = new Date(year, month, 0).getDate()

      const { data: rows } = await supabase
        .from('transactions')
        .select('type, amount, is_repayment')
        .lte('date', `${year}-${pad}-${days}`)

      if (!rows) { setLoading(false); return }

      const bal = rows.reduce((s, r) => {
        if (r.type === 'income')     return s + +r.amount
        if (r.type === 'expense')    return s - +r.amount
        if (r.type === 'investment') return s - +r.amount
        return s
      }, 0)

      setCached(cacheKey, bal)
      setBalance(bal)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [year, month, cacheKey])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  return { balance, loading }
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE OPERATIONS
// Each invalidates only the cache keys it affects — leaves other months warm.
// Analytics year summary stays warm while the affected month/balance refreshes.
// ─────────────────────────────────────────────────────────────────────────────
export async function addTransaction(payload) {
  const user_id = await getCurrentUserId()
  const { error } = await withTimeout(
    supabase.from('transactions').insert([{ ...payload, user_id }])
  )
  if (error) throw error
  // Invalidate the specific month + balance, leave other months warm
  const d = new Date(payload.date)
  invalidateCache(`month:${d.getFullYear()}:${d.getMonth() + 1}`)
  invalidateCache(`balance:`)
  invalidateCache(`txns:`)
  invalidateCache(`year:${d.getFullYear()}`)
}

export async function updateTransaction(id, payload) {
  const { error } = await withTimeout(
    supabase.from('transactions').update(payload).eq('id', id)
  )
  if (error) throw error
  const d = new Date(payload.date)
  invalidateCache(`month:${d.getFullYear()}:${d.getMonth() + 1}`)
  invalidateCache(`balance:`)
  invalidateCache(`txns:`)
  invalidateCache(`year:${d.getFullYear()}`)
}

export async function deleteTransaction(id) {
  const { error } = await withTimeout(
    supabase.from('transactions').delete().eq('id', id)
  )
  if (error) throw error
  // Delete doesn't know the date, so invalidate broadly
  invalidateCache('txns:')
  invalidateCache('month:')
  invalidateCache('balance:')
  invalidateCache('year:')
}
