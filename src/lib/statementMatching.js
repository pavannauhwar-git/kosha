import { normalizeText } from './bugReportUtils.js'
import { dateDistanceDays } from './dayKey.js'

const NOISE_TOKENS = new Set([
  'upi', 'imps', 'neft', 'rtgs', 'txn', 'ref', 'utr', 'vpa', 'bank',
  'debit', 'credit', 'dr', 'cr', 'purchase', 'payment', 'card', 'pos',
  'merchant', 'to', 'from', 'transfer', 'x', 'xx', 'xxx', 'xxxx',
])

function cleanMerchantText(value) {
  const normalized = normalizeText(value)
    .replace(/[\[\]()]/g, ' ')
    .replace(/\b(?:upi|imps|neft|rtgs)\/[^\s]+/g, ' ')
    .replace(/\b[a-z]*\d{8,}[a-z\d]*\b/g, ' ')
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

// Returns { amount, signedHint } where amount is always positive and
// signedHint is 'debit' | 'credit' | 'unknown' derived from bracket/DR/CR
// notation. Callers decide how to use the hint.
function parseAmount(text) {
  if (!text) return null
  const cleaned = String(text).replace(/,/g, '').replace(/₹/g, '').replace(/\u2212/g, '-')
  const hasBrackets = /^\s*\(.+\)\s*$/.test(cleaned)
  const match = cleaned.match(/[-+]?\d+(?:\.\d{1,2})?/)
  if (!match) return null
  const amount = Number.parseFloat(match[0])
  if (!Number.isFinite(amount)) return null
  let signedHint = 'unknown'
  if (hasBrackets || /\bdr\b/i.test(cleaned) || amount < 0) signedHint = 'debit'
  else if (/\bcr\b/i.test(cleaned)) signedHint = 'credit'
  return { amount: Math.abs(amount), signedHint }
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

  const iso = value.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    if (year > 1990 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  const dmy = value.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const yearRaw = Number(dmy[3])
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
    if (year > 1990 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  const dMmY = value.match(/(\d{1,2})[\s-]([a-zA-Z]{3})[\s-]?(\d{2,4})/)
  if (dMmY) {
    const day = Number(dMmY[1])
    const monthStr = dMmY[2].toLowerCase()
    const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
    const month = months[monthStr]
    const yearRaw = Number(dMmY[3])
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
    if (month && year > 1990 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  return null
}

function overlapScore(a, b) {
  if (!a.size || !b.size) return 0
  let overlap = 0
  for (const token of a) {
    if (b.has(token)) overlap += 1
  }
  return overlap / Math.max(a.size, b.size)
}

function parseCsvLine(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        // RFC 4180: a doubled quote inside a quoted field is a literal quote.
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  if (parts.length <= 1 && (line.includes('\t') || line.includes('|'))) {
    return line.split(/[\t|]/).map(p => p.trim()).filter(Boolean);
  }
  return parts.filter(Boolean);
}

export function parseStatementLines(rawText) {
  const lines = String(rawText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line, idx) => {
    const parts = parseCsvLine(line)
    const date = parseDate(parts[0] || line)
    const parsedAmount = parseAmount(parts[parts.length - 1] || line)
    const amount = parsedAmount?.amount ?? null

    let description = ''
    if (parts.length >= 3) description = parts.slice(1, -1).join(' ')
    else if (parts.length === 2) description = parts[1]
    else description = line

    // Prefer the signed hint from the amount notation (brackets / DR / CR);
    // fall back to keyword inference from the whole line.
    const direction = parsedAmount && parsedAmount.signedHint !== 'unknown'
      ? parsedAmount.signedHint
      : inferDirection(line)

    return {
      id: `stmt-${idx + 1}`,
      line,
      date,
      amount,
      direction,
      description: description.trim(),
      tokens: new Set(tokenize(description)),
      isValid: !!date && Number.isFinite(amount),
    }
  })
}

function buildAliasHintsMap(aliases) {
  const hints = new Map()
  for (const alias of aliases || []) {
    const aliasTokens = tokenize(alias?.statement || '')
    const canonicalTokens = tokenize(alias?.canonical || '')
    if (!aliasTokens.length || !canonicalTokens.length) continue

    for (const aliasToken of aliasTokens) {
      if (!hints.has(aliasToken)) hints.set(aliasToken, new Set())
      const bucket = hints.get(aliasToken)
      for (const canonicalToken of canonicalTokens) {
        bucket.add(canonicalToken)
      }
    }
  }
  return hints
}

export function buildLearnedStatementAliases(reviewRows, transactions, demotedMerchants = new Set()) {
  const txById = new Map((Array.isArray(transactions) ? transactions : []).map((txn) => [txn?.id, txn]))
  const aliases = []

  for (const row of reviewRows || []) {
    if (row?.status !== 'linked') continue
    if (!row?.statement_line || !row?.transaction_id) continue
    const txn = txById.get(row.transaction_id)
    if (!txn?.description) continue

    const parsed = parseStatementLines(row.statement_line)
    const statementDescription = parsed?.[0]?.description || row.statement_line
    
    // Skip demoted aliases — they failed repeatedly in recent period
    const merchant = statementDescription.split(/[,|]/)[0]?.trim() || statementDescription
    if (demotedMerchants.has(merchant)) continue

    const entry = parsed?.[0]
    if (entry) {
       const cand = {
         txn,
         tokens: new Set(tokenize(txn.description)),
         amount: Number(txn.amount || 0),
         type: String(txn.type || 'expense'),
       }
       const scoreObj = scoreCandidate(entry, cand)
       if (!scoreObj || scoreObj.score < 0.75) continue
    }

    aliases.push({
      statement: statementDescription,
      canonical: txn.description,
    })
  }

  return aliases
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

function scoreCandidate(entry, candidate, aliasHints = new Map()) {
  const amountDiff = Math.abs((entry.amount || 0) - Math.abs(candidate.amount || 0))
  if (amountDiff > 2) return null

  const days = dateDistanceDays(entry.date, candidate.txn?.date)
  if (!Number.isFinite(days) || days > 7) return null

  const descriptionScore = overlapScore(entry.tokens, candidate.tokens)
  const expandedTokens = new Set(entry.tokens)
  for (const token of entry.tokens) {
    const linked = aliasHints.get(token)
    if (!linked) continue
    for (const synonym of linked) expandedTokens.add(synonym)
  }
  const aliasBoostScore = overlapScore(expandedTokens, candidate.tokens)
  const dateScore = Math.max(0, 1 - days / 7)
  const amountScore = Math.max(0, 1 - amountDiff / 2)
  const txnTypeScore = typeCompatibility(entry.direction, candidate.type)
  const finalScore = Number((
    0.4 * dateScore +
    0.25 * descriptionScore +
    0.1 * aliasBoostScore +
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

export function matchStatementEntries(statementEntries, transactions, options = {}) {
  const txnIndex = buildTransactionIndex(transactions)
  const aliasHints = buildAliasHintsMap(options?.aliases)

  const entriesScored = (Array.isArray(statementEntries) ? statementEntries : []).map((entry) => {
    if (!entry?.isValid) {
      return { entry, allScored: [] }
    }

    const scored = txnIndex
      .map((candidate) => scoreCandidate(entry, candidate, aliasHints))
      .filter(Boolean)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (a.days !== b.days) return a.days - b.days
        if (a.amountDiff !== b.amountDiff) return a.amountDiff - b.amountDiff
        return String(b.txn?.date || '').localeCompare(String(a.txn?.date || ''))
      })

    return { entry, allScored: scored }
  })

  const matchedTxnIds = new Set()

  return entriesScored.map(({ entry, allScored }) => {
    if (!allScored.length) {
      return {
        entry,
        candidates: [],
        best: null,
        confidence: 'low',
      }
    }

    const candidates = allScored.filter(c => !matchedTxnIds.has(c.txn.id)).slice(0, 3)
    const best = candidates[0] || null
    let confidence = 'low'
    if (best && best.score >= 0.78) confidence = 'high'
    else if (best && best.score >= 0.55) confidence = 'medium'

    if (best) {
      matchedTxnIds.add(best.txn.id)
    }

    return {
      entry,
      candidates,
      best,
      confidence,
    }
  })
}