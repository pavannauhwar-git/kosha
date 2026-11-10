import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// vi.mock is hoisted — cannot reference any imported var inside factory
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, className, ...rest }) => (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={onClick} className={className} {...rest}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
  useDragControls: () => ({ start: vi.fn() }),
}))

vi.mock('../../../../src/hooks/useOverlayFocusTrap', () => ({
  default: () => ({ current: null }),
}))

import Sheet from '../../../../src/components/ui/Sheet'

describe('Sheet component', () => {
  it('renders nothing when closed', () => {
    render(
      <Sheet open={false} onClose={vi.fn()} title="Test Sheet">
        <p>Sheet Content</p>
      </Sheet>
    )
    expect(screen.queryByText('Sheet Content')).not.toBeInTheDocument()
  })

  it('renders children when open', () => {
    render(
      <Sheet open={true} onClose={vi.fn()} title="Test Sheet">
        <p>Sheet Content</p>
      </Sheet>
    )
    expect(screen.getByText('Sheet Content')).toBeInTheDocument()
  })

  it('renders the title when open', () => {
    render(<Sheet open={true} onClose={vi.fn()} title="My Title"><span /></Sheet>)
    expect(screen.getByText('My Title')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(<Sheet open={true} onClose={handleClose} title="Closable Sheet"><span /></Sheet>)

    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('closes on the Android back gesture through CloseWatcher', () => {
    const watchers = []
    class FakeCloseWatcher {
      constructor() {
        this.onclose = null
        this.destroy = vi.fn()
        watchers.push(this)
      }
    }
    vi.stubGlobal('CloseWatcher', FakeCloseWatcher)
    try {
      const handleClose = vi.fn()
      const { rerender } = render(<Sheet open={true} onClose={handleClose} title="Back"><span /></Sheet>)
      expect(watchers).toHaveLength(1)

      watchers[0].onclose()
      expect(handleClose).toHaveBeenCalledTimes(1)

      rerender(<Sheet open={false} onClose={handleClose} title="Back"><span /></Sheet>)
      expect(watchers[0].destroy).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('sets correct dialog semantics for accessibility', () => {
    render(<Sheet open={true} onClose={vi.fn()} title="Accessible Sheet"><span /></Sheet>)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Accessible Sheet')
  })
})
