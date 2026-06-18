import { useQueries } from '@tanstack/react-query'
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
  optimisticallyDeleteTransactionsByLoanId
} from './useTransactions'
import { todayStr } from '../lib/utils'
import { hapticSuccess } from '../lib/haptics'

export const LOAN_INVALIDATION_KEYS = [['loans']]

export const LOAN_ACTIVE_GIVEN_KEY = (targetUserId) => ['loans', 'active', 'given', targetUserId]
export const LOAN_ACTIVE_TAKEN_KEY = (targetUserId) => ['loans', 'active', 'taken', targetUserId]
export const LOAN_SETTLED_KEY = (targetUserId) => ['loans', 'settled', targetUserId]
const LOAN_COLUMNS =
  'id, direction, counterparty, amount, amount_settled, interest_rate, loan_date, due_date, note, settled, created_at'

function runInBackground(promise, scope) {
  void promise.catch((error) => {
    console.warn(`[Kosha] ${scope} background refresh failed`, error)
  })
}

async function invalidateLoanCache() {
  suppress('loans')
  await evictSwCacheEntries('/loans')
  await queryClient.invalidateQueries({ queryKey: ['loans'], refetchType: 'active' })
}

async function fetchLoans(direction, settledValue, targetUserId, signal) {
  const label = settledValue ? 'settled' : `active:${direction}`
  return traceQuery(`loans:${label}`, async () => {
    let query = supabase
      .from('loans')
      .select(LOAN_COLUMNS)
      .eq('user_id', targetUserId)
      .eq('settled', settledValue)

    if (!settledValue && direction) {
      query = query.eq('direction', direction)
    }

    query = query.order('created_at', { ascending: false }).abortSignal(signal)

    const { data: rows, error } = await query
    if (error) throw error
    return rows || []
  })
}

export function useLoans({ enabled = true } = {}) {
  const targetUserId = useActiveWallet()

  const [givenQuery, takenQuery, settledQuery] = useQueries({
    queries: [
      {
        queryKey: LOAN_ACTIVE_GIVEN_KEY(targetUserId),
        queryFn: ({ signal }) => fetchLoans('given', false, targetUserId, signal),
        enabled: enabled && !!targetUserId,
        refetchOnMount: true,
        placeholderData: (prev, query) =>
          query?.queryKey?.[3] === targetUserId ? prev : undefined,
      },
      {
        queryKey: LOAN_ACTIVE_TAKEN_KEY(targetUserId),
        queryFn: ({ signal }) => fetchLoans('taken', false, targetUserId, signal),
        enabled: enabled && !!targetUserId,
        refetchOnMount: true,
        placeholderData: (prev, query) =>
          query?.queryKey?.[3] === targetUserId ? prev : undefined,
      },
      {
        queryKey: LOAN_SETTLED_KEY(targetUserId),
        queryFn: ({ signal }) => fetchLoans(null, true, targetUserId, signal),
        enabled: enabled && !!targetUserId,
        refetchOnMount: true,
        placeholderData: (prev, query) =>
          query?.queryKey?.[2] === targetUserId ? prev : undefined,
      },
    ],
  })

  return {
    given: givenQuery.data || [],
    taken: takenQuery.data || [],
    settled: settledQuery.data || [],
    loading: givenQuery.isLoading || takenQuery.isLoading,
    settledLoading: settledQuery.isLoading,
    error: givenQuery.error || takenQuery.error || settledQuery.error || null,
  }
}

// ── CRUD helpers ──────────────────────────────────────────────────────────

async function addLoan(payload) {
  const userId = getActiveWalletUserId()

  const counterparty = String(payload.counterparty || '').trim()
  if (!counterparty) throw new Error('Counterparty name is required')

  // Derive a stable id (caller may pass one for idempotent retries; otherwise
  // generate). The server coalesces a null p_id, so this is belt-and-braces.
  const id = payload.id ?? crypto.randomUUID()

  // Use the atomic RPC so the disbursement transaction is created in the same
  // DB transaction as the loan row, guaranteeing referential consistency.
  const { data: result, error } = await supabase.rpc('create_loan', {
    p_id: id,
    p_user_id: userId,
    p_direction: payload.direction,
    p_counterparty: counterparty,
    p_amount: payload.amount,
    p_interest_rate: payload.interest_rate ?? 0,
    p_loan_date: payload.loan_date || null,
    p_due_date: payload.due_date || null,
    p_note: payload.note || null,
  })

  if (error) throw error

  // Shape the RPC response into the same LOAN_COLUMNS shape the rest of the
  // app expects (the RPC returns a json object, not a row).
  const data = {
    id: result.loan_id,
    direction: result.direction,
    counterparty: result.counterparty,
    amount: result.amount,
    amount_settled: result.amount_settled,
    interest_rate: result.interest_rate,
    loan_date: result.loan_date,
    due_date: result.due_date,
    note: result.note,
    settled: result.settled,
    created_at: result.created_at,
    // Stash the disbursement transaction id for the optimistic cache update.
    _disbursement_txn_id: result.transaction_id,
  }

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.LOAN_ADD,
      entityType: 'loan',
      entityId: data.id,
      metadata: {
        direction: data.direction,
        counterparty: data.counterparty,
        amount: data.amount,
        interest_rate: data.interest_rate,
        loan_date: data.loan_date,
        due_date: data.due_date,
        transaction_id: data._disbursement_txn_id,
      },
    }),
    'loan add audit'
  )

  return data
}

