import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, invalidateQueryFamilies } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { suppress } from '../lib/mutationGuard'

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

function logQueryError(scope, error) {
  console.error(`[Kosha] ${scope} query failed`, error)
}

// ── Cache invalidation (exported for cross-hook use) ──────────────────────

export async function invalidateCache() {
  // Suppress the realtime double-fetch that would otherwise fire
  // ~300-500ms later for the same mutation.
  suppress('transactions')
  // Fuzzy match all sub-keys for each family
  await Promise.all(
    TRANSACTION_INVALIDATION_KEYS.map(queryKey =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'active' })
    )
  )
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
    queryFn: async () => {
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
        console.log('[Kosha][Query] useTransactions: fetched', { filters, data })
        return data || []
      } catch (err) {
        logQueryError('transactions list', err)
        throw err
      }
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const { data: countData } = useQuery({
    queryKey: txnCountKey({ type, category }),
    enabled:  withCount,
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
    queryKey: ['todayExpenses', todayISO],
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

// ── Mutations — Strict Server-Truth Pattern ───────────────────────────────
//
// Each mutation follows this invariant:
//
//   async function mutate(payload) {
//     const userId = getAuthUserId()          // 1. auth (sync, no race)
//     const { data, error } = await supabase  // 2. server write
//     if (error) throw error
//     await invalidateCache()                 // 3. await full refetch cycle
//     return data                             // 4. resolve only after server confirms
//   }
//
// The calling component (AddTransactionSheet) awaits this function.
// It shows a spinner during the entire chain and only calls onClose()
// after the Promise resolves. This is the contract.
//
// DO NOT add setQueryData calls here. If you find yourself wanting to
// "patch the cache for speed," reach for a loading skeleton instead.

export async function addTransaction(payload) {
  const userId = getAuthUserId()

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...payload, user_id: userId })
    .select(TRANSACTION_MUTATION_COLUMNS)
    .single()

  if (error) throw error

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

  return data;
}

export async function deleteTransaction(id) {
  const userId = getAuthUserId()

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  return true;
}