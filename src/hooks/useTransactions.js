import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── All transactions ────────────────────────────────────────────────────────
export function useTransactions({ type, category, search, limit } = {}) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
    if (type)     q = q.eq('type', type)
    if (category) q = q.eq('category', category)
    if (search)   q = q.ilike('description', `%${search}%`)
    if (limit)    q = q.limit(limit)
    const { data: rows, error: err } = await q
    setData(rows || [])
    setError(err)
    setLoading(false)
  }, [type, category, search, limit])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

// ── Monthly summary ─────────────────────────────────────────────────────────
export function useMonthSummary(year, month) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const start = `${year}-${String(month).padStart(2,'0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const end   = `${year}-${String(month).padStart(2,'0')}-${lastDay}`
      const { data: rows } = await supabase
        .from('transactions').select('*')
        .gte('date', start).lte('date', end)
      if (!rows) { setLoading(false); return }

      const earned     = rows.filter(r => r.type==='income' && !r.is_repayment).reduce((s,r)=>s+ +r.amount,0)
      const repayments = rows.filter(r => r.type==='income' &&  r.is_repayment).reduce((s,r)=>s+ +r.amount,0)
      const expense    = rows.filter(r => r.type==='expense').reduce((s,r)=>s+ +r.amount,0)
      const investment = rows.filter(r => r.type==='investment').reduce((s,r)=>s+ +r.amount,0)

      const byCategory = {}
      rows.filter(r=>r.type==='expense').forEach(r=>{
        byCategory[r.category]=(byCategory[r.category]||0)+ +r.amount
      })
      const byVehicle = {}
      rows.filter(r=>r.type==='investment').forEach(r=>{
        const k=r.investment_vehicle||'Other'
        byVehicle[k]=(byVehicle[k]||0)+ +r.amount
      })

      setData({ rows, earned, repayments, expense, investment,
        balance: earned+repayments-expense-investment, byCategory, byVehicle })
      setLoading(false)
    }
    load()
  }, [year, month])

  return { data, loading }
}

// ── Year summary ────────────────────────────────────────────────────────────
export function useYearSummary(year) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: rows } = await supabase
        .from('transactions').select('*')
        .gte('date',`${year}-01-01`).lte('date',`${year}-12-31`)
      if (!rows) { setLoading(false); return }

      const monthly = Array.from({length:12},(_,i)=>{
        const m=i+1
        const mo=rows.filter(r=>new Date(r.date).getMonth()+1===m)
        return {
          month:m,
          income:    mo.filter(r=>r.type==='income'&&!r.is_repayment).reduce((s,r)=>s+ +r.amount,0),
          expense:   mo.filter(r=>r.type==='expense').reduce((s,r)=>s+ +r.amount,0),
          investment:mo.filter(r=>r.type==='investment').reduce((s,r)=>s+ +r.amount,0),
        }
      })
      const totalIncome     = rows.filter(r=>r.type==='income'&&!r.is_repayment).reduce((s,r)=>s+ +r.amount,0)
      const totalRepayments = rows.filter(r=>r.type==='income'&& r.is_repayment).reduce((s,r)=>s+ +r.amount,0)
      const totalExpense    = rows.filter(r=>r.type==='expense').reduce((s,r)=>s+ +r.amount,0)
      const totalInvestment = rows.filter(r=>r.type==='investment').reduce((s,r)=>s+ +r.amount,0)

      const byCategory={}
      rows.filter(r=>r.type==='expense').forEach(r=>{byCategory[r.category]=(byCategory[r.category]||0)+ +r.amount})
      const byVehicle={}
      rows.filter(r=>r.type==='investment').forEach(r=>{const k=r.investment_vehicle||'Other';byVehicle[k]=(byVehicle[k]||0)+ +r.amount})

      const withIncome=monthly.filter(m=>m.income>0)
      const avgSavings=withIncome.length
        ? Math.round(withIncome.reduce((s,m)=>s+(m.income>0?((m.income-m.expense)/m.income)*100:0),0)/withIncome.length)
        : 0

      setData({monthly,totalIncome,totalRepayments,totalExpense,totalInvestment,byCategory,byVehicle,avgSavings})
      setLoading(false)
    }
    load()
  },[year])

  return { data, loading }
}

// ── CRUD ────────────────────────────────────────────────────────────────────
export async function addTransaction(payload) {
  const { error } = await supabase.from('transactions').insert([payload])
  if (error) throw error
}
export async function updateTransaction(id, payload) {
  const { error } = await supabase.from('transactions').update(payload).eq('id',id)
  if (error) throw error
}
export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id',id)
  if (error) throw error
}

// ── Running (cumulative) balance up to end of a given month ──────────────
export function useRunningBalance(year, month) {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const endDate = `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`
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
      }, 12408.68)

      setBalance(cumulative)
      setLoading(false)
    }
    load()
  }, [year, month])

  return { balance, loading }
}