async function recordPayment(loanId, amount, id) {
  const userId = getActiveWalletUserId()
  const rpcId = id ?? crypto.randomUUID()
  const { data: result, error } = await supabase.rpc('record_loan_payment', {
    p_id: rpcId,
    p_loan_id: loanId,
    p_user_id: userId,
    p_amount: amount,
  })

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.LOAN_PAYMENT,
      entityType: 'loan',
      entityId: loanId,
      metadata: { payment_amount: amount, rpc_result: result || null },
    }),
    'loan payment audit'
  )

  return result
}

async function updateLoan(id, updates) {
  const userId = getActiveWalletUserId()
  const { data, error } = await supabase
    .from('loans')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select(LOAN_COLUMNS)
    .single()

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.LOAN_UPDATE,
      entityType: 'loan',
      entityId: id,
      metadata: updates,
    }),
    'loan update audit'
  )

  return data
}

async function deleteLoan(id, cachedLoan = null) {
  // Migration 004: single SECURITY DEFINER RPC handles
  //   (a) the owner check (server-side, can't be bypassed by a malicious
  //       client calling the table directly),
  //   (b) the loan DELETE (cascades to transactions via the existing
  //       transactions.linked_loan_id ON DELETE CASCADE FK),
  //   (c) the audit-log write (via the trigger on `loans`).
  const { data, error } = await supabase.rpc('delete_loan_with_txns', {
    p_id: id
  })
  if (error) throw error
  return data === true
}

// ── Cache helpers ─────────────────────────────────────────────────────────

function cloneCacheData(data) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(data)
  }
  return JSON.parse(JSON.stringify(data))
}

function snapshotLoanCaches(targetUserId) {
  const snap = [
    [LOAN_ACTIVE_GIVEN_KEY(targetUserId), cloneCacheData(queryClient.getQueryData(LOAN_ACTIVE_GIVEN_KEY(targetUserId)) || [])],
    [LOAN_ACTIVE_TAKEN_KEY(targetUserId), cloneCacheData(queryClient.getQueryData(LOAN_ACTIVE_TAKEN_KEY(targetUserId)) || [])],
    [LOAN_SETTLED_KEY(targetUserId), cloneCacheData(queryClient.getQueryData(LOAN_SETTLED_KEY(targetUserId)) || [])],
  ]

  // Snapshot running balance
  const balanceKey = ['balance', 2099, 12, targetUserId]
  const balanceData = queryClient.getQueryData(balanceKey)
  if (typeof balanceData !== 'undefined') {
    snap.push([balanceKey, cloneCacheData(balanceData)])
  }

  // Snapshot month keys for any transactions that might be adjusted
  const monthKeys = new Set()
  for (const family of [['transactions'], ['transactionsRecent']]) {
    const entries = queryClient.getQueriesData({ queryKey: family })
    for (const [key, data] of entries) {
      snap.push([key, cloneCacheData(data ?? null)])
      if (Array.isArray(data)) {
        for (const txn of data) {
          if (txn?.date) {
            const [yStr, mStr] = String(txn.date).split('-')
            const year = Number(yStr)
            const month = Number(mStr)
            if (year && month) {
              monthKeys.add(JSON.stringify(['month', year, month, targetUserId]))
            }
          }
        }
      }
    }
  }

  for (const mKeyStr of monthKeys) {
    const mKey = JSON.parse(mKeyStr)
    const mData = queryClient.getQueryData(mKey)
    if (typeof mData !== 'undefined') {
      snap.push([mKey, cloneCacheData(mData)])
    }
  }

  return snap
}

function restoreLoanSnapshot(snapshot) {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data)
  }
}

