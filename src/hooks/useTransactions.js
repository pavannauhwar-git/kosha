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

      return (rows || []).reduce((acc, row) => {
        const amt = Number(row.amount)
        if (row.type === 'expense') {
          acc.expense += amt
        } else if (row.type === 'income') {
          acc.income += amt
        } else if (row.type === 'investment') {
          acc.investment += amt
        }
        return acc
      }, { expense: 0, income: 0, investment: 0 })
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
        .select('type, amount, date, category')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)

      if (error) throw error
      
      const summary = { expense: 0, income: 0, investment: 0, monthly: {} }
      for (let i = 1; i <= 12; i++) {
        summary.monthly[i] = { expense: 0, income: 0, investment: 0 }
      }

      ;(rows || []).forEach(row => {
        const amt = Number(row.amount)
        const m = new Date(row.date).getMonth() + 1
        if (row.type && summary[row.type] !== undefined) {
          summary[row.type] += amt
          summary.monthly[m][row.type] += amt
        }
      })
      return summary
    }
  })

  return { data, loading: isLoading }
}

export function useRunningBalance(year, month) {
  const { data, isLoading } = useQuery({
    queryKey: ['balance', year, month],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('transactions').select('amount, type')
      if (error) throw error
      return (rows || []).reduce((acc, r) => {
        return acc + (r.type === 'income' ? Number(r.amount) : -Number(r.amount))
      }, 0)
    }
  })
  return { data, loading: isLoading }
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
