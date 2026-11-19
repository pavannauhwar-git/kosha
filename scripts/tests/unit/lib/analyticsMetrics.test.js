import { describe, it, expect } from 'vitest'
import {
  isActiveMonth,
  positiveMonthCount,
  outflowSharePct,
  rankedCategoryShare,
  investmentStreaks,
  runwayMonths,
  parseAmountText,
} from '../../../../src/lib/analyticsMetrics'

describe('analyticsMetrics', () => {
  describe('positiveMonthCount', () => {
    it('ignores months with no money in or out', () => {
      const rows = [
        { income: 1000, expense: 400, investment: 0, repayments: 0 },
        { income: 0, expense: 0, investment: 0, repayments: 0 },
        { income: 0, expense: 0, investment: 0, repayments: 0 },
        { income: 500, expense: 900, investment: 0, repayments: 0 },
      ]
      expect(positiveMonthCount(rows)).toEqual({ positive: 1, active: 2 })
    })

    it('treats a repayment-only month as active', () => {
      expect(isActiveMonth({ income: 0, repayments: 200, expense: 0, investment: 0 })).toBe(true)
      expect(isActiveMonth({})).toBe(false)
      expect(isActiveMonth(null)).toBe(false)
    })
  })

  describe('outflowSharePct', () => {
    it('returns null with no income instead of 0%', () => {
      expect(outflowSharePct(5000, 0)).toBeNull()
      expect(outflowSharePct(5000, -10)).toBeNull()
    })

    it('rounds the share of income', () => {
      expect(outflowSharePct(333, 1000)).toBe(33)
      expect(outflowSharePct(1500, 1000)).toBe(150)
    })
  })

  describe('rankedCategoryShare', () => {
    it('needs at least three spending categories by default', () => {
      expect(rankedCategoryShare({ food: 500 })).toBeNull()
      expect(rankedCategoryShare({ food: 500, rent: 100 })).toBeNull()
      expect(rankedCategoryShare({ food: 500, rent: 100, fuel: 0 })).toBeNull()
    })

    it('returns the biggest category and its share', () => {
      const top = rankedCategoryShare({ food: 200, rent: 600, fuel: 200 })
      expect(top.categoryId).toBe('rent')
      expect(top.amount).toBe(600)
      expect(top.sharePct).toBe(60)
      expect(top.total).toBe(1000)
    })

    it('sums the top N for a top-three share', () => {
      const top = rankedCategoryShare({ a: 40, b: 30, c: 20, d: 10 }, { minCategories: 4, top: 3 })
      expect(top.sharePct).toBe(90)
      expect(rankedCategoryShare({ a: 40, b: 30, c: 20 }, { minCategories: 4, top: 3 })).toBeNull()
    })
  })

  describe('investmentStreaks', () => {
    const months = (...flags) => flags.map((hit) => ({ investment: hit ? 100 : 0 }))

    it('does not count a running month with no investment as a miss', () => {
      const result = investmentStreaks(months(1, 1, 1, 0), { lastMonthInProgress: true })
      expect(result).toEqual({ current: 3, best: 3, pendingLast: true })
    })

    it('counts a finished month with no investment as a miss', () => {
      expect(investmentStreaks(months(1, 1, 1, 0)).current).toBe(0)
    })

    it('includes the running month once it has an investment', () => {
      const result = investmentStreaks(months(0, 1, 1), { lastMonthInProgress: true })
      expect(result).toEqual({ current: 2, best: 2, pendingLast: false })
    })

    it('tracks the best run separately', () => {
      expect(investmentStreaks(months(1, 1, 1, 0, 1)).best).toBe(3)
      expect(investmentStreaks([]).current).toBe(0)
    })
  })

  describe('runwayMonths', () => {
    it('divides the reserve by the monthly outflow', () => {
      expect(runwayMonths(60000, 20000)).toBe(3)
      expect(runwayMonths(60000, 20000, 1.5)).toBe(2)
    })

    it('returns 0 with no outflow and never goes negative', () => {
      expect(runwayMonths(60000, 0)).toBe(0)
      expect(runwayMonths(-500, 1000)).toBe(0)
    })
  })

  describe('parseAmountText', () => {
    it('reads Indian-grouped and rupee-prefixed amounts', () => {
      expect(parseAmountText('1,00,000')).toBe(100000)
      expect(parseAmountText('₹ 2,500.50')).toBe(2500.5)
      expect(parseAmountText('')).toBe(0)
    })
  })
})
