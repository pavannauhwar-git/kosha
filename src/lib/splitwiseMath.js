export function round2(value) {
  const n = Number(value || 0)
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function parsePositive(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function distributeRoundedShares(rawShares, totalAmount) {
  const total = round2(totalAmount)
  const rounded = rawShares.map((entry) => ({
    ...entry,
    share: round2(entry.share),
  }))

  const sum = round2(rounded.reduce((acc, entry) => acc + Number(entry.share || 0), 0))
  const delta = round2(total - sum)

  if (Math.abs(delta) >= 0.01 && rounded.length > 0) {
    let targetIndex = 0
    let maxShare = Number(rounded[0].share || 0)
    for (let i = 1; i < rounded.length; i += 1) {
      const share = Number(rounded[i].share || 0)
      if (share > maxShare) {
        maxShare = share
        targetIndex = i
      }
    }

    rounded[targetIndex] = {
      ...rounded[targetIndex],
      share: round2(Number(rounded[targetIndex].share || 0) + delta),
    }
  }

  return rounded
}

export function buildEqualSplits(memberIds, amount) {
  const validIds = (memberIds || []).filter(Boolean)
  const total = round2(amount)
  if (!validIds.length || total <= 0) return []

  const perHead = total / validIds.length
  return distributeRoundedShares(
    validIds.map((memberId) => ({ member_id: memberId, share: perHead })),
    total
  )
}

export function buildExactSplits(entries, amount) {
  const total = round2(amount)
  const mapped = (entries || [])
    .map((entry) => ({
      member_id: entry?.member_id,
      share: round2(entry?.share),
    }))
    .filter((entry) => entry.member_id && entry.share >= 0)

  const sum = round2(mapped.reduce((acc, entry) => acc + Number(entry.share || 0), 0))
  if (Math.abs(sum - total) > 0.01) {
    throw new Error('Exact splits must add up to the full amount.')
  }

  return mapped
}

export function buildPercentSplits(entries, amount) {
  const total = round2(amount)
  const mapped = (entries || [])
    .map((entry) => ({
      member_id: entry?.member_id,
      percent: Number(entry?.percent || 0),
    }))
    .filter((entry) => entry.member_id && entry.percent > 0)

  const percentSum = mapped.reduce((acc, entry) => acc + Number(entry.percent || 0), 0)
  if (Math.abs(percentSum - 100) > 0.01) {
    throw new Error('Percentage splits must total exactly 100%.')
  }

  const raw = mapped.map((entry) => ({
    member_id: entry.member_id,
    percent: round2(entry.percent),
    share: total * (entry.percent / 100),
  }))

  return distributeRoundedShares(raw, total)
}

export function buildShareSplits(entries, amount) {
  const total = round2(amount)
  const mapped = (entries || [])
    .map((entry) => ({
      member_id: entry?.member_id,
      shares: Number(entry?.shares || 0),
    }))
    .filter((entry) => entry.member_id && entry.shares > 0)

  const totalShares = mapped.reduce((acc, entry) => acc + Number(entry.shares || 0), 0)
  if (totalShares <= 0) {
    throw new Error('At least one share entry is required.')
  }

  const raw = mapped.map((entry) => ({
    member_id: entry.member_id,
    shares: round2(entry.shares),
    share: total * (entry.shares / totalShares),
  }))

  return distributeRoundedShares(raw, total)
}

export function computeMemberBalances(members, expenses, settlements) {
  const balanceByMember = new Map()

  for (const member of members || []) {
    if (!member?.id) continue
    balanceByMember.set(member.id, 0)
  }

  for (const expense of expenses || []) {
    const amount = parsePositive(expense?.amount)
    const payerId = expense?.paid_by_member_id
    if (payerId && balanceByMember.has(payerId)) {
      balanceByMember.set(payerId, round2((balanceByMember.get(payerId) || 0) + amount))
    }

    const splits = Array.isArray(expense?.split_expense_splits) ? expense.split_expense_splits : []
    for (const split of splits) {
      const memberId = split?.member_id
      const share = round2(split?.share)
      if (!memberId || !balanceByMember.has(memberId)) continue
      balanceByMember.set(memberId, round2((balanceByMember.get(memberId) || 0) - share))
    }
  }

  for (const settlement of settlements || []) {
    const amount = parsePositive(settlement?.amount)
    const payerId = settlement?.payer_member_id
    const payeeId = settlement?.payee_member_id

    if (payerId && balanceByMember.has(payerId)) {
      balanceByMember.set(payerId, round2((balanceByMember.get(payerId) || 0) + amount))
    }
    if (payeeId && balanceByMember.has(payeeId)) {
      balanceByMember.set(payeeId, round2((balanceByMember.get(payeeId) || 0) - amount))
    }
  }

  return balanceByMember
}

export function buildSimplifiedTransfers(balancesWithMembers) {
  const creditors = []
  const debtors = []

  for (const row of balancesWithMembers || []) {
    const net = round2(row?.net)
    if (net > 0.01) creditors.push({ member: row.member, remaining: net })
    else if (net < -0.01) debtors.push({ member: row.member, remaining: Math.abs(net) })
  }

  const transfers = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = round2(Math.min(debtor.remaining, creditor.remaining))

    if (amount > 0.01) {
      transfers.push({
        from: debtor.member,
        to: creditor.member,
        amount,
      })
    }

    debtor.remaining = round2(debtor.remaining - amount)
    creditor.remaining = round2(creditor.remaining - amount)

    if (debtor.remaining <= 0.01) i += 1
    if (creditor.remaining <= 0.01) j += 1
  }

  return transfers
}