export function optimisticallyInsertLoan(loan, targetUserId) {
  if (!loan?.id || !targetUserId) return
  const key = loan.direction === 'given' ? LOAN_ACTIVE_GIVEN_KEY(targetUserId) : LOAN_ACTIVE_TAKEN_KEY(targetUserId)
  const prev = queryClient.getQueryData(key)
  const base = Array.isArray(prev) ? prev : []
  const deduped = base.filter((row) => row?.id !== loan.id)
  queryClient.setQueryData(key, [{ ...loan, settled: false }, ...deduped])
}

export function optimisticallyDeleteLoan(id, targetUserId) {
  if (!id || !targetUserId) return
  for (const key of [LOAN_ACTIVE_GIVEN_KEY(targetUserId), LOAN_ACTIVE_TAKEN_KEY(targetUserId), LOAN_SETTLED_KEY(targetUserId)]) {
    const data = queryClient.getQueryData(key)
    if (Array.isArray(data)) {
      queryClient.setQueryData(key, data.filter((row) => row?.id !== id))
    }
  }
}

function getLoanFromCacheById(id, targetUserId) {
  if (!id || !targetUserId) return null
  for (const key of [LOAN_ACTIVE_GIVEN_KEY(targetUserId), LOAN_ACTIVE_TAKEN_KEY(targetUserId), LOAN_SETTLED_KEY(targetUserId)]) {
    const data = queryClient.getQueryData(key)
    if (Array.isArray(data)) {
      const found = data.find((row) => row?.id === id)
      if (found) return found
    }
  }
  return null
}

function refreshLoanAndTransactionCachesInBackground({ invalidateLoanFn, invalidateTransactionFn, scope }) {
  runInBackground(
    Promise.all([
      evictSwCacheEntries('/transactions'),
      invalidateLoanFn(),
      invalidateTransactionFn(),
    ]),
    scope
  )
}

// ── Mutation wrappers with optimistic updates ─────────────────────────────

export async function addLoanMutation(payload) {
  const authUserId = getAuthUserId()
  const targetUserId = getActiveWalletUserId()

  // Guard: Shared wallets are VIEW-ONLY. Prevent any mutation attempt.
  if (targetUserId !== authUserId) {
    console.warn('[Kosha] addLoanMutation blocked: Shared wallets are view-only.')
    return null
  }

  const snapshot = snapshotLoanCaches(targetUserId)
  suppress('loans')
  suppress('transactions')
  const optimisticId = `optimistic-loan-${Date.now()}`
  const optimisticTxnId = `optimistic-txn-disbursement-${Date.now()}`
  const nowIso = new Date().toISOString()
  const today = todayStr()

  // ── Optimistic: loan card appears immediately ──────────────────────────────
  optimisticallyInsertLoan({
    ...payload,
    id: optimisticId,
    amount_settled: 0,
    settled: false,
    created_at: nowIso,
    __optimistic: true,
  }, targetUserId)

  // ── Optimistic: disbursement transaction appears immediately ───────────────
  optimisticallyUpsertTransactionInCache({
    id: optimisticTxnId,
    date: payload.loan_date || today,
    created_at: nowIso,
    type: payload.direction === 'given' ? 'expense' : 'income',
    linked_loan_id: optimisticId,
    amount: payload.amount,
    description: payload.direction === 'given'
      ? `Loan given to ${payload.counterparty}`
      : `Loan taken from ${payload.counterparty}`,
    category: 'loans',
    investment_vehicle: null,
    is_repayment: false,
    payment_mode: 'other',
    notes: payload.note || null,
    is_recurring: false,
    recurrence: null,
    next_run_date: null,
    source_transaction_id: null,
    is_auto_generated: false,
    __optimistic: true,
  }, targetUserId)

  try {
    // create_loan RPC atomically creates the loan + disbursement transaction
    const created = await addLoan(payload)
    await queryClient.cancelQueries({ queryKey: ['loans'] })
    await queryClient.cancelQueries({ queryKey: ['transactions'] })
    await queryClient.cancelQueries({ queryKey: ['transactionsRecent'] })

    // Replace optimistic loan with real row
    optimisticallyDeleteLoan(optimisticId, targetUserId)
    optimisticallyInsertLoan(created, targetUserId)

    // ALWAYS remove the optimistic disbursement txn by its ID to prevent ghost txns
    for (const key of [['transactions'], ['transactionsRecent']]) {
      const data = queryClient.getQueryData(key)
      if (Array.isArray(data)) {
        queryClient.setQueryData(key, data.filter(t => t.id !== optimisticTxnId))
      }
    }
    // Also clean up by optimistic loan ID for good measure
    optimisticallyDeleteTransactionsByLoanId(optimisticId, targetUserId)

    // Insert real transaction if one was returned
    const realTxnId = created._disbursement_txn_id
    if (realTxnId) {
      optimisticallyUpsertTransactionInCache({
        id: realTxnId,
        date: payload.loan_date || today,
        created_at: nowIso,
        type: payload.direction === 'given' ? 'expense' : 'income',
        linked_loan_id: created.id,
        amount: payload.amount,
        description: payload.direction === 'given'
          ? `Loan given to ${payload.counterparty}`
          : `Loan taken from ${payload.counterparty}`,
        category: 'loans',
        investment_vehicle: null,
        is_repayment: false,
        payment_mode: 'other',
        notes: payload.note || null,
        is_recurring: false,
        recurrence: null,
        next_run_date: null,
        source_transaction_id: null,
        is_auto_generated: false,
      }, targetUserId)
    }

    refreshLoanAndTransactionCachesInBackground({
      invalidateLoanFn: invalidateLoanCache,
      invalidateTransactionFn: invalidateTransactionCache,
      scope: 'loans post-add refresh',
    })
    return created
  } catch (error) {
    restoreLoanSnapshot(snapshot)
    throw error
  }
}

