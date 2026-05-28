import { getActiveWalletUserId } from './walletStore'
import { normalizeText } from './bugReportUtils.js'
import { readLocalJson, writeLocalJson } from './safeStorage'

const RECON_REVIEWED_KEY_PREFIX = 'kosha:reconciliation-reviewed-v1:'

function normalizeAmount(value) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num.toFixed(2) : '0.00'
}

function duplicateKey(txn) {
  const description = normalizeText(txn?.description)
  if (!description) return null
  return [
    String(txn?.date || ''),
    String(txn?.type || ''),
    normalizeAmount(txn?.amount),
    description,
  ].join('|')
}

// Returns the per-wallet localStorage key for reviewed reconciliation ids,
// or `null` when no active wallet is known. Returning null prevents the
// pre-fix behaviour where this function would build a literal "…:null"
// key that was shared across every user who signed in on the same device.
function reviewedStorageKey() {
  const userId = getActiveWalletUserId()
  if (!userId) return null
  return `${RECON_REVIEWED_KEY_PREFIX}${userId}`
}

export function getReviewedReconciliationIds() {
  const key = reviewedStorageKey()
  if (!key) return new Set()
  const list = readLocalJson(key, [])
  if (!Array.isArray(list)) return new Set()
  return new Set(list.filter(Boolean))
}

export function setReviewedReconciliationIds(nextIds) {
  const key = reviewedStorageKey()
  if (!key) {
    console.warn('[Kosha] Skipping reconciliation review save — no active wallet yet.')
    return
  }
  const payload = Array.from(nextIds || []).filter(Boolean)
  writeLocalJson(key, payload)
}

export function buildReconciliationInsights(transactions, reviewedIds = new Set()) {
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
    const reviewed = reviewedIds.has(txn?.id)

    return {
      txn,
      duplicateCount,
      flags: {
        missingDescription,
        missingCategory,
        missingPaymentMode,
        potentialDuplicate,
      },
      needsReview,
      reviewed,
    }
  })

  const candidates = items.filter((item) => item.needsReview)
  const queue = candidates.filter((item) => !item.reviewed)

  return {
    items,
    candidates,
    queue,
    counts: {
      total: rows.length,
      candidates: candidates.length,
      queue: queue.length,
      reviewed: candidates.length - queue.length,
      missingCategory: candidates.filter((item) => item.flags.missingCategory).length,
      missingDetails: candidates.filter((item) => item.flags.missingDescription || item.flags.missingPaymentMode).length,
      potentialDuplicate: candidates.filter((item) => item.flags.potentialDuplicate).length,
    },
  }
}
