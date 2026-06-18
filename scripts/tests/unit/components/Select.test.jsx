import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Select from '../../../../src/components/ui/Select'
import React from 'react'

describe('Select component', () => {
  const options = [
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' }
  ]

  it('renders with label and options', () => {
    const { container } = render(<Select label="Choices" options={options} />)
    const el = container.querySelector('md-outlined-select')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('label', 'Choices')
    
    const renderedOptions = el.querySelectorAll('md-select-option')
    expect(renderedOptions.length).toBe(2)
    expect(renderedOptions[0]).toHaveAttribute('value', 'opt1')
  })

  it('passes value correctly', () => {
    const { container } = render(<Select value="opt2" options={options} />)
    const el = container.querySelector('md-outlined-select')
    expect(el).toHaveAttribute('value', 'opt2')
  })

  it('triggers onChange on change event', () => {
    const handleChange = vi.fn()
    const { container } = render(<Select value="opt1" options={options} onChange={handleChange} />)
    
    const el = container.querySelector('md-outlined-select')
    // Manually trigger the native change event that the component listens to
    fireEvent(el, new Event('change', { bubbles: true }))
    
    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it('displays error text when error prop is passed', () => {
    const { container } = render(<Select error="Selection required" />)
    const el = container.querySelector('md-outlined-select')
    expect(el).toHaveAttribute('error', '')
    expect(el).toHaveAttribute('error-text', 'Selection required')
  })

  it('renders placeholder correctly', () => {
    const { container } = render(<Select placeholder="Select one" options={options} />)
    const el = container.querySelector('md-outlined-select')
    const renderedOptions = el.querySelectorAll('md-select-option')
    
    expect(renderedOptions.length).toBe(3) // 1 placeholder + 2 options
    expect(renderedOptions[0]).toHaveAttribute('disabled')
    expect(renderedOptions[0]).toHaveAttribute('value', '')
  })
})
