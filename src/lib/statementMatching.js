function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

const NOISE_TOKENS = new Set([
  'upi', 'imps', 'neft', 'rtgs', 'txn', 'ref', 'utr', 'vpa', 'bank',
  'debit', 'credit', 'dr', 'cr', 'purchase', 'payment', 'card', 'pos',
  'merchant', 'to', 'from', 'transfer', 'x', 'xx', 'xxx', 'xxxx',
])

function cleanMerchantText(value) {
  const normalized = normalizeText(value)
    .replace(/[\[\]()]/g, ' ')
    .replace(/\b(?:upi|imps|neft|rtgs)\/[^\s]+/g, ' ')
    .replace(/\b[a-z]*\d+[a-z\d]*\b/g, ' ')
    .replace(/[|,:;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
}

function tokenize(value) {
  return cleanMerchantText(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !NOISE_TOKENS.has(token))
}

function parseAmount(text) {
  if (!text) return null
  const cleaned = String(text).replace(/,/g, '')
  const hasBrackets = /^\s*\(.+\)\s*$/.test(cleaned)
  const match = cleaned.match(/[-+]?\d+(?:\.\d{1,2})?/)
  if (!match) return null
  let amount = Number(match[0])
  if (hasBrackets) amount = -Math.abs(amount)
  if (/\bdr\b/i.test(cleaned)) amount = -Math.abs(amount)
  if (/\bcr\b/i.test(cleaned)) amount = Math.abs(amount)
  return Number.isFinite(amount) ? Math.abs(amount) : null
}

function inferDirection(text) {
  const normalized = normalizeText(text)
  if (/\b(?:salary|credit|refund|interest|cashback|received|cr)\b/.test(normalized)) return 'credit'
  if (/\b(?:debit|purchase|spent|paid|bill|dr|atm|withdrawal)\b/.test(normalized)) return 'debit'
  return 'unknown'
}

function parseDate(text) {
  if (!text) return null
  const value = String(text).trim()

  const iso = value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    if (year > 1990 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  const dmy = value.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const yearRaw = Number(dmy[3])
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
    if (year > 1990 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  return null
}

function dateDistanceDays(a, b) {
  if (!a || !b) return 999
  const aTime = new Date(`${a}T00:00:00`).getTime()
  const bTime = new Date(`${b}T00:00:00`).getTime()
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return 999
  return Math.round(Math.abs(aTime - bTime) / (1000 * 60 * 60 * 24))
}

function overlapScore(a, b) {
  if (!a.size || !b.size) return 0
  let overlap = 0
  for (const token of a) {
    if (b.has(token)) overlap += 1
  }
  return overlap / Math.max(a.size, b.size)
}

export function parseStatementLines(rawText) {
  const lines = String(rawText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line, idx) => {
    const parts = line.split(/[|,\t]/).map((part) => part.trim()).filter(Boolean)
    const date = parseDate(parts[0] || line)
    const amount = parseAmount(parts[parts.length - 1] || line)

    let description = ''
    if (parts.length >= 3) description = parts.slice(1, -1).join(' ')
    else if (parts.length === 2) description = parts[1]
    else description = line

    return {
      id: `stmt-${idx + 1}`,
      line,
      date,
      amount,
      direction: inferDirection(line),
      description: description.trim(),
      tokens: new Set(tokenize(description)),
      isValid: !!date && Number.isFinite(amount),
    }
  })
}

function buildTransactionIndex(transactions) {
  return (Array.isArray(transactions) ? transactions : []).map((txn) => ({
    txn,
    tokens: new Set(tokenize(txn?.description || '')),
    amount: Number(txn?.amount || 0),
    type: String(txn?.type || 'expense'),
  }))
}

function typeCompatibility(entryDirection, txnType) {
  if (entryDirection === 'unknown') return 0.6
  if (entryDirection === 'credit') return txnType === 'income' ? 1 : 0.2
  if (entryDirection === 'debit') return txnType === 'expense' || txnType === 'investment' ? 1 : 0.2
  return 0.6
}

function scoreCandidate(entry, candidate) {
  const amountDiff = Math.abs((entry.amount || 0) - Math.abs(candidate.amount || 0))
  if (amountDiff > 2) return null

  const days = dateDistanceDays(entry.date, candidate.txn?.date)
  if (days > 7) return null

  const descriptionScore = overlapScore(entry.tokens, candidate.tokens)
  const dateScore = Math.max(0, 1 - days / 7)
  const amountScore = Math.max(0, 1 - amountDiff / 2)
  const txnTypeScore = typeCompatibility(entry.direction, candidate.type)
  const finalScore = Number((
    0.45 * dateScore +
    0.3 * descriptionScore +
    0.2 * amountScore +
    0.05 * txnTypeScore
  ).toFixed(3))

  return {
    txn: candidate.txn,
    score: finalScore,
    days,
    amountDiff,
  }
}

export function matchStatementEntries(statementEntries, transactions) {
  const txnIndex = buildTransactionIndex(transactions)

  return (Array.isArray(statementEntries) ? statementEntries : []).map((entry) => {
    if (!entry?.isValid) {
      return {
        entry,
        candidates: [],
        best: null,
        confidence: 'low',
      }
    }

    const scored = txnIndex
      .map((candidate) => scoreCandidate(entry, candidate))
      .filter(Boolean)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (a.days !== b.days) return a.days - b.days
        if (a.amountDiff !== b.amountDiff) return a.amountDiff - b.amountDiff
        return String(b.txn?.date || '').localeCompare(String(a.txn?.date || ''))
      })
      .slice(0, 3)

    const best = scored[0] || null
    let confidence = 'low'
    if (best && best.score >= 0.78) confidence = 'high'
    else if (best && best.score >= 0.55) confidence = 'medium'

    return {
      entry,
      candidates: scored,
      best,
      confidence,
    }
  })
}