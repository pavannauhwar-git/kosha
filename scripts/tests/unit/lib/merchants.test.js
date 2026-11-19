import { describe, it, expect } from 'vitest'
import { merchantKey, groupMerchants, repeatMerchants } from '../../../../src/lib/merchants'

describe('merchants', () => {
  describe('merchantKey', () => {
    it('drops punctuation, stop words and order numbers', () => {
      expect(merchantKey('Paid to Swiggy - order #4411')).toBe('swiggy order')
      expect(merchantKey('SWIGGY order 9912')).toBe('swiggy order')
    })

    it('keeps names written in Indian scripts', () => {
      expect(merchantKey('राम किराना')).toBe('राम किराना')
      expect(merchantKey('சரவணா ஸ்டோர்ஸ் 12')).toBe('சரவணா ஸ்டோர்ஸ்')
    })

    it('returns an empty key for blank or number-only text', () => {
      expect(merchantKey('')).toBe('')
      expect(merchantKey(null)).toBe('')
      expect(merchantKey('12345')).toBe('')
    })
  })

  describe('groupMerchants', () => {
    it('counts only real expenses, not repayments or income', () => {
      const { merchants, totalExpense } = groupMerchants([
        { type: 'expense', amount: 300, description: 'Swiggy' },
        { type: 'expense', amount: 200, description: 'swiggy' },
        { type: 'expense', amount: 1000, description: 'Ravi', is_repayment: true },
        { type: 'income', amount: 5000, description: 'Salary' },
        { type: 'expense', amount: 0, description: 'Zero' },
      ])
      expect(totalExpense).toBe(500)
      expect(merchants).toHaveLength(1)
      expect(merchants[0]).toMatchObject({ key: 'swiggy', label: 'Swiggy', total: 500, count: 2, maxTxn: 300 })
    })

    it('adds expenses with no usable name to the total but not to any payee', () => {
      const { merchants, totalExpense } = groupMerchants([
        { type: 'expense', amount: 100, description: '' },
        { type: 'expense', amount: 50, description: '#' },
      ])
      expect(totalExpense).toBe(150)
      expect(merchants).toEqual([])
    })
  })

  describe('repeatMerchants', () => {
    it('lists payees seen twice or more, biggest first', () => {
      const { repeats, merchants } = repeatMerchants([
        { type: 'expense', amount: 100, description: 'Uber' },
        { type: 'expense', amount: 150, description: 'Uber' },
        { type: 'expense', amount: 400, description: 'राम किराना' },
        { type: 'expense', amount: 500, description: 'राम किराना' },
        { type: 'expense', amount: 9000, description: 'Rent' },
      ])
      expect(repeats.map((m) => m.key)).toEqual(['राम किराना', 'uber'])
      expect(merchants).toHaveLength(3)
    })
  })
})
