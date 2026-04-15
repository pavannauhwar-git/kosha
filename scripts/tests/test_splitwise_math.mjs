import {
  round2,
  buildEqualSplits,
  buildExactSplits,
  buildPercentSplits,
  buildShareSplits,
  computeMemberBalances,
  buildSimplifiedTransfers,
} from '../../src/lib/splitwiseMath.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sumShares(rows) {
  return round2((rows || []).reduce((acc, row) => acc + Number(row?.share || 0), 0))
}

function testEqualSplit() {
  const rows = buildEqualSplits(['a', 'b', 'c'], 100)
  assert(rows.length === 3, 'equal split should include all members')
  assert(sumShares(rows) === 100, 'equal split should preserve total amount')
}

function testExactSplit() {
  const rows = buildExactSplits([
    { member_id: 'a', share: 40 },
    { member_id: 'b', share: 60 },
  ], 100)

  assert(rows.length === 2, 'exact split should retain rows')
  assert(sumShares(rows) === 100, 'exact split should preserve total amount')

  let threw = false
  try {
    buildExactSplits([
      { member_id: 'a', share: 30 },
      { member_id: 'b', share: 60 },
    ], 100)
  } catch {
    threw = true
  }
  assert(threw, 'exact split must throw when totals mismatch')
}

function testPercentSplit() {
  const rows = buildPercentSplits([
    { member_id: 'a', percent: 50 },
    { member_id: 'b', percent: 50 },
  ], 101)

  assert(rows.length === 2, 'percent split should retain rows')
  assert(sumShares(rows) === 101, 'percent split should preserve total after rounding')

  let threw = false
  try {
    buildPercentSplits([
      { member_id: 'a', percent: 70 },
      { member_id: 'b', percent: 20 },
    ], 100)
  } catch {
    threw = true
  }
  assert(threw, 'percent split must throw when percent total is not 100')
}

function testShareSplit() {
  const rows = buildShareSplits([
    { member_id: 'a', shares: 1 },
    { member_id: 'b', shares: 2 },
  ], 90)

  assert(rows.length === 2, 'share split should retain rows')
  assert(sumShares(rows) === 90, 'share split should preserve total amount')
  const a = rows.find((row) => row.member_id === 'a')
  const b = rows.find((row) => row.member_id === 'b')
  assert(a && b, 'share split should include both members')
  assert(round2(b.share) === round2(a.share * 2), 'share split ratio should match share weights')
}

function testBalanceAndSimplification() {
  const members = [
    { id: 'a', display_name: 'A' },
    { id: 'b', display_name: 'B' },
    { id: 'c', display_name: 'C' },
  ]

  const expenses = [
    {
      paid_by_member_id: 'a',
      amount: 120,
      split_expense_splits: [
        { member_id: 'a', share: 40 },
        { member_id: 'b', share: 40 },
        { member_id: 'c', share: 40 },
      ],
    },
    {
      paid_by_member_id: 'b',
      amount: 60,
      split_expense_splits: [
        { member_id: 'a', share: 20 },
        { member_id: 'b', share: 20 },
        { member_id: 'c', share: 20 },
      ],
    },
  ]

  const settlements = [
    { payer_member_id: 'c', payee_member_id: 'a', amount: 10 },
  ]

  const balanceMap = computeMemberBalances(members, expenses, settlements)
  const balances = members.map((member) => ({ member, net: round2(balanceMap.get(member.id) || 0) }))

  const totalNet = round2(balances.reduce((acc, row) => acc + Number(row.net || 0), 0))
  assert(totalNet === 0, 'member balances should net to zero')

  const transfers = buildSimplifiedTransfers(balances)
  const transferTotal = round2(transfers.reduce((acc, row) => acc + Number(row.amount || 0), 0))
  const owedTotal = round2(balances.filter((row) => row.net < 0).reduce((acc, row) => acc + Math.abs(Number(row.net || 0)), 0))

  assert(transferTotal === owedTotal, 'suggested transfers should settle total debt')
}

function main() {
  testEqualSplit()
  testExactSplit()
  testPercentSplit()
  testShareSplit()
  testBalanceAndSimplification()
  console.log('PASS: splitwise math invariants are stable.')
}

main()
