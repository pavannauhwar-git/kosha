import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { invalidateCache as invalidateTxnCache } from './useTransactions'

// ── Cache — same stale-while-revalidate pattern as useTransactions ────────
// Bills data changes rarely (a few times a day at most), so 90s TTL is fine.
// This eliminates the loading flash when switching back to the Bills tab.
const cache   = new Map()
const TTL_MS  = 90_000  // 90 seconds
const CACHE_KEY = 'liabilities'
export const LIABILITIES_INVALIDATION_EVENT = 'kosha:liabilities:invalidated'
const subscribers = new Set()
let optimisticCounter = 0
let activeFetchController = null
let latestFetchToken = 0

function getCached() {
  const entry = cache.get(CACHE_KEY)
  if (!entry) return null
  return entry
}

function setCached(rows) {
  cache.set(CACHE_KEY, { rows, ts: Date.now() })
}

function invalidateCache() {
  // Mark cache as stale without deleting data — this is critical for preventing
  // the loading skeleton flash. The stale-while-revalidate pattern will serve
  // the existing cached data immediately while fetching fresh data in background.
  const entry = cache.get(CACHE_KEY)
  if (entry) entry.ts = 0
  window.dispatchEvent(new CustomEvent(LIABILITIES_INVALIDATION_EVENT))
}

function isFresh(entry) {
  return Date.now() - entry.ts < TTL_MS
}

function compareDueDate(a, b) {
  const left = a?.due_date || ''
  const right = b?.due_date || ''
  return left.localeCompare(right)
}

function subscribe(listener) {
  subscribers.add(listener)
  return () => subscribers.delete(listener)
}

function notify(rows) {
  subscribers.forEach((listener) => listener(rows))
}

function setCachedAndNotify(rows) {
  setCached(rows)
  notify(rows)
}

function cancelLiabilitiesFetches() {
  latestFetchToken += 1
  if (activeFetchController) {
    activeFetchController.abort()
    activeFetchController = null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('Not signed in')
  return session.user.id
}

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Check your connection.')), ms)
    ),
  ])
}

// ── useLiabilities ────────────────────────────────────────────────────────
export function useLiabilities() {
  // Initialise synchronously from cache — zero loading flash on return visits
  const [pending, setPending] = useState(() => {
    const cached = getCached()
    return cached ? cached.rows.filter(r => !r.paid) : []
  })
  const [paid, setPaid] = useState(() => {
    const cached = getCached()
    return cached ? cached.rows.filter(r => r.paid) : []
  })
  const [loading, setLoading] = useState(() => !getCached())

  const fetch = useCallback(async (force = false) => {
    const token = ++latestFetchToken
    const controller = new AbortController()
    activeFetchController = controller
    const cached = getCached()

    // Serve cache immediately while revalidating in background
    if (cached) {
      setPending(cached.rows.filter(r => !r.paid))
      setPaid(cached.rows.filter(r => r.paid))
      setLoading(false)
      if (!force && isFresh(cached)) return  // still fresh — skip network
    } else {
      setLoading(true)
    }

    try {
      const { data: rows } = await supabase
        .from('liabilities')
        .select('id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id')
        .order('due_date', { ascending: true })
        .abortSignal(controller.signal)

      if (rows && token === latestFetchToken) {
        setCachedAndNotify(rows)
        setPending(rows.filter(r => !r.paid))
        setPaid(rows.filter(r => r.paid))
      }
    } catch (error) {
      if (error?.name === 'AbortError') return
      // Network failure — cached data stays visible, no spinner
    } finally {
      if (activeFetchController === controller) activeFetchController = null
      if (token === latestFetchToken) setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    const unsubscribe = subscribe((rows) => {
      setPending(rows.filter(r => !r.paid))
      setPaid(rows.filter(r => r.paid))
      setLoading(false)
    })
    return unsubscribe
  }, [])

  // Re-fetch when app returns from background
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') fetch()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetch])

  useEffect(() => {
    const handler = () => { fetch(true) }
    window.addEventListener(LIABILITIES_INVALIDATION_EVENT, handler)
    return () => window.removeEventListener(LIABILITIES_INVALIDATION_EVENT, handler)
  }, [fetch])

  const refetch = useCallback(() => fetch(true), [fetch])

  return { pending, paid, loading, refetch }
}

// ── Writes — all invalidate cache so next read hits the network ───────────

export async function addLiability(payload) {
  cancelLiabilitiesFetches()
  const previousRows = [...(getCached()?.rows || [])]
  const optimisticId = globalThis.crypto?.randomUUID?.() || `temp-${Date.now()}-${++optimisticCounter}`
  const optimistic = {
    id: optimisticId,
    ...payload,
    linked_transaction_id: null,
  }
  setCachedAndNotify([...previousRows, optimistic].sort(compareDueDate))

  try {
    const user_id = await getCurrentUserId()
    const { data, error } = await withTimeout(
      supabase
        .from('liabilities')
        .insert([{ ...payload, user_id }])
        .select('id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id')
        .single()
    )
    if (error) throw error
    let replaced = false
    const withServerRow = (getCached()?.rows || [])
      .map((row) => {
        if (row.id === optimistic.id) {
          replaced = true
          return data
        }
        return row
      })
    if (!replaced) withServerRow.push(data)
    const deduped = Array.from(
      new Map(withServerRow.map((row) => [row.id, row])).values()
    ).sort(compareDueDate)
    setCachedAndNotify(deduped)
  } catch (error) {
    setCachedAndNotify(previousRows)
    throw error
  } finally {
    invalidateCache()
  }
}

export async function markPaid(liability) {
  cancelLiabilitiesFetches()
  const previousRows = [...(getCached()?.rows || [])]
  const optimisticRows = previousRows
    .map((row) => (row.id === liability.id ? { ...row, paid: true } : row))
    .sort(compareDueDate)
  setCachedAndNotify(optimisticRows)

  try {
    const user_id = await getCurrentUserId()

    // 1. Insert an expense transaction linked to this bill
    const txnPayload = {
      date:         new Date().toISOString().slice(0, 10),
      type:         'expense',
      description:  liability.description,
      amount:       liability.amount,
      category:     'bills',
      is_repayment: false,
      payment_mode: 'other',
      notes:        `Auto-created from bill: ${liability.description}`,
      user_id,
    }
    const { data: txn, error: txnErr } = await withTimeout(
      supabase.from('transactions').insert([txnPayload]).select('id').single()
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
  } catch (error) {
    setCachedAndNotify(previousRows)
    throw error
  } finally {
    invalidateCache()
    // markPaid creates an expense transaction, so invalidate transaction
    // caches so Dashboard totals, month summary, and balance update.
    invalidateTxnCache('txns:')
    invalidateTxnCache('month:')
    invalidateTxnCache('balance:')
    invalidateTxnCache('year:')
  }
}

export async function deleteLiability(id) {
  cancelLiabilitiesFetches()
  const previousRows = [...(getCached()?.rows || [])]
  setCachedAndNotify(previousRows.filter((row) => row.id !== id))

  try {
    const { error } = await withTimeout(
      supabase.from('liabilities').delete().eq('id', id)
    )
    if (error) throw error
  } catch (error) {
    setCachedAndNotify(previousRows)
    throw error
  } finally {
    invalidateCache()
  }
}
