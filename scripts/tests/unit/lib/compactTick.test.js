import { describe, it, expect } from 'vitest'
import { compactTick } from '../../../../src/lib/compactTick'

describe('compactTick', () => {
  it('uses lakh and crore, not million', () => {
    expect(compactTick(950)).toBe('950')
    expect(compactTick(12_000)).toBe('12k')
    expect(compactTick(12_00_000)).toBe('12L')
    expect(compactTick(3_40_00_000)).toBe('3.4Cr')
    expect(compactTick(-1_50_000)).toBe('-1.5L')
  })
})
