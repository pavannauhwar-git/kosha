import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const OPTIMISTIC_ID_PREFIX = '__optimistic__'

export function isOptimisticId(id) {
  return String(id).startsWith(OPTIMISTIC_ID_PREFIX)
}

export function useDebounce(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

export function useTransactions({ type, category, search, limit } = {}) {
  // Translate parameters into standard react query key
  const queryKey = ['transactions', { type, category, search, limit }]
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (type) q = q.eq('type', type)
      if (category) q = q.eq('category', category)
      if (search) q = q.ilike('description', `%${search}%`)
      if (limit) q = q.limit(limit)

      const { data: rows, error: err } = await q
      if (err) throw err
      return rows || []
    }
  })

  // Return exactly what the legacy hook returned to minimize component breakages
  return { 
    data: data || [], 
    loading: isLoading, 
    error, 
    refetch,
    // Stub these out or rely on the query layer
    applyLocalEdit: () => {},
    clearLocalEdit: () => {},
    revertLocalEdit: () => {}
  }
}

export function useMonthSummary(year, month) {
  const { data, isLoading } = useQuery({
    queryKey: ['month', year, month],
    queryFn: async () => {
      const pad = String(month).padStart(2, '0')
      const days = new Date(year, month, 0).getDate()

      const { data: rows, error } = await supabase
        .from('transactions')
        .select('type, amount, category, investment_vehicle, is_repayment')
        .gte('date', `${year}-${pad}-01`)
        .lte('date', `${year}-${pad}-${days}`)

      if (error) throw error
      
      const safeRows = rows || []

      const earned = safeRows.filter(r => r.type === 'income' && !r.is_repayment).reduce((s, r) => s + +r.amount, 0)
      const repayments = safeRows.filter(r => r.type === 'income' && r.is_repayment).reduce((s, r) => s + +r.amount, 0)
      const expense = safeRows.filter(r => r.type === 'expense').reduce((s, r) => s + +r.amount, 0)
      const investment = safeRows.filter(r => r.type === 'investment').reduce((s, r) => s + +r.amount, 0)

      const byCategory = {}
      safeRows.filter(r => r.type === 'expense').forEach(r => {
        byCategory[r.category] = (byCategory[r.category] || 0) + +r.amount
      })
      const byVehicle = {}
      safeRows.filter(r => r.type === 'investment').forEach(r => {
        const k = r.investment_vehicle || 'Other'
        byVehicle[k] = (byVehicle[k] || 0) + +r.amount
      })

      return {
        earned, repayments, expense, investment, byCategory, byVehicle,
        count: safeRows.length
      }
    }
  })

  return { data, loading: isLoading }
}

export function useYearSummary(year) {
  const { data, isLoading } = useQuery({
    queryKey: ['year', year],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('transactions')
        .select('id, date, type, amount, description, category, investment_vehicle, is_repayment')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)

      if (error) throw error
      
      const safeRows = rows || []
      
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        const mo = safeRows.filter(r => new Date(r.date).getMonth() + 1 === m)
        return {
          month: m,
          income: mo.filter(r => r.type === 'income' && !r.is_repayment).reduce((s, r) => s + +r.amount, 0),
          expense: mo.filter(r => r.type === 'expense').reduce((s, r) => s + +r.amount, 0),
          investment: mo.filter(r => r.type === 'investment').reduce((s, r) => s + +r.amount, 0),
        }
      })

      const totalIncome = safeRows.filter(r => r.type === 'income' && !r.is_repayment).reduce((s, r) => s + +r.amount, 0)
      const totalRepayments = safeRows.filter(r => r.type === 'income' && r.is_repayment).reduce((s, r) => s + +r.amount, 0)
      const totalExpense = safeRows.filter(r => r.type === 'expense').reduce((s, r) => s + +r.amount, 0)
      const totalInvestment = safeRows.filter(r => r.type === 'investment').reduce((s, r) => s + +r.amount, 0)

      const byCategory = {}
      safeRows.filter(r => r.type === 'expense').forEach(r => {
        byCategory[r.category] = (byCategory[r.category] || 0) + +r.amount
      })
      const byVehicle = {}
      safeRows.filter(r => r.type === 'investment').forEach(r => {
        const k = r.investment_vehicle || 'Other'
        byVehicle[k] = (byVehicle[k] || 0) + +r.amount
      })

      const top5 = safeRows
        .filter(r => r.type === 'expense')
        .sort((a, b) => +b.amount - +a.amount)
        .slice(0, 5)

      return {
        monthly,
        totalIncome,
        totalRepayments,
        totalExpense,
        totalInvestment,
        byCategory,
        byVehicle,
        top5,
        count: safeRows.length
      }
    }
  })

  return { data, loading: isLoading }
}

export function useRunningBalance(year, month) {
  const { data, isLoading } = useQuery({
    queryKey: ['balance', year, month],
    queryFn: async () => {
      const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
      const { data: rows, error } = await supabase
        .from('transactions')
        .select('type, amount')
        .lte('date', endDate)

      if (error) throw error
      return (rows || []).reduce((acc, r) => {
        return acc + (r.type === 'income' ? Number(r.amount) : -Number(r.amount))
      }, 0)
    }
  })
  return { balance: data, loading: isLoading }
}

export async function addTransaction(payload) {
  const { data, error } = await supabase.from('transactions').insert(payload).select().single()
  if (error) throw error
  return data
}
export async function updateTransaction(id, payload) {
  const { data, error } = await supabase.from('transactions').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
  return true
}

export const invalidateCache = () => {}
export const registerPrefetch = () => {}
export const prefetch = () => {}
