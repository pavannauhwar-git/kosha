import { memo } from 'react'
import { getCategoriesForType } from '../../lib/categories'
import CategoryIcon from '../categories/CategoryIcon'

/**
 * CategoryPicker — grid of icons+labels for selecting a category
 * @param {{ type: string, value: string, onChange: function, className?: string }} props
 */
const CategoryPicker = memo(function CategoryPicker({ type, value, onChange, className = '' }) {
  const categories = getCategoriesForType(type)

  return (
    <div className={`grid grid-cols-4 gap-2 ${className}`} role="radiogroup" aria-label="Select category">
      {categories.map((cat) => {
        const isSelected = value === cat.id
        return (
          <button
            key={cat.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(cat.id)}
            className={[
              'flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-all duration-150',
              'min-h-[44px] min-w-[44px]',
              isSelected
                ? 'bg-[var(--ds-primary-container)] ring-2 ring-[var(--ds-primary)] scale-[1.02]'
                : 'bg-[var(--ds-surface-container)] hover:bg-[var(--ds-surface-container-high)] active:scale-95',
            ].join(' ')}
          >
            <CategoryIcon id={cat.id} size={24} />
            <span className={[
              'text-[10px] leading-tight font-medium text-center line-clamp-1',
              isSelected ? 'text-[var(--ds-on-primary-container)]' : 'text-[var(--ds-text-secondary)]',
            ].join(' ')}>
              {cat.label}
            </span>
          </button>
        )
      })}
    </div>
  )
})

export default CategoryPicker
