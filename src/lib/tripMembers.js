// Trip member status. The server sets left_at when someone leaves and
// archived_at when an admin removes them; nobody else can change either.

export function memberStatus(member) {
  if (member?.archived_at) return 'removed'
  if (member?.left_at) return 'left'
  return 'active'
}

export function isActiveMember(member) {
  return !!member && memberStatus(member) === 'active'
}

export function memberStatusSuffix(member) {
  const status = memberStatus(member)
  if (status === 'removed') return ' (removed)'
  if (status === 'left') return ' (left)'
  return ''
}

// The trip creator has no special role: a demoted or removed creator is
// whatever their access row says.
export function memberRole(member, { roleByUserId } = {}) {
  const status = memberStatus(member)
  if (status !== 'active') return status
  if (!member?.linked_user_id) return 'guest'
  return roleByUserId?.get(member.linked_user_id) || 'left'
}

// Everyone still in the trip, plus anyone already on the expense being edited.
export function expenseMemberOptions(members, expense = null) {
  const keep = new Set()
  if (expense?.paid_by_member_id) keep.add(expense.paid_by_member_id)
  for (const split of expense?.split_expense_splits || []) keep.add(split.member_id)
  return (members || []).filter((member) => isActiveMember(member) || keep.has(member.id))
}

// Everyone still in the trip, anyone who left with a balance to settle, and
// the two people on the settlement being edited.
export function settlementMemberOptions(members, balances, settlement = null) {
  const unsettled = new Set(
    (balances || [])
      .filter((row) => Math.abs(Number(row?.net) || 0) >= 0.01)
      .map((row) => row?.member?.id)
  )
  const keep = new Set([settlement?.payer_member_id, settlement?.payee_member_id].filter(Boolean))
  return (members || []).filter((member) =>
    isActiveMember(member)
    || keep.has(member.id)
    || (memberStatus(member) === 'left' && unsettled.has(member.id))
  )
}

// The caller's own ledger entry for this expense paid one of their bills.
export function expensePaidOwnBill(expense, authUserId) {
  const txn = expense?.transactions
  return !!txn?.linked_bill_id && !!authUserId && txn.user_id === authUserId
}
