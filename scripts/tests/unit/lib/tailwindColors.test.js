import { describe, it, expect } from 'vitest'
import config from '../../../../tailwind.config.js'

const colors = config.theme.extend.colors

describe('tailwind colour tokens', () => {
  it('keep the plain variable when no opacity modifier is used', () => {
    expect(colors.brand({})).toBe('var(--ds-primary)')
    expect(colors.brand({ opacityVariable: '--tw-bg-opacity', opacityValue: 'var(--tw-bg-opacity, 1)' })).toBe('var(--ds-primary)')
    expect(colors['kosha-bg']({ opacityValue: '1' })).toBe('var(--ds-surface-dim)')
  })

  it('blend with transparent for an opacity modifier', () => {
    expect(colors.brand({ opacityValue: '0.2' })).toBe('color-mix(in srgb, var(--ds-primary) 20%, transparent)')
    expect(colors['kosha-bg']({ opacityValue: '0.95' })).toBe('color-mix(in srgb, var(--ds-surface-dim) 95%, transparent)')
    expect(colors.ink({ opacityValue: '0.06' })).toBe('color-mix(in srgb, var(--ds-text) 6%, transparent)')
    expect(colors.brand({ opacityValue: 0 })).toBe('color-mix(in srgb, var(--ds-primary) 0%, transparent)')
  })

  it('leave literal colours alone', () => {
    expect(colors['on-grad']).toBe('#FFFFFF')
    expect(colors['on-grad-2']).toBe('rgba(255,255,255,0.75)')
  })

  it('take category borders from the theme, so they change in dark mode', () => {
    for (const name of ['income', 'expense', 'invest', 'repay', 'warning']) {
      expect(colors[`${name}-border`]({})).toBe(`var(--ds-${name}-border)`)
    }
  })
})
