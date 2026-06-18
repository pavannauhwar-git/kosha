import { describe, it, expect } from 'vitest'
import {
  buildEqualSplits,
  buildExactSplits,
  buildPercentSplits,
  buildShareSplits
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
  })
})
