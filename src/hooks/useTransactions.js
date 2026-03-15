import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── In-memory cache ──────────────────────────────────────────────────────────
const cache = new Map()
const TTL   = 60_000

function getCached(key) {
  const e = cache.get(key)
  if (!e) return null
  if (Date.now() - e.ts > TTL) { cache.delete(key); return null }
  return e.data
}
function setCached(key, data) { cache.set(key, { data, ts: Date.now() }) }
export function invalidateCache() { cache.clear() }

// ── All transactions ─────────────────────────────────────────────────────────
export function useTransactions({ type, category, search, limit } = {}) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async (force = false) => {
    const key = `txns:${type}:${category}:${search}:${limit}`
    if (!force) {
      const hit = getCached(key)
      if (hit) { setData(hit); setLoading(false); return }
    }
    setLoading(true)
    let q = supabase.from('transactions').select('*')
      .order('date',       { ascending: false })
      .order('created_at', { ascending: false })
    if (type)     q = q.eq('type', type)
    if (category) q = q.eq('category', category)
    if (search)   q = q.ilike('description', `%${search}%`)
    if (limit)    q = q.limit(limit)
    const { data: rows, error: err } = await q
    setData(rows || [])
    setError(err)
    setCached(key, rows || [])
    setLoading(false)
  }, [type, category, search, limit])

  useEffect(() => { fetch() }, [fetch])

  const refetch = useCallback(() => { invalidateCache(); fetch(true) }, [fetch])
  return { data, loading, error, refetch }
}

// ── Monthly summary ──────────────────────────────────────────────────────────
export function useMonthSummary(year, month) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const key = `month:${year}:${month}`
    const hit = getCached(key)
    if (hit) { setData(hit); setLoading(false); return }

    async function load() {
      setLoading(true)
      const start   = `${year}-${String(month).padStart(2,'0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const end     = `${year}-${String(month).padStart(2,'0')}-${lastDay}`
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

      const result = {
        rows, earned, repayments, expense, investment,
        balance: earned+repayments-expense-investment,
        byCategory, byVehicle
      }
      setCached(key, result)
      setData(result)
      setLoading(false)
    }
    load()
  }, [year, month])

  return { data, loading }
}

// ── Year summary ─────────────────────────────────────────────────────────────
export function useYearSummary(year) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const key = `year:${year}`
    const hit = getCached(key)
    if (hit) { setData(hit); setLoading(false); return }

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
          income:     mo.filter(r=>r.type==='income'&&!r.is_repayment).reduce((s,r)=>s+ +r.amount,0),
          expense:    mo.filter(r=>r.type==='expense').reduce((s,r)=>s+ +r.amount,0),
          investment: mo.filter(r=>r.type==='investment').reduce((s,r)=>s+ +r.amount,0),
        }
      })
      const totalIncome     = rows.filter(r=>r.type==='income'&&!r.is_repayment).reduce((s,r)=>s+ +r.amount,0)
      const totalRepayments = rows.filter(r=>r.type==='income'&& r.is_repayment).reduce((s,r)=>s+ +r.amount,0)
      const totalExpense    = rows.filter(r=>r.type==='expense').reduce((s,r)=>s+ +r.amount,0)
      const totalInvestment = rows.filter(r=>r.type==='investment').reduce((s,r)=>s+ +r.amount,0)

      const byCategory={}
      rows.filter(r=>r.type==='expense').forEach(r=>{
        byCategory[r.category]=(byCategory[r.category]||0)+ +r.amount
      })
      const byVehicle={}
      rows.filter(r=>r.type==='investment').forEach(r=>{
        const k=r.investment_vehicle||'Other'
        byVehicle[k]=(byVehicle[k]||0)+ +r.amount
      })
      const withIncome  = monthly.filter(m=>m.income>0)
      const avgSavings  = withIncome.length
        ? Math.round(withIncome.reduce((s,m)=>s+((m.income-m.expense)/m.income*100),0)/withIncome.length)
        : 0

      const result = {monthly,totalIncome,totalRepayments,totalExpense,totalInvestment,byCategory,byVehicle,avgSavings}
      setCached(key, result)
      setData(result)
      setLoading(false)
    }
    load()
  }, [year])

  return { data, loading }
}

// ── Running balance ───────────────────────────────────────────────────────────
export function useRunningBalance(year, month) {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const key = `balance:${year}:${month}`
    const hit = getCached(key)
    if (hit !== null) { setBalance(hit); setLoading(false); return }

    async function load() {
      setLoading(true)
      const endDate = `${year}-${String(month).padStart(2,'0')}-${new Date(year,month,0).getDate()}`
      const { data: rows } = await supabase
        .from('transactions')
        .select('type, amount, is_repayment')
        .lte('date', endDate)
      if (!rows) { setLoading(false); return }
      const cumulative = rows.reduce((sum,r) => {
        if (r.type==='income')     return sum + +r.amount
        if (r.type==='expense')    return sum - +r.amount
        if (r.type==='investment') return sum - +r.amount
        return sum
      }, 0)
      setCached(key, cumulative)
      setBalance(cumulative)
      setLoading(false)
    }
    load()
  }, [year, month])

  return { balance, loading }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export async function addTransaction(payload) {
  const { error } = await supabase.from('transactions').insert([payload])
  if (error) throw error
  invalidateCache()
}
export async function updateTransaction(id, payload) {
  const { error } = await supabase.from('transactions').update(payload).eq('id',id)
  if (error) throw error
  invalidateCache()
}
export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id',id)
  if (error) throw error
  invalidateCache()
}