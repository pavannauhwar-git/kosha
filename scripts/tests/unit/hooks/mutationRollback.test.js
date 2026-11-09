import { describe, it, expect, beforeEach, vi } from 'vitest'
import { queryClient } from '../../../../src/lib/queryClient'
import { setAuthUser } from '../../../../src/lib/authStore'
import {
  saveTransactionMutation,
  removeTransactionMutation,
} from '../../../../src/hooks/useTransactions'
import {
  addLiabilityMutation,
  deleteLiabilityMutation,
  LIABILITY_PENDING_QUERY_KEY,
} from '../../../../src/hooks/useLiabilities'

const UID = '11111111-1111-4111-8111-111111111111'

const TXN = {
  id: 'txn-1',
  user_id: UID,
  type: 'expense',
  amount: 250,
  date: '2026-01-15',
  description: 'Groceries',
  category: 'food',
}

const BILL = {
  id: 'bill-1',
  user_id: UID,
  description: 'Rent',
  amount: 20000,
  due_date: '2026-01-31',
  paid: false,
}

const failWith = (message) => vi.fn().mockRejectedValue(new Error(message))

beforeEach(() => {
  queryClient.clear()
  setAuthUser({ id: UID })
  queryClient.setQueryData(['kosha-active-wallet'], UID)
})

describe('transaction mutations roll back the cache when the server call fails', () => {
  beforeEach(() => {
    queryClient.setQueryData(['transactionsRecent', UID], [TXN])
  })

  it('saveTransactionMutation (insert) removes the optimistic row', async () => {
    const before = queryClient.getQueryData(['transactionsRecent', UID])
    await expect(saveTransactionMutation({
      clientId: 'client-1',
      payload: { ...TXN, id: undefined, description: 'Coffee', amount: 90 },
      __testOverrides: { addTransaction: failWith('insert failed'), invalidateCache: vi.fn() },
    })).rejects.toThrow('insert failed')
    expect(queryClient.getQueryData(['transactionsRecent', UID])).toEqual(before)
  })

  it('saveTransactionMutation (update) restores the original row', async () => {
    await expect(saveTransactionMutation({
      id: TXN.id,
      payload: { ...TXN, amount: 999 },
      __testOverrides: { updateTransaction: failWith('update failed'), invalidateCache: vi.fn() },
    })).rejects.toThrow('update failed')
    expect(queryClient.getQueryData(['transactionsRecent', UID])).toEqual([TXN])
  })

  it('removeTransactionMutation puts the deleted row back', async () => {
    await expect(removeTransactionMutation(TXN.id, {
      deleteTransaction: failWith('delete failed'),
      invalidateCache: vi.fn(),
    })).rejects.toThrow('delete failed')
    expect(queryClient.getQueryData(['transactionsRecent', UID])).toEqual([TXN])
  })

  it('removeTransactionMutation keeps the row removed when the server call succeeds', async () => {
    await removeTransactionMutation(TXN.id, {
      deleteTransaction: vi.fn().mockResolvedValue(undefined),
      invalidateCache: vi.fn(),
    })
    expect(queryClient.getQueryData(['transactionsRecent', UID])).toEqual([])
  })
})

describe('bill mutations roll back the cache when the server call fails', () => {
  beforeEach(() => {
    queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY(UID), [BILL])
  })

  it('addLiabilityMutation removes the optimistic bill', async () => {
    await expect(addLiabilityMutation(
      { description: 'Internet', amount: 999, due_date: '2026-01-20' },
      { addLiability: failWith('insert failed'), invalidateLiabilityCache: vi.fn() },
    )).rejects.toThrow('insert failed')
    expect(queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY(UID))).toEqual([BILL])
  })

  it('deleteLiabilityMutation puts the deleted bill back', async () => {
    await expect(deleteLiabilityMutation(BILL.id, {
      deleteLiability: failWith('delete failed'),
      invalidateLiabilityCache: vi.fn(),
    })).rejects.toThrow('delete failed')
    expect(queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY(UID))).toEqual([BILL])
  })
})
