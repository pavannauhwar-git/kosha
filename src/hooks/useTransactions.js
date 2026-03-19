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
        balance: earned + repayments - expense - investment,
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

async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('Not signed in')
  return session.user.id
}

export async function addTransaction(payload) {
  const user_id = await getCurrentUserId()
  const { data, error } = await supabase.from('transactions').insert({ ...payload, user_id }).select().single()
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

import { queryClient } from '../lib/queryClient'

export function applyOptimisticUpdate(id, payload) {
  // 1. Attempt to resolve original transaction (for edits or deletes)
  let originalTxn = payload?._original;
  if (!originalTxn) {
    const txnsCaches = queryClient.getQueriesData({ queryKey: ['transactions'] });
    for (const [key, data] of txnsCaches) {
      if (Array.isArray(data)) {
        const found = data.find(t => t.id === id);
        if (found) { originalTxn = found; break; }
      }
    }
  }

  // 2. Patch transaction lists
  queryClient.setQueriesData({ queryKey: ['transactions'] }, (old) => {
    if (!Array.isArray(old)) return old;
    if (payload === null) {
      return old.filter(t => t.id !== id);
    }
    const exists = old.some(t => t.id === id);
    if (exists) {
      return old.map(t => t.id === id ? { ...t, ...payload } : t).sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return [{ id, ...payload }, ...old].sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  // 3. Patch global balance precisely and instantly
  let balanceDiff = 0;
  if (payload === null && originalTxn) {
    balanceDiff = originalTxn.type === 'income' ? -Number(originalTxn.amount) : Number(originalTxn.amount);
  } else if (payload && originalTxn) {
    const oldAmt = originalTxn.type === 'income' ? Number(originalTxn.amount) : -Number(originalTxn.amount);
    const newAmt = payload.type === 'income' ? Number(payload.amount) : -Number(payload.amount);
    balanceDiff = newAmt - oldAmt;
  } else if (payload) {
    balanceDiff = payload.type === 'income' ? Number(payload.amount) : -Number(payload.amount);
  }

  if (balanceDiff !== 0) {
    queryClient.setQueriesData({ queryKey: ['balance'] }, (old) => {
      if (typeof old === 'number') return old + balanceDiff;
      return old;
    });
  }

  // 4. Patch monthly summary exactly
  if (payload || originalTxn) {
    const activeDate = new Date((payload || originalTxn).date);
    const mYear = activeDate.getFullYear();
    const mMonth = activeDate.getMonth() + 1;
    
    queryClient.setQueriesData({ queryKey: ['month', mYear, mMonth] }, (old) => {
      if (!old || typeof old !== 'object') return old;
      let next = { ...old, byCategory: { ...old.byCategory || {} }, byVehicle: { ...old.byVehicle || {} } };
      
      // Revert old values
      if (originalTxn) {
        if (originalTxn.type === 'income' && !originalTxn.is_repayment) next.earned -= Number(originalTxn.amount);
        if (originalTxn.type === 'income' && originalTxn.is_repayment) next.repayments -= Number(originalTxn.amount);
        if (originalTxn.type === 'expense') { 
          next.expense -= Number(originalTxn.amount);
          if (originalTxn.category) next.byCategory[originalTxn.category] = Math.max(0, (next.byCategory[originalTxn.category] || 0) - Number(originalTxn.amount));
        }
        if (originalTxn.type === 'investment') { 
          next.investment -= Number(originalTxn.amount);
          const v = originalTxn.investment_vehicle || 'Other';
          next.byVehicle[v] = Math.max(0, (next.byVehicle[v] || 0) - Number(originalTxn.amount));
        }
      }

      // Apply new values
      if (payload) {
        if (payload.type === 'income' && !payload.is_repayment) next.earned += Number(payload.amount);
        if (payload.type === 'income' && payload.is_repayment) next.repayments += Number(payload.amount);
        if (payload.type === 'expense') {
          next.expense += Number(payload.amount);
          if (payload.category) next.byCategory[payload.category] = (next.byCategory[payload.category] || 0) + Number(payload.amount);
        }
        if (payload.type === 'investment') {
          next.investment += Number(payload.amount);
          const v = payload.investment_vehicle || 'Other';
          next.byVehicle[v] = (next.byVehicle[v] || 0) + Number(payload.amount);
        }
      }

      next.balance = (next.earned || 0) + (next.repayments || 0) - (next.expense || 0) - (next.investment || 0);
      return next;
    });
  }
}

export const invalidateCache = (pattern) => {
  if (!pattern) return
  if (pattern.startsWith('txns:')) queryClient.invalidateQueries({ queryKey: ['transactions'] })
  else if (pattern.startsWith('month:')) queryClient.invalidateQueries({ queryKey: ['month'] })
  else if (pattern.startsWith('year:')) queryClient.invalidateQueries({ queryKey: ['year'] })
  else if (pattern.startsWith('balance:')) queryClient.invalidateQueries({ queryKey: ['balance'] })
}
export const registerPrefetch = () => {}
export const prefetch = () => {}
