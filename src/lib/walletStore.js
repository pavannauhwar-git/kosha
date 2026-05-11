import { queryClient } from './queryClient'
import { getAuthUserId, isAuthReady } from './authStore'
import { useQuery } from '@tanstack/react-query'
import { hapticSelection, hapticWarning } from './haptics'

const ACTIVE_WALLET_KEY = ['kosha-active-wallet']

// SYNC — use only in mutations/lib utils. In components/hooks use useActiveWallet() instead.
export function getActiveWalletUserId() {
  const active = queryClient.getQueryData(ACTIVE_WALLET_KEY)
  if (active) return active

  if (!isAuthReady()) return null

  try {
    return getAuthUserId()
  } catch {
    return null
  }
}

// preferred in components/hooks — reactive, re-renders on wallet switch.
export function useActiveWallet() {
  const { data } = useQuery({
    queryKey: ACTIVE_WALLET_KEY,
    queryFn: () => isAuthReady() ? getAuthUserId() : null,
    initialData: () => getActiveWalletUserId(),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
  return data
}

// Seeds wallet key at auth boot without triggering full cache invalidation.
export function initActiveWallet(userId) {
  if (!userId) return
  const current = queryClient.getQueryData(ACTIVE_WALLET_KEY)
  if (!current) {
    queryClient.setQueryData(ACTIVE_WALLET_KEY, userId)
  }
}

export const WALLET_INVALIDATION_LIST = [
  'transactions',
  'transactionsRecent',
  'transactionsDigest',
  'transactionSignalAggregates',
  'todayExpenses',
  'dailyExpenseTotals',
  'monthExpenseDailyTotals',
  'yearDailyExpenseTotals',
  'txnCount',
  'liabilities',
  'liabilitiesMonth',
  'loans',
  'month',
  'year',
  'balance',
  'dashboard',
  'runningBalance',
  'monthSummary',
  'yearSummary',
  'userCategories',
  'categoryBudgets',
  'reconciliationReviews',
  'financialEvents',
]

export function setActiveWalletUserId(userId) {
  const authUserId = getAuthUserId()
  if (userId === authUserId) {
    hapticSelection()
  } else {
    hapticWarning()
  }
  queryClient.setQueryData(ACTIVE_WALLET_KEY, userId)
  // Reset instead of invalidate to eliminate "Ghost Flashes" of old data
  queryClient.resetQueries({
    predicate: (query) => WALLET_INVALIDATION_LIST.includes(query.queryKey[0])
  })
}
