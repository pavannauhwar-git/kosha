import { getAuthUserId } from './authStore'
import { normalizeText } from './bugReportUtils'

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

function reviewedStorageKey() {
  return `${RECON_REVIEWED_KEY_PREFIX}${getAuthUserId()}`
}

export function getReviewedReconciliationIds() {
  try {
    const raw = localStorage.getItem(reviewedStorageKey())
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return new Set()
    return new Set(list.filter(Boolean))
  } catch {
    return new Set()
  }
}

export function setReviewedReconciliationIds(nextIds) {
  try {
    const payload = Array.from(nextIds || []).filter(Boolean)
    localStorage.setItem(reviewedStorageKey(), JSON.stringify(payload))
  } catch {
    // no-op
  }
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