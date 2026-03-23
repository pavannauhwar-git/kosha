#!/usr/bin/env python3
"""
Complete pessimistic rewrite — removes all optimistic update logic,
replaces with clean server-first + invalidate pattern.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ─── 1. useTransactions.js ────────────────────────────────────────────────
def clean_use_transactions():
    path = os.path.join(ROOT, 'src/hooks/useTransactions.js')
    with open(path) as f:
        content = f.read()

    # Find where the mid-file `import { queryClient }` line is
    marker = "import { queryClient } from '../lib/queryClient'"
    idx = content.find(marker)
    if idx == -1:
        print("  ⚠ Could not find queryClient import marker")
        return

    before = content[:idx].rstrip() + '\n\n'

    # Remove OPTIMISTIC_ID_PREFIX + isOptimisticId
    before = before.replace(
        "export const OPTIMISTIC_ID_PREFIX = '__optimistic__'\n\n"
        "export function isOptimisticId(id) {\n"
        "  return String(id).startsWith(OPTIMISTIC_ID_PREFIX)\n"
        "}\n",
        ""
    )

    # Add queryClient import at top (after supabase import)
    before = before.replace(
        "import { supabase } from '../lib/supabase'",
        "import { supabase } from '../lib/supabase'\nimport { queryClient } from '../lib/queryClient'"
    )

    # Simplify useTransactions return — remove stub methods
    old_return = (
        "  return { \n"
        "    data: data || [], \n"
        "    loading: isLoading, \n"
        "    error, \n"
        "    refetch,\n"
        "    // Stub these out or rely on the query layer\n"
        "    applyLocalEdit: () => {},\n"
        "    clearLocalEdit: () => {},\n"
        "    revertLocalEdit: () => {}\n"
        "  }"
    )
    new_return = "  return { data: data || [], loading: isLoading, error, refetch }"
    before = before.replace(old_return, new_return)

    new_end = (
        "export function invalidateCache() {\n"
        "  queryClient.invalidateQueries({ queryKey: ['transactions'] })\n"
        "  queryClient.invalidateQueries({ queryKey: ['month'] })\n"
        "  queryClient.invalidateQueries({ queryKey: ['year'] })\n"
        "  queryClient.invalidateQueries({ queryKey: ['balance'] })\n"
        "}\n"
        "export const registerPrefetch = () => {}\n"
        "export const prefetch = () => {}\n"
    )

    with open(path, 'w') as f:
        f.write(before + new_end)
    print("  ✓ useTransactions.js cleaned")


# ─── 2. useLiabilities.js ─────────────────────────────────────────────────
def clean_use_liabilities():
    path = os.path.join(ROOT, 'src/hooks/useLiabilities.js')
    new_content = r"""import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { invalidateCache as invalidateTxnCache } from './useTransactions'

// ── Cache — stale-while-revalidate ────────────────────────────────────────
let cachedRows = null
let cachedTs   = 0
const TTL_MS   = 90_000
const INVALIDATION_EVENT = 'kosha:liabilities:invalidated'

function getCached() {
  return cachedRows ? { rows: cachedRows, ts: cachedTs } : null
}

function setCached(rows) {
  cachedRows = rows
  cachedTs   = Date.now()
}

function invalidateCache() {
  cachedTs = 0
  window.dispatchEvent(new CustomEvent(INVALIDATION_EVENT))
}

function isFresh() {
  return cachedRows && Date.now() - cachedTs < TTL_MS
}

// ── Helpers ───────────────────────────────────────────────────────────────
async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('Not signed in')
  return session.user.id
}

// ── useLiabilities ────────────────────────────────────────────────────────
export function useLiabilities() {
  const [pending, setPending] = useState(() => cachedRows ? cachedRows.filter(r => !r.paid) : [])
  const [paid, setPaid]       = useState(() => cachedRows ? cachedRows.filter(r => r.paid) : [])
  const [loading, setLoading] = useState(() => !cachedRows)

  const fetchData = useCallback(async (force = false) => {
    if (cachedRows) {
      setPending(cachedRows.filter(r => !r.paid))
      setPaid(cachedRows.filter(r => r.paid))
      setLoading(false)
      if (!force && isFresh()) return
    } else {
      setLoading(true)
    }

    try {
      const { data: rows, error } = await supabase
        .from('liabilities')
        .select('id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id')
        .order('due_date', { ascending: true })

      if (error) throw error
      const sorted = rows || []
      setCached(sorted)
      setPending(sorted.filter(r => !r.paid))
      setPaid(sorted.filter(r => r.paid))
    } catch {
      // Network failure — cached data stays visible
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Re-fetch when app returns from background
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') fetchData() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetchData])

  // Re-fetch on cache invalidation
  useEffect(() => {
    const handler = () => fetchData(true)
    window.addEventListener(INVALIDATION_EVENT, handler)
    return () => window.removeEventListener(INVALIDATION_EVENT, handler)
  }, [fetchData])

  const refetch = useCallback(() => fetchData(true), [fetchData])

  return { pending, paid, loading, refetch }
}

// ── Writes — pessimistic: server first, then invalidate ───────────────────

export async function addLiability(payload) {
  const user_id = await getCurrentUserId()
  const { data, error } = await supabase
    .from('liabilities')
    .insert([{ ...payload, user_id }])
    .select('id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id')
    .single()
  if (error) throw error
  invalidateCache()
  return data
}

export async function markPaid(liability) {
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
    await supabase.from('liabilities').insert([{
      description:  liability.description,
      amount:       liability.amount,
      due_date:     due.toISOString().slice(0, 10),
      is_recurring: true,
      recurrence:   liability.recurrence,
      paid:         false,
      user_id,
    }])
  }

  // Invalidate both caches — UI refreshes with server truth
  invalidateCache()
  invalidateTxnCache()
}

export async function deleteLiability(id) {
  const { error } = await supabase.from('liabilities').delete().eq('id', id)
  if (error) throw error
  invalidateCache()
}
"""
    with open(path, 'w') as f:
        f.write(new_content.lstrip())
    print("  ✓ useLiabilities.js cleaned")


if __name__ == '__main__':
    print("Pessimistic cleanup — removing all optimistic code…")
    clean_use_transactions()
    clean_use_liabilities()
    print("Done.")
