import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import useOverlayFocusTrap from '../../../../src/hooks/useOverlayFocusTrap'

function Overlay({ onClose, label }) {
  const ref = useOverlayFocusTrap(true, { onClose, restoreFocus: false })
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
      <button type="button">{label} action</button>
    </div>
  )
}

describe('useOverlayFocusTrap', () => {
  it('closes only the topmost overlay on Escape', () => {
    const closeParent = vi.fn()
    const closeChild = vi.fn()
    render(
      <>
        <Overlay onClose={closeParent} label="Parent" />
        <Overlay onClose={closeChild} label="Picker" />
      </>
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(closeChild).toHaveBeenCalledTimes(1)
    expect(closeParent).not.toHaveBeenCalled()
  })

  it('closes a single overlay on Escape', () => {
    const onClose = vi.fn()
    render(<Overlay onClose={onClose} label="Only" />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
