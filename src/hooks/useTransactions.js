import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAppData } from './useAppDataStore'

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENT CACHE
//
// Survives browser refresh, app close, and PWA reopen.
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
const SOFT_TTL      =   5 * 60 * 1000   //  5 min  — serve fresh from network
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

  const { optimisticTxns } = useAppData()

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

  const refetch = useCallback(() => {
    invalidateCache('txns:')
    return fetch(true)
  }, [fetch])

  // ── Optimistic prepend ────────────────────────────────────────────────
  // Instantly inserts a transaction at the top of the list with a temp id.
  // Called by Dashboard BEFORE the network save starts — zero latency UI.
  // When refetch() is called after save, the real server row replaces it.
  const prependOptimistic = useCallback((txn) => {
    const tempTxn = {
      ...txn,
      id:         '__optimistic__' + Date.now(),
      created_at: new Date().toISOString(),
    }
    setData(prev => [tempTxn, ...prev].slice(0, limit || 999))
  }, [limit])

  const optimisticForList = optimisticTxns.filter(t => {
    if (type && t.type !== type) return false
    if (category && t.category !== category) return false
    if (search && !t.description?.toLowerCase().includes(String(search).toLowerCase())) return false
    return true
  })

  const mergedData = optimisticForList.length
    ? [...optimisticForList.map(t => ({
        ...t,
        id: t._id || t.id,
      })), ...data].slice(0, limit || data.length || 999)
    : data

  return { data: mergedData, loading, error, refetch, prependOptimistic }
}

// ─────────────────────────────────────────────────────────────────────────────
// useMonthSummary
// ─────────────────────────────────────────────────────────────────────────────
export function useMonthSummary(year, month) {
  const cacheKey = `month:${year}:${month}`

  const [data,    setData]    = useState(() => getCached(cacheKey)?.data || null)
  const [loading, setLoading] = useState(() => !getCached(cacheKey))

  const { optimisticTxns } = useAppData()

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

  const refetch = useCallback(() => fetch(true), [fetch])

  const optimisticForMonth = optimisticTxns.filter(t => {
    const d = new Date(t.date)
    return d.getFullYear() === year && (d.getMonth() + 1) === month
  })

  const optimisticEarned     = optimisticForMonth
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + +t.amount, 0)
  const optimisticRepayments = 0
  const optimisticExpense    = optimisticForMonth
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + +t.amount, 0)
  const optimisticInvestment = optimisticForMonth
    .filter(t => t.type === 'investment')
    .reduce((s, t) => s + +t.amount, 0)

  const optimisticByCategory = {}
  optimisticForMonth
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const k = t.category
      optimisticByCategory[k] = (optimisticByCategory[k] || 0) + +t.amount
    })

  const optimisticByVehicle = {}
  optimisticForMonth
    .filter(t => t.type === 'investment')
    .forEach(t => {
      const k = t.investment_vehicle || 'Other'
      optimisticByVehicle[k] = (optimisticByVehicle[k] || 0) + +t.amount
    })

  const merged = data && optimisticForMonth.length > 0
    ? {
        ...data,
        earned:     data.earned     + optimisticEarned,
        repayments: data.repayments + optimisticRepayments,
        expense:    data.expense    + optimisticExpense,
        investment: data.investment + optimisticInvestment,
        balance:    data.balance    + optimisticEarned + optimisticRepayments - optimisticExpense - optimisticInvestment,
        byCategory: {
          ...data.byCategory,
          ...Object.fromEntries(
            Object.entries(optimisticByCategory).map(([k, v]) => [k, (data.byCategory[k] || 0) + v])
          ),
        },
        byVehicle: {
          ...data.byVehicle,
          ...Object.fromEntries(
            Object.entries(optimisticByVehicle).map(([k, v]) => [k, (data.byVehicle[k] || 0) + v])
          ),
        },
      }
    : data

  return { data: merged, loading, refetch }
}