export async function recordLoanPaymentMutation({ loan, paymentAmount, id }) {
  const authUserId = getAuthUserId()
  const targetUserId = getActiveWalletUserId()

  // Guard: Shared wallets are VIEW-ONLY. Prevent any mutation attempt.
  if (targetUserId !== authUserId) {
    console.warn('[Kosha] Loan payment blocked: Shared wallets are view-only.')
    return null
  }

  const snapshot = snapshotLoanCaches(targetUserId)
  const key = loan.direction === 'given' ? LOAN_ACTIVE_GIVEN_KEY(targetUserId) : LOAN_ACTIVE_TAKEN_KEY(targetUserId)
  const prev = queryClient.getQueryData(key)
  if (Array.isArray(prev)) {
    queryClient.setQueryData(key, prev.map((row) =>
      row?.id === loan.id
        ? { ...row, amount_settled: Number(row.amount_settled) + paymentAmount, __optimistic: true }
        : row
    ))
  }

  try {
    const result = await recordPayment(loan.id, paymentAmount, id)
    suppress('loans')
    suppress('transactions')
    await queryClient.cancelQueries({ queryKey: ['loans'] })
    await queryClient.cancelQueries({ queryKey: ['transactions'] })
    await queryClient.cancelQueries({ queryKey: ['transactionsRecent'] })

    const rpcRow = Array.isArray(result) ? result[0] : result
    const fullSettled = rpcRow?.fully_settled

    // If fully settled, move from active to settled cache
    if (fullSettled) {
      const activeData = queryClient.getQueryData(key)
      if (Array.isArray(activeData)) {
        queryClient.setQueryData(key, activeData.filter((row) => row?.id !== loan.id))
      }
      const settledData = queryClient.getQueryData(LOAN_SETTLED_KEY(targetUserId))
      if (Array.isArray(settledData)) {
        queryClient.setQueryData(LOAN_SETTLED_KEY(targetUserId), [
          { ...loan, amount_settled: loan.amount, settled: true },
          ...settledData.filter((row) => row?.id !== loan.id),
        ])
      }
    } else {
      // Update the settled amount with server value
      const activeData = queryClient.getQueryData(key)
      if (Array.isArray(activeData)) {
        queryClient.setQueryData(key, activeData.map((row) =>
          row?.id === loan.id
            ? { ...row, amount_settled: rpcRow?.new_amount_settled ?? row.amount_settled, __optimistic: false }
            : row
        ))
      }
    }

    // Optimistically inject the created transaction
    const txnId = rpcRow?.transaction_id || `optimistic-txn-loan-${Date.now()}`
    optimisticallyUpsertTransactionInCache({
      id: txnId,
      date: todayStr(),
      created_at: new Date().toISOString(),
      type: loan.direction === 'given' ? 'income' : 'expense',
      linked_loan_id: loan.id,
      amount: paymentAmount,
      description: `Loan payment: ${loan.counterparty}`,
      category: 'loans',
      investment_vehicle: null,
      is_repayment: true,
      payment_mode: 'other',
      notes: null,
      is_recurring: false,
      recurrence: null,
      next_run_date: null,
      source_transaction_id: null,
      is_auto_generated: false,
    }, targetUserId)

    hapticSuccess()

    refreshLoanAndTransactionCachesInBackground({
      invalidateLoanFn: invalidateLoanCache,
      invalidateTransactionFn: invalidateTransactionCache,
      scope: 'loans post-payment refresh',
    })

    return result
  } catch (error) {
    restoreLoanSnapshot(snapshot)
    throw error
  }
}

