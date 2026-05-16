import { useQueries, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, evictSwCacheEntries } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore';
import { getActiveWalletUserId, useActiveWallet } from '../lib/walletStore'
import { suppress } from '../lib/mutationGuard'
import { traceQuery } from '../lib/queryTrace'
import { FINANCIAL_EVENT_ACTIONS, logFinancialEvent } from '../lib/auditLog'
import {
  invalidateCache as invalidateTransactionCache,
  optimisticallyUpsertTransactionInCache,
  optimisticallyDeleteTransactionsByBillId
} from './useTransactions'
import { optimisticallyInsertFinancialEvent } from './useFinancialEvents'
import { todayStr } from '../lib/utils'
import { hapticSuccess } from '../lib/haptics'

export const LIABILITY_INVALIDATION_KEYS = [['liabilities'], ['liabilitiesMonth'], ['transactions']]

const LIABILITY_PENDING_QUERY_KEY = (targetUserId) => ['liabilities', 'pending', targetUserId]
const LIABILITY_PAID_QUERY_KEY    = (targetUserId) => ['liabilities', 'paid', targetUserId]
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

async function fetchLiabilitiesByPaid(paidValue, targetUserId) {
  return traceQuery(`liabilities:${paidValue ? 'paid' : 'pending'}`, async () => {
    const { data: rows, error } = await supabase
      .from('liabilities')
      .select(LIABILITY_COLUMNS)
      .eq('user_id', targetUserId)
      .eq('paid', paidValue)
      .order('due_date', { ascending: true })

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
        queryFn:  () => fetchLiabilitiesByPaid(false, targetUserId),
        enabled: enabled && !!targetUserId,
        placeholderData: (prev, query) => (query?.queryKey?.[2] === targetUserId) ? prev : undefined,
      },
      {
        queryKey: LIABILITY_PAID_QUERY_KEY(targetUserId),
        queryFn:  () => fetchLiabilitiesByPaid(true, targetUserId),
        enabled:  enabled && includePaid && !!targetUserId,
        placeholderData: (prev, query) => (query?.queryKey?.[2] === targetUserId) ? prev : undefined,
      },
    ],
  })

  return {
    pending: pendingQuery.data  || [],
    paid:    paidQuery.data || [],
    loading: pendingQuery.isLoading || (includePaid && paidQuery.isLoading),
    pendingLoading: pendingQuery.isLoading,
    paidLoading: includePaid ? paidQuery.isLoading : false,
    error:   pendingQuery.error  || (includePaid && paidQuery.error) || null,
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
    queryFn: async () => traceQuery('liabilities:month', async () => {
      const { data: rows, error: queryError } = await supabase
        .from('liabilities')
        .select(MONTH_LIABILITY_COLUMNS)
        .eq('user_id', targetUserId)
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .order('due_date', { ascending: true })

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
      p_user_id:      userId,
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
  const userId = getActiveWalletUserId()
  
  const { error: txnError } = await supabase
    .from('transactions')
    .delete()
    .eq('linked_bill_id', id)
    .eq('user_id', userId)

  if (txnError) throw txnError

  const { error } = await supabase
    .from('liabilities')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.BILL_DELETE,
      entityType: 'liability',
      entityId: id,
      metadata: {
        description: cachedBill?.description,
        amount: cachedBill?.amount,
        due_date: cachedBill?.due_date,
        paid: cachedBill?.paid,
        is_recurring: cachedBill?.is_recurring,
        recurrence: cachedBill?.recurrence,
      },
    }),
    'liabilities delete audit'
  )

  return true;
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
  return [
    [LIABILITY_PENDING_QUERY_KEY(targetUserId), cloneCacheData(queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY(targetUserId)) || [])],
    [LIABILITY_PAID_QUERY_KEY(targetUserId), cloneCacheData(queryClient.getQueryData(LIABILITY_PAID_QUERY_KEY(targetUserId)) || [])],
  ]
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
  const authUserId = getAuthUserId()
  const targetUserId = getActiveWalletUserId()

  // Guard: Shared wallets are VIEW-ONLY. Prevent any mutation attempt.
  if (targetUserId !== authUserId) {
    console.warn('[Kosha] Mutation blocked: Shared wallets are view-only.')
    return null
  }

  const snapshot = snapshotLiabilityCaches(targetUserId)
  suppress('liabilities')
  const optimisticId = `optimistic-liability-${Date.now()}`
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
    await queryClient.cancelQueries({ queryKey: ['liabilities'] })

    optimisticallyDeleteLiabilityFromCache(optimisticId, targetUserId)
    optimisticallyInsertPendingLiability(created, targetUserId)

    hapticSuccess()
    optimisticallyInsertFinancialEvent({
      action: FINANCIAL_EVENT_ACTIONS.BILL_ADD,
      entityType: 'liability',
      entityId: created.id,
      metadata: {
        description: created.description,
        amount: created.amount,
        due_date: created.due_date,
      },
    })

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
}

