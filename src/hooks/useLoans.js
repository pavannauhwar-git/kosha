import { useQueries } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, evictSwCacheEntries } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { suppress } from '../lib/mutationGuard'
import { traceQuery } from '../lib/queryTrace'
import { FINANCIAL_EVENT_ACTIONS, logFinancialEvent } from '../lib/auditLog'
import { invalidateCache as invalidateTransactionCache, optimisticallyUpsertTransactionInCache } from './useTransactions'
import { optimisticallyInsertFinancialEvent } from './useFinancialEvents'

export const LOAN_INVALIDATION_KEYS = [['loans']]

const LOAN_ACTIVE_GIVEN_KEY   = ['loans', 'active', 'given']
const LOAN_ACTIVE_TAKEN_KEY   = ['loans', 'active', 'taken']
const LOAN_SETTLED_KEY        = ['loans', 'settled']
const LOAN_COLUMNS =
  'id, direction, counterparty, amount, amount_settled, interest_rate, loan_date, due_date, note, settled, created_at'

function runInBackground(promise, scope) {
  void promise.catch((error) => {
    console.warn(`[Kosha] ${scope} background refresh failed`, error)
  })
}

export async function invalidateLoanCache() {
  suppress('loans')
  await evictSwCacheEntries('/loans')
  await queryClient.invalidateQueries({ queryKey: ['loans'], refetchType: 'active' })
}

async function fetchLoans(direction, settledValue) {
  const label = settledValue ? 'settled' : `active:${direction}`
  return traceQuery(`loans:${label}`, async () => {
    const userId = getAuthUserId()
    let query = supabase
      .from('loans')
      .select(LOAN_COLUMNS)
      .eq('user_id', userId)
      .eq('settled', settledValue)

    if (!settledValue && direction) {
      query = query.eq('direction', direction)
    }

    query = query.order('created_at', { ascending: false })

    const { data: rows, error } = await query
    if (error) throw error
    return rows || []
  })
}

export function useLoans({ enabled = true } = {}) {
  const [givenQuery, takenQuery, settledQuery] = useQueries({
    queries: [
      {
        queryKey: LOAN_ACTIVE_GIVEN_KEY,
        queryFn: () => fetchLoans('given', false),
        enabled,
        placeholderData: (prev) => prev,
      },
      {
        queryKey: LOAN_ACTIVE_TAKEN_KEY,
        queryFn: () => fetchLoans('taken', false),
        enabled,
        placeholderData: (prev) => prev,
      },
      {
        queryKey: LOAN_SETTLED_KEY,
        queryFn: () => fetchLoans(null, true),
        enabled,
        placeholderData: (prev) => prev,
      },
    ],
  })

  return {
    given:    givenQuery.data   || [],
    taken:    takenQuery.data   || [],
    settled:  settledQuery.data || [],
    loading:  givenQuery.isLoading || takenQuery.isLoading,
    settledLoading: settledQuery.isLoading,
    error:    givenQuery.error || takenQuery.error || settledQuery.error || null,
  }
}

// ── CRUD helpers ──────────────────────────────────────────────────────────

async function addLoan(payload) {
  const userId = getAuthUserId()
  const { data, error } = await supabase
    .from('loans')
    .insert([{ ...payload, user_id: userId }])
    .select(LOAN_COLUMNS)
    .single()

  if (error) throw error

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
      },
    }),
    'loan add audit'
  )

  return data
}

async function recordPayment(loanId, amount) {
  const userId = getAuthUserId()
  const { data: result, error } = await supabase.rpc('record_loan_payment', {
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

async function deleteLoan(id) {
  const userId = getAuthUserId()
  const { error } = await supabase
    .from('loans')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.LOAN_DELETE,
      entityType: 'loan',
      entityId: id,
      metadata: {},
    }),
    'loan delete audit'
  )

  return true
}

// ── Cache helpers ─────────────────────────────────────────────────────────

function cloneCacheData(data) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(data)
  }
  return JSON.parse(JSON.stringify(data))
}

function snapshotLoanCaches() {
  return [
    [LOAN_ACTIVE_GIVEN_KEY, cloneCacheData(queryClient.getQueryData(LOAN_ACTIVE_GIVEN_KEY) || [])],
    [LOAN_ACTIVE_TAKEN_KEY, cloneCacheData(queryClient.getQueryData(LOAN_ACTIVE_TAKEN_KEY) || [])],
    [LOAN_SETTLED_KEY,      cloneCacheData(queryClient.getQueryData(LOAN_SETTLED_KEY) || [])],
  ]
}

function restoreLoanSnapshot(snapshot) {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data)
  }
}

function optimisticallyInsertLoan(loan) {
  if (!loan?.id) return
  const key = loan.direction === 'given' ? LOAN_ACTIVE_GIVEN_KEY : LOAN_ACTIVE_TAKEN_KEY
  const prev = queryClient.getQueryData(key)
  if (!Array.isArray(prev)) return
  const deduped = prev.filter((row) => row?.id !== loan.id)
  queryClient.setQueryData(key, [{ ...loan, settled: false }, ...deduped])
}

function optimisticallyDeleteLoan(id) {
  if (!id) return
  for (const key of [LOAN_ACTIVE_GIVEN_KEY, LOAN_ACTIVE_TAKEN_KEY, LOAN_SETTLED_KEY]) {
    const data = queryClient.getQueryData(key)
    if (Array.isArray(data)) {
      queryClient.setQueryData(key, data.filter((row) => row?.id !== id))
    }
  }
}

