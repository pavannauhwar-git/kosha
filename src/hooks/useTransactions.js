import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { suppress } from '../lib/mutationGuard'
import { traceQuery } from '../lib/queryTrace'

// ── Query key factories ───────────────────────────────────────────────────
const txnListKey  = (filters) => ['transactions', filters]
const txnCountKey = (filters) => ['txnCount', filters]

export const TRANSACTION_INVALIDATION_KEYS = [
  ['transactions'],
  ['txnCount'],
  ['month'],
  ['year'],
  ['balance'],
  ['todayExpenses'],
]

const TRANSACTION_LIST_COLUMNS =
  'id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode, notes'

const TRANSACTION_MUTATION_COLUMNS =
  'id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode, notes'

const TXN_FRESH_WINDOW_MS = 15 * 1000

function runInBackground(promise, scope) {
  void promise.catch((error) => {
    console.warn(`[Kosha] ${scope} background refresh failed`, error)
  })
}

async function cancelTransactionFamilyQueries() {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: ['transactions'] }),
    queryClient.cancelQueries({ queryKey: ['txnCount'] }),
    queryClient.cancelQueries({ queryKey: ['todayExpenses'] }),
  ])
}

function txnSortDesc(a, b) {
  const byDate = String(b?.date || '').localeCompare(String(a?.date || ''))
  if (byDate !== 0) return byDate
  return String(b?.created_at || '').localeCompare(String(a?.created_at || ''))
}

function getTxnFiltersFromKey(queryKey) {
  return (Array.isArray(queryKey) && queryKey[1]) || {}
}

function mergeTxnRows(rows, limit) {
  const deduped = []
  const seen = new Set()
  for (const row of rows || []) {
    if (!row?.id || seen.has(row.id)) continue
    seen.add(row.id)
    deduped.push(row)
  }
  deduped.sort(txnSortDesc)
  const lim = Number(limit || 0)
  return lim > 0 ? deduped.slice(0, lim) : deduped
}

function matchesTransactionFilters(txn, filters = {}) {
  if (!txn) return false
  if (filters.type && txn.type !== filters.type) return false
  if (filters.category && txn.category !== filters.category) return false
  if (filters.search) {
    const q = String(filters.search).toLowerCase()
    const desc = String(txn.description || '').toLowerCase()
    if (!desc.includes(q)) return false
  }
  return true
}

function primeTransactionCaches(newTxn) {
  if (!newTxn?.id) return

  const queries = queryClient.getQueryCache().findAll({ queryKey: ['transactions'] })
  for (const query of queries) {
    const key = query.queryKey
    const filters = (Array.isArray(key) && key[1]) || {}
    if (!matchesTransactionFilters(newTxn, filters)) continue

    queryClient.setQueryData(key, (old) => {
      if (!Array.isArray(old)) return old
      return mergeTxnRows([newTxn, ...old], filters?.limit)
    })
  }

  const countQueries = queryClient.getQueryCache().findAll({ queryKey: ['txnCount'] })
  for (const query of countQueries) {
    const key = query.queryKey
    const filters = (Array.isArray(key) && key[1]) || {}
    if (!matchesTransactionFilters(newTxn, filters)) continue
    queryClient.setQueryData(key, (old) => {
      const prev = Number(old || 0)
      return Number.isFinite(prev) ? prev + 1 : 1
    })
  }

  if (newTxn.type === 'expense') {
    const todayISO = new Date().toISOString().slice(0, 10)
    if (newTxn.date === todayISO) {
      queryClient.setQueriesData({ queryKey: ['todayExpenses'] }, (old) => {
        const prev = Number(old || 0)
        return Number.isFinite(prev) ? prev + Number(newTxn.amount || 0) : Number(newTxn.amount || 0)
      })
    }
  }
}

function findCachedTransactionById(id) {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ['transactions'] })
  for (const query of queries) {
    const rows = query.state?.data
    if (!Array.isArray(rows)) continue
    const hit = rows.find(row => row?.id === id)
    if (hit) return hit
  }
  return null
}

