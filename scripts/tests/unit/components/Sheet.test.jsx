import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

// vi.mock is hoisted — cannot reference any imported var inside factory
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, className, ...rest }) => (
      <div onClick={onClick} className={className} {...rest}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}))

vi.mock('../../hooks/useOverlayFocusTrap', () => ({
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

  it('sets correct dialog semantics for accessibility', () => {
    render(<Sheet open={true} onClose={vi.fn()} title="Accessible Sheet"><span /></Sheet>)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Accessible Sheet')
  })
})
