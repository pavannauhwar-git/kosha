import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { queryClient } from '../../../../src/lib/queryClient'
import { supabase } from '../../../../src/lib/supabase'
import { setAuthUser } from '../../../../src/lib/authStore'
import { markLiabilityPaidMutation, LIABILITY_PENDING_QUERY_KEY } from '../../../../src/hooks/useLiabilities'
import { recordLoanPaymentMutation, LOAN_ACTIVE_GIVEN_KEY } from '../../../../src/hooks/useLoans'
import { upsertBudget, deleteBudget, budgetQueryKey } from '../../../../src/hooks/useBudgets'
import { deleteSplitExpenseMutation } from '../../../../src/hooks/useSplitwise'

const UID = '11111111-1111-4111-8111-111111111111'

const BILL = { id: 'bill-1', user_id: UID, description: 'Rent', amount: 20000, due_date: '2026-01-31', paid: false }
const LOAN = { id: 'loan-1', direction: 'given', counterparty: 'Ravi', amount: 5000, amount_settled: 1000, settled: false }
const BUDGET = { id: 'budget-1', category: 'food', monthly_limit: 8000, created_at: '2026-01-01T00:00:00.000Z' }
const EXPENSE = { id: 'exp-1', group_id: 'g-1', description: 'Dinner', amount: 1200 }

const rpcFails = () => vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: new Error('rpc failed') })

// A query builder whose every step chains and whose result is an error.
function failingQuery() {
  const chain = new Proxy({}, {
    get: (_target, prop) => (prop === 'then'
      ? (resolve) => resolve({ data: null, error: new Error('query failed') })
      : () => chain),
  })
  return chain
}

beforeEach(() => {
  queryClient.clear()
  setAuthUser({ id: UID })
  queryClient.setQueryData(['kosha-active-wallet'], UID)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('money mutations leave the cache as it was when the server call fails', () => {
  it('markLiabilityPaidMutation keeps the bill pending', async () => {
    queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY(UID), [BILL])
    await expect(markLiabilityPaidMutation(BILL, {
      markPaid: vi.fn().mockRejectedValue(new Error('mark paid failed')),
      invalidateLiabilityCache: vi.fn(),
      invalidateTransactionCache: vi.fn(),
    })).rejects.toThrow('mark paid failed')
    expect(queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY(UID))).toEqual([BILL])
  })

  it('recordLoanPaymentMutation restores the amount repaid', async () => {
    queryClient.setQueryData(LOAN_ACTIVE_GIVEN_KEY(UID), [LOAN])
    rpcFails()
    await expect(recordLoanPaymentMutation({ loan: LOAN, paymentAmount: 500, id: 'pay-1' }))
      .rejects.toThrow('rpc failed')
    expect(queryClient.getQueryData(LOAN_ACTIVE_GIVEN_KEY(UID))).toEqual([LOAN])
  })

  it('upsertBudget restores the previous limit', async () => {
    queryClient.setQueryData(budgetQueryKey(UID), [BUDGET])
    vi.spyOn(supabase, 'from').mockImplementation(() => failingQuery())
    await expect(upsertBudget('food', 12000)).rejects.toThrow('query failed')
    expect(queryClient.getQueryData(budgetQueryKey(UID))).toEqual([BUDGET])
  })

  it('deleteBudget puts the budget back', async () => {
    queryClient.setQueryData(budgetQueryKey(UID), [BUDGET])
    vi.spyOn(supabase, 'from').mockImplementation(() => failingQuery())
    await expect(deleteBudget(BUDGET.id)).rejects.toThrow('query failed')
    expect(queryClient.getQueryData(budgetQueryKey(UID))).toEqual([BUDGET])
  })

  it('deleteSplitExpenseMutation puts the expense back', async () => {
    queryClient.setQueryData(['splitwise', 'expenses', 'g-1'], [EXPENSE])
    rpcFails()
    await expect(deleteSplitExpenseMutation(EXPENSE.id)).rejects.toThrow('rpc failed')
    expect(queryClient.getQueryData(['splitwise', 'expenses', 'g-1'])).toEqual([EXPENSE])
  })
})
