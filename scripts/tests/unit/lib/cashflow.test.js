import { describe, it, expect } from 'vitest'
import { savingsRate, formatSavingsRate, averageSavingsRate, netCashflow } from '../../../../src/lib/cashflow'

describe('savingsRate', () => {
  it('is (income − expenses) ÷ income', () => {
    expect(savingsRate(100000, 70000)).toBe(30)
  })
  it('goes negative when spending exceeds income', () => {
    expect(savingsRate(50000, 60000)).toBe(-20)
  })
  it('is null without income', () => {
    expect(savingsRate(0, 500)).toBeNull()
  })
  it('formats negative as Overspent and null as a dash', () => {
    expect(formatSavingsRate(-20)).toBe('Overspent')
    expect(formatSavingsRate(30)).toBe('30%')
    expect(formatSavingsRate(null)).toBe('—')
  })
  it('averages only months with income', () => {
    expect(averageSavingsRate([{ income: 100, expense: 50 }, { income: 0, expense: 10 }, { income: 100, expense: 120 }])).toBe(15)
    expect(averageSavingsRate([])).toBeNull()
  })
})

describe('netCashflow', () => {
  it('counts repayments received as inflow', () => {
    expect(netCashflow({ income: 0, repayments: 4000, expense: 6000, investment: 0 })).toBe(-2000)
    expect(netCashflow({ income: 100000, repayments: 2000, expense: 30000, investment: 10000 })).toBe(62000)
  })
})