export async function markLiabilityPaidMutation(liability, __testOverrides = null) {
  const authUserId = getAuthUserId()
  const targetUserId = getActiveWalletUserId()

  // Guard: Shared wallets are VIEW-ONLY. Prevent any mutation attempt.
  if (targetUserId !== authUserId) {
    console.warn('[Kosha] Mutation blocked: Shared wallets are view-only.')
    return null
  }

  const snapshot = snapshotLiabilityCaches(targetUserId)

  try {
    const markPaidFn = __testOverrides?.markPaid || markPaid
    const invalidateLiabilityFn = __testOverrides?.invalidateLiabilityCache || invalidateLiabilityCache
    const invalidateTransactionFn = __testOverrides?.invalidateTransactionCache || invalidateTransactionCache

    const result = await markPaidFn(liability)
    suppress('liabilities')
    suppress('transactions')
    await queryClient.cancelQueries({ queryKey: ['liabilities'] })
    await queryClient.cancelQueries({ queryKey: ['transactions'] })
    await queryClient.cancelQueries({ queryKey: ['transactionsRecent'] })

    optimisticallyMarkLiabilityPaid(liability, targetUserId, { optimistic: false })

    const rpcRow = Array.isArray(result) ? result[0] : result
    const txnId = rpcRow?.transaction_id || `optimistic-txn-markpaid-${Date.now()}`

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
    optimisticallyInsertFinancialEvent({
      action: FINANCIAL_EVENT_ACTIONS.BILL_MARK_PAID,
      entityType: 'liability',
      entityId: liability.id,
      metadata: {
        description: liability.description,
        amount: liability.amount,
        due_date: liability.due_date,
        is_recurring: liability.is_recurring,
        recurrence: liability.recurrence,
        paid_at: new Date().toISOString(),
      },
    })

    refreshLiabilityAndTransactionCachesInBackground({
      invalidateLiabilityFn,
      invalidateTransactionFn,
      scope: 'liabilities post-mark-paid refresh',
    })

    return result
  } catch (error) {
    restoreLiabilitySnapshot(snapshot)
    throw error
  }
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

    optimisticallyInsertFinancialEvent({
      action: FINANCIAL_EVENT_ACTIONS.BILL_UPDATE,
      entityType: 'liability',
      entityId: id,
      metadata: updates,
    })

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
    await queryClient.cancelQueries({ queryKey: ['liabilities'] })
    await queryClient.cancelQueries({ queryKey: ['transactions'] })
    await queryClient.cancelQueries({ queryKey: ['transactionsRecent'] })

    optimisticallyDeleteLiabilityFromCache(id, targetUserId)
    optimisticallyDeleteTransactionsByBillId(id, targetUserId)

    hapticSuccess()
    optimisticallyInsertFinancialEvent({
      action: FINANCIAL_EVENT_ACTIONS.BILL_DELETE,
      entityType: 'liability',
      entityId: id,
      metadata: {
        description: cachedBill?.description,
        amount: cachedBill?.amount,
        due_date: cachedBill?.due_date,
        paid: cachedBill?.paid,
        is_recurring: cachedBill?.is_recurring,
        recurrence: cachedBill?.recurrence,
        impact: 'Associated payment transactions removed from cache.',
      },
    })

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
}
