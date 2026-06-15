import { fromRupees, toRupees, divEvenly } from './paise.js'

export function buildEqualSplits(memberIds, amount) {
  const validIds = (memberIds || []).filter(Boolean)
  const total = fromRupees(amount)
  if (!validIds.length || total === 0n) return []

  const shares = divEvenly(total, validIds.length)
  return validIds.map((memberId, i) => ({
    member_id: memberId,
    share: toRupees(shares[i])
  }))
}

export function buildExactSplits(entries, amount) {
  const total = fromRupees(amount)
  const mapped = (entries || [])
    .map((entry) => ({
      member_id: entry?.member_id,
      sharePaise: fromRupees(entry?.share),
    }))
    .filter((entry) => entry.member_id)

  const sum = mapped.reduce((acc, entry) => acc + entry.sharePaise, 0n)
  if (sum !== total) {
    throw new Error('Exact splits must add up to the full amount.')
  }

  return mapped.map(e => ({
    member_id: e.member_id,
    share: toRupees(e.sharePaise)
  }))
}

export function buildPercentSplits(entries, amount) {
  const total = fromRupees(amount)
  const mapped = (entries || [])
    .map((entry) => ({
      member_id: entry?.member_id,
      percent: Number(entry?.percent || 0),
    }))
    .filter((entry) => entry.member_id && entry.percent > 0)

  const basisPointsSum = mapped.reduce((acc, entry) => acc + Math.round(entry.percent * 100), 0)
  if (basisPointsSum !== 10000) {
    throw new Error('Percentage splits must total exactly 100%.')
  }

  const rawShares = mapped.map(entry => {
    const bp = BigInt(Math.round(entry.percent * 100))
    const exactShare = (total * bp) / 10000n
    return { ...entry, exactShare, bp }
  })
  
  const exactSum = rawShares.reduce((acc, e) => acc + e.exactShare, 0n)
  const delta = total - exactSum
  const sign = delta < 0n ? -1n : 1n;
  const absDelta = delta < 0n ? -delta : delta;
  
  for (let i = 0; i < Number(absDelta) && i < rawShares.length; i++) {
    rawShares[i].exactShare += sign;
  }
  
  return rawShares.map(e => ({
    member_id: e.member_id,
    percent: e.percent,
    share: toRupees(e.exactShare)
  }))
}

export function buildShareSplits(entries, amount) {
  const total = fromRupees(amount)
  const mapped = (entries || [])
    .map((entry) => ({
      member_id: entry?.member_id,
      shares: Number(entry?.shares || 0),
    }))
    .filter((entry) => entry.member_id && entry.shares > 0)

  const totalShares = mapped.reduce((acc, entry) => acc + entry.shares, 0)
  if (totalShares <= 0) {
    throw new Error('At least one share entry is required.')
  }

  const totalSharesBig = BigInt(Math.round(totalShares * 10000))
  
  const rawShares = mapped.map(entry => {
    const sBig = BigInt(Math.round(entry.shares * 10000))
    const exactShare = (total * sBig) / totalSharesBig
    return { ...entry, exactShare }
  })
  
  const exactSum = rawShares.reduce((acc, e) => acc + e.exactShare, 0n)
  const delta = total - exactSum
  const sign = delta < 0n ? -1n : 1n;
  const absDelta = delta < 0n ? -delta : delta;
  
  for (let i = 0; i < Number(absDelta) && i < rawShares.length; i++) {
    rawShares[i].exactShare += sign;
  }
  
  return rawShares.map(e => ({
    member_id: e.member_id,
    shares: e.shares,
    share: toRupees(e.exactShare)
  }))
}

export function computeMemberBalances(members, expenses, settlements) {
  const balanceByMember = new Map()
  const memberSet = new Set()

  for (const member of members || []) {
    if (!member?.id) continue
    balanceByMember.set(member.id, 0n)
    memberSet.add(member.id)
  }

  for (const expense of expenses || []) {
    const amount = fromRupees(expense?.amount)
    const payerId = expense?.paid_by_member_id
    
    if (payerId && !memberSet.has(payerId)) {
      throw new Error(`Payer ${payerId} is missing from group members`)
    }

    if (payerId) {
      balanceByMember.set(payerId, (balanceByMember.get(payerId) || 0n) + amount)
    }

    const splits = Array.isArray(expense?.split_expense_splits) ? expense.split_expense_splits : []
    for (const split of splits) {
      const memberId = split?.member_id
      const share = fromRupees(split?.share)
      if (!memberId) continue
      if (!memberSet.has(memberId)) {
        throw new Error(`Split member ${memberId} is missing from group members`)
      }
      balanceByMember.set(memberId, (balanceByMember.get(memberId) || 0n) - share)
    }
  }

  for (const settlement of settlements || []) {
    const amount = fromRupees(settlement?.amount)
    const payerId = settlement?.payer_member_id
    const payeeId = settlement?.payee_member_id

    if (payerId && !memberSet.has(payerId)) {
      throw new Error(`Settlement payer ${payerId} is missing from group members`)
    }
    if (payeeId && !memberSet.has(payeeId)) {
      throw new Error(`Settlement payee ${payeeId} is missing from group members`)
    }

    if (payerId) {
      balanceByMember.set(payerId, (balanceByMember.get(payerId) || 0n) + amount)
    }
    if (payeeId) {
      balanceByMember.set(payeeId, (balanceByMember.get(payeeId) || 0n) - amount)
    }
  }

  const floatMap = new Map()
  for (const [id, bal] of balanceByMember.entries()) {
    floatMap.set(id, toRupees(bal))
  }
  return floatMap
}

export function buildSimplifiedTransfers(balancesWithMembers) {
  const creditors = []
  const debtors = []

  for (const row of balancesWithMembers || []) {
    const net = fromRupees(row?.net)
    if (net > 0n) creditors.push({ member: row.member, remaining: net })
    else if (net < 0n) debtors.push({ member: row.member, remaining: -net })
  }

  creditors.sort((a, b) => (b.remaining > a.remaining ? 1 : b.remaining < a.remaining ? -1 : 0))
  debtors.sort((a, b) => (b.remaining > a.remaining ? 1 : b.remaining < a.remaining ? -1 : 0))

  // Invariant: creditor and debtor totals must match, else the greedy loop
  // leaves a residual and the settlement plan won't zero out. Report without
  // breaking the screen.
  const credSum = creditors.reduce((acc, c) => acc + c.remaining, 0n)
  const debtSum = debtors.reduce((acc, d) => acc + d.remaining, 0n)
  if (credSum !== debtSum) {
    if (import.meta.env?.DEV) {
      console.warn('[Kosha] buildSimplifiedTransfers: unbalanced inputs', {
        credSum: String(credSum), debtSum: String(debtSum),
      })
    }
  }

  const transfers = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = debtor.remaining < creditor.remaining ? debtor.remaining : creditor.remaining

    if (amount > 0n) {
      transfers.push({
        from: debtor.member,
        to: creditor.member,
        amount: toRupees(amount),
      })
    }

    debtor.remaining -= amount
    creditor.remaining -= amount

    if (debtor.remaining === 0n) i += 1
    if (creditor.remaining === 0n) j += 1
  }

  return transfers
}
