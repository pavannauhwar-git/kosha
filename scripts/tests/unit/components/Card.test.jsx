import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// vi.mock is hoisted, so we must NOT reference any imported variable (like React)
// inside the factory. Use a plain HTML element instead.
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, className, role, tabIndex, onKeyDown }) => (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div onClick={onClick} className={className} role={role} tabIndex={tabIndex} onKeyDown={onKeyDown}>
        {children}
      </div>
    ),
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }) => <>{children}</>,
}))

import Card from '../../../../src/components/ui/Card'

describe('Card component', () => {
  it('renders children inside a static card', () => {
    render(<Card><p>Card Content</p></Card>)
    expect(screen.getByText('Card Content')).toBeInTheDocument()
  })

  it('renders a pressable card with button role and click handler', () => {
    const handleClick = vi.fn()
    render(<Card pressable onClick={handleClick}>Pressable Card</Card>)

    const card = screen.getByRole('button')
    expect(card).toBeInTheDocument()

    fireEvent.click(card)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('triggers onClick via keyboard Enter key on pressable card', () => {
    const handleClick = vi.fn()
    render(<Card pressable onClick={handleClick}>Keyboard Card</Card>)

    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' })
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('triggers onClick via keyboard Space key on pressable card', () => {
    const handleClick = vi.fn()
    render(<Card pressable onClick={handleClick}>Space Card</Card>)

    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: ' ', code: 'Space' })
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders a static (non-pressable) card without button role', () => {
    render(<Card>Static Card</Card>)
    const card = screen.queryByRole('button')
    expect(card).not.toBeInTheDocument()
  })
})
