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

  it('submits the surrounding form on Enter', () => {
    const handleSubmit = vi.fn((e) => e.preventDefault())
    const { container } = render(
      <form onSubmit={handleSubmit}>
        <Input value="" enterKeyHint="done" />
      </form>
    )
    const el = container.querySelector('md-outlined-text-field')
    fireEvent.keyDown(el, { key: 'Enter' })
    expect(handleSubmit).toHaveBeenCalledTimes(1)
  })

  it('moves to the next field instead of submitting when the hint is "next"', () => {
    const handleSubmit = vi.fn((e) => e.preventDefault())
    const { container } = render(
      <form onSubmit={handleSubmit}>
        <Input value="" enterKeyHint="next" />
        <Input value="" enterKeyHint="done" />
      </form>
    )
    const [first, second] = container.querySelectorAll('md-outlined-text-field')
    const focusSpy = vi.spyOn(second, 'focus')
    fireEvent.keyDown(first, { key: 'Enter' })
    expect(focusSpy).toHaveBeenCalled()
    expect(handleSubmit).not.toHaveBeenCalled()
  })

  it('ignores Enter outside a form and other keys', () => {
    const handleSubmit = vi.fn((e) => e.preventDefault())
    const { container } = render(
      <>
        <Input value="" />
        <form onSubmit={handleSubmit}><Input value="" /></form>
      </>
    )
    const [outside, inside] = container.querySelectorAll('md-outlined-text-field')
    fireEvent.keyDown(outside, { key: 'Enter' })
    fireEvent.keyDown(inside, { key: 'a' })
    expect(handleSubmit).not.toHaveBeenCalled()
  })
})
