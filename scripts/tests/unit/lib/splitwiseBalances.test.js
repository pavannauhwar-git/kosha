import { describe, it, expect } from 'vitest'
import { computeMemberBalances, buildSimplifiedTransfers } from '../../../../src/lib/splitwiseMath'

const A = { id: 'a', display_name: 'A' }
const B = { id: 'b', display_name: 'B' }
const C = { id: 'c', display_name: 'C' }

function expense(paidBy, amount, shares) {
  return {
    paid_by_member_id: paidBy,
    amount,
    split_expense_splits: Object.entries(shares).map(([member_id, share]) => ({ member_id, share })),
  }
}

function balancesOf(members, expenses, settlements = []) {
  const map = computeMemberBalances(members, expenses, settlements)
  return members.map((member) => ({ member, net: Number(map.get(member.id) || 0) }))
}

describe('computeMemberBalances', () => {
  it('credits the payer and debits each share', () => {
    const rows = balancesOf([A, B], [expense('a', 100, { a: 50, b: 50 })])
    expect(rows.map((r) => r.net)).toEqual([50, -50])
  })

  it('a settlement moves the payer towards zero', () => {
    const rows = balancesOf([A, B], [expense('a', 100, { a: 50, b: 50 })], [
      { payer_member_id: 'b', payee_member_id: 'a', amount: 20 },
    ])
    expect(rows.map((r) => r.net)).toEqual([30, -30])
  })

  it('balances always net to zero', () => {
    const rows = balancesOf([A, B, C], [
      expense('a', 120, { a: 40, b: 40, c: 40 }),
      expense('b', 60, { a: 20, b: 20, c: 20 }),
    ], [{ payer_member_id: 'c', payee_member_id: 'a', amount: 10 }])
    expect(rows.reduce((sum, r) => sum + r.net, 0)).toBeCloseTo(0, 10)
    expect(rows.map((r) => r.net)).toEqual([50, 0, -50])
  })
})

describe('buildSimplifiedTransfers', () => {
  it('sends money from the debtor to the creditor, never the other way', () => {
    const transfers = buildSimplifiedTransfers(balancesOf([A, B], [expense('a', 100, { a: 50, b: 50 })]))
    expect(transfers).toEqual([{ from: B, to: A, amount: 50 }])
  })

  it('settles every debt exactly once with three people', () => {
    const transfers = buildSimplifiedTransfers(balancesOf([A, B, C], [
      expense('a', 90, { a: 30, b: 30, c: 30 }),
      expense('b', 30, { b: 10, c: 20 }),
    ]))
    // A is owed 60; B owes 10; C owes 50.
    expect(transfers).toEqual([
      { from: C, to: A, amount: 50 },
      { from: B, to: A, amount: 10 },
    ])
  })

  it('returns nothing when everyone is square', () => {
    expect(buildSimplifiedTransfers(balancesOf([A, B], [expense('a', 100, { a: 100 })]))).toEqual([])
  })

  it('handles paise without drifting', () => {
    const transfers = buildSimplifiedTransfers(balancesOf([A, B, C], [
      expense('a', 100, { a: 33.34, b: 33.33, c: 33.33 }),
    ]))
    expect(transfers.map((t) => [t.from.id, t.to.id, t.amount])).toEqual([
      ['b', 'a', 33.33],
      ['c', 'a', 33.33],
    ])
  })
})
