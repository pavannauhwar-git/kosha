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
    // Auth said it was ready but `getAuthUserId()` still threw.
    // If the error is 'Not signed in', it's expected during signed-out state.
    // Otherwise, surface it as a warning.
    if (err.message !== 'Not signed in') {
      console.warn('[Kosha] getActiveWalletUserId: auth ready but no user id resolvable.', err)
    }
    return null
  }
}

// preferred in components/hooks — reactive, re-renders on wallet switch.
export function useActiveWallet() {
  const { data } = useQuery({
    queryKey: ACTIVE_WALLET_KEY,
    queryFn: () => {
      if (!isAuthReady()) return null
      try {
        return getAuthUserId()
      } catch {
        // Transient sign-out window: auth ready but no user id yet. Return null
        // rather than throwing, which would spam Sentry via queryCache.onError.
        return null
      }
    },
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

const WALLET_INVALIDATION_LIST = [
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function setActiveWalletUserId(userId) {
  const authUserId = getAuthUserId()
  if (userId === authUserId) {
    hapticSelection()
  } else {
    hapticWarning()
  }
  queryClient.setQueryData(ACTIVE_WALLET_KEY, userId)
  // Remove instead of reset to instantly eliminate "Ghost Flashes" of old data.
  // Two-layer rule:
  //   1. The explicit family allow-list (fast, documents intent).
  //   2. A defensive predicate: evict any query whose LAST key segment is a
  //      UUID that is not the wallet we are switching to. This catches new
  //      user-scoped query families that were never added to the list.
  queryClient.removeQueries({
    predicate: (query) => {
      const key = query.queryKey
      if (Array.isArray(key) && WALLET_INVALIDATION_LIST.includes(key[0])) return true
      const last = Array.isArray(key) ? key[key.length - 1] : null
      if (typeof last === 'string' && UUID_RE.test(last) && last !== userId) return true
      return false
    },
  })
}
