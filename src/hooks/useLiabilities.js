import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, invalidateQueryFamilies } from '../lib/queryClient'
import { invalidateCache as invalidateTxnCache } from './useTransactions'

export const LIABILITY_INVALIDATION_KEYS = [['liabilities']]


const LIABILITY_QUERY_KEY = ['liabilities']
const LIABILITY_COLUMNS = 'id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id'
// ── Helpers ───────────────────────────────────────────────────────────────
async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('Not signed in')
  return session.user.id
}

export function invalidateLiabilityCache() {
  return invalidateQueryFamilies(LIABILITY_INVALIDATION_KEYS)
}

async function fetchLiabilities() {
  const { data: rows, error } = await supabase
    .from('liabilities')
    .select(LIABILITY_COLUMNS)
    .order('due_date', { ascending: true })
  if (error) throw error
  return rows || []
}

export function refreshLiabilityCache() {
  return queryClient.fetchQuery({
    queryKey: LIABILITY_QUERY_KEY,
    queryFn: fetchLiabilities,
    staleTime: 0,
  })
}

// ── useLiabilities ────────────────────────────────────────────────────────
export function useLiabilities() {
  const { data: rows, isLoading } = useQuery({
    queryKey: LIABILITY_QUERY_KEY,
    queryFn: fetchLiabilities,
  })

  const pending = useMemo(() => (rows || []).filter(r => !r.paid), [rows])
  const paid = useMemo(() => (rows || []).filter(r => r.paid), [rows])

  return { pending, paid, loading: isLoading }
}

// ── Writes — pessimistic: server first, then invalidate ───────────────────

export async function addLiability(payload, options = {}) {
  const { invalidate = true } = options
  const user_id = await getCurrentUserId()
  const { data, error } = await supabase
    .from('liabilities')
    .insert([{ ...payload, user_id }])
    .select('id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id')
    .single()
  if (error) throw error
  if (invalidate) {
    await invalidateLiabilityCache()
  }
  return data
}

export async function markPaid(liability, options = {}) {
  const { invalidate = true } = options
  const user_id = await getCurrentUserId()

  // 1. Insert an expense transaction linked to this bill
  const { data: txn, error: txnErr } = await supabase
    .from('transactions')
    .insert([{
      date:         new Date().toISOString().slice(0, 10),
      type:         'expense',
      description:  liability.description,
      amount:       liability.amount,
      category:     'bills',
      is_repayment: false,
      payment_mode: 'other',
      notes:        `Auto-created from bill: ${liability.description}`,
      user_id,
    }])
    .select('id')
    .single()
  if (txnErr) throw txnErr

  // 2. Mark liability paid and link to the transaction
  const { error: liabErr } = await supabase
    .from('liabilities')
    .update({ paid: true, linked_transaction_id: txn.id })
    .eq('id', liability.id)
  if (liabErr) throw liabErr

  // 3. If recurring, create the next period automatically
  if (liability.is_recurring && liability.recurrence) {
    const due    = new Date(liability.due_date)
    const months = { monthly: 1, quarterly: 3, yearly: 12 }
    due.setMonth(due.getMonth() + (months[liability.recurrence] || 1))
    const { error: recurringError } = await supabase.from('liabilities').insert([{
      description:  liability.description,
      amount:       liability.amount,
      due_date:     due.toISOString().slice(0, 10),
      is_recurring: true,
      recurrence:   liability.recurrence,
      paid:         false,
      user_id,
    }])
    if (recurringError) throw recurringError
  }

  // Invalidate both caches — UI refreshes with server truth
  if (invalidate) {
    await Promise.all([invalidateLiabilityCache(), invalidateTxnCache()])
  }
}

export async function deleteLiability(id, options = {}) {
  const { invalidate = true } = options
  const { error } = await supabase.from('liabilities').delete().eq('id', id)
  if (error) throw error
  if (invalidate) {
    await invalidateLiabilityCache()
  }
}
