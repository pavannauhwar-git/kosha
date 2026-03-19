import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAppData } from './useAppDataStore'

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENT CACHE — survives browser refresh, app close, and PWA reopen.
// Structure in localStorage: { data: ..., ts: epoch_ms }
// TTL: 5 min soft (stale-while-revalidate), 24 hr hard.
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_PREFIX = 'kosha_cache_'
const RECENT_CONFIRMED_TXNS_KEY = 'kosha_recent_confirmed_txns'
const SOFT_TTL = 5 * 60 * 1000   //  5 min  — serve fresh from network
const HISTORY_MONTH_SOFT_TTL = 20 * 60 * 1000 // 20 min for past months
const HISTORY_YEAR_SOFT_TTL = 30 * 60 * 1000  // 30 min for yearly summaries
const HARD_TTL = 24 * 60 * 60 * 1000  // 24 hrs — serve stale from cache
const RECENT_CONFIRMED_TXN_TTL = 10 * 60 * 1000 // 10 min lag bridge for post-reload fetches

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

function getSoftTtlForKey(key) {
  if (!key) return SOFT_TTL
  if (key.startsWith('year:')) return HISTORY_YEAR_SOFT_TTL

  if (key.startsWith('month:')) {
    const [, yRaw, mRaw] = key.split(':')
    const y = Number(yRaw)
    const m = Number(mRaw)
    if (Number.isFinite(y) && Number.isFinite(m)) {
      const now = new Date()
      const currentMonthIndex = now.getFullYear() * 12 + now.getMonth()
      const queryMonthIndex = y * 12 + (m - 1)
      if (queryMonthIndex < currentMonthIndex) return HISTORY_MONTH_SOFT_TTL
    }
  }

  return SOFT_TTL
}

function isFresh(entry, key) {
  return entry && (Date.now() - entry.ts < getSoftTtlForKey(key))
}

// Custom event name for broadcasting cache invalidations to all mounted hooks.
// When a mutation (add/edit/delete) happens, this event is dispatched so every
// hook instance — even on pages that are currently mounted in the background —
// immediately re-fetches instead of serving stale cache for up to SOFT_TTL.
const CACHE_INVALIDATION_EVENT = 'kosha:cache:invalidated'

export function invalidateCache(pattern) {
  // Mark matching cache entries as stale (ts=0) instead of deleting them,
  // preserving the stale-while-revalidate pattern.
  try {
    const keys = Object.keys(localStorage)
    keys.forEach(k => {
      if (!k.startsWith(CACHE_PREFIX)) return
      const suffix = k.slice(CACHE_PREFIX.length)
      if (!pattern || suffix.startsWith(pattern)) {
        const raw = localStorage.getItem(k)
        if (raw) {
          try {
            const entry = JSON.parse(raw)
            entry.ts = 0
            localStorage.setItem(k, JSON.stringify(entry))
          } catch { /* corrupt entry — remove it */ localStorage.removeItem(k) }
        }
      }
    })
  } catch { /* ignore */ }
  try {
    window.dispatchEvent(new CustomEvent(CACHE_INVALIDATION_EVENT, { detail: { pattern } }))
  } catch { /* ignore */ }
}

function readCacheEntryBySuffix(suffix) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + suffix)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeCacheEntryBySuffix(suffix, data, ts) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + suffix,
      JSON.stringify({ data, ts: Number.isFinite(ts) ? ts : Date.now() })
    )
  } catch {
    // ignore cache write errors
  }
}

function parseTxnCacheSuffix(suffix) {
  if (!suffix?.startsWith('txns:')) return null
  const raw = suffix.slice('txns:'.length)
  const parts = raw.split(':')
  if (parts.length < 4) return null
  const typeRaw = parts[0]
  const categoryRaw = parts[1]
  const limitRaw = parts[parts.length - 1]
  const searchRaw = parts.slice(2, -1).join(':')
  const limit = limitRaw === 'undefined' ? undefined : Number(limitRaw)
  return {
    type: typeRaw === 'undefined' ? undefined : typeRaw,
    category: categoryRaw === 'undefined' ? undefined : categoryRaw,
    search: searchRaw === 'undefined' ? undefined : searchRaw,
    limit: Number.isFinite(limit) ? limit : undefined,
  }
}

