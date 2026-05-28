import { queryClient } from './queryClient.js'
import { getAuthUserId, isAuthReady } from './authStore.js'
import { useQuery } from '@tanstack/react-query'
import { hapticSelection, hapticWarning } from './haptics.js'

const ACTIVE_WALLET_KEY = ['kosha-active-wallet']

// SYNC — use only in mutations/lib utils. In components/hooks use useActiveWallet() instead.

// Returns the current active wallet user id, or `null` when no wallet is
// known yet (auth still booting, or user is signed out). Callers that write
// to device-local storage MUST check for null before building a storage key;
// using `${prefix}${getActiveWalletUserId()}` produces a literal "…:null"
// key that leaks across users on the same device. See `reconciliation.js`
// for the correct pattern.
export function getActiveWalletUserId() {
  const active = queryClient.getQueryData(ACTIVE_WALLET_KEY)
  if (active) return active

  if (!isAuthReady()) return null

  try {
    return getAuthUserId()
  } catch (err) {
    // Auth said it was ready but `getAuthUserId()` still threw. This is
    // unusual (transitional state during sign-out, or a corrupt auth store)
    // and worth surfacing instead of swallowing silently.
    console.warn('[Kosha] getActiveWalletUserId: auth ready but no user id resolvable.', err)
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
  'transactionYearBounds',
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
  'monthly_net_changes',
  'splitwise',
]

export function setActiveWalletUserId(userId) {
  const authUserId = getAuthUserId()
  if (userId === authUserId) {
    hapticSelection()
  } else {
    hapticWarning()
  }
  queryClient.setQueryData(ACTIVE_WALLET_KEY, userId)
  // Remove instead of reset to instantly eliminate "Ghost Flashes" of old data
  queryClient.removeQueries({
    predicate: (query) => WALLET_INVALIDATION_LIST.includes(query.queryKey[0])
  })
}
