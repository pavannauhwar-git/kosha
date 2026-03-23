import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, invalidateQueryFamilies } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { suppress } from '../lib/mutationGuard'

export const TRANSACTION_INVALIDATION_KEYS = [
  ['transactions'],
  ['month'],
  ['year'],
  ['balance'],
]

const TRANSACTION_LIST_COLUMNS =
  'id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode, notes'
const TRANSACTION_MUTATION_COLUMNS =
  'id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode, notes'

function logQueryError(scope, error) {
  console.error(`[Kosha] ${scope} query failed`, error)
}

// ── Cache helpers ─────────────────────────────────────────────────────────

// Data queries are stored under ['transactions', 'data', {...filters}].
// Count queries are stored under ['transactions', 'count', {...filters}].
// We target only data queries via predicate to avoid touching count caches.
const DATA_QUERY_PREDICATE = {
  predicate: (query) => {
    const key = query.queryKey
    return Array.isArray(key) && key[0] === 'transactions' && key[1] === 'data'
  },
}

function injectTransactionIntoLists(txn, mode = 'add') {
  queryClient.setQueriesData(DATA_QUERY_PREDICATE, (old) => {
    if (!Array.isArray(old)) return old
    if (mode === 'add') {
      return [txn, ...old].sort(
        (a, b) =>
          new Date(b.date) - new Date(a.date) ||
          new Date(b.created_at) - new Date(a.created_at)
      )
    }
    if (mode === 'update') {
      return old.map(t => (t.id === txn.id ? txn : t))
    }
    if (mode === 'delete') {
      return old.filter(t => t.id !== txn.id)
    }
    return old
  })
}

function adjustBalanceCaches(delta) {
  if (!delta) return
  queryClient.setQueriesData(
    { queryKey: ['balance'], exact: false },
    (old) => (typeof old === 'number' ? old + delta : old)
  )
}

function balanceDelta(txn) {
  if (!txn) return 0
  return txn.type === 'income' ? +Number(txn.amount) : -Number(txn.amount)
}

function patchMonthSummary(txn, mode = 'add') {
  if (!txn?.date) return
  const d    = new Date(txn.date)
  const yr   = d.getFullYear()
  const mo   = d.getMonth() + 1
  const sign = mode === 'add' ? 1 : -1

  queryClient.setQueryData(['month', yr, mo], (old) => {
    if (!old) return old
    const amount = Number(txn.amount) * sign
    const next   = { ...old, byCategory: { ...old.byCategory }, byVehicle: { ...old.byVehicle } }

    if (txn.type === 'income') {
      if (txn.is_repayment) next.repayments = Math.max(0, (next.repayments || 0) + amount)
      else next.earned = Math.max(0, (next.earned || 0) + amount)
    } else if (txn.type === 'expense') {
      next.expense = Math.max(0, (next.expense || 0) + amount)
      if (txn.category) {
        next.byCategory[txn.category] = Math.max(0, (next.byCategory[txn.category] || 0) + amount)
      }
    } else if (txn.type === 'investment') {
      next.investment = Math.max(0, (next.investment || 0) + amount)
      const v = txn.investment_vehicle || 'Other'
      next.byVehicle[v] = Math.max(0, (next.byVehicle[v] || 0) + amount)
    }

    next.balance =
      (next.earned || 0) + (next.repayments || 0) - (next.expense || 0) - (next.investment || 0)
    return next
  })
}

function findCachedTransaction(id) {
  // Use the same predicate so we only search data queries (plain arrays),
  // never the count queries (numbers).
  const all = queryClient.getQueriesData(DATA_QUERY_PREDICATE)
  for (const [, data] of all) {
    if (Array.isArray(data)) {
      const found = data.find(t => t.id === id)
      if (found) return found
    }
  }
  return null
}

// ── Background invalidation ───────────────────────────────────────────────

export function invalidateCache() {
  suppress('transactions')
  return invalidateQueryFamilies(TRANSACTION_INVALIDATION_KEYS)
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
  const dataKey  = ['transactions', 'data',  { type, category, search, limit }]
  const countKey = ['transactions', 'count', { type, category }]

  const { data: rows, isLoading, error, refetch } = useQuery({
    queryKey: dataKey,
    queryFn: async () => {
      try {
        const userId = getAuthUserId()
        let q = supabase
          .from('transactions')
          .select(TRANSACTION_LIST_COLUMNS)
          .eq('user_id', userId)
          .order('date', { ascending: false })
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
    },
  })

  const { data: countData } = useQuery({
    queryKey: countKey,
    enabled: withCount,
    staleTime: 60 * 1000,
    queryFn: async () => {
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
    },
  })

  const safeRows = rows || []
  const total    = withCount ? (countData ?? safeRows.length) : safeRows.length

  return { data: safeRows, total, loading: isLoading, error, refetch }
}

export function useTodayExpenses() {
  const today    = new Date()
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions', 'today-expenses', todayISO],
    queryFn: async () => {
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
    },
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

// ── Mutations ─────────────────────────────────────────────────────────────

export async function addTransaction(payload) {
  const userId = getAuthUserId()

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...payload, user_id: userId })
    .select(TRANSACTION_MUTATION_COLUMNS)
    .single()

  if (error) throw error

  injectTransactionIntoLists(data, 'add')
  adjustBalanceCaches(balanceDelta(data))
  patchMonthSummary(data, 'add')
  invalidateCache()

  return data
}

export async function updateTransaction(id, payload) {
  const userId = getAuthUserId()
  const oldTxn = findCachedTransaction(id)

  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select(TRANSACTION_MUTATION_COLUMNS)
    .single()

  if (error) throw error

  injectTransactionIntoLists(data, 'update')

  if (oldTxn) {
    const diff = balanceDelta(data) - balanceDelta(oldTxn)
    adjustBalanceCaches(diff)

    if (
      oldTxn.date !== data.date ||
      oldTxn.type !== data.type ||
      oldTxn.amount !== data.amount ||
      oldTxn.category !== data.category
    ) {
      patchMonthSummary(oldTxn, 'remove')
      patchMonthSummary(data,   'add')
    }
  }

  invalidateCache()
  return data
}

export async function deleteTransaction(id) {
  const userId     = getAuthUserId()
  const deletedTxn = findCachedTransaction(id)

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  if (deletedTxn) {
    injectTransactionIntoLists(deletedTxn, 'delete')
    adjustBalanceCaches(-balanceDelta(deletedTxn))
    patchMonthSummary(deletedTxn, 'remove')
  } else {
    // Fallback: deletedTxn not found in cache — filter by id directly
    queryClient.setQueriesData(DATA_QUERY_PREDICATE, (old) => {
      if (!Array.isArray(old)) return old
      return old.filter(t => t.id !== id)
    })
  }

  invalidateCache()
  return true
}
