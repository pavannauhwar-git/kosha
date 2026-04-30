import { queryClient } from './queryClient'
import { getAuthUserId, isAuthReady } from './authStore'
import { useQuery } from '@tanstack/react-query'

const ACTIVE_WALLET_KEY = ['kosha-active-wallet']

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
      ].includes(k)
    }
  })
}