function reconcileTransactionCaches(previousTxn, nextTxn) {
  if (!previousTxn && !nextTxn) return
  const targetId = nextTxn?.id || previousTxn?.id
  if (!targetId) return

  const listQueries = queryClient.getQueryCache().findAll({ queryKey: ['transactions'] })
  for (const query of listQueries) {
    const key = query.queryKey
    const filters = getTxnFiltersFromKey(key)
    queryClient.setQueryData(key, (old) => {
      if (!Array.isArray(old)) return old
      const withoutTarget = old.filter(row => row.id !== targetId)
      const shouldIncludeNext = !!nextTxn && matchesTransactionFilters(nextTxn, filters)
      if (!shouldIncludeNext) return withoutTarget
      return mergeTxnRows([nextTxn, ...withoutTarget], filters?.limit)
    })
  }

  const countQueries = queryClient.getQueryCache().findAll({ queryKey: ['txnCount'] })
  for (const query of countQueries) {
    const key = query.queryKey
    const filters = getTxnFiltersFromKey(key)
    const prevMatches = !!previousTxn && matchesTransactionFilters(previousTxn, filters)
    const nextMatches = !!nextTxn && matchesTransactionFilters(nextTxn, filters)
    const delta = (nextMatches ? 1 : 0) - (prevMatches ? 1 : 0)
    if (!delta) continue

    queryClient.setQueryData(key, (old) => {
      const prev = Number(old || 0)
      const safePrev = Number.isFinite(prev) ? prev : 0
      return Math.max(0, safePrev + delta)
    })
  }

  const todayISO = new Date().toISOString().slice(0, 10)
  const prevTodayExpense =
    previousTxn?.type === 'expense' && previousTxn?.date === todayISO
      ? Number(previousTxn.amount || 0)
      : 0
  const nextTodayExpense =
    nextTxn?.type === 'expense' && nextTxn?.date === todayISO
      ? Number(nextTxn.amount || 0)
      : 0
  const deltaToday = nextTodayExpense - prevTodayExpense
  if (deltaToday) {
    queryClient.setQueriesData({ queryKey: ['todayExpenses'] }, (old) => {
      const prev = Number(old || 0)
      const safePrev = Number.isFinite(prev) ? prev : 0
      return Math.max(0, safePrev + deltaToday)
    })
  }
}

function logQueryError(scope, error) {
  console.error(`[Kosha] ${scope} query failed`, error)
}

// ── Cache invalidation (exported for cross-hook use) ──────────────────────

export async function invalidateCache() {
  // Suppress the realtime double-fetch that would otherwise fire
  // ~300-500ms later for the same mutation.
  suppress('transactions')
  await Promise.all([
    // Use 'all' for the raw transaction list so BOTH the Dashboard (recent 8)
    // and the Transactions page (paginated list) are refreshed immediately after
    // a mutation — even if one of them is not currently mounted. With 'active'
    // only the currently-visible page would refetch; the other page would show
    // stale cached data until its query mounted and re-fetched on its own.
    queryClient.invalidateQueries({ queryKey: ['transactions'],    refetchType: 'all'    }),
    // Aggregates are only relevant when the user can see them, so 'active' is
    // fine — the next mount will trigger a stale refetch automatically.
    queryClient.invalidateQueries({ queryKey: ['txnCount'],        refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['month'],           refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['year'],            refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['balance'],         refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['todayExpenses'],   refetchType: 'active' }),
  ])
}

// ── Debounce hook ─────────────────────────────────────────────────────────

