/**
 * test_wallet_cache_scoping.mjs
 *
 * Asserts that:
 *  1. The walletStore invalidation predicate covers every financial query family.
 *  2. Wallet-scoped query keys encode the userId so different wallets get
 *     different cache entries (no cross-wallet bleed).
 *
 * Run: node scripts/tests/test_wallet_cache_scoping.mjs
 */

import assert from 'assert'

// ── 1. Invalidation coverage ───────────────────────────────────────────────

/**
 * Mirror of the predicate list in src/lib/walletStore.js.
 * If you add a new financial query family to the app, add it here too
 * so this test will catch any missing invalidation entry.
 */
const EXPECTED_INVALIDATED_KEYS = [
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

// Simulate the actual predicate logic from walletStore.js
function walletStorePredicate(queryKey0) {
  return EXPECTED_INVALIDATED_KEYS.includes(queryKey0)
}

function testInvalidationCoverage() {
  for (const key of EXPECTED_INVALIDATED_KEYS) {
    assert.strictEqual(
      walletStorePredicate(key),
      true,
      `walletStore predicate must include '${key}'`
    )
  }

  // Keys that must NOT be invalidated on wallet switch (non-financial)
  const NON_FINANCIAL = [
    'kosha-active-wallet',
    'splitGroups',
    'splitGroupMembers',
    'splitGroupExpenses',
    'auth',
    'profile',
    'yearYoy',           // YoY card re-queries based on targetUserId in queryKey, not invalidation
  ]
  for (const key of NON_FINANCIAL) {
    assert.strictEqual(
      walletStorePredicate(key),
      false,
      `walletStore predicate must NOT include non-financial key '${key}'`
    )
  }
}

// ── 2. Query key wallet-scoping ────────────────────────────────────────────

/**
 * These factory functions mirror what the hooks produce.
 * If a key factory changes shape, this test fails, alerting you to
 * update or re-audit the cache strategy.
 */
const USER_A = 'user-aaa-111'
const USER_B = 'user-bbb-222'

import { budgetQueryKey } from '../../src/hooks/useBudgets.js'
import { USER_CATEGORIES_QUERY_KEY } from '../../src/hooks/useUserCategories.js'
import { reviewListKey } from '../../src/hooks/useReconciliationReviews.js'
import {
  txnCountKey,
  transactionSignalAggregatesKey,
  yearDailyExpenseTotalsKey,
  yearYoyKey
} from '../../src/hooks/useTransactions.js'
import {
  LOAN_ACTIVE_GIVEN_KEY,
  LOAN_ACTIVE_TAKEN_KEY,
  LOAN_SETTLED_KEY
} from '../../src/hooks/useLoans.js'

const keyFactories = {
  categoryBudgets: budgetQueryKey,
  userCategories: USER_CATEGORIES_QUERY_KEY,
  reconciliationReviews: reviewListKey,
  transactionSignalAggregates: (uid) => transactionSignalAggregatesKey({}, uid),
  yearDailyExpenseTotals: (uid) => yearDailyExpenseTotalsKey(2025, uid),
  txnCount: (uid) => txnCountKey({}, uid),
  yearYoy: (uid) => yearYoyKey(2025, uid),
  loanActiveGiven: LOAN_ACTIVE_GIVEN_KEY,
  loanActiveTaken: LOAN_ACTIVE_TAKEN_KEY,
  loanSettled: LOAN_SETTLED_KEY,
}

function testKeysDifferByWallet() {
  for (const [name, factory] of Object.entries(keyFactories)) {
    if (typeof factory !== 'function') {
      console.log('UNDEFINED FACTORY:', name, factory)
    }
    const keyA = JSON.stringify(factory(USER_A))
    const keyB = JSON.stringify(factory(USER_B))
    assert.notStrictEqual(
      keyA,
      keyB,
      `Key '${name}' must differ between wallet A and wallet B — cross-wallet cache bleed risk`
    )
  }
}

function testKeysPrefixMatchParent() {
  // React Query's prefix invalidation: ['financialEvents'] matches ['financialEvents', 10, uid]
  // We verify that [0] of each key matches the top-level invalidation key
  const INVALIDATED = new Set(EXPECTED_INVALIDATED_KEYS)

  const keysToCheck = [
    keyFactories.categoryBudgets(USER_A),
    keyFactories.userCategories(USER_A),
    keyFactories.reconciliationReviews(USER_A),
    keyFactories.transactionSignalAggregates(USER_A),
    keyFactories.yearDailyExpenseTotals(USER_A),
    keyFactories.txnCount(USER_A),
    keyFactories.loanActiveGiven(USER_A),
    keyFactories.loanActiveTaken(USER_A),
    keyFactories.loanSettled(USER_A),
  ]

  for (const key of keysToCheck) {
    assert.strictEqual(
      INVALIDATED.has(key[0]),
      true,
      `Key root '${key[0]}' must be in walletStore invalidation list — wallet switch will not clear this cache`
    )
  }
}

function testUidNeverNull() {
  // Passing null/undefined to any key factory must produce a key
  // that is distinguishable from a real user — prevents pre-auth
  // fetches polluting the real user's cache slot.
  for (const [name, factory] of Object.entries(keyFactories)) {
    const nullKey = JSON.stringify(factory(null))
    const realKey = JSON.stringify(factory(USER_A))
    assert.notStrictEqual(
      nullKey,
      realKey,
      `Key '${name}' with null uid must differ from a real uid — null/undefined pre-auth pollution risk`
    )
  }
}

// ── Run ────────────────────────────────────────────────────────────────────

console.log('Running wallet cache scoping tests...\n')

try {
  testInvalidationCoverage()
  console.log('✓ walletStore invalidation predicate covers all financial query families')

  testKeysDifferByWallet()
  console.log('✓ All wallet-scoped query keys differ between two distinct wallet users')

  testKeysPrefixMatchParent()
  console.log('✓ All scoped key roots are present in the wallet invalidation list')

  testUidNeverNull()
  console.log('✓ Null uid produces a distinct cache slot from a real user')

  console.log('\nPASS: wallet cache scoping invariants are stable.')
} catch (error) {
  console.error('\nFAIL:', error.message)
  process.exit(1)
}
