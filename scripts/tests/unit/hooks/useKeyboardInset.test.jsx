import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import useKeyboardInset from '../../../../src/hooks/useKeyboardInset'

function Harness() {
  useKeyboardInset()
  return <input aria-label="Amount" />
}

function setScrollY(y) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
}

describe('useKeyboardInset', () => {
  let vv
  let scrollTo

  beforeEach(() => {
    vv = new EventTarget()
    vv.height = window.innerHeight
    vv.offsetTop = 0
    vv.scale = 1
    vi.stubGlobal('visualViewport', vv)
    vi.stubGlobal('requestAnimationFrame', (cb) => { cb(0); return 1 })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    setScrollY(600)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    scrollTo.mockRestore()
    setScrollY(0)
  })

  function resizeViewport(height) {
    vv.height = height
    vv.dispatchEvent(new Event('resize'))
  }

  const kbInset = () => document.documentElement.style.getPropertyValue('--kb-inset')

  it('ignores viewport changes during a scroll with no field focused', () => {
    render(<Harness />)

    resizeViewport(window.innerHeight - 300)
    expect(kbInset()).toBe('0px')
    resizeViewport(window.innerHeight)

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('ignores small viewport changes while a field is focused', () => {
    render(<Harness />)
    screen.getByLabelText('Amount').focus()

    resizeViewport(window.innerHeight - 60)
    resizeViewport(window.innerHeight)

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('returns to the position before focus when the keyboard closes', () => {
    render(<Harness />)
    screen.getByLabelText('Amount').focus()
    setScrollY(900)

    resizeViewport(window.innerHeight - 300)
    expect(kbInset()).toBe('300px')
    resizeViewport(window.innerHeight)

    expect(scrollTo).toHaveBeenCalledWith(0, 600)
  })
})
