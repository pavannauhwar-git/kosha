import { describe, it, expect, afterEach } from 'vitest'
import {
  buildCategorySlug,
  categoryLabelError,
  categoryLabelKey,
  normalizeCategoryLabel,
  randomSlugSuffix,
} from '../../../../src/lib/categorySlug'
import { getCategoriesForType, getCategory, normalizeCategoryForType, registerCustomCategories } from '../../../../src/lib/categories'

const SLUG_PATTERN = /^custom_[a-z0-9_]+$/

describe('categorySlug', () => {
  it('builds a database-safe id for names in Indian scripts', () => {
    expect(buildCategorySlug('किराना', 'ab12cd')).toBe('custom_ab12cd')
    expect(buildCategorySlug('மளிகை பொருட்கள்', 'zz99yy')).toMatch(SLUG_PATTERN)
  })

  it('keeps the Latin part of a name and drops accents', () => {
    expect(buildCategorySlug('Café  Runs', 'x1y2z3')).toBe('custom_cafe_runs_x1y2z3')
    expect(buildCategorySlug('Kids school fees and uniforms', 'abc123')).toBe('custom_kids_school_fees_and_abc123')
  })

  it('gives two identical names different ids', () => {
    expect(buildCategorySlug('Gym')).not.toBe(buildCategorySlug('Gym'))
    expect(buildCategorySlug('Gym')).toMatch(SLUG_PATTERN)
    expect(randomSlugSuffix()).toMatch(/^[a-z0-9]{6}$/)
  })

  it('accepts names in any script and rejects symbol-only names', () => {
    expect(categoryLabelError('दूध')).toBeNull()
    expect(categoryLabelError('Rent')).toBeNull()
    expect(categoryLabelError('a')).toBe('Category name must be 2–30 characters')
    expect(categoryLabelError('x'.repeat(31))).toBe('Category name must be 2–30 characters')
    expect(categoryLabelError('!!')).toBe('Category name needs at least one letter or number')
  })

  it('compares names without case or extra spaces', () => {
    expect(normalizeCategoryLabel('  Pet   care ')).toBe('Pet care')
    expect(categoryLabelKey('Pet Care')).toBe(categoryLabelKey(' pet  care'))
  })
})

describe('custom category registry', () => {
  afterEach(() => registerCustomCategories([]))

  it('hides archived categories from pickers but still names old entries', () => {
    registerCustomCategories([
      { id: 'custom_gym_aaaaaa', label: 'Gym', type: 'expense', archived: false },
      { id: 'custom_pets_bbbbbb', label: 'Pets', type: 'expense', archived: true },
    ])
    const pickerIds = getCategoriesForType('expense').map((c) => c.id)
    expect(pickerIds).toContain('custom_gym_aaaaaa')
    expect(pickerIds).not.toContain('custom_pets_bbbbbb')
    expect(getCategory('custom_pets_bbbbbb').label).toBe('Pets')
  })

  it('does not offer an archived category for a new entry', () => {
    registerCustomCategories([{ id: 'custom_pets_bbbbbb', label: 'Pets', type: 'expense', archived: true }])
    expect(normalizeCategoryForType('expense', 'custom_pets_bbbbbb')).toBe('other')
  })
})
