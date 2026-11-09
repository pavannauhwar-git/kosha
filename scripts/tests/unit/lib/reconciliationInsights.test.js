import { describe, it, expect } from 'vitest'
import { buildReconciliationInsights } from '../../../../src/lib/reconciliation'

let nextId = 0
function txn(overrides = {}) {
  nextId += 1
  return {
    id: `t${nextId}`,
    date: '2025-03-01',
    type: 'expense',
    description: 'Swiggy',
    category: 'food',
    payment_mode: 'upi',
    amount: 250,
    ...overrides,
  }
}

describe('buildReconciliationInsights', () => {
  it('handles empty and null input', () => {
    expect(buildReconciliationInsights([]).counts.total).toBe(0)
    expect(buildReconciliationInsights([]).counts.candidates).toBe(0)
    expect(buildReconciliationInsights(null).counts.total).toBe(0)
  })

  it('does not flag a clean transaction', () => {
    const r = buildReconciliationInsights([txn()])
    expect(r.counts.candidates).toBe(0)
    expect(r.items[0].needsReview).toBe(false)
  })

  it('flags a missing category on expenses only', () => {
    const r = buildReconciliationInsights([txn({ category: '' })])
    expect(r.items[0].flags.missingCategory).toBe(true)
    expect(r.counts.missingCategory).toBe(1)
    const income = buildReconciliationInsights([txn({ type: 'income', category: '' })])
    expect(income.items[0].flags.missingCategory).toBe(false)
  })

  it('flags a missing payment mode', () => {
    const r = buildReconciliationInsights([txn({ payment_mode: '' })])
    expect(r.items[0].flags.missingPaymentMode).toBe(true)
    expect(r.counts.missingDetails).toBe(1)
  })

  it('flags duplicates by date, type, amount and description', () => {
    const r = buildReconciliationInsights([
      txn({ id: 'd1', description: 'Swiggy', amount: 250 }),
      txn({ id: 'd2', description: '  swiggy ', amount: '250.00' }),
      txn({ id: 'u1', description: 'Netflix', amount: 199 }),
      txn({ id: 'u2', description: 'Swiggy', amount: 250, date: '2025-03-02' }),
    ])
    const flag = (id) => r.items.find((i) => i.txn.id === id).flags.potentialDuplicate
    expect([flag('d1'), flag('d2'), flag('u1'), flag('u2')]).toEqual([true, true, false, false])
    expect(r.counts.potentialDuplicate).toBe(2)
  })

  it('moves reviewed items out of the queue', () => {
    const r = buildReconciliationInsights(
      [txn({ id: 'r1', category: '' }), txn({ id: 'r2', category: '' })],
      new Set(['r1']),
    )
    expect(r.counts).toMatchObject({ candidates: 2, queue: 1, reviewed: 1 })
  })

  it('keeps queue + reviewed equal to candidates', () => {
    const rows = [txn({ category: '' }), txn({ payment_mode: '' }), txn(), txn({ category: '' })]
    const r = buildReconciliationInsights(rows, new Set([rows[3].id]))
    expect(r.counts.queue + r.counts.reviewed).toBe(r.counts.candidates)
  })
})
