import { describe, it, expect, beforeEach } from 'vitest'
import { queryClient } from '../../../../src/lib/queryClient'
import {
  LOAN_ACTIVE_GIVEN_KEY,
  LOAN_ACTIVE_TAKEN_KEY,
  LOAN_SETTLED_KEY,
  optimisticallyInsertLoan,
} from '../../../../src/hooks/useLoans'

const UID = '11111111-1111-4111-8111-111111111111'

const LOAN = {
  id: 'loan-7',
  direction: 'given',
  counterparty: 'Asha',
  amount: 5000,
  amount_settled: 5000,
  settled: true,
}

beforeEach(() => {
  queryClient.clear()
})

describe('optimisticallyInsertLoan', () => {
  it('puts a settled loan back in the loaded settled list, not an active one', () => {
    queryClient.setQueryData(LOAN_SETTLED_KEY(UID), [{ id: 'loan-1', settled: true }])
    queryClient.setQueryData(LOAN_ACTIVE_GIVEN_KEY(UID), [])

    optimisticallyInsertLoan(LOAN, UID)

    expect(queryClient.getQueryData(LOAN_SETTLED_KEY(UID)).map((row) => row.id)).toEqual(['loan-7', 'loan-1'])
    expect(queryClient.getQueryData(LOAN_ACTIVE_GIVEN_KEY(UID))).toEqual([])
  })

  it('leaves the cache alone for a settled loan when the settled list is not loaded', () => {
    optimisticallyInsertLoan(LOAN, UID)

    expect(queryClient.getQueryData(LOAN_SETTLED_KEY(UID))).toBeUndefined()
    expect(queryClient.getQueryData(LOAN_ACTIVE_GIVEN_KEY(UID))).toBeUndefined()
  })

  it('still adds an active loan to its direction list', () => {
    optimisticallyInsertLoan({ ...LOAN, direction: 'taken', settled: false }, UID)

    expect(queryClient.getQueryData(LOAN_ACTIVE_TAKEN_KEY(UID)).map((row) => row.id)).toEqual(['loan-7'])
    expect(queryClient.getQueryData(LOAN_SETTLED_KEY(UID))).toBeUndefined()
  })
})
