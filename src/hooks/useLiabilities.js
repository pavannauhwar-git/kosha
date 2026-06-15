import { useQueries, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queryClient, evictSwCacheEntries } from '../lib/queryClient.js'
import { getAuthUserId } from '../lib/authStore.js';
import { getActiveWalletUserId, useActiveWallet } from '../lib/walletStore.js'
import { suppress, withOptimisticGuard } from '../lib/mutationGuard.js'
import { traceQuery } from '../lib/queryTrace.js'
import { FINANCIAL_EVENT_ACTIONS, logFinancialEvent } from '../lib/auditLog.js'
import {
  invalidateCache as invalidateTransactionCache,
  optimisticallyUpsertTransactionInCache,
  optimisticallyDeleteTransactionsByBillId
} from './useTransactions.js'
import { todayStr } from '../lib/utils.js'
import { hapticSuccess } from '../lib/haptics.js'

export const LIABILITY_INVALIDATION_KEYS = [['liabilities'], ['liabilitiesMonth'], ['transactions']]

export const LIABILITY_PENDING_QUERY_KEY = (targetUserId) => ['liabilities', 'pending', targetUserId]
export const LIABILITY_PAID_QUERY_KEY = (targetUserId) => ['liabilities', 'paid', targetUserId]
const LIABILITY_COLUMNS =
  'id, user_id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id, payment_mode'
export const MONTH_LIABILITY_COLUMNS = 'id, description, amount, due_date, paid, is_recurring, recurrence, linked_transaction_id, payment_mode'

function runInBackground(promise, scope) {
  void promise.catch((error) => {
    console.warn(`[Kosha] ${scope} background refresh failed`, error)
  })
}

export async function invalidateLiabilityCache() {
  suppress('liabilities')
  await evictSwCacheEntries('/liabilities')
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['liabilities'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['liabilitiesMonth'], refetchType: 'active' }),
  ])
}

async function fetchLiabilitiesByPaid(paidValue, targetUserId, signal) {
  return traceQuery(`liabilities:${paidValue ? 'paid' : 'pending'}`, async () => {
    const { data: rows, error } = await supabase
      .from('liabilities')
      .select(LIABILITY_COLUMNS)
      .eq('user_id', targetUserId)
      .eq('paid', paidValue)
      .order('due_date', { ascending: true })
      .abortSignal(signal)

    if (error) throw error
    return rows || []
  })
}

export function useLiabilities({ includePaid = true, enabled = true } = {}) {
  const targetUserId = useActiveWallet()

  const [pendingQuery, paidQuery] = useQueries({
    queries: [
      {
        queryKey: LIABILITY_PENDING_QUERY_KEY(targetUserId),
        queryFn: ({ signal }) => fetchLiabilitiesByPaid(false, targetUserId, signal),
        enabled: enabled && !!targetUserId,
        placeholderData: (prev, query) => (query?.queryKey?.[2] === targetUserId) ? prev : undefined,
      },
      {
        queryKey: LIABILITY_PAID_QUERY_KEY(targetUserId),
        queryFn: ({ signal }) => fetchLiabilitiesByPaid(true, targetUserId, signal),
        enabled: enabled && includePaid && !!targetUserId,
        placeholderData: (prev, query) => (query?.queryKey?.[2] === targetUserId) ? prev : undefined,
      },
    ],
  })

  return {
    pending: pendingQuery.data || [],
    paid: paidQuery.data || [],
    loading: pendingQuery.isLoading || (includePaid && paidQuery.isLoading),
    pendingLoading: pendingQuery.isLoading,
    paidLoading: includePaid ? paidQuery.isLoading : false,
    error: pendingQuery.error || (includePaid && paidQuery.error) || null,
  }
}

function monthDateRange(year, month) {
  const safeYear = Number(year)
  const safeMonth = Number(month)
  if (!Number.isFinite(safeYear) || !Number.isFinite(safeMonth)) {
    return { startDate: null, endDate: null }
  }

  const startDate = `${safeYear}-${String(safeMonth).padStart(2, '0')}-01`
  const endDate = `${safeYear}-${String(safeMonth).padStart(2, '0')}-${new Date(safeYear, safeMonth, 0).getDate()}`
  return { startDate, endDate }
}

