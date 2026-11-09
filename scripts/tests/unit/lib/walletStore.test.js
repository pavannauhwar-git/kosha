import { describe, it, expect, beforeEach } from 'vitest'
import { queryClient } from '../../../../src/lib/queryClient'
import { setAuthUser } from '../../../../src/lib/authStore'
import { setActiveWalletUserId, getActiveWalletUserId } from '../../../../src/lib/walletStore'
import { budgetQueryKey } from '../../../../src/hooks/useBudgets'
import { USER_CATEGORIES_QUERY_KEY } from '../../../../src/hooks/useUserCategories'
import { reviewListKey } from '../../../../src/hooks/useReconciliationReviews'
import {
  txnCountKey,
  transactionSignalAggregatesKey,
  yearDailyExpenseTotalsKey,
  yearYoyKey,
  balanceAsOfKey,
} from '../../../../src/hooks/useTransactions'
import {
  LOAN_ACTIVE_GIVEN_KEY,
  LOAN_ACTIVE_TAKEN_KEY,
  LOAN_SETTLED_KEY,
} from '../../../../src/hooks/useLoans'
import { LIABILITY_PENDING_QUERY_KEY, LIABILITY_PAID_QUERY_KEY } from '../../../../src/hooks/useLiabilities'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const keyFactories = {
  categoryBudgets: budgetQueryKey,
  userCategories: USER_CATEGORIES_QUERY_KEY,
  reconciliationReviews: reviewListKey,
  transactionSignalAggregates: (uid) => transactionSignalAggregatesKey({}, uid),
  yearDailyExpenseTotals: (uid) => yearDailyExpenseTotalsKey(2025, uid),
  txnCount: (uid) => txnCountKey({}, uid),
  yearYoy: (uid) => yearYoyKey(2025, uid),
  balanceAsOf: (uid) => balanceAsOfKey('2025-01-31', uid),
  loanActiveGiven: LOAN_ACTIVE_GIVEN_KEY,
  loanActiveTaken: LOAN_ACTIVE_TAKEN_KEY,
  loanSettled: LOAN_SETTLED_KEY,
  liabilitiesPending: LIABILITY_PENDING_QUERY_KEY,
  liabilitiesPaid: LIABILITY_PAID_QUERY_KEY,
}

beforeEach(() => {
  queryClient.clear()
  setAuthUser({ id: USER_A })
  queryClient.setQueryData(['kosha-active-wallet'], USER_A)
})

describe('setActiveWalletUserId', () => {
  it('removes every cached query that belongs to the previous wallet', () => {
    for (const factory of Object.values(keyFactories)) {
      queryClient.setQueryData(factory(USER_A), ['wallet A data'])
    }
    queryClient.setQueryData(['transactions', { month: 1 }, USER_A], ['wallet A rows'])
    queryClient.setQueryData(['month', 2025, 1, USER_A], { earned: 1 })

    setActiveWalletUserId(USER_B)

    expect(getActiveWalletUserId()).toBe(USER_B)
    for (const [name, factory] of Object.entries(keyFactories)) {
      expect(queryClient.getQueryData(factory(USER_A)), name).toBeUndefined()
    }
    expect(queryClient.getQueryData(['transactions', { month: 1 }, USER_A])).toBeUndefined()
    expect(queryClient.getQueryData(['month', 2025, 1, USER_A])).toBeUndefined()
  })

  it('keeps queries that are not tied to a wallet', () => {
    queryClient.setQueryData(['profile'], { display_name: 'Me' })
    queryClient.setQueryData(['splitGroups'], [{ id: 'g1' }])

    setActiveWalletUserId(USER_B)

    expect(queryClient.getQueryData(['profile'])).toEqual({ display_name: 'Me' })
    expect(queryClient.getQueryData(['splitGroups'])).toEqual([{ id: 'g1' }])
  })
})

describe('wallet-scoped query keys', () => {
  it('differ between two wallets', () => {
    for (const [name, factory] of Object.entries(keyFactories)) {
      expect(JSON.stringify(factory(USER_A)), name).not.toBe(JSON.stringify(factory(USER_B)))
    }
  })

  it('give a signed-out (null) user a different cache slot from a real user', () => {
    for (const [name, factory] of Object.entries(keyFactories)) {
      expect(JSON.stringify(factory(null)), name).not.toBe(JSON.stringify(factory(USER_A)))
    }
  })
})
