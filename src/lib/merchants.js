const STOP_WORDS = new Set(['paid', 'for', 'to', 'at', 'from', 'via', 'on', 'in', 'the', 'and', 'of', 'with'])

// Turns an expense description into a payee key, so "Swiggy order #4411" and
// "swiggy" group together. Letters in any script are kept, with their vowel
// signs (\p{M}), which Hindi, Tamil and other Indian scripts rely on.
export function merchantKey(description) {
  return String(description || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word) && !/^\p{N}+$/u.test(word))
    .join(' ')
}

function countsAsMerchantSpend(row) {
  if (!row || row.type !== 'expense' || row.is_repayment) return false
  const amount = Number(row.amount || 0)
  return Number.isFinite(amount) && amount > 0
}

// Groups expenses by payee. Repayments are left out: paying a friend back is
// not a merchant habit. `totalExpense` is the base for "% of spend".
export function groupMerchants(rows) {
  const merchants = new Map()
  let totalExpense = 0

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!countsAsMerchantSpend(row)) continue
    const amount = Number(row.amount)
    totalExpense += amount

    const description = String(row.description || '').trim().replace(/\s+/g, ' ')
    const key = merchantKey(description)
    if ([...key].length < 2) continue

    const existing = merchants.get(key)
    if (existing) {
      existing.total += amount
      existing.count += 1
      if (amount > existing.maxTxn) existing.maxTxn = amount
      continue
    }
    merchants.set(key, { key, label: description, queryText: description, total: amount, count: 1, maxTxn: amount })
  }

  return { merchants: [...merchants.values()], totalExpense }
}

// Payees seen at least twice, biggest total first.
export function repeatMerchants(rows) {
  const { merchants, totalExpense } = groupMerchants(rows)
  return {
    repeats: merchants.filter((m) => m.count >= 2).sort((a, b) => b.total - a.total),
    merchants,
    totalExpense,
  }
}
