import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, invalidateQueryFamilies } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'

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
const TRANSACTION_MONTH_COLUMNS = 'type, amount, category, investment_vehicle, is_repayment'
const TRANSACTION_YEAR_COLUMNS = 'date, type, amount, category, investment_vehicle, is_repayment'
const TRANSACTION_TOP_EXPENSE_COLUMNS = 'id, date, type, amount, description, category'

function logQueryError(scope, error) {
  console.error(`[Kosha] ${scope} query failed`, error)
}

// ── Cache helpers ──────────────────────────────────────────────────────────

/**
 * Injects a new or updated transaction into all transaction list caches.
 * Called synchronously after a successful DB mutation.
 */
function injectTransactionIntoLists(txn, mode = 'add') {
  queryClient.setQueriesData(
    { queryKey: ['transactions'], exact: false },
    (old) => {
      if (!old?.rows) return old
      if (mode === 'add') {
        return { ...old, rows: [txn, ...old.rows], total: (old.total || 0) + 1 }
      }
      if (mode === 'update') {
        return { ...old, rows: old.rows.map(t => t.id === txn.id ? txn : t) }
      }
      if (mode === 'delete') {
        return {
          ...old,
          rows: old.rows.filter(t => t.id !== txn.id),
          total: Math.max(0, (old.total || 0) - 1),
        }
      }
      return old
    }
  )
}

/**
 * Updates running balance caches by a delta amount.
 */
function adjustBalanceCaches(delta) {
  if (!delta) return
  queryClient.setQueriesData(
    { queryKey: ['balance'], exact: false },
    (old) => typeof old === 'number' ? old + delta : old
  )
}

/**
 * Returns the signed balance delta for a transaction.
 * Income adds to balance; expense and investment subtract.
 */
function balanceDelta(txn) {
  if (!txn) return 0
  return txn.type === 'income' ? +Number(txn.amount) : -Number(txn.amount)
}

/**
 * Updates the month summary cache for the month containing txn.date.
 * mode 'add' applies the transaction; mode 'remove' reverses it.
 */
function patchMonthSummary(txn, mode = 'add') {
  if (!txn?.date) return
  const d = new Date(txn.date)
  const yr = d.getFullYear()
  const mo = d.getMonth() + 1
  const sign = mode === 'add' ? 1 : -1

  queryClient.setQueryData(['month', yr, mo], (old) => {
    if (!old) return old
    const amount = Number(txn.amount) * sign
    const next = { ...old, byCategory: { ...old.byCategory }, byVehicle: { ...old.byVehicle } }

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

/**
 * Finds a transaction by ID across all transaction list caches.
 * Used by update/delete to retrieve the pre-mutation state for cache diffing.
 */
function findCachedTransaction(id) {
  const all = queryClient.getQueriesData({ queryKey: ['transactions'] })
  for (const [, data] of all) {
    if (data?.rows) {
      const found = data.rows.find(t => t.id === id)
      if (found) return found
    }
  }
  return null
}

// ── Background invalidation ───────────────────────────────────────────────

export function invalidateCache() {
  // NOT awaited by callers — runs in the background after cache injection.
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
  const queryKey = ['transactions', { type, category, search, limit, withCount }]

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const userId = getAuthUserId()
        const selectOptions = withCount ? { count: 'exact' } : undefined

        let q = supabase
          .from('transactions')
          .select(TRANSACTION_LIST_COLUMNS, selectOptions)
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })

        if (type)     q = q.eq('type', type)
        if (category) q = q.eq('category', category)
        if (search)   q = q.ilike('description', `%${search}%`)
        if (limit)    q = q.limit(limit)

        const { data: rows, error: err, count } = await q
        if (err) throw err

        return {
          rows: rows || [],
          total: typeof count === 'number' ? count : (rows || []).length,
        }
      } catch (err) {
        logQueryError('transactions list', err)
        throw err
      }
    },
  })

  return {
    data: data?.rows || [],
    total: data?.total ?? 0,
    loading: isLoading,
    error,
    refetch,
  }
}