function txnMatchesCacheFilter(txn, parsedKey) {
  if (!txn || !parsedKey) return false
  if (parsedKey.type && txn.type !== parsedKey.type) return false
  if (parsedKey.category && txn.category !== parsedKey.category) return false
  if (parsedKey.search) {
    const needle = String(parsedKey.search).toLowerCase()
    const hay = String(txn.description || '').toLowerCase()
    if (!hay.includes(needle)) return false
  }
  return true
}

function compareTxnRows(a, b) {
  const dateCmp = String(b?.date || '').localeCompare(String(a?.date || ''))
  if (dateCmp !== 0) return dateCmp
  return String(b?.created_at || '').localeCompare(String(a?.created_at || ''))
}

function readRecentConfirmedTxnMap() {
  try {
    const raw = localStorage.getItem(RECENT_CONFIRMED_TXNS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeRecentConfirmedTxnMap(map) {
  try {
    localStorage.setItem(RECENT_CONFIRMED_TXNS_KEY, JSON.stringify(map))
  } catch {
    // ignore marker persistence errors
  }
}

function parseRecentConfirmedEntry(entry) {
  if (typeof entry === 'number') {
    return Number.isFinite(entry) ? { ts: entry, txn: null } : null
  }
  if (!entry || typeof entry !== 'object') return null
  const ts = Number(entry.ts)
  if (!Number.isFinite(ts)) return null
  const txn = entry.txn && typeof entry.txn === 'object' ? entry.txn : null
  return { ts, txn }
}

function normalizeRecentConfirmedEntry(entry, parsed) {
  const hasNormalizedNumber = typeof entry === 'number' && entry === parsed.ts
  const hasNormalizedObject = !!(
    entry &&
    typeof entry === 'object' &&
    Number(entry.ts) === parsed.ts &&
    (entry.txn || null) === (parsed.txn || null)
  )
  return {
    normalized: parsed.txn ? { ts: parsed.ts, txn: parsed.txn } : parsed.ts,
    isAlreadyNormalized: hasNormalizedNumber || hasNormalizedObject,
  }
}

function getRecentConfirmedTxnIds() {
  const now = Date.now()
  const map = readRecentConfirmedTxnMap()
  let changed = false
  const next = {}
  Object.entries(map).forEach(([id, entry]) => {
    const parsed = parseRecentConfirmedEntry(entry)
    if (!parsed || parsed.ts > now || now - parsed.ts > RECENT_CONFIRMED_TXN_TTL) {
      changed = true
      return
    }
    const { normalized, isAlreadyNormalized } = normalizeRecentConfirmedEntry(entry, parsed)
    if (!isAlreadyNormalized) changed = true
    next[id] = normalized
  })
  if (changed) writeRecentConfirmedTxnMap(next)
  return new Set(Object.keys(next))
}

function getRecentConfirmedTxnRows() {
  const now = Date.now()
  const map = readRecentConfirmedTxnMap()
  let changed = false
  const next = {}
  const rows = []

  Object.entries(map).forEach(([id, entry]) => {
    const parsed = parseRecentConfirmedEntry(entry)
    if (!parsed || parsed.ts > now || now - parsed.ts > RECENT_CONFIRMED_TXN_TTL) {
      changed = true
      return
    }
    const { normalized, isAlreadyNormalized } = normalizeRecentConfirmedEntry(entry, parsed)
    if (!isAlreadyNormalized) changed = true
    next[id] = normalized
    if (parsed.txn?.id) rows.push(parsed.txn)
  })

  if (changed) writeRecentConfirmedTxnMap(next)
  return rows
}

function markRecentConfirmedTxn(txn) {
  if (!txn?.id) return
  const map = readRecentConfirmedTxnMap()
  map[txn.id] = { ts: Date.now(), txn }
  writeRecentConfirmedTxnMap(map)
}

function reconcileRecentConfirmedTxns({
  rows,
  cachedRows,
  type,
  category,
  search,
  limit,
}) {
  if (!Array.isArray(rows)) return rows || []

  const recentIds = getRecentConfirmedTxnIds()
  if (!recentIds.size) return rows

  const recentRows = getRecentConfirmedTxnRows()
  const bridgeRows = [
    ...(Array.isArray(cachedRows) ? cachedRows : []),
    ...recentRows,
  ]
  if (!bridgeRows.length) return rows

  const seenBridgeIds = new Set()
  const uniqueBridgeRows = bridgeRows.filter((row) => {
    const id = row?.id
    if (!id) return false
    if (seenBridgeIds.has(id)) return false
    seenBridgeIds.add(id)
    return true
  })

  const filterOptions = { type, category, search, limit }
  const networkIds = new Set(rows.map((r) => r?.id).filter(Boolean))
  const missingRecentRows = uniqueBridgeRows.filter((r) =>
    (r?.id && recentIds.has(r.id) && !networkIds.has(r.id)) &&
    txnMatchesCacheFilter(r, filterOptions)
  )
  if (!missingRecentRows.length) return rows

  const seenIds = new Set()
  const merged = [...rows, ...missingRecentRows]
    .filter((r) => {
      if (!r?.id) return true
      if (seenIds.has(r.id)) return false
      seenIds.add(r.id)
      return true
    })
    .sort(compareTxnRows)

  return limit ? merged.slice(0, limit) : merged
}

/**
 * Writes a confirmed transaction into existing local caches immediately so a
 * page reload does not temporarily hide the new row while backend replicas or
 * delayed reads catch up.
 */
export function mergeConfirmedTransactionIntoCache(txn) {
  if (!txn?.id) return
  markRecentConfirmedTxn(txn)
  try {
    const keys = Object.keys(localStorage)
    keys.forEach((fullKey) => {
      if (!fullKey.startsWith(CACHE_PREFIX)) return
      const suffix = fullKey.slice(CACHE_PREFIX.length)
      const entry = readCacheEntryBySuffix(suffix)
      if (!entry) return

      if (suffix.startsWith('txns:') && Array.isArray(entry.data)) {
        const parsed = parseTxnCacheSuffix(suffix)
        if (!txnMatchesCacheFilter(txn, parsed)) return
        const merged = [txn, ...entry.data.filter((row) => row?.id !== txn.id)]
          .sort(compareTxnRows)
        const limited = parsed?.limit ? merged.slice(0, parsed.limit) : merged
        writeCacheEntryBySuffix(suffix, limited, entry.ts)
        return
      }

      if (suffix.startsWith('month:') && entry.data && typeof entry.data === 'object') {
        const [, yRaw, mRaw] = suffix.split(':')
        const y = Number(yRaw)
        const m = Number(mRaw)
        if (!Number.isFinite(y) || !Number.isFinite(m)) return
        const d = new Date(txn.date)
        if (d.getFullYear() !== y || d.getMonth() + 1 !== m) return

        const next = {
          ...entry.data,
          byCategory: { ...(entry.data.byCategory || {}) },
          byVehicle: { ...(entry.data.byVehicle || {}) },
        }
        if (txn.type === 'income') {
          if (txn.is_repayment) next.repayments = (next.repayments || 0) + +txn.amount
          else next.earned = (next.earned || 0) + +txn.amount
        } else if (txn.type === 'expense') {
          next.expense = (next.expense || 0) + +txn.amount
          const cat = txn.category
          if (cat) next.byCategory[cat] = (next.byCategory[cat] || 0) + +txn.amount
        } else if (txn.type === 'investment') {
          next.investment = (next.investment || 0) + +txn.amount
          const veh = txn.investment_vehicle || 'Other'
          next.byVehicle[veh] = (next.byVehicle[veh] || 0) + +txn.amount
        }
        next.balance = (next.earned || 0) + (next.repayments || 0) - (next.expense || 0) - (next.investment || 0)
        writeCacheEntryBySuffix(suffix, next, entry.ts)
        return
      }

      if (suffix.startsWith('year:') && entry.data && typeof entry.data === 'object') {
        const [, yRaw] = suffix.split(':')
        const y = Number(yRaw)
        if (!Number.isFinite(y)) return
        const d = new Date(txn.date)
        if (d.getFullYear() !== y) return
        const monthIdx = d.getMonth()
        const nextMonthly = Array.isArray(entry.data.monthly)
          ? entry.data.monthly.map((row) => ({ ...row }))
          : []
        if (nextMonthly[monthIdx]) {
          if (txn.type === 'income' && !txn.is_repayment) nextMonthly[monthIdx].income += +txn.amount
          if (txn.type === 'expense') nextMonthly[monthIdx].expense += +txn.amount
          if (txn.type === 'investment') nextMonthly[monthIdx].investment += +txn.amount
        }

        const next = {
          ...entry.data,
          monthly: nextMonthly,
          byCategory: { ...(entry.data.byCategory || {}) },
          byVehicle: { ...(entry.data.byVehicle || {}) },
        }
        if (txn.type === 'income') {
          if (txn.is_repayment) next.totalRepayments = (next.totalRepayments || 0) + +txn.amount
          else next.totalIncome = (next.totalIncome || 0) + +txn.amount
        } else if (txn.type === 'expense') {
          next.totalExpense = (next.totalExpense || 0) + +txn.amount
          const cat = txn.category
          if (cat) next.byCategory[cat] = (next.byCategory[cat] || 0) + +txn.amount
          if (Array.isArray(next.top5)) {
            next.top5 = [
              { id: txn.id, date: txn.date, description: txn.description, amount: +txn.amount, category: txn.category },
              ...next.top5.filter((row) => row?.id !== txn.id),
            ]
              .sort((a, b) => (+b.amount || 0) - (+a.amount || 0))
              .slice(0, 5)
          }
        } else if (txn.type === 'investment') {
          next.totalInvestment = (next.totalInvestment || 0) + +txn.amount
          const veh = txn.investment_vehicle || 'Other'
          next.byVehicle[veh] = (next.byVehicle[veh] || 0) + +txn.amount
        }
        writeCacheEntryBySuffix(suffix, next, entry.ts)
        return
      }

      if (suffix.startsWith('balance:') && typeof entry.data === 'number') {
        const [, yRaw, mRaw] = suffix.split(':')
        const y = Number(yRaw)
        const m = Number(mRaw)
        if (!Number.isFinite(y) || !Number.isFinite(m)) return
        const endDate = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`
        if (!txn.date || txn.date > endDate) return
        let delta = 0
        if (txn.type === 'income') delta = +txn.amount
        if (txn.type === 'expense' || txn.type === 'investment') delta = -(+txn.amount)
        writeCacheEntryBySuffix(suffix, entry.data + delta, entry.ts)
      }
    })
  } catch {
    // ignore cache patch errors
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIMISTIC ID HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** The prefix used for all temporary optimistic transaction IDs. */
export const OPTIMISTIC_ID_PREFIX = '__optimistic__'

/**
 * Returns true if `id` is a temporary optimistic ID (not yet confirmed by the server).
 * Use this guard before any Supabase write that requires a real UUID.
 */
export function isOptimisticId(id) {
  return typeof id === 'string' && id.startsWith(OPTIMISTIC_ID_PREFIX)
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

  // Ref always tracks the latest localEdits value so clearLocalEdit /
  // revertLocalEdit can read it without needing it as a useCallback dep.
  const localEditsRef = useRef(localEdits)
  localEditsRef.current = localEdits

  const {
    optimisticTxns,
    pruneOptimisticTxns,
    optimisticDeletedIds,
    pruneOptimisticDeletes,
    pruneOptimisticEdits,
  } = useAppData()

  // Fetch version guard — discards stale concurrent fetches.
  const fetchVersionRef = useRef(0)

  const fetch = useCallback(async (force = false) => {
    const myVersion = ++fetchVersionRef.current
    const key = `txns:${type}:${category}:${search}:${limit}`
    const cached = getCached(key)

    if (cached) {
      if (!force) {
        setData(cached.data)
        setLoading(false)
      }
      if (!force && isFresh(cached, key)) return
    } else {
      setLoading(true)
    }

    try {
      let q = supabase
        .from('transactions')
        .select('id, date, type, description, amount, category, investment_vehicle, is_repayment, payment_mode, notes, created_at')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (type) q = q.eq('type', type)
      if (category) q = q.eq('category', category)
      if (search) q = q.ilike('description', `%${search}%`)
      if (limit) q = q.limit(limit)

      const { data: rows, error: err } = await q

      if (myVersion !== fetchVersionRef.current) return

      if (err) { setError(err); setLoading(false); return }

      const result = reconcileRecentConfirmedTxns({
        rows: rows || [],
        cachedRows: cached?.data,
        type,
        category,
        search,
        limit,
      })
      setCached(key, result)
      setData(result)
      setLoading(false)
      const isCanonicalFullList = !limit && !type && !category && !search
      if (isCanonicalFullList) {
        pruneOptimisticTxns(result)
        // Prune deletes only from the canonical full list. Filtered/paginated
        // responses can legitimately omit IDs and would drop the delete guard
        // too early, causing "resurrected" rows.
        pruneOptimisticDeletes(result)
        pruneOptimisticEdits(result)
      }
    } catch (e) {
      if (myVersion !== fetchVersionRef.current) return
      setError(e)
      setLoading(false)
    }
  }, [type, category, search, limit, pruneOptimisticTxns, pruneOptimisticDeletes, pruneOptimisticEdits])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  useEffect(() => {
    const txnKey = `txns:${type}:${category}:${search}:${limit}`
    const handler = (e) => {
      const { pattern } = e.detail || {}
      if (!pattern || txnKey.startsWith(pattern)) fetch(true)
    }
    window.addEventListener(CACHE_INVALIDATION_EVENT, handler)
    return () => window.removeEventListener(CACHE_INVALIDATION_EVENT, handler)
  }, [type, category, search, limit, fetch])

  const refetch = useCallback(() => fetch(true), [fetch])

  const applyLocalEdit = useCallback((id, updates) => {
    setLocalEdits(prev => ({ ...prev, [id]: updates }))
    setData(prev => prev.map(row => (
      row.id === id ? { ...row, ...updates } : row
    )))
  }, [])

  const clearLocalEdit = useCallback((id) => {
    const edit = localEditsRef.current[id]
    if (edit !== undefined) {
      // Commit the pending edit into `data` before clearing the overlay.
      // Without this, a concurrent background fetch can overwrite `data` with
      // stale server values between applyLocalEdit and the post-confirm refetch,
      // causing the edit to vanish the moment the overlay is removed.
      const { _original, ...cleanEdit } = edit
      setData(prev => prev.map(row => row.id === id ? { ...row, ...cleanEdit } : row))
    }
    setLocalEdits(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  // Called on save failure: restores data to the pre-edit original so the UI
  // doesn't show a wrong value after the overlay is cleared.
  const revertLocalEdit = useCallback((id) => {
    const edit = localEditsRef.current[id]
    if (edit !== undefined) {
      if (edit._original) {
        setData(prev => prev.map(row => row.id === id ? { ...row, ...edit._original } : row))
      }
    }
    setLocalEdits(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const optimisticForList = optimisticTxns.filter(t => {
    if (type && t.type !== type) return false
    if (category && t.category !== category) return false
    if (search && !t.description?.toLowerCase().includes(String(search).toLowerCase())) return false
    return true
  })

  // Merge optimistic adds on top of server data, deduplicating by ID to prevent
  // duplicate rows if a resolved entry's real UUID also appears in server data.
  const mergedData = (() => {
    if (!optimisticForList.length) return data
    const mapped = optimisticForList.map(t => ({ ...t, id: t._id || t.id }))
    const optimisticIds = new Set(mapped.map(t => t.id))
    const dedupedData = data.filter(t => !optimisticIds.has(t.id))
    return [...mapped, ...dedupedData].slice(0, limit || data.length || 999)
  })()

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
    applyLocalEdit,
    clearLocalEdit,
    revertLocalEdit,
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

  const fetchVersionRef = useRef(0)

  const fetch = useCallback(async (force = false) => {
    const myVersion = ++fetchVersionRef.current
    const cached = getCached(cacheKey)
    if (cached) {
      setData(cached.data)
      setLoading(false)
      if (!force && isFresh(cached, cacheKey)) return
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

      if (myVersion !== fetchVersionRef.current) return
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
      if (myVersion !== fetchVersionRef.current) return
      setLoading(false)
    }
  }, [year, month, cacheKey])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  // Re-fetch whenever 'month:' cache entries are invalidated by mutations.
  // All mutation functions already call invalidateCache('month:...') so we
  // don't need to also listen for 'txns:' invalidations — that caused
  // double-fetches on every mutation.
  useEffect(() => {
    const handler = (e) => {
      const { pattern } = e.detail || {}
      if (!pattern || cacheKey.startsWith(pattern)) fetch(true)
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

  const fetchVersionRef = useRef(0)

  const fetch = useCallback(async (force = false) => {
    const myVersion = ++fetchVersionRef.current
    const cached = getCached(cacheKey)
    if (cached) {
      setData(cached.data)
      setLoading(false)
      if (!force && isFresh(cached, cacheKey)) return
    } else {
      setLoading(true)
    }

    try {
      const { data: rows } = await supabase
        .from('transactions')
        .select('id, date, type, amount, description, category, investment_vehicle, is_repayment')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)

      if (myVersion !== fetchVersionRef.current) return
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
      if (myVersion !== fetchVersionRef.current) return
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
// ─────────────────────────────────────────────────────────────────────────────
export function useRunningBalance(year, month) {
  const cacheKey = `balance:${year}:${month}`

  const [balance, setBalance] = useState(() => {
    const cached = getCached(cacheKey)
    return cached?.data ?? null
  })
  const [loading, setLoading] = useState(() => !getCached(cacheKey))

  const { optimisticTxns, optimisticDeletedTxns, optimisticEdits } = useAppData()

  const fetchVersionRef = useRef(0)

  const fetch = useCallback(async (force = false) => {
    const myVersion = ++fetchVersionRef.current
    const cached = getCached(cacheKey)
    if (cached !== null && cached !== undefined) {
      setBalance(cached.data)
      setLoading(false)
      if (!force && isFresh(cached, cacheKey)) return
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

      if (myVersion !== fetchVersionRef.current) return
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
      if (myVersion !== fetchVersionRef.current) return
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
  const { data, error } = await withTimeout(
    supabase
      .from('transactions')
      .insert([{ ...payload, user_id }])
      .select('id, date, type, description, amount, category, investment_vehicle, is_repayment, payment_mode, notes, created_at')
      .single()
  )
  if (error) throw error
  return data || null
}

export async function updateTransaction(id, payload) {
  const { data, error } = await withTimeout(
    supabase
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .select('id, date, type, description, amount, category, investment_vehicle, is_repayment, payment_mode, notes, created_at')
      .single()
  )
  if (error) throw error
  return data || null
}

export async function deleteTransaction(id) {
  const { error } = await withTimeout(
    supabase.from('transactions').delete().eq('id', id)
  )
  if (error) throw error
}
