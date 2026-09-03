import { describe, it, expect, vi } from 'vitest'
import {
  parseMonthSummaryRows,
  sanitizeTransactionSearchNeedle,
  buildTransactionSearchOrClause
} from '../../../../src/hooks/useTransactions'
import { CATEGORIES } from '../../../../src/lib/categories'

describe('useTransactions hooks', () => {
  describe('parseMonthSummaryRows', () => {
    it('handles empty or null inputs', () => {
      const nullResult = parseMonthSummaryRows(null)
      expect(nullResult).toEqual({
        earned: 0, repayments: 0, expense: 0, investment: 0,
        byCategory: {}, byVehicle: {}, balance: 0, count: 0,
      })

      const emptyResult = parseMonthSummaryRows([])
      expect(emptyResult).toEqual({
        earned: 0, repayments: 0, expense: 0, investment: 0,
        byCategory: {}, byVehicle: {}, balance: 0, count: 0,
      })
    })

    it('parses income and repayments correctly', () => {
      const rows = [
        { type: 'income', total: '1000' },
        { type: 'income', total: '500', is_repayment: true },
        { type: 'income', total: '200' },
      ]
      const result = parseMonthSummaryRows(rows)
      expect(result.earned).toBe(1200)
      expect(result.repayments).toBe(500)
      expect(result.expense).toBe(0)
      expect(result.investment).toBe(0)
      expect(result.balance).toBe(1700)
      expect(result.count).toBe(3)
    })

    it('parses expenses and groups by category', () => {
      const rows = [
        { type: 'expense', total: '100', category: 'food' },
        { type: 'expense', total: '150', category: 'food' },
        { type: 'expense', total: '50', category: 'transport' },
        { type: 'expense', total: '20', category: null }, // no category
      ]
      const result = parseMonthSummaryRows(rows)
      expect(result.expense).toBe(320)
      expect(result.byCategory).toEqual({
        food: 250,
        transport: 50,
      })
      expect(result.balance).toBe(-320)
    })

    it('parses investments and groups by vehicle', () => {
      const rows = [
        { type: 'investment', total: '500', investment_vehicle: 'Stocks' },
        { type: 'investment', total: '200', investment_vehicle: 'Bonds' },
        { type: 'investment', total: '100' }, // missing vehicle maps to 'Other'
      ]
      const result = parseMonthSummaryRows(rows)
      expect(result.investment).toBe(800)
      expect(result.byVehicle).toEqual({
        'Stocks': 500,
        'Bonds': 200,
        'Other': 100,
      })
      expect(result.balance).toBe(-800)
    })

    it('computes correct overall balance with mixed types', () => {
      const rows = [
        { type: 'income', total: '2000' },
        { type: 'income', total: '100', is_repayment: true },
        { type: 'expense', total: '500', category: 'rent' },
        { type: 'investment', total: '300', investment_vehicle: 'Stocks' },
      ]
      const result = parseMonthSummaryRows(rows)
      // Balance = earned(2000) + repayments(100) - expense(500) - investment(300) = 1300
      expect(result.balance).toBe(1300)
    })
  })

  describe('sanitizeTransactionSearchNeedle', () => {
    it('returns empty string for null or undefined', () => {
      expect(sanitizeTransactionSearchNeedle(null)).toBe('')
      expect(sanitizeTransactionSearchNeedle(undefined)).toBe('')
      expect(sanitizeTransactionSearchNeedle('')).toBe('')
    })

    it('strips PostgREST reserved characters', () => {
      expect(sanitizeTransactionSearchNeedle('hello,world%()')).toBe('hello world')
      expect(sanitizeTransactionSearchNeedle('a:b"c\\d_e*f')).toBe('a b c d e f')
    })

    it('lowercases and collapses multiple spaces', () => {
      expect(sanitizeTransactionSearchNeedle('  Hello   World  ')).toBe('hello world')
    })
  })

  describe('buildTransactionSearchOrClause', () => {
    it('returns empty string for empty search', () => {
      expect(buildTransactionSearchOrClause('')).toBe('')
      expect(buildTransactionSearchOrClause('   ')).toBe('')
    })

    it('builds ilike conditions for description and notes', () => {
      const clause = buildTransactionSearchOrClause('apple')
      // Note: apple might match some category, let's assume it doesn't match a default category name for this check
      // Or we can just check if it contains the basic ilike filters
      expect(clause).toContain('description.ilike.%apple%')
      expect(clause).toContain('notes.ilike.%apple%')
    })

    it('includes category.eq if the search term matches a known category', () => {
      // Find a known category label
      const category = CATEGORIES[0] 
      const label = category.label.toLowerCase()
      const clause = buildTransactionSearchOrClause(label)
      
      expect(clause).toContain(`description.ilike.%${label}%`)
      expect(clause).toContain(`notes.ilike.%${label}%`)
      expect(clause).toContain(`category.eq.${category.id}`)
    })
  })
})
