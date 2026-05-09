import { queryClient } from './queryClient'
import { getAuthUserId, isAuthReady } from './authStore'
import { useQuery } from '@tanstack/react-query'

const ACTIVE_WALLET_KEY = ['kosha-active-wallet']

/**
 * ⚠️  SYNC FOOTGUN — Read carefully before using.
 *
 * Returns the active wallet user ID from a synchronous cache snapshot.
 * This value can be STALE between React renders because it does not
 * subscribe to wallet changes.
 *
 * ONLY use this in:
 *   - Non-React async functions (mutations, lib utilities)
 *   - Places where you are certain the wallet cannot change mid-execution
 *
 * In React components or hooks, ALWAYS use `useActiveWallet()` instead.
 * Using this in a queryFn or component will cause silent cache misses when
 * the user switches wallets.
 */
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

/**
 * ✅ PREFERRED — use this in all React components and hooks.
 *
 * Returns the active wallet user ID, reactively. Automatically re-renders
 * callers when the user switches wallets. Suspends (returns undefined) for
 * one tick on cold start before auth resolves — always guard with `!!userId`
 * before using as a query `enabled` flag.
 *
 * For non-React mutation functions use `getActiveWalletUserId()` — but read
 * its warning first.
 */
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

/**
 * Called once on INITIAL_SESSION in useAuth to seed the wallet key with
 * the user's own ID. Does NOT trigger the full invalidation cycle.
 * Safe to call multiple times — only sets if no wallet is already active.
 */
export function initActiveWallet(userId) {
  if (!userId) return
  const current = queryClient.getQueryData(ACTIVE_WALLET_KEY)
  if (!current) {
    queryClient.setQueryData(ACTIVE_WALLET_KEY, userId)
  }
}

export function setActiveWalletUserId(userId) {
  queryClient.setQueryData(ACTIVE_WALLET_KEY, userId)
  
  // Hard invalidate ALL financial data so they re-fetch scoped to the new wallet user
  queryClient.invalidateQueries({
    predicate: (query) => {
      const k = query.queryKey[0]
      return [
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
      ].includes(k)
    }
  })
}
