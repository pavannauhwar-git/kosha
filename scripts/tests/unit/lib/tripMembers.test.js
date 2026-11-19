import { describe, it, expect } from 'vitest'
import {
  memberStatus,
  memberStatusSuffix,
  memberRole,
  expenseMemberOptions,
  settlementMemberOptions,
  expensePaidOwnBill,
} from '../../../../src/lib/tripMembers'

const OWNER = 'u-owner'
const asha = { id: 'm-asha', linked_user_id: OWNER, user_id: OWNER }
const ben = { id: 'm-ben', linked_user_id: null, user_id: 'u-ben', left_at: '2026-11-01T00:00:00Z' }
const gita = { id: 'm-gita', linked_user_id: null, user_id: OWNER }
const xan = { id: 'm-xan', linked_user_id: 'u-xan', user_id: 'u-xan', archived_at: '2026-11-02T00:00:00Z' }
const dev = { id: 'm-dev', linked_user_id: 'u-dev', user_id: 'u-dev' }
const members = [asha, ben, gita, xan, dev]
const ids = (rows) => rows.map((row) => row.id)

describe('tripMembers', () => {
  it('reads status from the server columns, removed before left', () => {
    expect(memberStatus(asha)).toBe('active')
    expect(memberStatus(ben)).toBe('left')
    expect(memberStatus(xan)).toBe('removed')
    expect(memberStatus({ ...ben, archived_at: '2026-11-03T00:00:00Z' })).toBe('removed')
    expect(memberStatusSuffix(ben)).toBe(' (left)')
    expect(memberStatusSuffix(xan)).toBe(' (removed)')
    expect(memberStatusSuffix(gita)).toBe('')
  })

  it('keeps a guest active after the person who added them leaves', () => {
    const roleByUserId = new Map([[OWNER, 'admin'], ['u-dev', 'member']])
    expect(memberRole({ ...gita, user_id: 'u-ben' }, { roleByUserId })).toBe('guest')
    expect(memberRole(asha, { roleByUserId })).toBe('admin')
    expect(memberRole(dev, { roleByUserId })).toBe('member')
    expect(memberRole(ben, { roleByUserId })).toBe('left')
    expect(memberRole(xan, { roleByUserId })).toBe('removed')
  })

  it('gives the trip creator only the role in their access row', () => {
    expect(memberRole(asha, { roleByUserId: new Map([[OWNER, 'viewer']]) })).toBe('viewer')
    expect(memberRole(asha, { roleByUserId: new Map() })).toBe('left')
  })

  it('offers only current members for a new expense', () => {
    expect(ids(expenseMemberOptions(members))).toEqual(['m-asha', 'm-gita', 'm-dev'])
  })

  it('keeps people already on an expense when editing it', () => {
    const expense = { paid_by_member_id: 'm-ben', split_expense_splits: [{ member_id: 'm-xan' }, { member_id: 'm-asha' }] }
    expect(ids(expenseMemberOptions(members, expense))).toEqual(['m-asha', 'm-ben', 'm-gita', 'm-xan', 'm-dev'])
  })

  it('offers someone who left only while they have a balance to settle', () => {
    const balances = [{ member: ben, net: -250 }, { member: asha, net: 250 }]
    expect(ids(settlementMemberOptions(members, balances))).toEqual(['m-asha', 'm-ben', 'm-gita', 'm-dev'])
    expect(ids(settlementMemberOptions(members, [{ member: ben, net: 0.004 }]))).toEqual(['m-asha', 'm-gita', 'm-dev'])
  })

  it('keeps both people on a settlement being edited', () => {
    const settlement = { payer_member_id: 'm-xan', payee_member_id: 'm-ben' }
    expect(ids(settlementMemberOptions(members, [], settlement))).toEqual(['m-asha', 'm-ben', 'm-gita', 'm-xan', 'm-dev'])
  })

  it('spots an expense whose own ledger entry paid one of your bills', () => {
    const expense = { transactions: { category: 'bills', linked_bill_id: 'bill-1', user_id: OWNER } }
    expect(expensePaidOwnBill(expense, OWNER)).toBe(true)
    expect(expensePaidOwnBill(expense, 'u-dev')).toBe(false)
    expect(expensePaidOwnBill({ transactions: { category: 'food', linked_bill_id: null, user_id: OWNER } }, OWNER)).toBe(false)
    expect(expensePaidOwnBill({ transactions: null }, OWNER)).toBe(false)
  })
})