export function useLiabilitiesByMonth(year, month, options = {}) {
  const { enabled = true } = options
  const { startDate, endDate } = monthDateRange(year, month)
  const targetUserId = useActiveWallet()

  const { data, isLoading, error } = useQuery({
    queryKey: ['liabilitiesMonth', year, month, targetUserId],
    enabled: enabled && !!startDate && !!endDate && !!targetUserId,
    queryFn: async ({ signal }) => traceQuery('liabilities:month', async () => {
      const { data: rows, error: queryError } = await supabase
        .from('liabilities')
        .select(MONTH_LIABILITY_COLUMNS)
        .eq('user_id', targetUserId)
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .order('due_date', { ascending: true })
        .abortSignal(signal)

      if (queryError) throw queryError
      return rows || []
    }),
    placeholderData: (prev, query) => (query?.queryKey?.[3] === targetUserId) ? prev : undefined,
  })

  const rows = data || []
  return {
    rows,
    pending: rows.filter((row) => !row?.paid),
    paid: rows.filter((row) => !!row?.paid),
    loading: isLoading,
    error,
  }
}

export async function addLiability(payload) {
  const userId = getActiveWalletUserId()

  // 1. Strict Server Write
  const { data, error } = await supabase
    .from('liabilities')
    .insert([{ ...payload, user_id: userId }])
    .select(LIABILITY_COLUMNS)
    .single()

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.BILL_ADD,
      entityType: 'liability',
      entityId: data.id,
      metadata: {
        description: data.description,
        amount: data.amount,
        due_date: data.due_date,
        is_recurring: data.is_recurring,
        recurrence: data.recurrence,
      },
    }),
    'liabilities add audit'
  )

  return data
}

export async function markPaid(liability) {
  const userId = getActiveWalletUserId()

  const { data: result, error: rpcError } = await supabase
    .rpc('mark_liability_paid', {
      p_liability_id: liability.id,
      p_user_id: userId,
    })

  if (rpcError) throw rpcError

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.BILL_MARK_PAID,
      entityType: 'liability',
      entityId: liability.id,
      metadata: {
        description: liability.description,
        amount: liability.amount,
        rpc_result: result || null,
      },
    }),
    'liabilities markPaid audit'
  )
  return result;
}

export async function updateLiability(id, updates) {
  const userId = getActiveWalletUserId()

  const { data, error } = await supabase
    .from('liabilities')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select(LIABILITY_COLUMNS)
    .single()

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.BILL_UPDATE,
      entityType: 'liability',
      entityId: id,
      metadata: updates,
    }),
    'liabilities update audit'
  )

  return data
}

export async function deleteLiability(id, cachedBill = null) {
  // Migration 004: a single SECURITY DEFINER RPC now does
  //   (a) the owner check,
  //   (b) the liability DELETE (which cascades to its transactions via the
  //       existing transactions.linked_bill_id ON DELETE CASCADE FK), and
  //   (c) the audit-log write (via the trigger on `liabilities`).
  // The previous two-step client delete could leave the liability behind
  // if the second statement failed after the first succeeded; the RPC
  // either commits both or neither.
  const { data, error } = await supabase.rpc('delete_liability_with_txns', { 
    p_id: id,
    p_payload: cachedBill 
  })
  if (error) throw error
  return data === true
}

function sortLiabilitiesByDueDateAsc(rows) {
  return [...rows].sort((a, b) => String(a?.due_date || '').localeCompare(String(b?.due_date || '')))
}

function cloneCacheData(data) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(data)
  }
  return JSON.parse(JSON.stringify(data))
}

