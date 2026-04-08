# Chapter 3: The Data Engine (React Query Architecture)

## 3.1 What the data engine is

Kosha data access is built as a layered runtime:

1. Query Client policy layer in [src/lib/queryClient.js](src/lib/queryClient.js).
2. Domain hooks in [src/hooks/useTransactions.js](src/hooks/useTransactions.js), [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js), [src/hooks/useLoans.js](src/hooks/useLoans.js), [src/hooks/useBudgets.js](src/hooks/useBudgets.js), [src/hooks/useFinancialEvents.js](src/hooks/useFinancialEvents.js), [src/hooks/useReconciliationReviews.js](src/hooks/useReconciliationReviews.js), [src/hooks/useUserCategories.js](src/hooks/useUserCategories.js), and [src/hooks/useAuth.js](src/hooks/useAuth.js).
3. Auth identity bridge in [src/lib/authStore.js](src/lib/authStore.js) used by all mutation/query functions to avoid session race windows.
4. Realtime freshness loop in [src/App.jsx](src/App.jsx#L535) that invalidates query families from database events.
5. Mutation suppression guard in [src/lib/mutationGuard.js](src/lib/mutationGuard.js) that prevents duplicate local-plus-realtime fetch storms.

The result is a server-truth architecture with optimistic UX and controlled refetch behavior.

---

## 3.2 Global SWR strategy in QueryClient

Global defaults are defined in [src/lib/queryClient.js](src/lib/queryClient.js#L3).

### 3.2.1 Default query lifecycle

1. staleTime is 5 minutes at [src/lib/queryClient.js](src/lib/queryClient.js#L6).
2. gcTime is 24 hours at [src/lib/queryClient.js](src/lib/queryClient.js#L7).
3. refetchOnMount is true at [src/lib/queryClient.js](src/lib/queryClient.js#L11).
4. refetchOnWindowFocus is false at [src/lib/queryClient.js](src/lib/queryClient.js#L12).
5. refetchOnReconnect is always at [src/lib/queryClient.js](src/lib/queryClient.js#L24).

Interpretation:

1. Cached data is treated as fresh for 5 minutes.
2. Cached entries are retained for long offline resilience and quick back-navigation.
3. Returning to inactive pages refetches stale data when needed.
4. Focus thrash does not trigger unnecessary reloads.
5. Network recovery automatically heals stale active views.

### 3.2.2 Retry policy

Retry callback is at [src/lib/queryClient.js](src/lib/queryClient.js#L14).

Rules:

1. Maximum 2 retries.
2. No retries for 401, 403, 404.
3. No retries for Not signed in errors.
4. Retry transient transport/server failures.

This balances resilience with safety for auth and ownership errors.

### 3.2.3 Shared invalidation helpers

1. invalidateQueryFamilies in [src/lib/queryClient.js](src/lib/queryClient.js#L29) invalidates multiple families with refetchType active.
2. evictSwCacheEntries in [src/lib/queryClient.js](src/lib/queryClient.js#L37) clears matching entries from the service-worker supabase-data cache.

This is critical because Kosha uses both React Query memory cache and Workbox runtime cache.

---

## 3.3 SWR behavior by hook-level overrides

Global policy is intentionally refined in domain hooks.

### 3.3.1 Placeholder continuity (anti-flash)

Many hooks use placeholderData previousData to keep prior rows while revalidating, including:

1. useTransactions list at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L219).
2. useMonthSummary at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L470).
3. useYearSummary at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L481).
4. useRunningBalance at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L628).
5. useLiabilities queries at [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L56).
6. useLoans queries at [src/hooks/useLoans.js](src/hooks/useLoans.js#L60).
7. useBudgets at [src/hooks/useBudgets.js](src/hooks/useBudgets.js#L26).
8. useUserCategories at [src/hooks/useUserCategories.js](src/hooks/useUserCategories.js#L91).

### 3.3.2 Shorter cache retention for high-variance query variants

Transactions list variants use gcTime 5 minutes at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L218) to avoid long-lived cache buildup across many filter combinations.

### 3.3.3 Domain staleTime tuning

1. useFinancialEvents staleTime 10 minutes at [src/hooks/useFinancialEvents.js](src/hooks/useFinancialEvents.js#L44).
2. useTransactionYearBounds staleTime 5 minutes at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L598).

---

## 3.4 Deferred Refetch mutation pattern (current implementation)

The runtime pattern is not a naive refetch immediately on every write and every realtime event. It is a coordinated pipeline.

## 3.4.1 Transaction save path

UI trigger:

1. Add sheet disables controls before network write at [src/components/transactions/AddTransactionSheet.jsx](src/components/transactions/AddTransactionSheet.jsx#L335).
2. UI awaits mutation at [src/components/transactions/AddTransactionSheet.jsx](src/components/transactions/AddTransactionSheet.jsx#L339).
3. Sheet closes only after success at [src/components/transactions/AddTransactionSheet.jsx](src/components/transactions/AddTransactionSheet.jsx#L344).

Mutation engine:

1. saveTransactionMutation begins at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L839).
2. Optimistic cache upsert/delete happens first.
3. DB write is awaited via addTransaction or updateTransaction.
4. Active query cancels occur to prevent stale merge races.
5. Financial event is optimistically injected.
6. invalidateCache is awaited at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L917).

Why it feels instant:

1. Optimistic setQueryData updates visible lists immediately.
2. Sheet closes right after confirmed write.
3. Reconciliation invalidation runs in background on active views.

## 3.4.2 Where the 300ms deferred refetch lives

Realtime invalidation is intentionally debounced in GlobalRealtimeSync:

1. scheduleInvalidate defined at [src/App.jsx](src/App.jsx#L549).
2. Each table invalidation is delayed 300ms at [src/App.jsx](src/App.jsx#L555).

This 300ms deferral smooths event bursts and gives local mutation caches time to settle.

## 3.4.3 Duplicate fetch suppression window

Without suppression, one local mutation would trigger:

1. Direct invalidation from mutation code.
2. Realtime invalidation shortly after.

Suppression mechanism:

1. suppress table key in [src/lib/mutationGuard.js](src/lib/mutationGuard.js#L39).
2. TTL 2000ms in [src/lib/mutationGuard.js](src/lib/mutationGuard.js#L28).
3. GlobalRealtimeSync checks isSuppressed before invalidating at [src/App.jsx](src/App.jsx#L550).

Effect:

1. Local write path wins for immediate reconciliation.
2. Realtime duplicate refetch is dropped if it lands inside suppression window.
3. Genuine remote changes later still invalidate normally.

## 3.4.4 Same pattern reused across liabilities and loans

1. liabilities mutation wrappers start at [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L306).
2. loans mutation wrappers start at [src/hooks/useLoans.js](src/hooks/useLoans.js#L224).
3. Both suppress local table plus transactions where linked transaction side-effects exist.
4. Both optimistically upsert related transactions for immediate dashboard/list consistency.

---

## 3.5 Query key topology

Key families in active use:

1. transactions family in [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L49).
2. liabilities family in [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L11).
3. loans family in [src/hooks/useLoans.js](src/hooks/useLoans.js#L11).
4. categoryBudgets in [src/hooks/useBudgets.js](src/hooks/useBudgets.js#L7).
5. financialEvents in [src/hooks/useFinancialEvents.js](src/hooks/useFinancialEvents.js#L37).
6. reconciliationReviews in [src/hooks/useReconciliationReviews.js](src/hooks/useReconciliationReviews.js#L31).
7. userCategories in [src/hooks/useUserCategories.js](src/hooks/useUserCategories.js#L10).
8. user-profile keyed by user id in [src/hooks/useAuth.js](src/hooks/useAuth.js#L6).

Guideline for new hooks:

1. Add a stable root key family.
2. Keep dynamic params in a deterministic object.
3. Wire invalidation at family granularity, not per-view hard-coding.

---

## 3.6 Custom hook API reference

This section documents input and output contracts for every custom hook currently used in runtime data flow.

## 3.6.1 Auth layer hooks

### useAuthState

Definition: [src/hooks/useAuth.js](src/hooks/useAuth.js#L9)

Inputs:

1. No arguments.

Returns:

1. user.
2. profile.
3. loading.
4. profileLoading.
5. signInWithGoogle.
6. signInWithEmail email password.
7. signUpWithEmail email password.
8. requestPasswordReset email.
9. updatePassword newPassword.
10. signOut.
11. updateProfile updates.
12. updateDisplayName displayName.

Important internals:

1. onAuthStateChange handler at [src/hooks/useAuth.js](src/hooks/useAuth.js#L78).
2. INITIAL_SESSION logic at [src/hooks/useAuth.js](src/hooks/useAuth.js#L82).
3. TOKEN_REFRESHED fix at [src/hooks/useAuth.js](src/hooks/useAuth.js#L101).
4. 3s safety release at [src/hooks/useAuth.js](src/hooks/useAuth.js#L143).

### useAuth

Definition: [src/context/AuthContext.jsx](src/context/AuthContext.jsx#L35)

Inputs:

1. No arguments.

Returns:

1. Exact AuthProvider context value from useAuthState.

Guard:

1. Throws if called outside provider.

---

## 3.6.2 Transactions hooks and APIs

### useDebounce value ms

Definition: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L167)

Inputs:

1. value any.
2. ms number default 300.

Returns:

1. debounced value.

### useTransactions options

Definition: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L178)

Inputs:

1. type optional.
2. category optional.
3. search optional.
4. limit optional.
5. startDate optional.
6. endDate optional.
7. withCount boolean default false.
8. enabled boolean default true.
9. columns optional select override.

Returns:

1. data array.
2. total number.
3. loading boolean.
4. error.
5. refetch function.

Notes:

1. Broad unfiltered reads can trigger recurring materialization sync.
2. List query uses short gcTime override.

### useRecentTransactions limit

Definition: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L265)

Returns:

1. data array.
2. loading.
3. fetching.
4. error.

### useTransactionDigest days limit options

Definition: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L288)

Returns:

1. data array.
2. loading.
3. error.

### useDailyExpenseTotals days options

Definition: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L319)

Returns:

1. data object keyed by YYYY-MM-DD with summed expense.
2. loading.
3. error.

### useYearDailyExpenseTotals year options

Definition: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L369)

Returns:

1. data object keyed by YYYY-MM-DD.
2. loading.
3. error.

### useTodayExpenses options

Definition: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L418)

Returns:

1. todaySpend number.
2. loading.
3. error.

### useMonthSummary year month options

Definition: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L448)

Returns:

1. data with earned repayments expense investment byCategory byVehicle balance count.
2. loading.
3. fetching.
4. error.

### useYearSummary year options

Definition: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L476)

Returns:

1. data with monthly totals category map vehicle map top5 and count.
2. loading.
3. error.

### useTransactionYearBounds options

Definition: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L557)

Returns:

1. data minYear maxYear.
2. loading.
3. error.

### useRunningBalance year month

Definition: [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L608)

Returns:

1. balance number.
2. loading.
3. fetching.
4. error.

### Transaction mutation helper APIs

Definitions:

1. addTransaction at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L636).
2. updateTransaction at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L667).
3. deleteTransaction at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L812).
4. saveTransactionMutation at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L839).
5. removeTransactionMutation at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L925).

Optimistic cache helpers:

1. optimisticallyUpsertTransactionInCache at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L777).
2. optimisticallyDeleteTransactionFromCache at [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L796).

---

## 3.6.3 Liabilities hooks and APIs

### useLiabilities includePaid enabled

Definition: [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L49)

Returns:

1. pending array.
2. paid array.
3. loading.
4. pendingLoading.
5. paidLoading.
6. error.

### useLiabilitiesByMonth year month options

Definition: [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L89)

Returns:

1. rows array.
2. pending array.
3. paid array.
4. loading.
5. error.

### Liability mutation APIs

Definitions:

1. addLiability at [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L121).
2. markPaid at [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L153).
3. deleteLiability at [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L181).
4. addLiabilityMutation at [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L306).
5. markLiabilityPaidMutation at [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L349).
6. deleteLiabilityMutation at [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L415).

Optimistic helpers:

1. optimisticallyInsertPendingLiability at [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L232).
2. optimisticallyMarkLiabilityPaid at [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L245).
3. optimisticallyDeleteLiabilityFromCache at [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L286).

Invalidation helper:

1. invalidateLiabilityCache at [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L25).

---

## 3.6.4 Loans hooks and APIs

### useLoans enabled

Definition: [src/hooks/useLoans.js](src/hooks/useLoans.js#L53)

Returns:

1. given array.
2. taken array.
3. settled array.
4. loading.
5. settledLoading.
6. error.

### Loan mutation APIs

Definitions:

1. addLoanMutation at [src/hooks/useLoans.js](src/hooks/useLoans.js#L224).
2. recordLoanPaymentMutation at [src/hooks/useLoans.js](src/hooks/useLoans.js#L264).
3. deleteLoanMutation at [src/hooks/useLoans.js](src/hooks/useLoans.js#L360).

Derived helpers:

1. accruedInterest at [src/hooks/useLoans.js](src/hooks/useLoans.js#L392).
2. loanProgress at [src/hooks/useLoans.js](src/hooks/useLoans.js#L398).

Invalidation helper:

1. invalidateLoanCache at [src/hooks/useLoans.js](src/hooks/useLoans.js#L25).

---

## 3.6.5 Budgets hooks and APIs

### useBudgets enabled

Definition: [src/hooks/useBudgets.js](src/hooks/useBudgets.js#L10)

Returns:

1. budgets array.
2. loading.
3. error.

### Budget APIs

Definitions:

1. budgetMap at [src/hooks/useBudgets.js](src/hooks/useBudgets.js#L36).
2. upsertBudget at [src/hooks/useBudgets.js](src/hooks/useBudgets.js#L44).
3. deleteBudget at [src/hooks/useBudgets.js](src/hooks/useBudgets.js#L77).

---

## 3.6.6 Financial event hooks and APIs

### useFinancialEvents limit options

Definition: [src/hooks/useFinancialEvents.js](src/hooks/useFinancialEvents.js#L37)

Returns:

1. data array.
2. loading.
3. error.
4. refetch.

Companion APIs:

1. optimisticallyInsertFinancialEvent at [src/hooks/useFinancialEvents.js](src/hooks/useFinancialEvents.js#L9).
2. invalidateFinancialEvents at [src/hooks/useFinancialEvents.js](src/hooks/useFinancialEvents.js#L32).

---

## 3.6.7 Reconciliation review hooks and APIs

### useReconciliationReviews options

Definition: [src/hooks/useReconciliationReviews.js](src/hooks/useReconciliationReviews.js#L27)

Returns:

1. rows array.
2. reviewedIdSet.
3. linkedIdSet.
4. unavailable boolean.
5. loading.
6. error.
7. refetch.

Write APIs:

1. upsertReconciliationReview at [src/hooks/useReconciliationReviews.js](src/hooks/useReconciliationReviews.js#L76).
2. clearLearnedReconciliationAliases at [src/hooks/useReconciliationReviews.js](src/hooks/useReconciliationReviews.js#L100).
3. reportReconciliationFalsePositive at [src/hooks/useReconciliationReviews.js](src/hooks/useReconciliationReviews.js#L118).

---

## 3.6.8 User category hooks and APIs

### useUserCategories enabled

Definition: [src/hooks/useUserCategories.js](src/hooks/useUserCategories.js#L60)

Returns:

1. customCategories array.
2. loading.
3. error.

Companion exports:

1. USER_CATEGORIES_QUERY_KEY at [src/hooks/useUserCategories.js](src/hooks/useUserCategories.js#L107).
2. createUserCategory at [src/hooks/useUserCategories.js](src/hooks/useUserCategories.js#L113).
3. archiveUserCategory at [src/hooks/useUserCategories.js](src/hooks/useUserCategories.js#L179).

Notable behavior:

1. Registers fetched categories into module-level category registry for non-hook consumers.
2. Gracefully returns empty when table is unavailable in partial migration environments.

---

## 3.6.9 Non-data utility hook used by shell behavior

### useScrollDirection resetKey

Definition: [src/hooks/useScrollDirection.js](src/hooks/useScrollDirection.js#L13)

Returns:

1. scrolledDown boolean.

Though not a data-fetch hook, it is part of runtime shell behavior and affects perceived data browsing flow by collapsing the mobile nav on downward scroll.

---

## 3.7 Mutation timing model by domain

## 3.7.1 Transactions

1. UI disables form.
2. Await saveTransactionMutation.
3. Close sheet on success.
4. Mutation helper reconciles optimistic state and triggers invalidateCache.
5. Realtime event arrives later and is dropped if suppressed.

Anchors:

1. [src/components/transactions/AddTransactionSheet.jsx](src/components/transactions/AddTransactionSheet.jsx#L335)
2. [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L839)
3. [src/App.jsx](src/App.jsx#L549)

## 3.7.2 Bills

1. Bills page awaits addLiabilityMutation and markLiabilityPaidMutation.
2. Row-level optimistic hide and paid-state moves happen in hook layer.
3. Linked transaction cache is upserted for mark-paid flow.

Anchors:

1. [src/pages/Bills.jsx](src/pages/Bills.jsx#L196)
2. [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L349)

## 3.7.3 Loans

1. Loans page awaits addLoanMutation and recordLoanPaymentMutation.
2. Hook layer updates loan lists and injects corresponding repayment transaction.
3. Invalidates loans and transactions families together.

Anchors:

1. [src/pages/Loans.jsx](src/pages/Loans.jsx#L93)
2. [src/hooks/useLoans.js](src/hooks/useLoans.js#L264)

---

## 3.8 Engineering guardrails for adding a new data hook

1. Define a root query key family and document it in the hook module.
2. Use getAuthUserId from [src/lib/authStore.js](src/lib/authStore.js) for ownership-safe sync access.
3. Use placeholderData previousData for list-like surfaces that should avoid flash.
4. Use traceQuery for expensive network paths.
5. Add a family invalidation helper if the domain has multiple related views.
6. If mutation side-effects touch other domains, suppress all affected realtime keys before invalidate.
7. If service worker cache can hold stale endpoint data, call evictSwCacheEntries for impacted paths.
8. Keep mutation wrappers testable with optional __testOverrides as used in transactions and liabilities.

---

## 3.9 Quick hook index

Primary runtime hook entrypoints:

1. [src/hooks/useAuth.js](src/hooks/useAuth.js#L9)
2. [src/context/AuthContext.jsx](src/context/AuthContext.jsx#L35)
3. [src/hooks/useTransactions.js](src/hooks/useTransactions.js#L178)
4. [src/hooks/useLiabilities.js](src/hooks/useLiabilities.js#L49)
5. [src/hooks/useLoans.js](src/hooks/useLoans.js#L53)
6. [src/hooks/useBudgets.js](src/hooks/useBudgets.js#L10)
7. [src/hooks/useFinancialEvents.js](src/hooks/useFinancialEvents.js#L37)
8. [src/hooks/useReconciliationReviews.js](src/hooks/useReconciliationReviews.js#L27)
9. [src/hooks/useUserCategories.js](src/hooks/useUserCategories.js#L60)
10. [src/hooks/useScrollDirection.js](src/hooks/useScrollDirection.js#L13)