export function useDebounce(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

// ── Query hooks ───────────────────────────────────────────────────────────

export function useTransactions({ type, category, search, limit, withCount = false } = {}) {
  const filters = { type, category, search, limit }
  const { data: rows, isLoading, error, refetch } = useQuery({
    queryKey: txnListKey(filters),
    queryFn: () => traceQuery('transactions:list', async () => {
      try {
        const userId = getAuthUserId()
        let q = supabase
          .from('transactions')
          .select(TRANSACTION_LIST_COLUMNS)
          .eq('user_id', userId)
          .order('date',       { ascending: false })
          .order('created_at', { ascending: false })

        if (type)     q = q.eq('type', type)
        if (category) q = q.eq('category', category)
        if (search)   q = q.ilike('description', `%${search}%`)
        if (limit)    q = q.limit(limit)

        const { data, error: err } = await q
        if (err) throw err
        return data || []
      } catch (err) {
        logQueryError('transactions list', err)
        throw err
      }
    }),
    // Keep list fresh enough for rapid edits while avoiding redundant
    // remount/focus refetches during short navigation hops.
    staleTime: TXN_FRESH_WINDOW_MS,
    // Short gc window keeps old filter-variant queries (e.g. type:'expense',
    // search:'coffee') from piling up in cache. refetchType:'all' above would
    // otherwise re-request every combination the user tried this session.
    gcTime: 5 * 60 * 1000,
  })

  const { data: countData } = useQuery({
    queryKey: txnCountKey({ type, category }),
    enabled:  withCount,
    staleTime: 60 * 1000,
    queryFn: () => traceQuery('transactions:count', async () => {
      try {
        const userId = getAuthUserId()
        let q = supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)

        if (type)     q = q.eq('type', type)
        if (category) q = q.eq('category', category)

        const { count, error: err } = await q
        if (err) throw err
        return count || 0
      } catch (err) {
        logQueryError('transactions count', err)
        return 0
      }
    }),
  })

  const safeRows = rows || []
  const total    = withCount ? (countData ?? safeRows.length) : safeRows.length

  return { data: safeRows, total, loading: isLoading, error, refetch }
}

export function useTodayExpenses() {
  const today    = new Date()
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data, isLoading, error } = useQuery({
    queryKey: ['todayExpenses', todayISO],
    queryFn: () => traceQuery('transactions:today-expenses', async () => {
      try {
        const userId = getAuthUserId()
        const { data: r, error: qError } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', userId)
          .eq('type', 'expense')
          .eq('date', todayISO)

        if (qError) throw qError
        return (r || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
      } catch (err) {
        logQueryError('today expenses', err)
        throw err
      }
    }),
  })

  return { todaySpend: data ?? 0, loading: isLoading, error }
}

export function useMonthSummary(year, month) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['month', year, month],
    queryFn: async () => {
      try {
        const userId = getAuthUserId()

        const { data: rows, error: qError } = await supabase.rpc('get_month_summary', {
          p_user_id: userId,
          p_year:    year,
          p_month:   month,
        })

        if (qError) throw qError

        const safeRows   = rows || []
        const byCategory = {}
        const byVehicle  = {}
        let earned = 0, repayments = 0, expense = 0, investment = 0

        for (const row of safeRows) {
          const amount = Number(row.total || 0)
          if (row.type === 'income') {
            if (row.is_repayment) repayments += amount
            else earned += amount
          }
          if (row.type === 'expense') {
            expense += amount
            if (row.category) {
              byCategory[row.category] = (byCategory[row.category] || 0) + amount
            }
          }
          if (row.type === 'investment') {
            investment += amount
            const vehicle = row.investment_vehicle || 'Other'
            byVehicle[vehicle] = (byVehicle[vehicle] || 0) + amount
          }
        }

        return {
          earned, repayments, expense, investment,
          byCategory, byVehicle,
          balance: earned + repayments - expense - investment,
          count:   safeRows.length,
        }
      } catch (err) {
        logQueryError('month summary', err)
        throw err
      }
    },
  })

  return { data, loading: isLoading, error }
}

