import { describe, it, expect, beforeEach } from 'vitest'
import { queryClient } from '../../../../src/lib/queryClient'
import { setAuthUser } from '../../../../src/lib/authStore'
import { optimisticallyDeleteTransactionsByBillId } from '../../../../src/hooks/useTransactions'
import { billPaymentTransactionId } from '../../../../src/hooks/useLiabilities'

const UID = '11111111-1111-4111-8111-111111111111'
const BILL = 'bill-1'
const row = (id, extra = {}) => ({
  id, user_id: UID, type: 'expense', amount: 100, date: '2026-11-05', created_at: '2026-11-05T10:00:00.000Z',
  description: id, category: 'bills', linked_bill_id: BILL, ...extra,
})

beforeEach(() => {
  queryClient.clear()
  setAuthUser({ id: UID })
  queryClient.setQueryData(['kosha-active-wallet'], UID)
})

describe('deleting a bill from the cache', () => {
  it('removes only the payment entry the bill created and unlinks the rest', () => {
    queryClient.setQueryData(['transactionsRecent', UID], [
      row('payment'),
      row('linked-expense'),
      row('split-entry', { linked_split_expense_id: 'exp-1' }),
      row('other', { linked_bill_id: null }),
    ])

    const deleted = optimisticallyDeleteTransactionsByBillId(BILL, UID, 'payment')

    expect([...deleted]).toEqual(['payment'])
    const rows = queryClient.getQueryData(['transactionsRecent', UID])
    expect(rows.map((r) => [r.id, r.linked_bill_id])).toEqual([
      ['linked-expense', null],
      ['split-entry', null],
      ['other', null],
    ])
  })

  it('keeps a split entry even when the bill points at it', () => {
    queryClient.setQueryData(['transactionsRecent', UID], [row('split-entry', { linked_split_expense_id: 'exp-1' })])
    const deleted = optimisticallyDeleteTransactionsByBillId(BILL, UID, 'split-entry')
    expect(deleted.size).toBe(0)
    expect(queryClient.getQueryData(['transactionsRecent', UID])).toHaveLength(1)
  })

  it('knows which entry the bill created', () => {
    expect(billPaymentTransactionId({ linked_transaction_id: 't1', payment_txn_created: true })).toBe('t1')
    expect(billPaymentTransactionId({ linked_transaction_id: 't1', payment_txn_created: null })).toBe('t1')
    expect(billPaymentTransactionId({ linked_transaction_id: 't1', payment_txn_created: false })).toBeNull()
    expect(billPaymentTransactionId({ linked_transaction_id: null })).toBeNull()
    expect(billPaymentTransactionId(null)).toBeNull()
  })
})
