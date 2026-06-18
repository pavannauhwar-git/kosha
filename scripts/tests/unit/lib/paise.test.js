import { describe, it, expect } from 'vitest'
import { fromRupees, toRupees, divEvenly, round2 } from '../../../../src/lib/paise'

describe('paise', () => {
  describe('fromRupees', () => {
    it('converts positive numbers to paise (BigInt)', () => {
      expect(fromRupees(12.34)).toBe(1234n)
      expect(fromRupees('12.34')).toBe(1234n)
    })

    it('rounds half away from zero correctly', () => {
      expect(fromRupees(1.235)).toBe(124n)
      expect(fromRupees(-1.235)).toBe(-124n)
    })

    it('handles empty or invalid inputs', () => {
      expect(fromRupees(null)).toBe(0n)
      expect(fromRupees(undefined)).toBe(0n)
      expect(fromRupees('')).toBe(0n)
      expect(fromRupees('abc')).toBe(0n)
    })
  })

  describe('toRupees', () => {
    it('converts paise to decimal rupees', () => {
      expect(toRupees(1234n)).toBe(12.34)
      expect(toRupees(1234)).toBe(12.34)
      expect(toRupees(-1234n)).toBe(-12.34)
    })

    it('handles empty inputs', () => {
      expect(toRupees(null)).toBe(0)
      expect(toRupees(undefined)).toBe(0)
    })
  })

  describe('divEvenly', () => {
    it('divides evenly without remainder', () => {
      expect(divEvenly(100n, 2)).toEqual([50n, 50n])
    })

    it('distributes positive remainders one by one', () => {
      // 100 split 3 ways is 33, 33, 34
      expect(divEvenly(100n, 3)).toEqual([34n, 33n, 33n])
    })

    it('distributes negative remainders one by one', () => {
      expect(divEvenly(-100n, 3)).toEqual([-34n, -33n, -33n])
    })
  })

  describe('round2', () => {
    it('rounds to 2 decimal places', () => {
      expect(round2(1.234)).toBe(1.23)
      expect(round2(1.236)).toBe(1.24)
    })
  })
})
