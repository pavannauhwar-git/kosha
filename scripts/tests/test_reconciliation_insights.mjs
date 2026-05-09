/**
 * test_reconciliation_insights.mjs
 * Unit tests for the buildReconciliationInsights pure function logic.
 * Run: node scripts/tests/test_reconciliation_insights.mjs
 */
import assert from 'assert'

// ── Inline the pure logic (no React/Supabase deps) ─────────────────────────

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeAmount(value) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num.toFixed(2) : '0.00'
}

function duplicateKey(txn) {
  const description = normalizeText(txn?.description)
  if (!description) return null
  return [String(txn?.date || ''), String(txn?.type || ''), normalizeAmount(txn?.amount), description].join('|')
}

function buildReconciliationInsights(transactions, reviewedIds = new Set()) {
  const rows = Array.isArray(transactions) ? transactions : []
  const duplicateCounts = new Map()
  for (const txn of rows) {
    const key = duplicateKey(txn)
    if (!key) continue
    duplicateCounts.set(key, (duplicateCounts.get(key) || 0) + 1)
  }
  const items = rows.map((txn) => {
    const key = duplicateKey(txn)
    const duplicateCount = key ? (duplicateCounts.get(key) || 0) : 0
    const missingDescription = !normalizeText(txn?.description)
    const missingCategory = txn?.type === 'expense' && !normalizeText(txn?.category)
    const missingPaymentMode = !normalizeText(txn?.payment_mode)
    const potentialDuplicate = duplicateCount > 1
    const needsReview = missingDescription || missingCategory || missingPaymentMode || potentialDuplicate
    return { txn, duplicateCount, flags: { missingDescription, missingCategory, missingPaymentMode, potentialDuplicate }, needsReview, reviewed: reviewedIds.has(txn?.id) }
  })
  const candidates = items.filter(i => i.needsReview)
  const queue = candidates.filter(i => !i.reviewed)
  return {
    items, candidates, queue,
    counts: {
      total: rows.length, candidates: candidates.length, queue: queue.length,
      reviewed: candidates.length - queue.length,
      missingCategory: candidates.filter(i => i.flags.missingCategory).length,
      missingDetails: candidates.filter(i => i.flags.missingDescription || i.flags.missingPaymentMode).length,
      potentialDuplicate: candidates.filter(i => i.flags.potentialDuplicate).length,
    },
  }
}

// ── Fixture ────────────────────────────────────────────────────────────────

let _id = 0
function txn(overrides = {}) {
  return { id: `t${++_id}`, date: '2025-03-01', type: 'expense', description: 'Swiggy', category: 'food', payment_mode: 'upi', amount: 250, ...overrides }
}

// ── Tests ──────────────────────────────────────────────────────────────────

function testEmpty() {
  const r = buildReconciliationInsights([])
  assert.strictEqual(r.counts.total, 0)
  assert.strictEqual(r.counts.candidates, 0)
  const r2 = buildReconciliationInsights(null)
  assert.strictEqual(r2.counts.total, 0)
}

function testClean() {
  const r = buildReconciliationInsights([txn()])
  assert.strictEqual(r.counts.candidates, 0)
  assert.strictEqual(r.items[0].needsReview, false)
}

function testMissingCategory() {
  const r = buildReconciliationInsights([txn({ category: '' })])
  assert.strictEqual(r.items[0].flags.missingCategory, true)
  assert.strictEqual(r.counts.missingCategory, 1)
  // Income without category must NOT flag
  const r2 = buildReconciliationInsights([txn({ type: 'income', category: '' })])
  assert.strictEqual(r2.items[0].flags.missingCategory, false)
}

function testMissingMode() {
  const r = buildReconciliationInsights([txn({ payment_mode: '' })])
  assert.strictEqual(r.items[0].flags.missingPaymentMode, true)
  assert.strictEqual(r.counts.missingDetails, 1)
}

function testDuplicates() {
  const a = txn({ id: 'd1', description: 'Swiggy', amount: 250, date: '2025-03-01' })
  const b = txn({ id: 'd2', description: 'Swiggy', amount: 250, date: '2025-03-01' })
  const c = txn({ id: 'u1', description: 'Netflix', amount: 199 })
  const r = buildReconciliationInsights([a, b, c])
  assert.strictEqual(r.items.find(i => i.txn.id === 'd1').flags.potentialDuplicate, true)
  assert.strictEqual(r.items.find(i => i.txn.id === 'd2').flags.potentialDuplicate, true)
  assert.strictEqual(r.items.find(i => i.txn.id === 'u1').flags.potentialDuplicate, false)
  assert.strictEqual(r.counts.potentialDuplicate, 2)
}

function testReviewed() {
  const a = txn({ id: 'r1', category: '' })
  const b = txn({ id: 'r2', category: '' })
  const r = buildReconciliationInsights([a, b], new Set(['r1']))
  assert.strictEqual(r.counts.candidates, 2)
  assert.strictEqual(r.counts.queue, 1)
  assert.strictEqual(r.counts.reviewed, 1)
}

function testCountInvariant() {
  const t = [txn({ category: '' }), txn({ payment_mode: '' }), txn(), txn({ category: '' })]
  const reviewed = new Set([t[3].id])
  const r = buildReconciliationInsights(t, reviewed)
  assert.strictEqual(r.counts.queue + r.counts.reviewed, r.counts.candidates, 'queue + reviewed must equal candidates')
}

// ── Run ────────────────────────────────────────────────────────────────────

console.log('Running reconciliation insights tests...\n')
try {
  testEmpty();   console.log('✓ Empty / null input')
  testClean();   console.log('✓ Clean transaction — no candidates')
  testMissingCategory(); console.log('✓ Missing category (expense only)')
  testMissingMode();     console.log('✓ Missing payment_mode')
  testDuplicates();      console.log('✓ Duplicate detection by fingerprint')
  testReviewed();        console.log('✓ Reviewed state splits queue correctly')
  testCountInvariant();  console.log('✓ queue + reviewed === candidates invariant')
  console.log('\nPASS: reconciliation insights test suite is healthy.')
} catch (e) {
  console.error('\nFAIL:', e.message)
  process.exit(1)
}
