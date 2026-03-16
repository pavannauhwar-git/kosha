import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Helper: get current user_id from session ──────────────────────────────
async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('Not signed in')
  return session.user.id
}

// ── 8-second timeout wrapper ─────────────────────────────────────────────
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Check your connection.')), ms)
    ),
  ])
}

export function useLiabilities() {
  const [pending, setPending] = useState([])
  const [paid,    setPaid]    = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('liabilities')
      .select('*')
      .order('due_date', { ascending: true })
    if (rows) {
      setPending(rows.filter(r => !r.paid))
      setPaid(rows.filter(r =>  r.paid))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  // ── visibilitychange: re-fetch when app returns from background ────────
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') fetch()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetch])

  return { pending, paid, loading, refetch: fetch }
}

export async function addLiability(payload) {
  const user_id = await getCurrentUserId()
  const { error } = await withTimeout(
    supabase.from('liabilities').insert([{ ...payload, user_id }])
  )
  if (error) throw error
}

export async function markPaid(liability) {
  const user_id = await getCurrentUserId()

  // 1. Insert an expense transaction linked to this bill
  const txnPayload = {
    date:         new Date().toISOString().slice(0, 10),
    type:         'expense',
    description:  liability.description,
    amount:       liability.amount,
    category:     'credit_card',
    is_repayment: false,
    payment_mode: 'net_banking',
    notes:        `Auto-created from bill: ${liability.description}`,
    user_id,
  }
  const { data: txn, error: txnErr } = await withTimeout(
    supabase.from('transactions').insert([txnPayload]).select().single()
  )
  if (txnErr) throw txnErr

  // 2. Mark liability paid and link to the transaction
  const { error: liabErr } = await withTimeout(
    supabase.from('liabilities')
      .update({ paid: true, linked_transaction_id: txn.id })
      .eq('id', liability.id)
  )
  if (liabErr) throw liabErr

  // 3. If recurring, create the next period automatically
  if (liability.is_recurring && liability.recurrence) {
    const due    = new Date(liability.due_date)
    const months = { monthly: 1, quarterly: 3, yearly: 12 }
    due.setMonth(due.getMonth() + (months[liability.recurrence] || 1))
    await withTimeout(
      supabase.from('liabilities').insert([{
        description:  liability.description,
        amount:       liability.amount,
        due_date:     due.toISOString().slice(0, 10),
        is_recurring: true,
        recurrence:   liability.recurrence,
        paid:         false,
        user_id,
      }])
    )
  }
}

export async function deleteLiability(id) {
  const { error } = await withTimeout(
    supabase.from('liabilities').delete().eq('id', id)
  )
  if (error) throw error
}
