import { describe, it, expect } from 'vitest'
import {
  buildEqualSplits,
  buildExactSplits,
  buildPercentSplits,
  buildShareSplits,
  buildSplitsFromInputs
} from '../../../../src/lib/splitwiseMath'

describe('splitwiseMath', () => {
  describe('buildEqualSplits', () => {
    it('splits amount equally among members', () => {
      const splits = buildEqualSplits(['id1', 'id2'], 100)
      expect(splits).toEqual([
        { member_id: 'id1', share: 50 },
        { member_id: 'id2', share: 50 }
      ])
    })

    it('handles remainders correctly', () => {
      const splits = buildEqualSplits(['id1', 'id2', 'id3'], 100)
      // 100 divided by 3 is 33.33, 33.33, 33.34
      expect(splits).toEqual([
        { member_id: 'id1', share: 33.34 },
        { member_id: 'id2', share: 33.33 },
        { member_id: 'id3', share: 33.33 }
      ])
    })

    it('returns empty array if no valid ids or amount is 0', () => {
      expect(buildEqualSplits([], 100)).toEqual([])
      expect(buildEqualSplits(['id1'], 0)).toEqual([])
    })
  })

  describe('buildExactSplits', () => {
    it('returns exact splits if they match the total', () => {
      const entries = [
        { member_id: 'id1', share: 20 },
        { member_id: 'id2', share: 80 }
      ]
      const splits = buildExactSplits(entries, 100)
      expect(splits).toEqual(entries)
    })

    it('throws error if exact splits do not match total', () => {
      const entries = [
        { member_id: 'id1', share: 20 },
        { member_id: 'id2', share: 70 }
      ]
      expect(() => buildExactSplits(entries, 100)).toThrow('Exact splits must add up to the full amount.')
    })
  })

  describe('buildPercentSplits', () => {
    it('calculates correct percentages', () => {
      const entries = [
        { member_id: 'id1', percent: 25 },
        { member_id: 'id2', percent: 75 }
      ]
      const splits = buildPercentSplits(entries, 200)
      expect(splits).toEqual([
        { member_id: 'id1', percent: 25, share: 50 },
        { member_id: 'id2', percent: 75, share: 150 }
      ])
    })

    it('throws if percentages do not add up to 100', () => {
      const entries = [
        { member_id: 'id1', percent: 25 },
        { member_id: 'id2', percent: 74 }
      ]
      expect(() => buildPercentSplits(entries, 200)).toThrow('Percentage splits must total exactly 100%.')
    })
  })

  describe('buildShareSplits', () => {
    it('calculates shares correctly', () => {
      const entries = [
        { member_id: 'id1', shares: 1 },
        { member_id: 'id2', shares: 3 }
      ]
      // Total shares = 4. id1 gets 1/4 of 100 = 25. id2 gets 3/4 of 100 = 75.
      const splits = buildShareSplits(entries, 100)
      expect(splits).toEqual([
        { member_id: 'id1', shares: 1, share: 25 },
        { member_id: 'id2', shares: 3, share: 75 }
      ])
    })

    it('throws if total shares is <= 0', () => {
      const entries = [
        { member_id: 'id1', shares: 0 },
        { member_id: 'id2', shares: 0 }
      ]
      expect(() => buildShareSplits(entries, 100)).toThrow('At least one share entry is required.')
    })

    it('adds up to the full amount with fractional shares on a large amount', () => {
      const entries = [
        { member_id: 'id1', shares: 0.33333 },
        { member_id: 'id2', shares: 0.33333 },
        { member_id: 'id3', shares: 0.33333 }
      ]
      const splits = buildShareSplits(entries, 1000000)
      const totalPaise = splits.reduce((sum, row) => sum + Math.round(row.share * 100), 0)
      expect(totalPaise).toBe(100000000)
      expect(splits.map((row) => row.share)).toEqual([333333.34, 333333.33, 333333.33])
    })

    it('drops members whose share rounds to zero', () => {
      const splits = buildShareSplits([
        { member_id: 'id1', shares: 1000 },
        { member_id: 'id2', shares: 1 }
      ], 0.01)
      expect(splits).toEqual([{ member_id: 'id1', shares: 1000, share: 0.01 }])
    })
  })

  describe('zero shares', () => {
    it('leaves out equal-split members who would owe nothing', () => {
      expect(buildEqualSplits(['id1', 'id2', 'id3'], 0.02)).toEqual([
        { member_id: 'id1', share: 0.01 },
        { member_id: 'id2', share: 0.01 }
      ])
    })

    it('leaves out percent-split members who would owe nothing', () => {
      const splits = buildPercentSplits([
        { member_id: 'id1', percent: 99.5 },
        { member_id: 'id2', percent: 0.5 }
      ], 0.01)
      expect(splits).toEqual([{ member_id: 'id1', percent: 99.5, share: 0.01 }])
    })
  })

  describe('buildSplitsFromInputs', () => {
    const ids = ['a', 'b', 'c']

    it('uses only enabled members', () => {
      const inputs = { a: { enabled: true }, b: { enabled: false }, c: { enabled: true } }
      expect(buildSplitsFromInputs('equal', 100, ids, inputs)).toEqual([
        { member_id: 'a', share: 50 },
        { member_id: 'c', share: 50 },
      ])
    })

    it('ignores enabled inputs for members not in the list', () => {
      const inputs = { a: { enabled: true }, z: { enabled: true } }
      expect(buildSplitsFromInputs('equal', 90, ids, inputs)).toEqual([{ member_id: 'a', share: 90 }])
    })

    it('needs at least one participant', () => {
      expect(() => buildSplitsFromInputs('equal', 100, ids, {})).toThrow('Select at least one participant')
    })

    it('needs exact amounts to add up to the paisa', () => {
      const inputs = { a: { enabled: true, exact: '33.33' }, b: { enabled: true, exact: '66.66' } }
      expect(() => buildSplitsFromInputs('exact', 100, ids, inputs)).toThrow('Sum: 99.99, Total: 100')
      inputs.b.exact = '66.67'
      expect(buildSplitsFromInputs('exact', 100, ids, inputs)).toEqual([
        { member_id: 'a', share: 33.33 },
        { member_id: 'b', share: 66.67 },
      ])
    })

    it('needs percentages to total 100', () => {
      const inputs = { a: { enabled: true, percent: '60' }, b: { enabled: true, percent: '30' } }
      expect(() => buildSplitsFromInputs('percent', 100, ids, inputs)).toThrow('Current: 90%')
      inputs.b.percent = '40'
      expect(buildSplitsFromInputs('percent', 100, ids, inputs)).toEqual([
        { member_id: 'a', percent: 60, share: 60 },
        { member_id: 'b', percent: 40, share: 40 },
      ])
    })

    it('splits by shares and needs at least one share', () => {
      const inputs = { a: { enabled: true, shares: '2' }, b: { enabled: true, shares: '1' } }
      expect(buildSplitsFromInputs('shares', 90, ids, inputs)).toEqual([
        { member_id: 'a', shares: 2, share: 60 },
        { member_id: 'b', shares: 1, share: 30 },
      ])
      expect(() => buildSplitsFromInputs('shares', 90, ids, { a: { enabled: true, shares: '0' } }))
        .toThrow('At least one share entry is required.')
    })
  })
})
