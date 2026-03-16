import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ── In-memory SWR cache ───────────────────────────────────────────────────
// stale-while-revalidate: serve cached data instantly, refresh in background.
const cache     = new Map()   // key → { data, ts }
const listeners = new Map()   // key → Set of setState callbacks
const TTL       = 60_000      // 60 s before a cached entry is considered stale

function getCached(key) {
  const e = cache.get(key)
  if (!e) return null
  return e.data  // always return even if stale — caller decides freshness
}
function isFresh(key) {
  const e = cache.get(key)
  return e ? (Date.now() - e.ts < TTL) : false
}
function setCached(key, data) {
  cache.set(key, { data, ts: Date.now() })
  // Notify all components watching this key (cross-tab SWR broadcast)
  listeners.get(key)?.forEach(fn => fn(data))
}
export function invalidateCache() { cache.clear() }

// ── Debounce helper ───────────────────────────────────────────────────────
// Used by Transactions search: fires the actual query only after the user
// stops typing for 300 ms, preventing a Supabase round-trip per keystroke.
export function useDebounce(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// ── Helper: get current user_id from session ──────────────────────────────
async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('Not signed in')
  return session.user.id
}

// ── visibilitychange refetch ──────────────────────────────────────────────
// When the phone comes back from background (lock screen, another app),
// silently re-run all pending fetches so data is always fresh without
// the user having to restart the app.
function useVisibilityRefetch(refetch) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') refetch(true)
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [refetch])
}

// ── All transactions ──────────────────────────────────────────────────────
export function useTransactions({ type, category, search, limit } = {}) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async (force = false) => {
    const key = `txns:${type}:${category}:${search}:${limit}`

    // Stale-while-revalidate: serve cache instantly, then refresh in bg
    const hit = getCached(key)
    if (hit) {
      setData(hit)
      setLoading(false)
      if (!force && isFresh(key)) return   // fresh — no network call
    } else {
      setLoading(true)
    }

    let q = supabase.from('transactions').select('*')
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
  }, [type, category, search, limit])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  const refetch = useCallback(() => { invalidateCache(); fetch(true) }, [fetch])
  return { data, loading, error, refetch }
}

// ── Monthly summary ───────────────────────────────────────────────────────
export function useMonthSummary(year, month) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async (force = false) => {
    const key = `month:${year}:${month}`
    const hit = getCached(key)
    if (hit) {
      setData(hit)
      setLoading(false)
      if (!force && isFresh(key)) return
    } else {
      setLoading(true)
    }

    const pad  = String(month).padStart(2, '0')
    const days = new Date(year, month, 0).getDate()
    const { data: rows } = await supabase
      .from('transactions').select('*')
      .gte('date', `${year}-${pad}-01`)
      .lte('date', `${year}-${pad}-${days}`)
    if (!rows) { setLoading(false); return }

    const earned      = rows.filter(r => r.type === 'income' && !r.is_repayment).reduce((s, r) => s + +r.amount, 0)
    const repayments  = rows.filter(r => r.type === 'income' &&  r.is_repayment).reduce((s, r) => s + +r.amount, 0)
    const expense     = rows.filter(r => r.type === 'expense'   ).reduce((s, r) => s + +r.amount, 0)
    const investment  = rows.filter(r => r.type === 'investment').reduce((s, r) => s + +r.amount, 0)
    const byCategory  = {}
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
    setCached(key, result)
    setData(result)
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  return { data, loading }
}

// ── Year summary ──────────────────────────────────────────────────────────
export function useYearSummary(year) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async (force = false) => {
    const key = `year:${year}`
    const hit = getCached(key)
    if (hit) {
      setData(hit)
      setLoading(false)
      if (!force && isFresh(key)) return
    } else {
      setLoading(true)
    }

    const { data: rows } = await supabase
      .from('transactions').select('*')
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
    const totalIncome      = rows.filter(r => r.type === 'income' && !r.is_repayment).reduce((s, r) => s + +r.amount, 0)
    const totalRepayments  = rows.filter(r => r.type === 'income' &&  r.is_repayment).reduce((s, r) => s + +r.amount, 0)
    const totalExpense     = rows.filter(r => r.type === 'expense'   ).reduce((s, r) => s + +r.amount, 0)
    const totalInvestment  = rows.filter(r => r.type === 'investment').reduce((s, r) => s + +r.amount, 0)
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
    setCached(key, result)
    setData(result)
    setLoading(false)
  }, [year])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  return { data, loading }
}

// ── Running balance ───────────────────────────────────────────────────────
export function useRunningBalance(year, month) {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async (force = false) => {
    const key = `balance:${year}:${month}`
    const hit = getCached(key)
    if (hit !== null && hit !== undefined) {
      setBalance(hit)
      setLoading(false)
      if (!force && isFresh(key)) return
    } else {
      setLoading(true)
    }

    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
    const { data: rows } = await supabase
      .from('transactions')
      .select('type, amount, is_repayment')
      .lte('date', endDate)
    if (!rows) { setLoading(false); return }
    const cumulative = rows.reduce((sum, r) => {
      if (r.type === 'income')     return sum + +r.amount
      if (r.type === 'expense')    return sum - +r.amount
      if (r.type === 'investment') return sum - +r.amount
      return sum
    }, 0)
    setCached(key, cumulative)
    setBalance(cumulative)
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetch() }, [fetch])
  useVisibilityRefetch(fetch)

  return { balance, loading }
}

// ── CRUD ──────────────────────────────────────────────────────────────────
// 8-second timeout on every write — if Supabase never responds, the promise
// rejects cleanly instead of hanging the UI forever.
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Check your connection.')), ms)
    ),
  ])
}

export async function addTransaction(payload) {
  const user_id = await getCurrentUserId()
  const { error } = await withTimeout(
    supabase.from('transactions').insert([{ ...payload, user_id }])
  )
  if (error) throw error
  invalidateCache()
}

export async function updateTransaction(id, payload) {
  const { error } = await withTimeout(
    supabase.from('transactions').update(payload).eq('id', id)
  )
  if (error) throw error
  invalidateCache()
}

export async function deleteTransaction(id) {
  const { error } = await withTimeout(
    supabase.from('transactions').delete().eq('id', id)
  )
  if (error) throw error
  invalidateCache()
}
