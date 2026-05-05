import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const rules = [
  {
    rel: 'src/components/transactions/AddTransactionSheet.jsx',
    mustInclude: ['saveTransactionMutation'],
    mustExclude: ['addTransaction(', 'updateTransaction(', 'invalidateCache('],
  },
  {
    rel: 'src/pages/Transactions.jsx',
    mustInclude: ['removeTransactionMutation'],
    mustExclude: ['deleteTransaction(', 'invalidateCache('],
  },
  {
    rel: 'src/pages/Dashboard.jsx',
    mustInclude: ['removeTransactionMutation'],
    mustExclude: ['deleteTransaction(', 'invalidateCache('],
  },
  {
    rel: 'src/pages/Reconciliation.jsx',
    mustInclude: ['saveTransactionMutation'],
    mustExclude: ['updateTransaction(', 'invalidateCache('],
  },
  {
    rel: 'src/pages/Onboarding.jsx',
    mustInclude: ['saveTransactionMutation'],
    mustExclude: ['addTransaction('],
  },
  {
    rel: 'src/components/obligations/Bills.jsx',
    mustInclude: ['addLiabilityMutation', 'markLiabilityPaidMutation', 'deleteLiabilityMutation'],
    mustExclude: ['addLiability(', 'markPaid(', 'deleteLiability(', 'invalidateLiabilityCache(', 'invalidateTransactionCache('],
  },
]

for (const rule of rules) {
  const src = read(rule.rel)

  for (const token of rule.mustInclude) {
    assert(src.includes(token), `[mutation-integration] Missing ${token} in ${rule.rel}`)
  }

  for (const token of rule.mustExclude) {
    assert(!src.includes(token), `[mutation-integration] Found forbidden ${token} in ${rule.rel}`)
  }
}

console.log('[mutation-integration] PASS')
