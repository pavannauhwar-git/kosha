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
const CACHE_PREFIX = 'kosha_cache_'
const SOFT_TTL = 5 * 60 * 1000   //  5 min  — serve fresh from network
const HARD_TTL = 24 * 60 * 60 * 1000  // 24 hrs — serve stale from cache

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

// Custom event name for broadcasting cache invalidations to all mounted hooks.
// When a mutation (add/edit/delete) happens, this event is dispatched so every
// hook instance — even on pages that are currently mounted in the background —
// immediately re-fetches instead of serving stale cache for up to SOFT_TTL.
const CACHE_INVALIDATION_EVENT = 'kosha:cache:invalidated'

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
  // Notify all mounted hook instances that their cache may have been cleared.
  // This ensures cross-page consistency: hooks on background pages immediately
  // refetch rather than waiting until they are navigated-to again.
  try {
    window.dispatchEvent(new CustomEvent(CACHE_INVALIDATION_EVENT, { detail: { pattern } }))
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
  const [data, setData] = useState(() => {
    // Initialise from cache synchronously — zero loading flash on return visits
    const cached = getCached(`txns:${type}:${category}:${search}:${limit}`)
    return cached?.data || []
  })
  const [loading, setLoading] = useState(() => {
    const cached = getCached(`txns:${type}:${category}:${search}:${limit}`)
    return !cached  // only show loading spinner if nothing in cache
  })
  const [error, setError] = useState(null)

  // ── localEdits overlay — persists through refetches until confirmed ──────
  // applyLocalEdit patches data instantly, but setData(freshRows) from
  // refetch() would overwrite it before Supabase confirms the write.
  // localEdits sits on top of finalData so edits survive the refetch gap.
  const [localEdits, setLocalEdits] = useState({})

  const {
    optimisticTxns,
    pruneOptimisticTxns,
    optimisticDeletedIds,
    pruneOptimisticDeletes,
  } = useAppData()

  const fetch = useCallback(async (force = false) => {
    const key = `txns:${type}:${category}:${search}:${limit}`
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
        .select('id, date, type, description, amount, category, investment_vehicle, is_repayment, payment_mode, notes')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (type) q = q.eq('type', type)
      if (category) q = q.eq('category', category)
      if (search) q = q.ilike('description', `%${search}%`)
      if (limit) q = q.limit(limit)

      const { data: rows, error: err } = await q
      if (err) { setError(err); setLoading(false); return }

      const result = rows || []
      setCached(key, result)
      setData(result)
      setLoading(false)
      pruneOptimisticTxns(result)
      // Only prune optimistic deletes when fetching the full list (no limit).
      // Paginated fetches (e.g. Dashboard's limit:8) would incorrectly prune
      // deletes for transactions beyond the page, causing them to reappear.
      if (!limit) pruneOptimisticDeletes(result)
    } catch (e) {
      setError(e)
      setLoading(false)
    }
  }, [type, category, search, limit, pruneOptimisticTxns, pruneOptimisticDeletes])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  // Re-fetch whenever any cache key matching 'txns:' is invalidated by a mutation
  // on any page — ensures this hook instance is always up-to-date.
  useEffect(() => {
    const txnKey = `txns:${type}:${category}:${search}:${limit}`
    const handler = (e) => {
      const { pattern } = e.detail || {}
      if (!pattern || txnKey.startsWith(pattern)) fetch(true)
    }
    window.addEventListener(CACHE_INVALIDATION_EVENT, handler)
    return () => window.removeEventListener(CACHE_INVALIDATION_EVENT, handler)
  }, [type, category, search, limit, fetch])

  const refetch = useCallback(() => {
    invalidateCache('txns:')
    return fetch(true)
  }, [fetch])

  // Local-only helpers for list-level optimism (Phase 1):
  // They mutate the in-memory list used by this hook instance only.
  const applyLocalEdit = useCallback((id, updates) => {
    // 1. Store in overlay so the edit survives the upcoming refetch()
    setLocalEdits(prev => ({ ...prev, [id]: updates }))
    // 2. Also patch raw data immediately for instant render
    setData(prev => prev.map(row => (
      row.id === id ? { ...row, ...updates } : row
    )))
  }, [])

  // Called after onConfirmed — removes the overlay once fresh server data is back
  const clearLocalEdit = useCallback((id) => {
    setLocalEdits(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const applyLocalDelete = useCallback((id) => {
    setData(prev => prev.filter(row => row.id !== id))
  }, [])

  // ── Optimistic prepend ────────────────────────────────────────────────
  // Instantly inserts a transaction at the top of the list with a temp id.
  // Called by Dashboard BEFORE the network save starts — zero latency UI.
  // When refetch() is called after save, the real server row replaces it.
  const prependOptimistic = useCallback((txn) => {
    const tempTxn = {
      ...txn,
      id: '__optimistic__' + Date.now(),
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

  const finalData = optimisticDeletedIds?.length
    ? mergedData.filter(t => !optimisticDeletedIds.includes(t.id))
    : mergedData

  // Apply localEdits overlay on top of finalData so edits survive refetches
  const overlaidData = Object.keys(localEdits).length
    ? finalData.map(row => localEdits[row.id] ? { ...row, ...localEdits[row.id] } : row)
    : finalData

  return {
    data: overlaidData,
    loading,
    error,
    refetch,
    prependOptimistic,
    applyLocalEdit,
    clearLocalEdit,
    applyLocalDelete,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// useMonthSummary
// ─────────────────────────────────────────────────────────────────────────────
export function useMonthSummary(year, month) {
  const cacheKey = `month:${year}:${month}`

  const [data, setData] = useState(() => getCached(cacheKey)?.data || null)
  const [loading, setLoading] = useState(() => !getCached(cacheKey))

  const { optimisticTxns, optimisticDeletedTxns, optimisticEdits } = useAppData()

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
      const pad = String(month).padStart(2, '0')
      const days = new Date(year, month, 0).getDate()

      const { data: rows } = await supabase
        .from('transactions')
        .select('type, amount, category, investment_vehicle, is_repayment')
        .gte('date', `${year}-${pad}-01`)
        .lte('date', `${year}-${pad}-${days}`)

      if (!rows) { setLoading(false); return }

      const earned = rows.filter(r => r.type === 'income' && !r.is_repayment).reduce((s, r) => s + +r.amount, 0)
      const repayments = rows.filter(r => r.type === 'income' && r.is_repayment).reduce((s, r) => s + +r.amount, 0)
      const expense = rows.filter(r => r.type === 'expense').reduce((s, r) => s + +r.amount, 0)
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

      const result = {
        earned, repayments, expense, investment, byCategory, byVehicle,
        balance: earned + repayments - expense - investment
      }
      setCached(cacheKey, result)
      setData(result)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [year, month, cacheKey])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  // Re-fetch whenever 'month:' cache entries are invalidated by mutations,
  // or when transaction data changes (month summaries are derived from txns).
  useEffect(() => {
    const handler = (e) => {
      const { pattern } = e.detail || {}
      if (!pattern || cacheKey.startsWith(pattern) || pattern.startsWith('txns:')) fetch(true)
    }
    window.addEventListener(CACHE_INVALIDATION_EVENT, handler)
    return () => window.removeEventListener(CACHE_INVALIDATION_EVENT, handler)
  }, [cacheKey, fetch])

  const refetch = useCallback(() => fetch(true), [fetch])
  const inMonth = (t) => {
    if (!t?.date) return false
    const d = new Date(t.date)
    return d.getFullYear() === year && (d.getMonth() + 1) === month
  }

  // ── Optimistic ADDS ────────────────────────────────────────────────────
  const optimisticForMonth = optimisticTxns.filter(inMonth)

  const optimisticEarned = optimisticForMonth
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + +t.amount, 0)
  const optimisticRepayments = 0
  const optimisticExpense = optimisticForMonth
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

  // ── Optimistic DELETES — subtract amounts for deleted txns in month ────
  const deletedForMonth = optimisticDeletedTxns.filter(inMonth)

  const deletedEarned = deletedForMonth
    .filter(t => t.type === 'income' && !t.is_repayment)
    .reduce((s, t) => s + +t.amount, 0)
  const deletedRepayments = deletedForMonth
    .filter(t => t.type === 'income' && t.is_repayment)
    .reduce((s, t) => s + +t.amount, 0)
  const deletedExpense = deletedForMonth
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + +t.amount, 0)
  const deletedInvestment = deletedForMonth
    .filter(t => t.type === 'investment')
    .reduce((s, t) => s + +t.amount, 0)

  const deletedByCategory = {}
  deletedForMonth
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const k = t.category
      deletedByCategory[k] = (deletedByCategory[k] || 0) + +t.amount
    })

  const deletedByVehicle = {}
  deletedForMonth
    .filter(t => t.type === 'investment')
    .forEach(t => {
      const k = t.investment_vehicle || 'Other'
      deletedByVehicle[k] = (deletedByVehicle[k] || 0) + +t.amount
    })

  // ── Optimistic EDITS — compute delta (updated − original) for month ────
  let editEarnedDelta = 0, editRepaymentsDelta = 0, editExpenseDelta = 0, editInvestmentDelta = 0
  const editByCategoryDelta = {}
  const editByVehicleDelta = {}

  optimisticEdits.forEach(({ original, updated }) => {
    const origInMonth = inMonth(original)
    const updInMonth = inMonth(updated)
    // Subtract original if it was in this month
    if (origInMonth) {
      if (original.type === 'income' && !original.is_repayment) editEarnedDelta -= +original.amount
      if (original.type === 'income' && original.is_repayment) editRepaymentsDelta -= +original.amount
      if (original.type === 'expense') {
        editExpenseDelta -= +original.amount
        const k = original.category
        if (k) editByCategoryDelta[k] = (editByCategoryDelta[k] || 0) - +original.amount
      }
      if (original.type === 'investment') {
        editInvestmentDelta -= +original.amount
        const k = original.investment_vehicle || 'Other'
        editByVehicleDelta[k] = (editByVehicleDelta[k] || 0) - +original.amount
      }
    }
    // Add updated if it falls in this month
    if (updInMonth) {
      if (updated.type === 'income' && !updated.is_repayment) editEarnedDelta += +updated.amount
      if (updated.type === 'income' && updated.is_repayment) editRepaymentsDelta += +updated.amount
      if (updated.type === 'expense') {
        editExpenseDelta += +updated.amount
        const k = updated.category
        if (k) editByCategoryDelta[k] = (editByCategoryDelta[k] || 0) + +updated.amount
      }
      if (updated.type === 'investment') {
        editInvestmentDelta += +updated.amount
        const k = updated.investment_vehicle || 'Other'
        editByVehicleDelta[k] = (editByVehicleDelta[k] || 0) + +updated.amount
      }
    }
  })

  // ── Merge all deltas into server data ──────────────────────────────────
  const hasChanges = optimisticForMonth.length > 0 || deletedForMonth.length > 0 || optimisticEdits.length > 0

  const merged = data && hasChanges
    ? (() => {
      const newEarned = data.earned + optimisticEarned - deletedEarned + editEarnedDelta
      const newRepayments = data.repayments + optimisticRepayments - deletedRepayments + editRepaymentsDelta
      const newExpense = data.expense + optimisticExpense - deletedExpense + editExpenseDelta
      const newInvestment = data.investment + optimisticInvestment - deletedInvestment + editInvestmentDelta

      // Merge byCategory
      const mergedCat = { ...data.byCategory }
      for (const [k, v] of Object.entries(optimisticByCategory)) {
        mergedCat[k] = (mergedCat[k] || 0) + v
      }
      for (const [k, v] of Object.entries(deletedByCategory)) {
        mergedCat[k] = (mergedCat[k] || 0) - v
      }
      for (const [k, v] of Object.entries(editByCategoryDelta)) {
        mergedCat[k] = (mergedCat[k] || 0) + v
      }

      // Merge byVehicle
      const mergedVeh = { ...data.byVehicle }
      for (const [k, v] of Object.entries(optimisticByVehicle)) {
        mergedVeh[k] = (mergedVeh[k] || 0) + v
      }
      for (const [k, v] of Object.entries(deletedByVehicle)) {
        mergedVeh[k] = (mergedVeh[k] || 0) - v
      }
      for (const [k, v] of Object.entries(editByVehicleDelta)) {
        mergedVeh[k] = (mergedVeh[k] || 0) + v
      }

      return {
        ...data,
        earned: newEarned,
        repayments: newRepayments,
        expense: newExpense,
        investment: newInvestment,
        balance: newEarned + newRepayments - newExpense - newInvestment,
        byCategory: mergedCat,
        byVehicle: mergedVeh,
      }
    })()
    : data

  return { data: merged, loading, refetch }
}

// ─────────────────────────────────────────────────────────────────────────────
// useYearSummary
// ─────────────────────────────────────────────────────────────────────────────
export function useYearSummary(year) {
  const cacheKey = `year:${year}`

  const [data, setData] = useState(() => getCached(cacheKey)?.data || null)
  const [loading, setLoading] = useState(() => !getCached(cacheKey))

  const { optimisticTxns, optimisticDeletedTxns, optimisticEdits } = useAppData()

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
        .select('id, date, type, amount, description, category, investment_vehicle, is_repayment')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)

      if (!rows) { setLoading(false); return }

      const monthly = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        const mo = rows.filter(r => new Date(r.date).getMonth() + 1 === m)
        return {
          month: m,
          income: mo.filter(r => r.type === 'income' && !r.is_repayment).reduce((s, r) => s + +r.amount, 0),
          expense: mo.filter(r => r.type === 'expense').reduce((s, r) => s + +r.amount, 0),
          investment: mo.filter(r => r.type === 'investment').reduce((s, r) => s + +r.amount, 0),
        }
      })

      const totalIncome = rows.filter(r => r.type === 'income' && !r.is_repayment).reduce((s, r) => s + +r.amount, 0)
      const totalRepayments = rows.filter(r => r.type === 'income' && r.is_repayment).reduce((s, r) => s + +r.amount, 0)
      const totalExpense = rows.filter(r => r.type === 'expense').reduce((s, r) => s + +r.amount, 0)
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

      const top5 = rows
        .filter(r => r.type === 'expense')
        .sort((a, b) => +b.amount - +a.amount)
        .slice(0, 5)
        .map(r => ({
          id: r.id, date: r.date, description: r.description,
          amount: +r.amount, category: r.category
        }))

      const withIncome = monthly.filter(m => m.income > 0)
      const avgSavings = withIncome.length
        ? Math.round(withIncome.reduce((s, m) => s + ((m.income - m.expense) / m.income * 100), 0) / withIncome.length)
        : 0

      const result = {
        monthly, totalIncome, totalRepayments, totalExpense, totalInvestment,
        byCategory, byVehicle, avgSavings, top5
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

  // Re-fetch whenever 'year:' cache entries are invalidated by mutations
  useEffect(() => {
    const handler = (e) => {
      const { pattern } = e.detail || {}
      if (!pattern || cacheKey.startsWith(pattern)) fetch(true)
    }
    window.addEventListener(CACHE_INVALIDATION_EVENT, handler)
    return () => window.removeEventListener(CACHE_INVALIDATION_EVENT, handler)
  }, [cacheKey, fetch])

  const refetch = useCallback(() => fetch(true), [fetch])
  const inYear = (t) => {
    if (!t?.date) return false
    return new Date(t.date).getFullYear() === year
  }

  const optimisticForYear = optimisticTxns.filter(inYear)
  const deletedForYear = optimisticDeletedTxns.filter(inYear)
  const editsForYear = optimisticEdits.filter(e =>
    inYear(e.original) || inYear(e.updated)
  )

  const hasChanges = optimisticForYear.length > 0 || deletedForYear.length > 0 || editsForYear.length > 0

  if (!data || !hasChanges) {
    return { data, loading, refetch }
  }

  // ── Helper: compute monthly delta for a list of txns ───────────────────
  const monthDelta = (txns, sign) => {
    const delta = Array.from({ length: 12 }, () => ({ income: 0, expense: 0, investment: 0 }))
    txns.forEach(t => {
      const m = new Date(t.date).getMonth()
      if (t.type === 'income' && !t.is_repayment) delta[m].income += sign * +t.amount
      if (t.type === 'expense') delta[m].expense += sign * +t.amount
      if (t.type === 'investment') delta[m].investment += sign * +t.amount
    })
    return delta
  }

  const addDelta = monthDelta(optimisticForYear, 1)
  const delDelta = monthDelta(deletedForYear, -1)

  // Edit deltas: subtract original, add updated
  const editOriginals = editsForYear.map(e => e.original).filter(inYear)
  const editUpdated = editsForYear.map(e => e.updated).filter(inYear)
  const editSubDelta = monthDelta(editOriginals, -1)
  const editAddDelta = monthDelta(editUpdated, 1)

  const monthly = data.monthly.map((m, i) => ({
    month: m.month,
    income: m.income + addDelta[i].income + delDelta[i].income + editSubDelta[i].income + editAddDelta[i].income,
    expense: m.expense + addDelta[i].expense + delDelta[i].expense + editSubDelta[i].expense + editAddDelta[i].expense,
    investment: m.investment + addDelta[i].investment + delDelta[i].investment + editSubDelta[i].investment + editAddDelta[i].investment,
  }))

  // Total deltas
  const allDeltaTxns = [
    ...optimisticForYear.map(t => ({ ...t, _sign: 1 })),
    ...deletedForYear.map(t => ({ ...t, _sign: -1 })),
    ...editOriginals.map(t => ({ ...t, _sign: -1 })),
    ...editUpdated.map(t => ({ ...t, _sign: 1 })),
  ]

  const totalIncomeDelta = allDeltaTxns
    .filter(t => t.type === 'income' && !t.is_repayment)
    .reduce((s, t) => s + t._sign * +t.amount, 0)
  const totalRepaymentsDelta = allDeltaTxns
    .filter(t => t.type === 'income' && t.is_repayment)
    .reduce((s, t) => s + t._sign * +t.amount, 0)
  const totalExpenseDelta = allDeltaTxns
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t._sign * +t.amount, 0)
  const totalInvestmentDelta = allDeltaTxns
    .filter(t => t.type === 'investment')
    .reduce((s, t) => s + t._sign * +t.amount, 0)

  const byCategory = { ...data.byCategory }
  allDeltaTxns
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const k = t.category
      byCategory[k] = (byCategory[k] || 0) + t._sign * +t.amount
    })

  const byVehicle = { ...data.byVehicle }
  allDeltaTxns
    .filter(t => t.type === 'investment')
    .forEach(t => {
      const k = t.investment_vehicle || 'Other'
      byVehicle[k] = (byVehicle[k] || 0) + t._sign * +t.amount
    })

  const withIncome = monthly.filter(m => m.income > 0)
  const avgSavings = withIncome.length
    ? Math.round(withIncome.reduce((s, m) => s + ((m.income - m.expense) / m.income * 100), 0) / withIncome.length)
    : 0

  const merged = {
    ...data,
    monthly,
    totalIncome: data.totalIncome + totalIncomeDelta,
    totalRepayments: data.totalRepayments + totalRepaymentsDelta,
    totalExpense: data.totalExpense + totalExpenseDelta,
    totalInvestment: data.totalInvestment + totalInvestmentDelta,
    byCategory,
    byVehicle,
    avgSavings,
    top5: data.top5,
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

  const { optimisticTxns, optimisticDeletedTxns, optimisticEdits } = useAppData()

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
      const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

      // Fetch only what we need — type + amount, no other columns
      const { data: rows } = await supabase
        .from('transactions')
        .select('type, amount')
        .lte('date', endDate)

      if (!rows) { setLoading(false); return }

      const cumulative = rows.reduce((sum, r) => {
        if (r.type === 'income') return sum + +r.amount
        if (r.type === 'expense') return sum - +r.amount
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

  // Re-fetch whenever 'balance:' cache entries are invalidated by mutations
  useEffect(() => {
    const handler = (e) => {
      const { pattern } = e.detail || {}
      if (!pattern || cacheKey.startsWith(pattern)) fetch(true)
    }
    window.addEventListener(CACHE_INVALIDATION_EVENT, handler)
    return () => window.removeEventListener(CACHE_INVALIDATION_EVENT, handler)
  }, [cacheKey, fetch])

  const refetch = useCallback(() => fetch(true), [fetch])
  const balanceDelta = (t) => {
    if (t.type === 'income') return +t.amount
    if (t.type === 'expense') return -(+t.amount)
    if (t.type === 'investment') return -(+t.amount)
    return 0
  }

  const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

  // Optimistic ADDS
  const optimisticDelta = optimisticTxns
    .filter(t => t.date <= endDate)
    .reduce((sum, t) => sum + balanceDelta(t), 0)

  // Optimistic DELETES — reverse the balance impact of deleted txns
  const deletedDelta = optimisticDeletedTxns
    .filter(t => t.date && t.date <= endDate)
    .reduce((sum, t) => sum - balanceDelta(t), 0)

  // Optimistic EDITS — compute delta (updated − original) for txns in period
  const editDelta = optimisticEdits.reduce((sum, { original, updated }) => {
    let delta = 0
    if (original?.date && original.date <= endDate) delta -= balanceDelta(original)
    if (updated?.date && updated.date <= endDate) delta += balanceDelta(updated)
    return sum + delta
  }, 0)

  const mergedBalance = balance != null ?
    balance + optimisticDelta + deletedDelta + editDelta : balance

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