function snapshotLiabilityCaches(targetUserId) {
  const snap = [
    [LIABILITY_PENDING_QUERY_KEY(targetUserId), cloneCacheData(queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY(targetUserId)) || [])],
    [LIABILITY_PAID_QUERY_KEY(targetUserId), cloneCacheData(queryClient.getQueryData(LIABILITY_PAID_QUERY_KEY(targetUserId)) || [])],
  ]
  // Bill delete / mark-paid also mutate the linked transaction in the
  // transaction caches. Snapshot those families so a failed RPC restores them
  // too instead of leaving the cache in a half-mutated state.
  for (const family of [['transactions'], ['transactionsRecent']]) {
    const entries = queryClient.getQueriesData({ queryKey: family })
    for (const [key, data] of entries) {
      snap.push([key, cloneCacheData(data ?? null)])
    }
  }
  return snap
}

function restoreLiabilitySnapshot(snapshot) {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data)
  }
}

export function optimisticallyInsertPendingLiability(liability, targetUserId) {
  if (!liability?.id || !targetUserId) return
  const prev = queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY(targetUserId))
  const base = Array.isArray(prev) ? prev : []
  const deduped = base.filter((row) => row?.id !== liability.id)
  queryClient.setQueryData(
    LIABILITY_PENDING_QUERY_KEY(targetUserId),
    sortLiabilitiesByDueDateAsc([...deduped, { ...liability, paid: false }])
  )
}

export function optimisticallyMarkLiabilityPaid(liability, targetUserId, { optimistic = true } = {}) {
  if (!liability?.id || !targetUserId) return
  const pendingData = queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY(targetUserId))
  if (Array.isArray(pendingData)) {
    queryClient.setQueryData(
      LIABILITY_PENDING_QUERY_KEY(targetUserId),
      pendingData.filter((row) => row?.id !== liability.id)
    )
  }

  const paidRow = optimistic
    ? { ...liability, paid: true, __optimistic: true }
    : { ...liability, paid: true }
  const paidData = queryClient.getQueryData(LIABILITY_PAID_QUERY_KEY(targetUserId))
  if (Array.isArray(paidData)) {
    const deduped = paidData.filter((row) => row?.id !== liability.id)
    queryClient.setQueryData(
      LIABILITY_PAID_QUERY_KEY(targetUserId),
      sortLiabilitiesByDueDateAsc([...deduped, paidRow])
    )
  } else {
    queryClient.setQueryData(LIABILITY_PAID_QUERY_KEY(targetUserId), [paidRow])
  }
}

function getLiabilityFromCacheById(id, targetUserId) {
  if (!id || !targetUserId) return null
  const pendingData = queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY(targetUserId))
  if (Array.isArray(pendingData)) {
    const found = pendingData.find((row) => row?.id === id)
    if (found) return found
  }
  const paidData = queryClient.getQueryData(LIABILITY_PAID_QUERY_KEY(targetUserId))
  if (Array.isArray(paidData)) {
    const found = paidData.find((row) => row?.id === id)
    if (found) return found
  }
  return null
}

export function optimisticallyDeleteLiabilityFromCache(id, targetUserId) {
  if (!id || !targetUserId) return
  const pendingData = queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY(targetUserId))
  if (Array.isArray(pendingData)) {
    queryClient.setQueryData(
      LIABILITY_PENDING_QUERY_KEY(targetUserId),
      pendingData.filter((row) => row?.id !== id)
    )
  }

  const paidData = queryClient.getQueryData(LIABILITY_PAID_QUERY_KEY(targetUserId))
  if (Array.isArray(paidData)) {
    queryClient.setQueryData(
      LIABILITY_PAID_QUERY_KEY(targetUserId),
      paidData.filter((row) => row?.id !== id)
    )
  }
}

function refreshLiabilityCachesInBackground(invalidateLiabilityFn, scope) {
  runInBackground(
    invalidateLiabilityFn(),
    scope
  )
}

function refreshLiabilityAndTransactionCachesInBackground({ invalidateLiabilityFn, invalidateTransactionFn, scope }) {
  runInBackground(
    Promise.all([
      evictSwCacheEntries('/transactions'),
      invalidateLiabilityFn(),
      invalidateTransactionFn(),
    ]),
    scope
  )
}

