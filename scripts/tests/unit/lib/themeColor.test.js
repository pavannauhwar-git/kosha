import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { applyThemeColor, trackTopBar } from '../../../../src/lib/themeColor'

const TOKENS = { '--ds-surface': '#FFFFFF', '--ds-surface-dim': '#F0F4F9' }

describe('themeColor', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#000000">'
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (name) => TOKENS[name] ?? '',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const themeColor = () => document.querySelector('meta[name="theme-color"]').getAttribute('content')

  it('uses the page colour when no top bar is on screen', () => {
    applyThemeColor()
    expect(themeColor()).toBe('#F0F4F9')
  })

  it('uses the top bar colour while a top bar is mounted', () => {
    const untrack = trackTopBar()
    expect(themeColor()).toBe('#FFFFFF')
    untrack()
    expect(themeColor()).toBe('#F0F4F9')
  })

  it('keeps the top bar colour while the next page’s bar replaces the old one', () => {
    const untrackOld = trackTopBar()
    const untrackNew = trackTopBar()
    untrackOld()
    expect(themeColor()).toBe('#FFFFFF')
    untrackNew()
    expect(themeColor()).toBe('#F0F4F9')
  })
})