export async function updateLoanMutation(id, updates) {
  const authUserId = getAuthUserId()
  const targetUserId = getActiveWalletUserId()

  // Guard: Shared wallets are VIEW-ONLY. Prevent any mutation attempt.
  if (targetUserId !== authUserId) {
    console.warn('[Kosha] Loan update blocked: Shared wallets are view-only.')
    return null
  }

  const snapshot = snapshotLoanCaches(targetUserId)
  suppress('loans')

  // Optimistic: update in the correct cache bucket
  const cachedLoan = getLoanFromCacheById(id, targetUserId)
  if (cachedLoan) {
    const key = cachedLoan.direction === 'given' ? LOAN_ACTIVE_GIVEN_KEY(targetUserId) : LOAN_ACTIVE_TAKEN_KEY(targetUserId)
    const prev = queryClient.getQueryData(key)
    if (Array.isArray(prev)) {
      queryClient.setQueryData(key, prev.map(row => row?.id === id ? { ...row, ...updates } : row))
    }
  }

  try {
    const updated = await updateLoan(id, updates)
    await queryClient.cancelQueries({ queryKey: ['loans'] })

    const oldKey = cachedLoan?.direction === 'given' ? LOAN_ACTIVE_GIVEN_KEY(targetUserId) : LOAN_ACTIVE_TAKEN_KEY(targetUserId)
    const newKey = updated.direction === 'given' ? LOAN_ACTIVE_GIVEN_KEY(targetUserId) : LOAN_ACTIVE_TAKEN_KEY(targetUserId)

    if (oldKey !== newKey) {
      const oldData = queryClient.getQueryData(oldKey)
      if (Array.isArray(oldData)) queryClient.setQueryData(oldKey, oldData.filter(row => row?.id !== id))
      optimisticallyInsertLoan(updated, targetUserId)
    } else {
      const data = queryClient.getQueryData(newKey)
      if (Array.isArray(data)) queryClient.setQueryData(newKey, data.map(row => row?.id === id ? updated : row))
    }

    refreshLoanAndTransactionCachesInBackground({
      invalidateLoanFn: invalidateLoanCache,
      invalidateTransactionFn: invalidateTransactionCache,
      scope: 'loans post-update refresh',
    })
    return updated
  } catch (error) {
    restoreLoanSnapshot(snapshot)
    throw error
  }
}

export async function deleteLoanMutation(id) {
  const authUserId = getAuthUserId()
  const targetUserId = getActiveWalletUserId()

  // Guard: Shared wallets are VIEW-ONLY. Prevent any mutation attempt.
  if (targetUserId !== authUserId) {
    console.warn('[Kosha] Loan delete blocked: Shared wallets are view-only.')
    return false
  }

  const cachedLoan = getLoanFromCacheById(id, targetUserId)
  const snapshot = snapshotLoanCaches(targetUserId)
  suppress('loans')
  optimisticallyDeleteLoan(id, targetUserId)
  optimisticallyDeleteTransactionsByLoanId(id, targetUserId)

  try {
    await deleteLoan(id, cachedLoan)
    await queryClient.cancelQueries({ queryKey: ['loans'] })
    optimisticallyDeleteLoan(id, targetUserId)
    optimisticallyDeleteTransactionsByLoanId(id, targetUserId)

    refreshLoanAndTransactionCachesInBackground({
      invalidateLoanFn: invalidateLoanCache,
      invalidateTransactionFn: invalidateTransactionCache,
      scope: 'loans post-delete refresh',
    })
    return true
  } catch (error) {
    restoreLoanSnapshot(snapshot)
    throw error
  }
}

// ── Interest helpers (client-side, simple interest) ───────────────────────

export function accruedInterest(principal, annualRate, loanDate, endDate = Date.now()) {
  if (!annualRate || annualRate <= 0 || !loanDate) return 0
  const endTs = typeof endDate === 'string'
    ? new Date(`${endDate}T23:59:59`).getTime()
    : (endDate instanceof Date ? endDate.getTime() : Number(endDate))
  const startTs = new Date(`${loanDate}T00:00:00`).getTime()
  if (Number.isNaN(endTs) || Number.isNaN(startTs)) return 0
  const years = (endTs - startTs) / (365.25 * 86400000)
  return Number(principal) * (Number(annualRate) / 100) * Math.max(0, years)
}

export function loanProgress(amount, amountSettled) {
  const a = Number(amount) || 0
  const s = Number(amountSettled) || 0
  if (a <= 0) return 0
  return Math.min(100, Math.round((s / a) * 100))
}
