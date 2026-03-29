import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const targets = [
  'src/components/transactions/AddTransactionSheet.jsx',
  'src/pages/Transactions.jsx',
  'src/pages/Dashboard.jsx',
  'src/pages/Bills.jsx',
  'src/pages/Reconciliation.jsx',
  'src/pages/Onboarding.jsx',
]

const delayedInvalidationPattern = /setTimeout\s*\(\s*\(\)\s*=>\s*\{[\s\S]*invalidate(?:Cache|LiabilityCache)\(/m

for (const rel of targets) {
  const src = read(rel)
  assert(!delayedInvalidationPattern.test(src), `[mutation-path-check] Delayed invalidation still present in ${rel}`)
}

const checks = [
  {
    rel: 'src/components/transactions/AddTransactionSheet.jsx',
    mustInclude: 'saveTransactionMutation',
    msg: 'AddTransactionSheet must use saveTransactionMutation',
  },
  {
    rel: 'src/pages/Transactions.jsx',
    mustInclude: 'removeTransactionMutation',
    msg: 'Transactions page must use removeTransactionMutation',
  },
  {
    rel: 'src/pages/Dashboard.jsx',
    mustInclude: 'removeTransactionMutation',
    msg: 'Dashboard page must use removeTransactionMutation',
  },
  {
    rel: 'src/pages/Bills.jsx',
    mustInclude: 'addLiabilityMutation',
    msg: 'Bills page must use addLiabilityMutation',
  },
  {
    rel: 'src/pages/Bills.jsx',
    mustInclude: 'markLiabilityPaidMutation',
    msg: 'Bills page must use markLiabilityPaidMutation',
  },
  {
    rel: 'src/pages/Bills.jsx',
    mustInclude: 'deleteLiabilityMutation',
    msg: 'Bills page must use deleteLiabilityMutation',
  },
  {
    rel: 'src/pages/Reconciliation.jsx',
    mustInclude: 'saveTransactionMutation',
    msg: 'Reconciliation page must use saveTransactionMutation',
  },
  {
    rel: 'src/pages/Onboarding.jsx',
    mustInclude: 'saveTransactionMutation',
    msg: 'Onboarding page must use saveTransactionMutation',
  },
]

for (const check of checks) {
  const src = read(check.rel)
  assert(src.includes(check.mustInclude), `[mutation-path-check] ${check.msg}`)
}

console.log('[mutation-path-check] PASS')