export async function addLiabilityMutation(payload, __testOverrides = null) {
  return withOptimisticGuard(['liabilities'], async (tempId) => {
    const authUserId = getAuthUserId()
    const targetUserId = getActiveWalletUserId()

    // Guard: Shared wallets are VIEW-ONLY. Prevent any mutation attempt.
    if (targetUserId !== authUserId) {
      console.warn('[Kosha] Mutation blocked: Shared wallets are view-only.')
      return null
    }

    const snapshot = snapshotLiabilityCaches(targetUserId)
    suppress('liabilities')
    const optimisticId = tempId
    const nowIso = new Date().toISOString()

    optimisticallyInsertPendingLiability({
      ...payload,
      id: optimisticId,
      paid: false,
      created_at: nowIso,
      __optimistic: true,
    }, targetUserId)

    try {
      const addFn = __testOverrides?.addLiability || addLiability
      const invalidateLiabilityFn = __testOverrides?.invalidateLiabilityCache || invalidateLiabilityCache

      const created = await addFn(payload)
      // Lock already handled by withOptimisticGuard, no need for cancelQueries here

      optimisticallyDeleteLiabilityFromCache(optimisticId, targetUserId)
      optimisticallyInsertPendingLiability(created, targetUserId)

      hapticSuccess()

      refreshLiabilityAndTransactionCachesInBackground({
        invalidateLiabilityFn,
        invalidateTransactionFn: invalidateTransactionCache,
        scope: 'liabilities post-add refresh',
      })
      return created
    } catch (error) {
      restoreLiabilitySnapshot(snapshot)
      throw error
    }
  })
}

export async function markLiabilityPaidMutation(liability, __testOverrides = null) {
  return withOptimisticGuard(['liabilities'], async (tempId) => {
    const authUserId = getAuthUserId()
    const targetUserId = getActiveWalletUserId()

    // Guard: Shared wallets are VIEW-ONLY. Prevent any mutation attempt.
    if (targetUserId !== authUserId) {
      console.warn('[Kosha] Mutation blocked: Shared wallets are view-only.')
      return null
    }

    const snapshot = snapshotLiabilityCaches(targetUserId)
    let serverCommitted = false

    try {
      const markPaidFn = __testOverrides?.markPaid || markPaid
      const invalidateLiabilityFn = __testOverrides?.invalidateLiabilityCache || invalidateLiabilityCache
      const invalidateTransactionFn = __testOverrides?.invalidateTransactionCache || invalidateTransactionCache

      const result = await markPaidFn(liability)
      serverCommitted = true
      suppress('liabilities')
      suppress('transactions')
      await queryClient.cancelQueries({ queryKey: ['transactions'] })
      await queryClient.cancelQueries({ queryKey: ['transactionsRecent'] })

      optimisticallyMarkLiabilityPaid(liability, targetUserId, { optimistic: false })

      const rpcRow = Array.isArray(result) ? result[0] : result
      const txnId = rpcRow?.transaction_id || tempId

      optimisticallyUpsertTransactionInCache({
        id: txnId,
        date: todayStr(),
        created_at: new Date().toISOString(),
        type: 'expense',
        amount: Number(liability.amount || 0),
        description: liability.description || 'Bill Payment',
        category: liability.category || 'bills',
        payment_mode: liability.payment_mode || 'upi',
        linked_bill_id: liability.id,
        notes: `Paid bill: ${liability.description}`,
        investment_vehicle: null,
        is_repayment: false,
        is_recurring: false,
        recurrence: null,
        next_run_date: null,
        source_transaction_id: null,
        is_auto_generated: false,
      }, targetUserId)

      hapticSuccess()

      refreshLiabilityAndTransactionCachesInBackground({
        invalidateLiabilityFn,
        invalidateTransactionFn,
        scope: 'liabilities post-mark-paid refresh',
      })

      return result
    } catch (error) {
      // Only roll back the optimistic UI if the SERVER mutation failed. If the
      // server already committed and a later cache step threw, rolling back
      // would visually un-pay a bill that is actually paid — reconcile via a
      // background refetch instead.
      if (!serverCommitted) {
        restoreLiabilitySnapshot(snapshot)
        throw error
      }
      console.warn('[Kosha] markLiabilityPaid: post-commit step failed; refetching instead of rolling back', error)
      refreshLiabilityAndTransactionCachesInBackground({
        invalidateLiabilityFn: __testOverrides?.invalidateLiabilityCache || invalidateLiabilityCache,
        invalidateTransactionFn: __testOverrides?.invalidateTransactionCache || invalidateTransactionCache,
        scope: 'liabilities mark-paid post-commit recovery',
      })
      return null
    }
  })
}

