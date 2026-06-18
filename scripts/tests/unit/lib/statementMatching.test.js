import { describe, it, expect } from 'vitest'
import { parseStatementLines, matchStatementEntries } from '../../../../src/lib/statementMatching'

describe('statementMatching', () => {
  describe('parseStatementLines', () => {
    it('parses a valid CSV line into a statement entry', () => {
      const lines = parseStatementLines('2024-01-15,Swiggy Order Payment,450.00')
      expect(lines).toHaveLength(1)
      const entry = lines[0]
      expect(entry.date).toBe('2024-01-15')
      expect(entry.amount).toBe(450)
      expect(entry.isValid).toBe(true)
    })

    it('parses DD/MM/YYYY date format correctly', () => {
      const lines = parseStatementLines('15/01/2024,Amazon Purchase,1250.50')
      expect(lines[0].date).toBe('2024-01-15')
      expect(lines[0].isValid).toBe(true)
    })

    it('parses DD-Mon-YY date format', () => {
      const lines = parseStatementLines('15 Jan 24,Zomato Food,350')
      expect(lines[0].date).toBe('2024-01-15')
    })

    it('marks entry as invalid when date is missing', () => {
      const lines = parseStatementLines('No date here,500.00')
      expect(lines[0].isValid).toBe(false)
    })

    it('marks entry as invalid when amount is missing', () => {
      const lines = parseStatementLines('2024-01-15,Some merchant without amount')
      expect(lines[0].isValid).toBe(false)
    })

    it('infers debit direction from DR notation', () => {
      const lines = parseStatementLines('2024-01-15,ATM Withdrawal,5000.00 DR')
      expect(lines[0].direction).toBe('debit')
    })

    it('infers credit direction from CR notation', () => {
      const lines = parseStatementLines('2024-01-15,Salary Credit,50000.00 CR')
      expect(lines[0].direction).toBe('credit')
    })

    it('handles multiple lines', () => {
      const raw = `2024-01-15,Swiggy,450.00
2024-01-16,Zomato,300.00`
      const lines = parseStatementLines(raw)
      expect(lines).toHaveLength(2)
      expect(lines[0].id).toBe('stmt-1')
      expect(lines[1].id).toBe('stmt-2')
    })

    it('strips noise tokens and preserves merchant name', () => {
      // Use a plain CSV line so the merchant word is clearly extractable
      const lines = parseStatementLines('2024-01-15,Swiggy Food debit UPI,250.00')
      const entry = lines[0]
      // 'upi' and 'debit' are noise tokens — should not appear
      expect(entry.tokens.has('upi')).toBe(false)
      expect(entry.tokens.has('debit')).toBe(false)
      // 'swiggy' and 'food' should survive tokenization (length >= 3, not noise)
      expect(entry.tokens.has('swiggy')).toBe(true)
      expect(entry.tokens.has('food')).toBe(true)
    })
  })

  describe('matchStatementEntries', () => {
    const transactions = [
      { id: 'txn-1', description: 'Swiggy Food Order', amount: 450, type: 'expense', date: '2024-01-15' },
      { id: 'txn-2', description: 'Amazon Shopping', amount: 1250.50, type: 'expense', date: '2024-01-16' },
      { id: 'txn-3', description: 'Monthly Salary', amount: 50000, type: 'income', date: '2024-01-01' },
    ]

    it('matches a statement entry to the correct transaction with high confidence', () => {
      const entries = parseStatementLines('2024-01-15,Swiggy Food Order,450.00')
      const results = matchStatementEntries(entries, transactions)
      expect(results).toHaveLength(1)
      expect(results[0].best?.txn.id).toBe('txn-1')
      expect(results[0].confidence).toBe('high')
    })

    it('returns low confidence for entries with no matching transactions', () => {
      const entries = parseStatementLines('2024-01-15,Some random merchant xyz,9999.00')
      const results = matchStatementEntries(entries, transactions)
      expect(results[0].confidence).toBe('low')
    })

    it('returns empty candidates for invalid entries', () => {
      const entries = parseStatementLines('no date, no amount')
      const results = matchStatementEntries(entries, transactions)
      expect(results[0].candidates).toHaveLength(0)
      expect(results[0].best).toBeNull()
    })

    it('does not match the same transaction to multiple entries (one-to-one)', () => {
      // Two lines for the same transaction — the second should not steal txn-1
      const raw = `2024-01-15,Swiggy Food Order,450.00
2024-01-15,Swiggy Order,450.00`
      const entries = parseStatementLines(raw)
      const results = matchStatementEntries(entries, transactions)
      const firstMatchId = results[0].best?.txn.id
      const secondMatchId = results[1].best?.txn.id
      // Both cannot be 'txn-1'
      expect(firstMatchId === 'txn-1' && secondMatchId === 'txn-1').toBe(false)
    })
  })
})
