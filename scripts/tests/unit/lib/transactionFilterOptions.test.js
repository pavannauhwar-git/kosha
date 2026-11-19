import { describe, it, expect, afterEach } from 'vitest'
import {
  getCategoriesForType,
  getTransactionFilterOptions,
  registerCustomCategories,
} from '../../../../src/lib/categories'

afterEach(() => {
  registerCustomCategories([])
})

describe('getTransactionFilterOptions', () => {
  it('returns the normal categories for income and expense', () => {
    expect(getTransactionFilterOptions('expense')).toEqual(getCategoriesForType('expense'))
    expect(getTransactionFilterOptions('income')).toEqual(getCategoriesForType('income'))
  })

  it('lists investment types by label, with Other last', () => {
    const options = getTransactionFilterOptions('investment')
    expect(options[0]).toEqual({ id: 'Mutual Fund', label: 'Mutual Fund' })
    expect(options.at(-1)).toEqual({ id: 'Other', label: 'Other' })
    expect(options.filter((o) => o.label === 'Other')).toHaveLength(1)
    expect(options.every((o) => o.id === o.label)).toBe(true)
  })

  it('adds active custom investment types once, and skips archived ones', () => {
    registerCustomCategories([
      { id: 'custom_reit_a1', label: 'REIT', type: 'investment' },
      { id: 'custom_gold_b2', label: 'Gold', type: 'investment' },
      { id: 'custom_old_c3', label: 'Chit Fund', type: 'investment', archived: true },
      { id: 'custom_gym_d4', label: 'Gym', type: 'expense' },
    ])
    const labels = getTransactionFilterOptions('investment').map((o) => o.label)
    expect(labels).toContain('REIT')
    expect(labels.filter((l) => l === 'Gold')).toHaveLength(1)
    expect(labels).not.toContain('Chit Fund')
    expect(labels).not.toContain('Gym')
    expect(labels.at(-1)).toBe('Other')
  })
})
