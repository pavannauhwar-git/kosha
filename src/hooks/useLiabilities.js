import { useQueries } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, invalidateQueryFamilies } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { invalidateCache as invalidateTxnCache } from './useTransactions'

export const LIABILITY_INVALIDATION_KEYS = [['liabilities']]

const LIABILITY_PENDING_QUERY_KEY = ['liabilities', 'pending']
const LIABILITY_PAID_QUERY_KEY    = ['liabilities', 'paid']
const LIABILITY_COLUMNS =
  'id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id'

export function invalidateLiabilityCache() {
  return invalidateQueryFamilies(LIABILITY_INVALIDATION_KEYS)
}

// FIX (defect 2.1, 2.2): Removed getCurrentUserId() which called getSession().
// All functions now use getAuthUserId() from authStore — synchronous,
// reads from the in-memory user updated by onAuthStateChange, no race window.

async function fetchLiabilitiesByPaid(paidValue) {
  const userId = getAuthUserId()
  const { data: rows, error } = await supabase
    .from('liabilities')
    .select(LIABILITY_COLUMNS)
    .eq('user_id', userId)
    .eq('paid', paidValue)
    .order('due_date', { ascending: true })

  if (error) throw error
  return rows || []
}

export function useLiabilities({ includePaid = true } = {}) {
  const [pendingQuery, paidQuery] = useQueries({
    queries: [
      {
        queryKey: LIABILITY_PENDING_QUERY_KEY,
        queryFn: () => fetchLiabilitiesByPaid(false),
      },
      {
        queryKey: LIABILITY_PAID_QUERY_KEY,
        queryFn: () => fetchLiabilitiesByPaid(true),
        enabled: includePaid,
      },
    ],
  })

  return {
    pending: pendingQuery.data  || [],
    paid:    includePaid ? (paidQuery.data || []) : [],
    loading: pendingQuery.isLoading || (includePaid && paidQuery.isLoading),
    error:   pendingQuery.error  || (includePaid && paidQuery.error) || null,
  }
}

export async function addLiability(payload, options = {}) {
  const { invalidate = true } = options

  try {
    const userId = getAuthUserId()
    const { data, error } = await supabase
      .from('liabilities')
      .insert([{ ...payload, user_id: userId }])
      .select(LIABILITY_COLUMNS)
      .single()

    if (error) throw error

    // Inject into pending cache immediately
    queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY, (old) => {
      if (!Array.isArray(old)) return old
      // Insert in due-date order
      const next = [...old, data].sort(
        (a, b) => new Date(a.due_date) - new Date(b.due_date)
      )
      return next
    })

    // FIX (defect 1.1): no await — background only
    if (invalidate) invalidateLiabilityCache()

    return data
  } catch (err) {
    console.error('[Kosha] addLiability failed', err)
    throw err
  }
}

export async function markPaid(liability, options = {}) {
  const { invalidate = true } = options

  try {
    const userId = getAuthUserId()

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
        user_id:      userId,
      }])
      .select('id')
      .single()

    if (txnErr) throw txnErr

    const { error: liabErr } = await supabase
      .from('liabilities')
      .update({ paid: true, linked_transaction_id: txn.id })
      .eq('id', liability.id)
      .eq('user_id', userId)

    if (liabErr) throw liabErr

    if (liability.is_recurring && liability.recurrence) {
      const due    = new Date(liability.due_date)
      const months = { monthly: 1, quarterly: 3, yearly: 12 }
      due.setMonth(due.getMonth() + (months[liability.recurrence] || 1))

      const { error: recurringError } = await supabase
        .from('liabilities')
        .insert([{
          description:  liability.description,
          amount:       liability.amount,
          due_date:     due.toISOString().slice(0, 10),
          is_recurring: true,
          recurrence:   liability.recurrence,
          paid:         false,
          user_id:      userId,
        }])

      if (recurringError) throw recurringError
    }

    // Optimistically move the liability from pending to paid in cache
    queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY, (old) =>
      Array.isArray(old) ? old.filter(b => b.id !== liability.id) : old
    )
    queryClient.setQueryData(LIABILITY_PAID_QUERY_KEY, (old) => {
      if (!Array.isArray(old)) return old
      return [{ ...liability, paid: true, linked_transaction_id: txn.id }, ...old]
    })

    // FIX (defect 1.1): no await — fire and forget
    if (invalidate) {
      invalidateLiabilityCache()
      invalidateTxnCache()
    }
  } catch (err) {
    console.error('[Kosha] markPaid failed', err)
    throw err
  }
}

export async function deleteLiability(id, options = {}) {
  const { invalidate = true } = options

  try {
    const userId = getAuthUserId()
    const { error } = await supabase
      .from('liabilities')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error

    // Remove from both caches immediately
    const removeById = (old) =>
      Array.isArray(old) ? old.filter(b => b.id !== id) : old

    queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY, removeById)
    queryClient.setQueryData(LIABILITY_PAID_QUERY_KEY,    removeById)

    // Background invalidation — no await
    if (invalidate) invalidateLiabilityCache()
  } catch (err) {
    console.error('[Kosha] deleteLiability failed', err)
    throw err
  }
}