// ─────────────────────────────────────────────────────────────────────────────
// useYearSummary
// ─────────────────────────────────────────────────────────────────────────────
export function useYearSummary(year) {
  const cacheKey = `year:${year}`

  const [data,    setData]    = useState(() => getCached(cacheKey)?.data || null)
  const [loading, setLoading] = useState(() => !getCached(cacheKey))

  const { optimisticTxns } = useAppData()

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
        .select('type, amount, category, investment_vehicle, is_repayment, date')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)

      if (!rows) { setLoading(false); return }

      const monthly = Array.from({ length: 12 }, (_, i) => {
        const m  = i + 1
        const mo = rows.filter(r => new Date(r.date).getMonth() + 1 === m)
        return {
          month:      m,
          income:     mo.filter(r => r.type === 'income' && !r.is_repayment).reduce((s, r) => s + +r.amount, 0),
          expense:    mo.filter(r => r.type === 'expense'   ).reduce((s, r) => s + +r.amount, 0),
          investment: mo.filter(r => r.type === 'investment').reduce((s, r) => s + +r.amount, 0),
        }
      })

      const totalIncome     = rows.filter(r => r.type === 'income' && !r.is_repayment).reduce((s, r) => s + +r.amount, 0)
      const totalRepayments = rows.filter(r => r.type === 'income' &&  r.is_repayment).reduce((s, r) => s + +r.amount, 0)
      const totalExpense    = rows.filter(r => r.type === 'expense'   ).reduce((s, r) => s + +r.amount, 0)
      const totalInvestment = rows.filter(r => r.type === 'investment').reduce((s, r) => s + +r.amount, 0)

      const byCategory = {}
      rows.filter(r => r.type === 'expense').forEach(r => {
        byCategory[r.category] = (byCategory[r.category] || 0) + +r.amount
      })
      const byVehicle = {}
      rows.filter(r => r.type === 'investment').forEach(r => {
        const k = r.investment_vehicle || 'Other'
        byVehicle[k] = (byVehicle[k] || 0) + +r.amount
      })

      const withIncome = monthly.filter(m => m.income > 0)
      const avgSavings = withIncome.length
        ? Math.round(withIncome.reduce((s, m) => s + ((m.income - m.expense) / m.income * 100), 0) / withIncome.length)
        : 0

      const result = { monthly, totalIncome, totalRepayments, totalExpense, totalInvestment,
                       byCategory, byVehicle, avgSavings }
      setCached(cacheKey, result)
      setData(result)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [year, cacheKey])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  const refetch = useCallback(() => fetch(true), [fetch])

  const optimisticForYear = optimisticTxns.filter(t => {
    const d = new Date(t.date)
    return d.getFullYear() === year
  })

  if (!data || optimisticForYear.length === 0) {
    return { data, loading, refetch }
  }

  const monthly = data.monthly.map(m => {
    const monthTxns = optimisticForYear.filter(t => {
      const d = new Date(t.date)
      return (d.getMonth() + 1) === m.month
    })
    const income     = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + +t.amount, 0)
    const expense    = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + +t.amount, 0)
    const investment = monthTxns.filter(t => t.type === 'investment').reduce((s, t) => s + +t.amount, 0)
    return {
      month:      m.month,
      income:     m.income     + income,
      expense:    m.expense    + expense,
      investment: m.investment + investment,
    }
  })

  const totalIncomeDelta     = optimisticForYear.filter(t => t.type === 'income').reduce((s, t) => s + +t.amount, 0)
  const totalRepaymentsDelta = 0
  const totalExpenseDelta    = optimisticForYear.filter(t => t.type === 'expense').reduce((s, t) => s + +t.amount, 0)
  const totalInvestmentDelta = optimisticForYear.filter(t => t.type === 'investment').reduce((s, t) => s + +t.amount, 0)

  const byCategory = { ...data.byCategory }
  optimisticForYear
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const k = t.category
      byCategory[k] = (byCategory[k] || 0) + +t.amount
    })

  const byVehicle = { ...data.byVehicle }
  optimisticForYear
    .filter(t => t.type === 'investment')
    .forEach(t => {
      const k = t.investment_vehicle || 'Other'
      byVehicle[k] = (byVehicle[k] || 0) + +t.amount
    })

  const withIncome = monthly.filter(m => m.income > 0)
  const avgSavings = withIncome.length
    ? Math.round(withIncome.reduce((s, m) => s + ((m.income - m.expense) / m.income * 100), 0) / withIncome.length)
    : 0

  const merged = {
    ...data,
    monthly,
    totalIncome:     data.totalIncome     + totalIncomeDelta,
    totalRepayments: data.totalRepayments + totalRepaymentsDelta,
    totalExpense:    data.totalExpense    + totalExpenseDelta,
    totalInvestment: data.totalInvestment + totalInvestmentDelta,
    byCategory,
    byVehicle,
    avgSavings,
  }

  return { data: merged, loading, refetch }
}

// ─────────────────────────────────────────────────────────────────────────────
// useRunningBalance
//
// FIXED: The old version fetched ALL historical transactions with no lower
// bound (potentially 500+ rows) just to sum them. This version uses a
// Postgres aggregate — one number comes back instead of all rows.
// ─────────────────────────────────────────────────────────────────────────────
export function useRunningBalance(year, month) {
  const cacheKey = `balance:${year}:${month}`

  const [balance, setBalance] = useState(() => {
    const cached = getCached(cacheKey)
    return cached?.data ?? null
  })
  const [loading, setLoading] = useState(() => !getCached(cacheKey))

  const { optimisticTxns } = useAppData()

  const fetch = useCallback(async (force = false) => {
    const cached = getCached(cacheKey)
    if (cached !== null && cached !== undefined) {
      setBalance(cached.data)
      setLoading(false)
      if (!force && isFresh(cached)) return
    } else {
      setLoading(true)
    }

    try {
      const endDate = `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`

      // Fetch only what we need — type + amount, no other columns
      const { data: rows } = await supabase
        .from('transactions')
        .select('type, amount')
        .lte('date', endDate)

      if (!rows) { setLoading(false); return }

      const cumulative = rows.reduce((sum, r) => {
        if (r.type === 'income')     return sum + +r.amount
        if (r.type === 'expense')    return sum - +r.amount
        if (r.type === 'investment') return sum - +r.amount
        return sum
      }, 0)

      setCached(cacheKey, cumulative)
      setBalance(cumulative)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [year, month, cacheKey])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  const refetch = useCallback(() => fetch(true), [fetch])

  const endDate = `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`
  const optimisticForPeriod = optimisticTxns.filter(t => t.date <= endDate)

  const optimisticDelta = optimisticForPeriod.reduce((sum, t) => {
    if (t.type === 'income')     return sum + +t.amount
    if (t.type === 'expense')    return sum - +t.amount
    if (t.type === 'investment') return sum - +t.amount
    return sum
  }, 0)

  const mergedBalance = balance != null ? balance + optimisticDelta : balance

  return { balance: mergedBalance, loading, refetch }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// All writes invalidate only the relevant cache keys rather than wiping
// everything — so unrelated cached data (e.g. Analytics year summary)
// stays warm while the affected month/balance refreshes.
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
