import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { suppress } from '../lib/mutationGuard'
import { traceQuery } from '../lib/queryTrace'
import { FINANCIAL_EVENT_ACTIONS, logFinancialEvent } from '../lib/auditLog'

// ── Query key factories ───────────────────────────────────────────────────
const txnListKey  = (filters) => ['transactions', filters]
const txnCountKey = (filters) => ['txnCount', filters]

export const TRANSACTION_INVALIDATION_KEYS = [
  ['transactions'],
  ['transactionsRecent'],
  ['transactionsDigest'],
  ['txnCount'],
  ['month'],
  ['year'],
  ['balance'],
  ['todayExpenses'],
]

const TRANSACTION_LIST_COLUMNS =
  'id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode, notes, is_recurring, recurrence, next_run_date, source_transaction_id, is_auto_generated'

const TRANSACTION_MUTATION_COLUMNS =
  'id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode, notes, is_recurring, recurrence, next_run_date, source_transaction_id, is_auto_generated'

const RECURRING_SYNC_COOLDOWN_MS = 60 * 1000
let lastRecurringSyncAt = 0

function runInBackground(promise, scope) {
  void promise.catch((error) => {
    console.warn(`[Kosha] ${scope} background refresh failed`, error)
  })
}

async function maybeGenerateRecurringTransactions(userId) {
  const now = Date.now()
  if (now - lastRecurringSyncAt < RECURRING_SYNC_COOLDOWN_MS) return
  lastRecurringSyncAt = now

  try {
    await supabase.rpc('generate_recurring_transactions', { p_user_id: userId })
  } catch (error) {
    const message = String(error?.message || '')
    // Safe no-op when migration has not yet been applied on an environment.
    if (message.includes('generate_recurring_transactions')) return
    console.warn('[Kosha] recurring transaction generation failed', error)
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
    // Keep list surfaces strongly consistent across routes. Dashboard's
    // "Latest" feed depends on transactionsRecent; if mutations happen on
    // Transactions page, pre-refresh this family as well so Dashboard stays
    // correct immediately on navigation.
    queryClient.invalidateQueries({ queryKey: ['transactions'],    refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: ['transactionsRecent'], refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: ['transactionsDigest'], refetchType: 'active' }),
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

export function useTransactions({ type, category, search, limit, startDate, endDate, withCount = false, enabled = true } = {}) {
  const filters = { type, category, search, limit, startDate, endDate }
  const { data: rows, isLoading, error, refetch } = useQuery({
    queryKey: txnListKey(filters),
    enabled,
    queryFn: () => traceQuery('transactions:list', async () => {
      try {
        const userId = getAuthUserId()
        // Run recurring materialization only for broad list reads.
        // Filtered/short lists (dashboard widgets, search, category tabs)
        // should stay read-only for latency.
        if (!type && !category && !search && !startDate && !endDate) {
          await maybeGenerateRecurringTransactions(userId)
        }
        let q = supabase
          .from('transactions')
          .select(TRANSACTION_LIST_COLUMNS)
          .eq('user_id', userId)
          .order('date',       { ascending: false })
          .order('created_at', { ascending: false })

        if (type)     q = q.eq('type', type)
        if (category) q = q.eq('category', category)
        if (startDate) q = q.gte('date', startDate)
        if (endDate)   q = q.lte('date', endDate)
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
    // Short gc window keeps old filter-variant queries (e.g. type:'expense',
    // search:'coffee') from piling up in cache. refetchType:'all' above would
    // otherwise re-request every combination the user tried this session.
    gcTime: 5 * 60 * 1000,
  })

  const { data: countData } = useQuery({
    queryKey: txnCountKey({ type, category, startDate, endDate }),
    enabled:  enabled && withCount,
    queryFn: () => traceQuery('transactions:count', async () => {
      try {
        const userId = getAuthUserId()
        let q = supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)

        if (type)     q = q.eq('type', type)
        if (category) q = q.eq('category', category)
        if (startDate) q = q.gte('date', startDate)
        if (endDate)   q = q.lte('date', endDate)

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

const RECENT_TXN_COLUMNS = 'id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode'
const DIGEST_TXN_COLUMNS = 'id, date, created_at, type, amount, category, is_repayment'

export function useRecentTransactions(limit = 5) {
  const safeLimit = Math.max(1, Number(limit) || 5)
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['transactionsRecent', safeLimit],
    queryFn: () => traceQuery('transactions:recent', async () => {
      const userId = getAuthUserId()
      const { data: rows, error: qError } = await supabase
        .from('transactions')
        .select(RECENT_TXN_COLUMNS)
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(safeLimit)

      if (qError) throw qError
      return rows || []
    }),
    gcTime: 5 * 60 * 1000,
  })

  return { data: data || [], loading: isLoading, fetching: isFetching, error }
}

export function useTransactionDigest(days = 14, limit = 200, options = {}) {
  const { enabled = true } = options
  const safeDays = Math.max(1, Number(days) || 14)
  const safeLimit = Math.max(1, Number(limit) || 200)
  const start = new Date()
  start.setDate(start.getDate() - (safeDays - 1))
  const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`

  const { data, isLoading, error } = useQuery({
    queryKey: ['transactionsDigest', safeDays, safeLimit],
    enabled,
    queryFn: () => traceQuery('transactions:digest', async () => {
      const userId = getAuthUserId()
      const { data: rows, error: qError } = await supabase
        .from('transactions')
        .select(DIGEST_TXN_COLUMNS)
        .eq('user_id', userId)
        .gte('date', startISO)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(safeLimit)

      if (qError) throw qError
      return rows || []
    }),
    gcTime: 5 * 60 * 1000,
  })

  return { data: data || [], loading: isLoading, error }
}

export function useTodayExpenses(options = {}) {
  const { enabled = true } = options
  const today    = new Date()
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data, isLoading, error } = useQuery({
    queryKey: ['todayExpenses', todayISO],
    enabled,
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

export function useMonthSummary(year, month, options = {}) {
  const { enabled = true } = options
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['month', year, month],
    enabled,
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

  return { data, loading: isLoading, fetching: isFetching, error }
}

export function useYearSummary(year, options = {}) {
  const { enabled = true } = options
  const { data, isLoading, error } = useQuery({
    queryKey: ['year', year],
    enabled,
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
  const { data, isLoading, isFetching, error } = useQuery({
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

  return { balance: data, loading: isLoading, fetching: isFetching, error }
}

// ── Mutations — centralized pipeline ──────────────────────────────────────

export async function addTransaction(payload) {
  const userId = getAuthUserId()

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...payload, user_id: userId })
    .select(TRANSACTION_MUTATION_COLUMNS)
    .single()

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.TXN_ADD,
      entityType: 'transaction',
      entityId: data.id,
      metadata: {
        amount: data.amount,
        type: data.type,
        date: data.date,
        category: data.category,
      },
    }),
    'transactions add audit'
  )

  return data;
}

export async function updateTransaction(id, payload) {
  const userId = getAuthUserId()

  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select(TRANSACTION_MUTATION_COLUMNS)
    .single()

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.TXN_UPDATE,
      entityType: 'transaction',
      entityId: data.id,
      metadata: {
        before: null,
        after: data,
      },
    }),
    'transactions update audit'
  )

  return data;
}

function compareTxnDesc(a, b) {
  const dateCmp = String(b?.date || '').localeCompare(String(a?.date || ''))
  if (dateCmp !== 0) return dateCmp
  return String(b?.created_at || '').localeCompare(String(a?.created_at || ''))
}

function matchesTransactionFilters(txn, filters = {}) {
  if (!txn) return false

  if (filters.type && txn.type !== filters.type) return false
  if (filters.category && txn.category !== filters.category) return false
  if (filters.startDate && String(txn.date || '') < String(filters.startDate)) return false
  if (filters.endDate && String(txn.date || '') > String(filters.endDate)) return false

  if (filters.search) {
    const needle = String(filters.search).toLowerCase().trim()
    const hay = String(txn.description || '').toLowerCase()
    if (needle && !hay.includes(needle)) return false
  }

  return true
}

function applyTxnLimit(rows, limit) {
  const safeLimit = Number(limit)
  if (!Number.isFinite(safeLimit) || safeLimit <= 0) return rows
  return rows.slice(0, safeLimit)
}

function upsertRecentTransactionCaches(txn) {
  const recentEntries = queryClient.getQueriesData({ queryKey: ['transactionsRecent'] })
  for (const [key, rows] of recentEntries) {
    if (!Array.isArray(rows)) continue
    const limit = Number(key?.[1]) || 5
    const next = applyTxnLimit(
      [...rows.filter((row) => row?.id !== txn.id), txn].sort(compareTxnDesc),
      limit
    )
    queryClient.setQueryData(key, next)
  }
}

function cloneCacheData(data) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(data)
  }
  return JSON.parse(JSON.stringify(data))
}

function snapshotCacheFamilies(queryKeys) {
  const snapshot = []
  for (const queryKey of queryKeys) {
    const entries = queryClient.getQueriesData({ queryKey })
    for (const [key, data] of entries) {
      snapshot.push([key, cloneCacheData(data)])
    }
  }
  return snapshot
}

function restoreCacheSnapshot(snapshot) {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data)
  }
}

function getTransactionFromCacheById(id) {
  const entries = queryClient.getQueriesData({ queryKey: ['transactions'] })
  for (const [, rows] of entries) {
    if (!Array.isArray(rows)) continue
    const found = rows.find((row) => row?.id === id)
    if (found) return found
  }
  return null
}

export function optimisticallyUpsertTransactionInCache(txn) {
  if (!txn?.id) return

  const listEntries = queryClient.getQueriesData({ queryKey: ['transactions'] })
  for (const [key, rows] of listEntries) {
    if (!Array.isArray(rows)) continue
    const filters = key?.[1] || {}

    const base = rows.filter((row) => row?.id !== txn.id)
    const next = matchesTransactionFilters(txn, filters)
      ? applyTxnLimit([...base, txn].sort(compareTxnDesc), filters.limit)
      : base

    queryClient.setQueryData(key, next)
  }

  upsertRecentTransactionCaches(txn)
}

export function optimisticallyDeleteTransactionFromCache(id) {
  if (!id) return

  const listEntries = queryClient.getQueriesData({ queryKey: ['transactions'] })
  for (const [key, rows] of listEntries) {
    if (!Array.isArray(rows)) continue
    queryClient.setQueryData(key, rows.filter((row) => row?.id !== id))
  }

  const recentEntries = queryClient.getQueriesData({ queryKey: ['transactionsRecent'] })
  for (const [key, rows] of recentEntries) {
    if (!Array.isArray(rows)) continue
    queryClient.setQueryData(key, rows.filter((row) => row?.id !== id))
  }
}

export async function deleteTransaction(id) {
  const userId = getAuthUserId()

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.TXN_DELETE,
      entityType: 'transaction',
      entityId: id,
      metadata: {
        before: null,
      },
    }),
    'transactions delete audit'
  )

  return true;
}

export async function saveTransactionMutation({ id, payload, __testOverrides = null }) {
  const snapshot = snapshotCacheFamilies([
    ['transactions'],
    ['transactionsRecent'],
  ])

  const nowIso = new Date().toISOString()
  const optimisticId = id || `optimistic-txn-${Date.now()}`

  if (id) {
    const existing = getTransactionFromCacheById(id)
    if (existing) {
      optimisticallyUpsertTransactionInCache({
        ...existing,
        ...payload,
        id,
        __optimistic: true,
      })
    }
  } else {
    optimisticallyUpsertTransactionInCache({
      ...payload,
      id: optimisticId,
      created_at: nowIso,
      date: payload?.date || nowIso.slice(0, 10),
      __optimistic: true,
    })
  }

  try {
    const updateFn = __testOverrides?.updateTransaction || updateTransaction
    const addFn = __testOverrides?.addTransaction || addTransaction
    const invalidateFn = __testOverrides?.invalidateCache || invalidateCache

    const savedTxn = id
      ? await updateFn(id, payload)
      : await addFn(payload)

    if (!id) {
      optimisticallyDeleteTransactionFromCache(optimisticId)
    }
    optimisticallyUpsertTransactionInCache(savedTxn)
    await invalidateFn()
    return savedTxn
  } catch (error) {
    restoreCacheSnapshot(snapshot)
    throw error
  }
}

export async function removeTransactionMutation(id, __testOverrides = null) {
  const snapshot = snapshotCacheFamilies([
    ['transactions'],
    ['transactionsRecent'],
  ])

  optimisticallyDeleteTransactionFromCache(id)

  try {
    const deleteFn = __testOverrides?.deleteTransaction || deleteTransaction
    const invalidateFn = __testOverrides?.invalidateCache || invalidateCache

    await deleteFn(id)
    await invalidateFn()
    return true
  } catch (error) {
    restoreCacheSnapshot(snapshot)
    throw error
  }
}