import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query'
import { captureError, isExpectedMutationError } from './errorReporting'

import { saveTransactionMutation, removeTransactionMutation } from '../hooks/useTransactions'
import { addLiabilityMutation, markLiabilityPaidMutation, deleteLiabilityMutation } from '../hooks/useLiabilities'
import { addLoanMutation, deleteLoanMutation } from '../hooks/useLoans'
import {
  createSplitGroupMutation, addSplitMemberMutation, addSplitExpenseMutation,
  recordSplitSettlementMutation, deleteSplitSettlementMutation, deleteSplitExpenseMutation,
  deleteSplitGroupMutation, deleteSplitMemberMutation, leaveSplitGroupMutation,
  updateSplitExpenseMutation, updateSplitGroupMutation, setSplitGroupAccessRoleMutation,
  createSplitGroupInviteMutation, previewSplitGroupInviteMutation, consumeSplitGroupInviteMutation
} from '../hooks/useSplitwise'
import { createUserCategory, updateUserCategory, archiveUserCategory } from '../hooks/useUserCategories'


const queryCache = new QueryCache({
  onError: (error, query) => {
    const status = error?.status || error?.code
    // Auth failures are handled by AuthGuard redirect — don't spam Sentry.
    if (status === 401 || status === 403) return
    captureError(error, {
      tags: {
        source: 'react-query',
        queryKey: JSON.stringify(query.queryKey).slice(0, 200),
      },
    })
  },
})

const mutationCache = new MutationCache({
  // Single global reporting choke point for every useMutation in the app.
  // Expected errors (validation, auth/RLS, double-tap) are filtered out so the
  // Sentry dashboard stays signal-rich. Pass a human label via the mutation's
  // `meta.context` (see useAppMutation) for a readable Sentry `context` tag.
  onError: (error, _vars, _ctx, mutation) => {
    if (isExpectedMutationError(error)) return
    const context = mutation?.meta?.context || 'mutation'
    captureError(error, {
      context,
      tags: {
        source: 'mutation',
        mutationKey: JSON.stringify(mutation.options.mutationKey || []).slice(0, 200),
      },
    })
  },
})

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      // FIX-007: refetchOnMount is disabled so tab switches never trigger a
      // refetch waterfall. Freshness is maintained by three mechanisms instead:
      //   1. refetchOnWindowFocus: true  — app returns from background → refresh
      //   2. refetchOnReconnect: 'always' — network drop + reconnect → refresh
      //   3. Realtime subscriptions + invalidateQueryFamilies — mutations → refresh
      //
      // If a specific query reports stale data, lower its per-query staleTime
      // (e.g. staleTime: 30_000) rather than reverting this flag globally.
      refetchOnMount: false,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false
        const status = error?.status || error?.code
        if (status === 401 || status === 403 || status === 404) return false
        if (String(error?.message || '').includes('Not signed in')) return false
        return true
      },
      refetchOnReconnect: 'always',
    },
  },
})

// Register resumable mutations for Stage 2 Offline Writes.
// These are the defaults used when React Query replays a paused mutation from IDB.
const resumableMutations = {
  // Transactions
  'transactions:save': saveTransactionMutation,
  'transactions:delete': removeTransactionMutation,
  'transactions:deleteCommit': removeTransactionMutation,
  'dashboard:deleteTransaction': removeTransactionMutation,
  'dashboard:deleteTransactionCommit': removeTransactionMutation,
  'onboarding:firstTransaction': saveTransactionMutation,
  'reconciliation:updateCategory': saveTransactionMutation,
  
  // Obligations
  'bills:add': addLiabilityMutation,
  'bills:markPaid': markLiabilityPaidMutation,
  'bills:delete': deleteLiabilityMutation,
  'loans:add': addLoanMutation,
  'loans:delete': deleteLoanMutation,

  // Splitwise
  'splitwise:createGroup': createSplitGroupMutation,
  'splitwise:addMember': addSplitMemberMutation,
  'splitwise:addExpense': addSplitExpenseMutation,
  'splitwise:settle': recordSplitSettlementMutation,
  'splitwise:deleteSettlement': deleteSplitSettlementMutation,
  'splitwise:deleteExpense': deleteSplitExpenseMutation,
  'splitwise:createInvite': createSplitGroupInviteMutation,
  'splitwise:deleteGroup': deleteSplitGroupMutation,
  'splitwise:deleteMember': deleteSplitMemberMutation,
  'splitwise:leaveGroup': leaveSplitGroupMutation,
  'splitwise:previewInvite': previewSplitGroupInviteMutation,
  'splitwise:consumeInvite': consumeSplitGroupInviteMutation,
  'splitwise:updateExpense': updateSplitExpenseMutation,
  'splitwise:updateGroup': updateSplitGroupMutation,
  'splitwise:setMemberRole': setSplitGroupAccessRoleMutation,

  // Categories
  'categories:save': (vars) => vars.dbId ? updateUserCategory(vars) : createUserCategory(vars),
  'categories:delete': archiveUserCategory,
}

for (const [context, mutationFn] of Object.entries(resumableMutations)) {
  queryClient.setMutationDefaults([[context]], { mutationFn })
}

export function invalidateQueryFamilies(queryKeys) {
  if (!Array.isArray(queryKeys)) return Promise.resolve()
  return Promise.all(
    queryKeys.map(queryKey =>
      queryClient.invalidateQueries({ queryKey })
    )
  )
}

// Map API routes to query prefixes for targeted Service Worker cache invalidation
const CACHE_INVALIDATION_MAP = {
  '/transactions': ['/transactions'],
  '/liabilities': ['/liabilities', '/transactions'], // Bills touch transactions
  '/loans': ['/loans', '/transactions'],             // Loans touch transactions
  '/splitwise': ['/splitwise'],
}

export async function evictSwCacheEntries(pathPrefix) {
  const pathsToEvict = CACHE_INVALIDATION_MAP[pathPrefix] || [pathPrefix]
  
  try {
    const cache = await caches.open('supabase-data')
    const keys = await cache.keys()
    await Promise.all(
      keys
        .filter(req => pathsToEvict.some(p => req.url.includes(p)))
        .map(req => cache.delete(req))
    )
  } catch { /* Cache API unavailable */ }
}
