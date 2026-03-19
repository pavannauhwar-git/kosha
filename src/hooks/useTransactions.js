import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { invalidateQueryFamilies } from '../lib/queryClient'

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

async function getCurrentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('Not signed in')
  return session.user.id
}

export function useDebounce(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

export function useTransactions({ type, category, search, limit, withCount = false } = {}) {
  const queryKey = ['transactions', { type, category, search, limit, withCount }]

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const userId = await getCurrentUserId()
        const selectOptions = withCount ? { count: 'exact' } : undefined

        let q = supabase
          .from('transactions')
          .select(TRANSACTION_LIST_COLUMNS, selectOptions)
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })

        if (type) q = q.eq('type', type)
        if (category) q = q.eq('category', category)
        if (search) q = q.ilike('description', `%${search}%`)
        if (limit) q = q.limit(limit)

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
        const userId = await getCurrentUserId()
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
        const userId = await getCurrentUserId()
        const pad = String(month).padStart(2, '0')
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
        const byVehicle = {}

        let earned = 0
        let repayments = 0
        let expense = 0
        let investment = 0

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
          earned,
          repayments,
          expense,
          investment,
          byCategory,
          byVehicle,
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
        const userId = await getCurrentUserId()
        const rangeStart = `${year}-01-01`
        const rangeEnd = `${year}-12-31`

        const [baseRes, topExpenseRes] = await Promise.all([
          supabase
            .from('transactions')
            .select(TRANSACTION_YEAR_COLUMNS)
            .eq('user_id', userId)
            .gte('date', rangeStart)
            .lte('date', rangeEnd),
          supabase
            .from('transactions')
            .select(TRANSACTION_TOP_EXPENSE_COLUMNS)
            .eq('user_id', userId)
            .eq('type', 'expense')
            .gte('date', rangeStart)
            .lte('date', rangeEnd)
            .order('amount', { ascending: false })
            .limit(5),
        ])

        if (baseRes.error) throw baseRes.error
        if (topExpenseRes.error) throw topExpenseRes.error

        const baseRows = baseRes.data || []
        const top5 = topExpenseRes.data || []

        const monthly = Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          income: 0,
          expense: 0,
          investment: 0,
        }))

        const byCategory = {}
        const byVehicle = {}

        let totalIncome = 0
        let totalRepayments = 0
        let totalExpense = 0
        let totalInvestment = 0

        for (const row of baseRows) {
          const amount = Number(row.amount || 0)
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
            monthsWithIncome.reduce((sum, m) => sum + ((m.income - m.expense) / m.income) * 100, 0)
              / monthsWithIncome.length
          )
          : 0

        return {
          monthly,
          totalIncome,
          totalRepayments,
          totalExpense,
          totalInvestment,
          avgSavings,
          byCategory,
          byVehicle,
          top5,
          count: baseRows.length,
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
        const userId = await getCurrentUserId()
        const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

        const [incomeRes, outflowRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .eq('type', 'income')
            .lte('date', endDate),
          supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .in('type', ['expense', 'investment'])
            .lte('date', endDate),
        ])

        if (incomeRes.error) throw incomeRes.error
        if (outflowRes.error) throw outflowRes.error

        const incomeTotal = (incomeRes.data || []).reduce((sum, r) => sum + Number(r.amount || 0), 0)
        const outflowTotal = (outflowRes.data || []).reduce((sum, r) => sum + Number(r.amount || 0), 0)
        return incomeTotal - outflowTotal
      } catch (err) {
        logQueryError('running balance', err)
        throw err
      }
    },
  })

  return { balance: data, loading: isLoading, error }
}

export async function addTransaction(payload) {
  try {
    const user_id = await getCurrentUserId()
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...payload, user_id })
      .select(TRANSACTION_MUTATION_COLUMNS)
      .single()

    if (error) throw error
    await invalidateCache()
    return data
  } catch (err) {
    console.error('[Kosha] addTransaction failed', err)
    throw err
  }
}

export async function updateTransaction(id, payload) {
  try {
    const user_id = await getCurrentUserId()
    const { data, error } = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user_id)
      .select(TRANSACTION_MUTATION_COLUMNS)
      .single()

    if (error) throw error
    await invalidateCache()
    return data
  } catch (err) {
    console.error('[Kosha] updateTransaction failed', err)
    throw err
  }
}

export async function deleteTransaction(id) {
  try {
    const user_id = await getCurrentUserId()
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user_id)

    if (error) throw error
    await invalidateCache()
    return true
  } catch (err) {
    console.error('[Kosha] deleteTransaction failed', err)
    throw err
  }
}

export function invalidateCache() {
  return invalidateQueryFamilies(TRANSACTION_INVALIDATION_KEYS)
}