export async function updateLiabilityMutation(id, updates) {
  const authUserId = getAuthUserId()
  const targetUserId = getActiveWalletUserId()

  // Guard: Shared wallets are VIEW-ONLY. Prevent any mutation attempt.
  if (targetUserId !== authUserId) {
    console.warn('[Kosha] Mutation blocked: Shared wallets are view-only.')
    return null
  }

  const snapshot = snapshotLiabilityCaches(targetUserId)
  const pendingData = queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY(targetUserId))
  if (Array.isArray(pendingData)) {
    queryClient.setQueryData(
      LIABILITY_PENDING_QUERY_KEY(targetUserId),
      sortLiabilitiesByDueDateAsc(pendingData.map(row => row?.id === id ? { ...row, ...updates } : row))
    )
  }

  try {
    const updated = await updateLiability(id, updates)
    await queryClient.cancelQueries({ queryKey: ['liabilities'] })

    // Replace optimistic row with server row
    const latestPending = queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY(targetUserId))
    if (Array.isArray(latestPending)) {
      queryClient.setQueryData(
        LIABILITY_PENDING_QUERY_KEY(targetUserId),
        sortLiabilitiesByDueDateAsc(latestPending.map(row => row?.id === id ? updated : row))
      )
    }

    refreshLiabilityAndTransactionCachesInBackground({
      invalidateLiabilityFn: invalidateLiabilityCache,
      invalidateTransactionFn: invalidateTransactionCache,
      scope: 'liabilities post-update refresh',
    })
    return updated
  } catch (error) {
    restoreLiabilitySnapshot(snapshot)
    throw error
  }
}

export async function deleteLiabilityMutation(id, __testOverrides = null) {
  return withOptimisticGuard(['liabilities'], async () => {
    const authUserId = getAuthUserId()
    const targetUserId = getActiveWalletUserId()

    // Guard: Shared wallets are VIEW-ONLY. Prevent any mutation attempt.
    if (targetUserId !== authUserId) {
      console.warn('[Kosha] Mutation blocked: Shared wallets are view-only.')
      return null
    }

    const cachedBill = getLiabilityFromCacheById(id, targetUserId)
    const snapshot = snapshotLiabilityCaches(targetUserId)
    suppress('liabilities')
    optimisticallyDeleteLiabilityFromCache(id, targetUserId)
    optimisticallyDeleteTransactionsByBillId(id, targetUserId)

    try {
      const deleteFn = __testOverrides?.deleteLiability || deleteLiability
      const invalidateLiabilityFn = __testOverrides?.invalidateLiabilityCache || invalidateLiabilityCache

      await deleteFn(id, cachedBill)
      await queryClient.cancelQueries({ queryKey: ['transactions'] })
      await queryClient.cancelQueries({ queryKey: ['transactionsRecent'] })

      optimisticallyDeleteLiabilityFromCache(id, targetUserId)
      optimisticallyDeleteTransactionsByBillId(id, targetUserId)

      hapticSuccess()

      refreshLiabilityAndTransactionCachesInBackground({
        invalidateLiabilityFn,
        invalidateTransactionFn: invalidateTransactionCache,
        scope: 'liabilities post-delete refresh',
      })
      return true
    } catch (error) {
      restoreLiabilitySnapshot(snapshot)
      throw error
    }
  })
}
