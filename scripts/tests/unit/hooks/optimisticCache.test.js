import { describe, it, expect, beforeEach, vi } from 'vitest'
import { queryClient } from '../../../../src/lib/queryClient'
import { setAuthUser } from '../../../../src/lib/authStore'
import { todayStr } from '../../../../src/lib/utils'
import { registerCustomCategories } from '../../../../src/lib/categories'
import {
  buildTransactionSearchOrClause,
  optimisticallyUpsertTransactionInCache,
  saveTransactionMutation,
} from '../../../../src/hooks/useTransactions'

const UID = '11111111-1111-4111-8111-111111111111'
const PARTNER = '22222222-2222-4222-8222-222222222222'

const TXN = {
  id: 'txn-9',
  user_id: UID,
  type: 'expense',
  amount: 120,
  date: '2026-02-10',
  created_at: '2026-02-10T10:00:00.000Z',
  description: 'Tea',
  category: 'food',
  linked_loan_id: null,
}

beforeEach(() => {
  queryClient.clear()
  setAuthUser({ id: UID })
  queryClient.setQueryData(['kosha-active-wallet'], UID)
})

describe('optimistic transaction cache', () => {
  it('does not create a one-row list when no list is loaded yet', () => {
    optimisticallyUpsertTransactionInCache(TXN, UID)
    expect(queryClient.getQueriesData({ queryKey: ['transactions'] })).toEqual([])
    expect(queryClient.getQueriesData({ queryKey: ['transactionsRecent'] })).toEqual([])
  })

  it('adds the entry only to lists whose linked filters it matches', () => {
    const loanListKey = ['transactions', { linkedLoanId: 'loan-1' }, UID]
    const allListKey = ['transactions', { limit: 50 }, UID]
    queryClient.setQueryData(loanListKey, [])
    queryClient.setQueryData(allListKey, [])

    optimisticallyUpsertTransactionInCache(TXN, UID)
    expect(queryClient.getQueryData(loanListKey)).toEqual([])
    expect(queryClient.getQueryData(allListKey).map((row) => row.id)).toEqual(['txn-9'])

    optimisticallyUpsertTransactionInCache({ ...TXN, id: 'txn-10', linked_loan_id: 'loan-1' }, UID)
    expect(queryClient.getQueryData(loanListKey).map((row) => row.id)).toEqual(['txn-10'])
  })

  it("updates only today's total for the entry's own wallet", async () => {
    const today = todayStr()
    const ownKey = ['todayExpenses', today, UID]
    const partnerKey = ['todayExpenses', today, PARTNER]
    const staleKey = ['todayExpenses', '2000-01-01', UID]
    queryClient.setQueryData(ownKey, 100)
    queryClient.setQueryData(partnerKey, 100)
    queryClient.setQueryData(staleKey, 100)

    const payload = { ...TXN, id: undefined, date: today, amount: 50 }
    await saveTransactionMutation({
      clientId: 'client-9',
      payload,
      __testOverrides: {
        addTransaction: vi.fn().mockResolvedValue({ ...payload, id: 'txn-11' }),
        invalidateCache: vi.fn(),
      },
    })

    expect(queryClient.getQueryData(ownKey)).toBe(150)
    expect(queryClient.getQueryData(partnerKey)).toBe(100)
    expect(queryClient.getQueryData(staleKey)).toBe(100)
  })

  it('counts a backdated add once even when no loaded list holds it', async () => {
    const monthKey = ['month', 2026, 2, UID]
    queryClient.setQueryData(monthKey, { expense: 1000 })
    const newer = { ...TXN, id: 'txn-newer', date: '2026-03-01', created_at: '2026-03-01T10:00:00.000Z' }
    queryClient.setQueryData(['transactionsRecent', 1, UID], [newer])

    const payload = { ...TXN, id: undefined, amount: 200 }
    await saveTransactionMutation({
      clientId: 'client-12',
      payload,
      __testOverrides: {
        addTransaction: vi.fn().mockResolvedValue({ ...payload, id: 'txn-12' }),
        invalidateCache: vi.fn(),
      },
    })

    expect(queryClient.getQueryData(monthKey).expense).toBe(1200)
  })

  it('keeps a category-only edit in the total spent today', async () => {
    const today = todayStr()
    const todayKey = ['todayExpenses', today, UID]
    const existing = { ...TXN, date: today, amount: 80 }
    queryClient.setQueryData(['transactions', { limit: 50 }, UID], [existing])
    queryClient.setQueryData(todayKey, 80)

    await saveTransactionMutation({
      id: existing.id,
      payload: { category: 'transport' },
      __testOverrides: {
        updateTransaction: vi.fn().mockResolvedValue({ ...existing, category: 'transport' }),
        invalidateCache: vi.fn(),
      },
    })

    expect(queryClient.getQueryData(todayKey)).toBe(80)
  })

  it('searches custom categories added after the first search, archived ones included', () => {
    registerCustomCategories([])
    expect(buildTransactionSearchOrClause('gym')).not.toContain('category.eq.custom_gym')

    registerCustomCategories([
      { id: 'custom_gym_a1b2c3', label: 'Gym', type: 'expense' },
      { id: 'custom_gymnastics_d4e5f6', label: 'Gymnastics', type: 'expense', archived: true },
    ])
    const clause = buildTransactionSearchOrClause('gym')
    expect(clause).toContain('category.eq.custom_gym_a1b2c3')
    expect(clause).toContain('category.eq.custom_gymnastics_d4e5f6')
    registerCustomCategories([])
  })
})
