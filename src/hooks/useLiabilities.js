import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useLiabilities() {
  const [pending, setPending] = useState([])
  const [paid,    setPaid]    = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('liabilities').select('*').order('due_date', { ascending: true })
    if (rows) {
      setPending(rows.filter(r => !r.paid))
      setPaid(rows.filter(r => r.paid))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])
  return { pending, paid, loading, refetch: fetch }
}

export async function addLiability(payload) {
  const { error } = await supabase.from('liabilities').insert([payload])
  if (error) throw error
}

export async function markPaid(liability, addTxn) {
  // 1. Insert expense transaction
  const txnPayload = {
    date:        new Date().toISOString().slice(0,10),
    type:        'expense',
    description: liability.description,
    amount:      liability.amount,
    category:    'credit_card',
    is_repayment:false,
    payment_mode:'net_banking',
    notes:       `Auto-created from bill: ${liability.description}`,
  }
  const { data: txn, error: txnErr } = await supabase
    .from('transactions').insert([txnPayload]).select().single()
  if (txnErr) throw txnErr

  // 2. Mark liability paid + link transaction
  const { error: liabErr } = await supabase
    .from('liabilities')
    .update({ paid: true, linked_transaction_id: txn.id })
    .eq('id', liability.id)
  if (liabErr) throw liabErr

  // 3. If recurring, create next period
  if (liability.is_recurring && liability.recurrence) {
    const due    = new Date(liability.due_date)
    const months = { monthly:1, quarterly:3, yearly:12 }
    due.setMonth(due.getMonth() + (months[liability.recurrence] || 1))
    await supabase.from('liabilities').insert([{
      description:  liability.description,
      amount:       liability.amount,
      due_date:     due.toISOString().slice(0,10),
      is_recurring: true,
      recurrence:   liability.recurrence,
      paid:         false,
    }])
  }
}

export async function deleteLiability(id) {
  const { error } = await supabase.from('liabilities').delete().eq('id', id)
  if (error) throw error
}