export function useTodayExpenses() {
  const today = new Date()
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions', 'today-expenses', todayISO],
    queryFn: async () => {
      try {
        const userId = getAuthUserId()
        const { data: rows, error: qError } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', userId)
          .eq('type', 'expense')
          .eq('date', todayISO)

        if (qError) throw qError
        return (rows || []).reduce((sum, r) => sum + Number(r.amount || 0), 0)
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
        const pad  = String(month).padStart(2, '0')
        const days = new Date(year, month, 0).getDate()

        const { data: rows, error: qError } = await supabase
          .from('transactions')
          .select(TRANSACTION_MONTH_COLUMNS)
          .eq('user_id', userId)
          .gte('date', `${year}-${pad}-01`)
          .lte('date', `${year}-${pad}-${days}`)

        if (qError) throw qError

        const safeRows = rows || []
        const byCategory = {}
        const byVehicle  = {}
        let earned = 0, repayments = 0, expense = 0, investment = 0

        for (const row of safeRows) {
          const amount = Number(row.amount || 0)
          if (row.type === 'income') {
            if (row.is_repayment) repayments += amount
            else earned += amount
          }
          if (row.type === 'expense') {
            expense += amount
            byCategory[row.category] = (byCategory[row.category] || 0) + amount
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
          count: safeRows.length,
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

        const [baseRes, topExpenseRes] = await Promise.all([
          supabase
            .from('transactions')
            .select(TRANSACTION_YEAR_COLUMNS)
            .eq('user_id', userId)
            .gte('date', `${year}-01-01`)
            .lte('date', `${year}-12-31`),
          supabase
            .from('transactions')
            .select(TRANSACTION_TOP_EXPENSE_COLUMNS)
            .eq('user_id', userId)
            .eq('type', 'expense')
            .gte('date', `${year}-01-01`)
            .lte('date', `${year}-12-31`)
            .order('amount', { ascending: false })
            .limit(5),
        ])

        if (baseRes.error)       throw baseRes.error
        if (topExpenseRes.error) throw topExpenseRes.error

        const baseRows = baseRes.data || []
        const top5     = topExpenseRes.data || []

        const monthly = Array.from({ length: 12 }, (_, i) => ({
          month: i + 1, income: 0, expense: 0, investment: 0,
        }))

        const byCategory = {}
        const byVehicle  = {}
        let totalIncome = 0, totalRepayments = 0, totalExpense = 0, totalInvestment = 0

        for (const row of baseRows) {
          const amount     = Number(row.amount || 0)
          const monthIndex = Number(String(row.date).slice(5, 7)) - 1

          if (row.type === 'income') {
            if (row.is_repayment) totalRepayments += amount
            else {
              totalIncome += amount
              if (monthIndex >= 0 && monthIndex < 12) monthly[monthIndex].income += amount
            }
          }
          if (row.type === 'expense') {
            totalExpense += amount
            if (monthIndex >= 0 && monthIndex < 12) monthly[monthIndex].expense += amount
            byCategory[row.category] = (byCategory[row.category] || 0) + amount
          }
          if (row.type === 'investment') {
            totalInvestment += amount
            if (monthIndex >= 0 && monthIndex < 12) monthly[monthIndex].investment += amount
            const vehicle = row.investment_vehicle || 'Other'
            byVehicle[vehicle] = (byVehicle[vehicle] || 0) + amount
          }
        }

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
          avgSavings, byCategory, byVehicle, top5, count: baseRows.length,
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

        const [incomeRes, outflowRes] = await Promise.all([
          supabase.from('transactions').select('amount')
            .eq('user_id', userId).eq('type', 'income').lte('date', endDate),
          supabase.from('transactions').select('amount')
            .eq('user_id', userId).in('type', ['expense', 'investment']).lte('date', endDate),
        ])

        if (incomeRes.error)  throw incomeRes.error
        if (outflowRes.error) throw outflowRes.error

        const incomeTotal  = (incomeRes.data  || []).reduce((s, r) => s + Number(r.amount || 0), 0)
        const outflowTotal = (outflowRes.data || []).reduce((s, r) => s + Number(r.amount || 0), 0)
        return incomeTotal - outflowTotal
      } catch (err) {
        logQueryError('running balance', err)
        throw err
      }
    },
  })

  return { balance: data, loading: isLoading, error }
}

// ── Mutations ─────────────────────────────────────────────────────────────
//
// Pattern — "Fast Pessimistic UI with Cache Injection":
//   1. getAuthUserId() — synchronous, no network, no race window
//   2. await DB call
//   3. Inject result into React Query caches synchronously (instant UI update)
//   4. Fire background invalidation WITHOUT await (dialog is already closed)
//
// The calling component can call onClose() immediately after the await
// because the DB response is back and the cache is already updated.

export async function addTransaction(payload) {
  // FIX (defect 2.1): synchronous, reads from authStore, no getSession() race
  const userId = getAuthUserId()

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...payload, user_id: userId })
    .select(TRANSACTION_MUTATION_COLUMNS)
    .single()

  if (error) throw error

  // FIX (defect 1.2): inject into caches so UI updates instantly
  injectTransactionIntoLists(data, 'add')
  adjustBalanceCaches(balanceDelta(data))
  patchMonthSummary(data, 'add')

  // FIX (defect 1.1): no await — fires in background, dialog already closed
  invalidateCache()

  return data
}

export async function updateTransaction(id, payload) {
  const userId = getAuthUserId()

  // Snapshot old transaction from cache for accurate delta calculation
  const oldTxn = findCachedTransaction(id)

  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select(TRANSACTION_MUTATION_COLUMNS)
    .single()

  if (error) throw error

  // Update list caches
  injectTransactionIntoLists(data, 'update')

  // Adjust balance by the net delta between old and new amounts
  if (oldTxn) {
    const diff = balanceDelta(data) - balanceDelta(oldTxn)
    adjustBalanceCaches(diff)

    // Reverse old values in month summary, apply new values
    if (oldTxn.date !== data.date || oldTxn.type !== data.type ||
        oldTxn.amount !== data.amount || oldTxn.category !== data.category) {
      patchMonthSummary(oldTxn, 'remove')
      patchMonthSummary(data,   'add')
    }
  }

  // Background invalidation — no await
  invalidateCache()

  return data
}

export async function deleteTransaction(id) {
  const userId = getAuthUserId()

  // Snapshot before delete for cache cleanup
  const deletedTxn = findCachedTransaction(id)

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  // Remove from list caches
  if (deletedTxn) {
    injectTransactionIntoLists(deletedTxn, 'delete')
    adjustBalanceCaches(-balanceDelta(deletedTxn))
    patchMonthSummary(deletedTxn, 'remove')
  } else {
    // Fallback: we didn't find it in cache, just remove by ID
    queryClient.setQueriesData(
      { queryKey: ['transactions'], exact: false },
      (old) => {
        if (!old?.rows) return old
        return { ...old, rows: old.rows.filter(t => t.id !== id) }
      }
    )
  }

  // Background invalidation — no await
  invalidateCache()

  return true
}