export function useYearSummary(year) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['year', year],
    queryFn: async () => {
      try {
        const userId = getAuthUserId()

        const { data: result, error: rpcError } = await supabase
          .rpc('get_year_summary', { p_user_id: userId, p_year: year })
          .single()

        if (rpcError) throw rpcError
        if (!result)  return null

        const monthlyRaw = result.monthly_data  || []
        const totals     = result.totals         || {}
        const byCategory = result.category_data  || {}
        const byVehicle  = result.vehicle_data   || {}
        const top5       = result.top5_expenses  || []

        const monthMap = Object.fromEntries(monthlyRaw.map(m => [m.month_num, m]))
        const monthly  = Array.from({ length: 12 }, (_, i) => {
          const m = monthMap[i + 1] || {}
          return {
            month:      i + 1,
            income:     Number(m.income     || 0),
            expense:    Number(m.expense    || 0),
            investment: Number(m.investment || 0),
          }
        })

        const totalIncome     = Number(totals.income     || 0)
        const totalRepayments = Number(totals.repayments || 0)
        const totalExpense    = Number(totals.expense    || 0)
        const totalInvestment = Number(totals.investment || 0)

        const monthsWithIncome = monthly.filter(m => m.income > 0)
        const avgSavings = monthsWithIncome.length
          ? Math.round(
              monthsWithIncome.reduce(
                (sum, m) => sum + ((m.income - m.expense) / m.income) * 100, 0
              ) / monthsWithIncome.length
            )
          : 0

        return {
          monthly, totalIncome, totalRepayments, totalExpense, totalInvestment,
          avgSavings, byCategory, byVehicle, top5,
          count: Number(totals.count || 0),
        }
      } catch (err) {
        logQueryError('year summary', err)
        throw err
      }
    },
  })

  return { data, loading: isLoading, error }
}

export function useRunningBalance(year, month) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['balance', year, month],
    queryFn: async () => {
      try {
        const userId  = getAuthUserId()
        const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

        const { data: balance, error: rpcError } = await supabase.rpc(
          'get_running_balance',
          { p_user_id: userId, p_end_date: endDate }
        )

        if (rpcError) throw rpcError
        return Number(balance || 0)
      } catch (err) {
        logQueryError('running balance', err)
        throw err
      }
    },
  })

  return { balance: data, loading: isLoading, error }
}

// ── Mutations — Fast Local Paint + Background Reconciliation ─────────────
//
// For add flows, we optimistically prime transaction caches using the server
// response row, then reconcile in the background via invalidateCache().
// This removes the modal-close lag while preserving server-truth convergence.

export async function addTransaction(payload, options = {}) {
  const { invalidate = true } = options
  const userId = getAuthUserId()

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...payload, user_id: userId })
    .select(TRANSACTION_MUTATION_COLUMNS)
    .single()

  if (error) throw error

  await cancelTransactionFamilyQueries()

  // Paint the new row immediately in mounted/cached transaction lists.
  primeTransactionCaches(data)

  if (invalidate) {
    // Refresh summaries and any non-primed queries in the background.
    runInBackground(invalidateCache(), 'transactions add')
  }

  return data;
}

export async function updateTransaction(id, payload, options = {}) {
  const { invalidate = true } = options
  const userId = getAuthUserId()
  const previousTxn = findCachedTransactionById(id)

  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select(TRANSACTION_MUTATION_COLUMNS)
    .single()

  if (error) throw error

  await cancelTransactionFamilyQueries()

  reconcileTransactionCaches(previousTxn, data)

  if (invalidate) {
    runInBackground(invalidateCache(), 'transactions update')
  }

  return data;
}

export async function deleteTransaction(id, options = {}) {
  const { invalidate = true } = options
  const userId = getAuthUserId()
  const previousTxn = findCachedTransactionById(id)

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  await cancelTransactionFamilyQueries()

  reconcileTransactionCaches(previousTxn, null)

  if (invalidate) {
    runInBackground(invalidateCache(), 'transactions delete')
  }

  return true;
}