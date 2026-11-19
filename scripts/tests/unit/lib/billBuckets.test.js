import { describe, it, expect } from 'vitest'
import { billBucket, summarizeBillBuckets, duePressureScore } from '../../../../src/lib/billBuckets'

describe('billBuckets', () => {
  describe('billBucket', () => {
    it('splits overdue, this week and later without overlap', () => {
      expect(billBucket(-1)).toBe('overdue')
      expect(billBucket(0)).toBe('dueSoon')
      expect(billBucket(7)).toBe('dueSoon')
      expect(billBucket(8)).toBe('later')
    })

    it('treats a missing due date as later', () => {
      expect(billBucket(null)).toBe('later')
      expect(billBucket(undefined)).toBe('later')
      expect(billBucket(NaN)).toBe('later')
    })
  })

  describe('summarizeBillBuckets', () => {
    it('counts each bill once and sums amounts', () => {
      const bills = [
        { amount: 100, days: -3 },
        { amount: 200.1, days: 0 },
        { amount: 50, days: 5 },
        { amount: 75, days: 30 },
        { amount: 25, days: null },
      ]
      const summary = summarizeBillBuckets(bills, (bill) => bill.days)
      expect(summary.overdue).toEqual({ count: 1, amount: 100 })
      expect(summary.dueSoon).toEqual({ count: 2, amount: 250.1 })
      expect(summary.later).toEqual({ count: 2, amount: 100 })
      expect(summary.total.count).toBe(5)
    })
  })

  describe('duePressureScore', () => {
    it('stays between 0 and 100', () => {
      expect(duePressureScore({ overdue: 0, dueSoon: 0, total: 0 })).toBe(0)
      expect(duePressureScore({ overdue: 4, dueSoon: 0, total: 4 })).toBe(100)
      expect(duePressureScore({ overdue: 9, dueSoon: 9, total: 4 })).toBe(100)
    })

    it('weighs an overdue bill twice a bill due this week', () => {
      expect(duePressureScore({ overdue: 1, dueSoon: 0, total: 4 })).toBe(25)
      expect(duePressureScore({ overdue: 0, dueSoon: 1, total: 4 })).toBe(13)
    })
  })
})
