import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Button from '../../../../src/components/ui/Button'
import React from 'react'

// Mock haptics to prevent import errors during testing
vi.mock('../../lib/haptics', () => ({
  hapticTap: vi.fn(),
}))

describe('Button component', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>)
    // Material Web Components use light DOM for children projection
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('handles click events', () => {
    const handleClick = vi.fn()
    const { container } = render(<Button onClick={handleClick}>Submit</Button>)
    
    // We target the custom element tag directly
    const buttonElement = container.querySelector('md-filled-button')
    fireEvent.click(buttonElement)
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not trigger click when disabled', () => {
    const handleClick = vi.fn()
    const { container } = render(<Button disabled onClick={handleClick}>Submit</Button>)
    
    const buttonElement = container.querySelector('md-filled-button')
    fireEvent.click(buttonElement)
    
    expect(handleClick).not.toHaveBeenCalled()
    expect(buttonElement).toHaveAttribute('disabled', '')
  })

  it('does not trigger click when loading', () => {
    const handleClick = vi.fn()
    const { container } = render(<Button loading onClick={handleClick}>Submit</Button>)
    
    const buttonElement = container.querySelector('md-filled-button')
    fireEvent.click(buttonElement)
    
    expect(handleClick).not.toHaveBeenCalled()
    expect(buttonElement).toHaveAttribute('disabled', '')
  })

  it('renders different variants as different material tags', () => {
    const { container, rerender } = render(<Button variant="primary">Primary</Button>)
    expect(container.querySelector('md-filled-button')).toBeInTheDocument()

    rerender(<Button variant="secondary">Secondary</Button>)
    expect(container.querySelector('md-outlined-button')).toBeInTheDocument()

    rerender(<Button variant="ghost">Ghost</Button>)
    expect(container.querySelector('md-text-button')).toBeInTheDocument()
    
    rerender(<Button variant="tonal">Tonal</Button>)
    expect(container.querySelector('md-filled-tonal-button')).toBeInTheDocument()
  })
})
