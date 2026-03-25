import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const txSrc = read('src/hooks/useTransactions.js')
const liSrc = read('src/hooks/useLiabilities.js')

function assertRollbackContract(src, fnName, snapshotToken, restoreToken) {
  const fnStart = src.indexOf(`export async function ${fnName}`)
  assert(fnStart >= 0, `[rollback-contract] ${fnName} not found`)

  const fnBody = src.slice(fnStart, Math.min(src.length, fnStart + 2600))

  assert(fnBody.includes(snapshotToken), `[rollback-contract] ${fnName} missing snapshot token: ${snapshotToken}`)
  assert(fnBody.includes('try {'), `[rollback-contract] ${fnName} missing try block`)
  assert(fnBody.includes('catch (error)'), `[rollback-contract] ${fnName} missing catch block`)
  assert(fnBody.includes(restoreToken), `[rollback-contract] ${fnName} missing restore token: ${restoreToken}`)

  const tryIdx = fnBody.indexOf('try {')
  const catchIdx = fnBody.indexOf('catch (error)')
  const restoreIdx = fnBody.indexOf(restoreToken)

  assert(catchIdx > tryIdx, `[rollback-contract] ${fnName} catch appears before try`)
  assert(restoreIdx > catchIdx, `[rollback-contract] ${fnName} restore not in catch path`)
}

assert(txSrc.includes('__testOverrides'), '[rollback-contract] transactions hooks missing __testOverrides support')
assert(liSrc.includes('__testOverrides'), '[rollback-contract] liabilities hooks missing __testOverrides support')

assertRollbackContract(txSrc, 'saveTransactionMutation', 'snapshotCacheFamilies', 'restoreCacheSnapshot(snapshot)')
assertRollbackContract(txSrc, 'removeTransactionMutation', 'snapshotCacheFamilies', 'restoreCacheSnapshot(snapshot)')
assertRollbackContract(liSrc, 'addLiabilityMutation', 'snapshotLiabilityCaches', 'restoreLiabilitySnapshot(snapshot)')
assertRollbackContract(liSrc, 'markLiabilityPaidMutation', 'snapshotLiabilityCaches', 'restoreLiabilitySnapshot(snapshot)')
assertRollbackContract(liSrc, 'deleteLiabilityMutation', 'snapshotLiabilityCaches', 'restoreLiabilitySnapshot(snapshot)')

console.log('[rollback-contract] PASS')
