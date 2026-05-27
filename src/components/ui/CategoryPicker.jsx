import { memo } from 'react'
import { motion } from 'framer-motion'
import { getCategoriesForType } from '../../lib/categories'
import { useUserCategories } from '../../hooks/useUserCategories'
import CategoryIcon from '../categories/CategoryIcon'

/**
 * CategoryPicker — grid of icons+labels for selecting a category
 * @param {{ type: string, value: string, onChange: function, className?: string }} props
 */
const CategoryPicker = memo(function CategoryPicker({ type, value, onChange, className = '' }) {
  // We call this hook even if we don't use the 'customCategories' value directly,
  // because this hook is what invalidates/re-renders when categories are added/updated.
  useUserCategories()
  const categories = getCategoriesForType(type)

  return (
    <div className={`grid grid-cols-4 gap-2 ${className}`} role="radiogroup" aria-label="Select category">
      {categories.map((cat) => {
        const isSelected = value === cat.id
        return (
          <motion.button
            key={cat.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(cat.id)}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            className={[
              'flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-[background-color,box-shadow] duration-150 will-change-transform',
              'min-h-[44px] min-w-[44px]',
              isSelected
                ? 'bg-[var(--ds-primary-container)] ring-2 ring-[var(--ds-primary)]'
                : 'bg-[var(--ds-surface-container)] hover:bg-[var(--ds-surface-container-high)]',
            ].join(' ')}
          >
            <motion.div
              animate={isSelected ? { scale: [1, 1.22, 1], rotate: [0, -6, 6, 0] } : {}}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
            >
              <CategoryIcon id={cat.id} size={24} />
            </motion.div>
            <span className={[
              'text-[10px] leading-tight font-medium text-center line-clamp-1',
              isSelected ? 'text-[var(--ds-on-primary-container)]' : 'text-[var(--ds-text-secondary)]',
            ].join(' ')}>
              {cat.label}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
})

export default CategoryPicker
