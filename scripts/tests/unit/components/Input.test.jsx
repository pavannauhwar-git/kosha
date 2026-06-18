import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Input from '../../../../src/components/ui/Input'

describe('Input component', () => {
  it('renders with label and placeholder', () => {
    const { container } = render(<Input label="Name" placeholder="John Doe" />)
    const el = container.querySelector('md-outlined-text-field')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('label', 'Name')
    expect(el).toHaveAttribute('placeholder', 'John Doe')
  })

  it('passes value correctly', () => {
    const { container } = render(<Input value="Test Value" />)
    const el = container.querySelector('md-outlined-text-field')
    expect(el).toHaveAttribute('value', 'Test Value')
  })

  it('triggers onChange on input event', () => {
    const handleChange = vi.fn()
    const { container } = render(<Input value="" onChange={handleChange} />)
    
    const el = container.querySelector('md-outlined-text-field')
    // Manually trigger the native input event that the component listens to
    fireEvent(el, new Event('input', { bubbles: true }))
    
    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it('displays error text when error prop is passed', () => {
    const { container } = render(<Input error="Invalid input" />)
    const el = container.querySelector('md-outlined-text-field')
    expect(el).toHaveAttribute('error', '')
    expect(el).toHaveAttribute('error-text', 'Invalid input')
  })

  it('displays helper text when no error', () => {
    const { container } = render(<Input helperText="Helper info" />)
    const el = container.querySelector('md-outlined-text-field')
    expect(el).not.toHaveAttribute('error')
    expect(el).toHaveAttribute('supporting-text', 'Helper info')
  })

  it('handles disabled state', () => {
    const { container } = render(<Input disabled />)
    const el = container.querySelector('md-outlined-text-field')
    expect(el).toHaveAttribute('disabled', '')
  })
})
