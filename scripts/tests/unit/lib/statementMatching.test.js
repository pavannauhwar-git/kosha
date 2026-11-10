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

  describe('bank export formats', () => {
    const parseOne = (line) => parseStatementLines(line)[0]

    it('keeps an unquoted Indian-grouped amount whole', () => {
      const entry = parseOne('24/03/2026, Swiggy, 1,23,456.50')
      expect(entry.amount).toBe(123456.5)
      expect(entry.description).toBe('Swiggy')
      expect(entry.isValid).toBe(true)
    })

    it('keeps unquoted Western-grouped amounts whole', () => {
      expect(parseOne('24/03/2026, Rent, 12,345').amount).toBe(12345)
      expect(parseOne('24/03/2026, Petrol, ₹ 2,000').amount).toBe(2000)
    })

    it('reads quoted CSV with commas inside fields', () => {
      const entry = parseOne('"24/03/2026","Zomato, Koramangala","1,234.00"')
      expect(entry.amount).toBe(1234)
      expect(entry.description).toBe('Zomato, Koramangala')
    })

    it('splits tab- and pipe-separated rows on that separator only', () => {
      const tab = parseOne('24/03/2026\tSWIGGY, BANGALORE\t1,250.00')
      expect(tab.amount).toBe(1250)
      expect(tab.description).toBe('SWIGGY, BANGALORE')

      const pipe = parseOne('24/03/2026 | Amazon, Pay | 542.00')
      expect(pipe.amount).toBe(542)
      expect(pipe.description).toBe('Amazon, Pay')
    })

    it('reads space-separated lines and takes the right-most amount', () => {
      const entry = parseOne('24/03/2026 Uber trip 318.50')
      expect(entry.date).toBe('2026-03-24')
      expect(entry.amount).toBe(318.5)
      expect(entry.description).toBe('Uber trip')
    })

    it('uses a trailing Dr/Cr column as the direction', () => {
      expect(parseOne('24/03/2026,Groceries,542.00,Dr').direction).toBe('debit')
      expect(parseOne('24/03/2026,Salary ACME,50000.00,Cr').direction).toBe('credit')

      const spaced = parseOne('15-Mar-2026 NEFT-ACME LTD-SALARY 75,000.00 CR')
      expect(spaced.amount).toBe(75000)
      expect(spaced.direction).toBe('credit')
    })

    it('treats a bracketed amount as a debit', () => {
      const entry = parseOne('24/03/2026,Myntra,(450.00)')
      expect(entry.amount).toBe(450)
      expect(entry.direction).toBe('debit')
    })

    it('finds the amount when it is not the last field', () => {
      const entry = parseOne('24/03/2026,450.00,Swiggy')
      expect(entry.amount).toBe(450)
      expect(entry.description).toBe('Swiggy')
    })

    it('keeps the merchant from a UPI narration and drops the reference number', () => {
      const entry = parseOne('24/03/2026,UPI/412345678901/SWIGGY/swiggy@okicici/Payment,542.00,Dr')
      expect([...entry.tokens]).toEqual(['swiggy'])

      const [match] = matchStatementEntries([entry], [
        { id: 'txn-upi', description: 'Swiggy', amount: 542, type: 'expense', date: '2026-03-24' },
      ])
      expect(match.best?.txn.id).toBe('txn-upi')
      expect(match.confidence).toBe('high')
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

    it('scores a statement line dated after the transaction the same as one dated before', () => {
      const later = matchStatementEntries(parseStatementLines('2024-01-18,Swiggy Food Order,450.00'), transactions)[0]
      const earlier = matchStatementEntries(parseStatementLines('2024-01-12,Swiggy Food Order,450.00'), transactions)[0]
      expect(later.best?.txn.id).toBe('txn-1')
      expect(later.best?.days).toBe(3)
      expect(later.best?.score).toBeLessThanOrEqual(1)
      expect(later.best?.score).toBe(earlier.best?.score)
    })

    it('does not match a transaction more than 7 days before the statement line', () => {
      const result = matchStatementEntries(parseStatementLines('2024-01-30,Swiggy Food Order,450.00'), transactions)[0]
      expect(result.candidates).toHaveLength(0)
      expect(result.best).toBeNull()
    })
  })
})