function getLoanFromCacheById(id) {
  if (!id) return null
  for (const key of [LOAN_ACTIVE_GIVEN_KEY, LOAN_ACTIVE_TAKEN_KEY, LOAN_SETTLED_KEY]) {
    const data = queryClient.getQueryData(key)
    if (Array.isArray(data)) {
      const found = data.find((row) => row?.id === id)
      if (found) return found
    }
  }
  return null
}

// ── Mutation wrappers with optimistic updates ─────────────────────────────

export async function addLoanMutation(payload) {
  const snapshot = snapshotLoanCaches()
  suppress('loans')
  const optimisticId = `optimistic-loan-${Date.now()}`
  const nowIso = new Date().toISOString()

  optimisticallyInsertLoan({
    ...payload,
    id: optimisticId,
    amount_settled: 0,
    settled: false,
    created_at: nowIso,
    __optimistic: true,
  })

  try {
    const created = await addLoan(payload)
    await queryClient.cancelQueries({ queryKey: ['loans'] })
    optimisticallyDeleteLoan(optimisticId)
    optimisticallyInsertLoan(created)

    optimisticallyInsertFinancialEvent({
      action: FINANCIAL_EVENT_ACTIONS.LOAN_ADD,
      entityType: 'loan',
      entityId: created.id,
      metadata: {
        direction: created.direction,
        counterparty: created.counterparty,
        amount: created.amount,
      },
    })

    await invalidateLoanCache()
    return created
  } catch (error) {
    restoreLoanSnapshot(snapshot)
    throw error
  }
}

export async function recordLoanPaymentMutation(loan, paymentAmount) {
  const snapshot = snapshotLoanCaches()
  suppress('loans')
  suppress('transactions')

  // Optimistically update the loan's settled amount
  const key = loan.direction === 'given' ? LOAN_ACTIVE_GIVEN_KEY : LOAN_ACTIVE_TAKEN_KEY
  const prev = queryClient.getQueryData(key)
  if (Array.isArray(prev)) {
    queryClient.setQueryData(key, prev.map((row) =>
      row?.id === loan.id
        ? { ...row, amount_settled: Number(row.amount_settled) + paymentAmount, __optimistic: true }
        : row
    ))
  }

  try {
    const result = await recordPayment(loan.id, paymentAmount)
    suppress('loans')
    suppress('transactions')
    await queryClient.cancelQueries({ queryKey: ['loans'] })
    await queryClient.cancelQueries({ queryKey: ['transactions'] })

    const rpcRow = Array.isArray(result) ? result[0] : result
    const fullSettled = rpcRow?.fully_settled

    // If fully settled, move from active to settled cache
    if (fullSettled) {
      const activeData = queryClient.getQueryData(key)
      if (Array.isArray(activeData)) {
        queryClient.setQueryData(key, activeData.filter((row) => row?.id !== loan.id))
      }
      const settledData = queryClient.getQueryData(LOAN_SETTLED_KEY)
      if (Array.isArray(settledData)) {
        queryClient.setQueryData(LOAN_SETTLED_KEY, [
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
      date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      type: loan.direction === 'given' ? 'income' : 'expense',
      amount: paymentAmount,
      description: `Loan payment: ${loan.counterparty}`,
      category: 'loans',
      investment_vehicle: null,
      is_repayment: true,
      payment_mode: 'other',
      notes: loan.direction === 'given'
        ? `Payment received from ${loan.counterparty}`
        : `Payment made to ${loan.counterparty}`,
      is_recurring: false,
      recurrence: null,
      next_run_date: null,
      source_transaction_id: null,
      is_auto_generated: false,
    })

    optimisticallyInsertFinancialEvent({
      action: FINANCIAL_EVENT_ACTIONS.LOAN_PAYMENT,
      entityType: 'loan',
      entityId: loan.id,
      metadata: { payment_amount: paymentAmount },
    })

    await evictSwCacheEntries('/transactions')
    await Promise.all([
      invalidateLoanCache(),
      invalidateTransactionCache(),
      queryClient.invalidateQueries({ queryKey: ['transactions'], refetchType: 'none' }),
      queryClient.invalidateQueries({ queryKey: ['transactionsRecent'], refetchType: 'none' }),
    ])

    return result
  } catch (error) {
    restoreLoanSnapshot(snapshot)
    throw error
  }
}

export async function deleteLoanMutation(id) {
  const cachedLoan = getLoanFromCacheById(id)
  const snapshot = snapshotLoanCaches()
  suppress('loans')
  optimisticallyDeleteLoan(id)

  try {
    await deleteLoan(id)
    await queryClient.cancelQueries({ queryKey: ['loans'] })
    optimisticallyDeleteLoan(id)

    optimisticallyInsertFinancialEvent({
      action: FINANCIAL_EVENT_ACTIONS.LOAN_DELETE,
      entityType: 'loan',
      entityId: id,
      metadata: {
        counterparty: cachedLoan?.counterparty,
        amount: cachedLoan?.amount,
        direction: cachedLoan?.direction,
      },
    })

    await invalidateLoanCache()
    return true
  } catch (error) {
    restoreLoanSnapshot(snapshot)
    throw error
  }
}

// ── Interest helpers (client-side, simple interest) ───────────────────────

export function accruedInterest(principal, annualRate, loanDate) {
  if (!annualRate || annualRate <= 0 || !loanDate) return 0
  const years = (Date.now() - new Date(loanDate).getTime()) / (365.25 * 86400000)
  return Number(principal) * (Number(annualRate) / 100) * Math.max(0, years)
}

export function loanProgress(amount, amountSettled) {
  const a = Number(amount) || 0
  const s = Number(amountSettled) || 0
  if (a <= 0) return 0
  return Math.min(100, Math.round((s / a) * 100))
}
