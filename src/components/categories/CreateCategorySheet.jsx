import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Check } from '@phosphor-icons/react'
import { ICON_MAP } from './CategoryIcon'
import { createUserCategory, updateUserCategory } from '../../hooks/useUserCategories'
import useOverlayFocusTrap from '../../hooks/useOverlayFocusTrap'

const ICON_OPTIONS_BY_TYPE = {
  expense: [
    'ForkKnife', 'ShoppingCart', 'Handbag', 'BowlFood', 'Car', 'GasPump',
    'AirplaneTilt', 'DeviceMobile', 'Phone', 'WifiHigh', 'House', 'Hammer',
    'Broom', 'MapPin', 'CalendarCheck', 'Ticket', 'Confetti', 'Gift',
    'Heart', 'FileText', 'Scales', 'CreditCard', 'Receipt', 'BookOpen',
    'Cigarette',
    'Popcorn', 'FirstAid', 'Barbell', 'PawPrint', 'Baby', 'Tag',
  ],
  income: [
    'MoneyWavy', 'Wallet', 'CashRegister', 'HandCoins', 'Coins', 'ChartLineUp',
    'TrendUp', 'IdentificationBadge', 'Sparkle', 'ArrowsCounterClockwise', 'Globe', 'Certificate',
  ],
  investment: [
    'Plant', 'TrendUp', 'Vault', 'Coin', 'Umbrella', 'Diamond',
    'Buildings', 'CurrencyBtc', 'Scroll', 'Briefcase', 'Bank', 'Certificate',
  ],
}

const CATEGORY_TYPES = [
  { id: 'expense', label: 'Expense', activeClass: 'bg-expense-bg text-expense-text border-expense-border' },
  { id: 'income', label: 'Income', activeClass: 'bg-income-bg text-income-text border-income-border' },
  { id: 'investment', label: 'Investment', activeClass: 'bg-invest-bg text-invest-text border-invest-border' },
]

const ICON_SWATCHES_BY_TYPE = {
  expense: [
    { color: '#D24B4B', bg: '#FFE8E6' },
    { color: '#D17A00', bg: '#FFF2DF' },
    { color: '#8D5CF6', bg: '#F1EAFF' },
    { color: '#2E9F8F', bg: '#E7F8F4' },
    { color: '#007FFF', bg: '#E6F2FF' },
    { color: '#B357E8', bg: '#F5E9FF' },
  ],
  income: [
    { color: '#1E9E63', bg: '#E8F9EF' },
    { color: '#0AA3B5', bg: '#E7FAFC' },
    { color: '#2B8A3E', bg: '#EAF8ED' },
    { color: '#1F7AE0', bg: '#E6F1FF' },
    { color: '#5E60CE', bg: '#ECECFF' },
    { color: '#F08C00', bg: '#FFF3E0' },
  ],
  investment: [
    { color: '#2D9CDB', bg: '#EAF6FF' },
    { color: '#2F80ED', bg: '#E9F2FF' },
    { color: '#27AE60', bg: '#E8F8EE' },
    { color: '#9B51E0', bg: '#F4E9FF' },
    { color: '#F2C94C', bg: '#FFF8DD' },
    { color: '#F2994A', bg: '#FFF1E6' },
    { color: '#EB5757', bg: '#FFECEC' },
    { color: '#56CCF2', bg: '#E8FAFF' },
  ],
}

function getIconSwatch(type, index) {
  const palette = ICON_SWATCHES_BY_TYPE[type] || ICON_SWATCHES_BY_TYPE.expense
  return palette[index % palette.length]
}

export default function CreateCategorySheet({ type, onClose, onSaved, onCreated, existingCategory = null }) {
  const isEditing = Boolean(existingCategory?.dbId)
  const initialType = existingCategory?.type || type || 'expense'
  const initialIcons = ICON_OPTIONS_BY_TYPE[initialType] || ICON_OPTIONS_BY_TYPE.expense
  const [name, setName] = useState(existingCategory?.label || '')
  const [icon, setIcon] = useState(existingCategory?.icon || initialIcons[0] || 'Tag')
  const [selectedType, setSelectedType] = useState(initialType)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const sheetRef = useOverlayFocusTrap(true, {
    onClose: saving ? undefined : onClose,
    initialFocusSelector: 'input[name="category-name"]',
  })

  const iconOptions = ICON_OPTIONS_BY_TYPE[selectedType] || ICON_OPTIONS_BY_TYPE.expense

  async function handleCreate() {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters')
      return
    }
    if (trimmed.length > 30) {
      setError('Name must be 30 characters or less')
      return
    }

    setSaving(true)
    setError('')

    try {
      const cat = isEditing
        ? await updateUserCategory({
          dbId: existingCategory.dbId,
          label: trimmed,
          icon,
        })
        : await createUserCategory({ label: trimmed, type: selectedType, icon })

      onSaved?.(cat)
      onCreated?.(cat)
      onClose()
    } catch (e) {
      setError(e.message || (isEditing ? 'Could not update category' : 'Could not create category'))
      setSaving(false)
    }
  }

  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={saving ? undefined : onClose}
      />
      <motion.div
        ref={sheetRef}
        className="sheet-panel"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Create category"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
        exit={{ y: '100%', transition: { duration: 0.2 } }}
      >
        <div className="sheet-handle" />
        <div className="px-4 pb-4">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[18px] font-bold text-ink">{isEditing ? 'Edit Category' : 'Create Category'}</h3>
            <button
              type="button"
              aria-label="Close create category sheet"
              onClick={saving ? undefined : onClose}
              disabled={saving}
              className="close-btn disabled:opacity-40"
            >
              <X size={16} className="text-ink-3" />
            </button>
          </div>

          {/* Name input */}
          <input
            type="text"
            name="category-name"
            placeholder="Category name"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={saving}
            maxLength={30}
            autoFocus
            className="input mb-4 disabled:opacity-50"
          />

          <p className="text-[13px] font-medium text-ink-3 mb-2">Category type</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {CATEGORY_TYPES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  if (isEditing) return
                  setSelectedType(option.id)
                  const nextOptions = ICON_OPTIONS_BY_TYPE[option.id] || []
                  if (!nextOptions.includes(icon) && nextOptions.length > 0) {
                    setIcon(nextOptions[0])
                  }
                }}
                disabled={saving || isEditing}
                className={`h-9 rounded-card text-[12px] font-semibold border transition-[background-color,border-color,color] duration-150 disabled:opacity-50
                  ${selectedType === option.id
                    ? option.activeClass
                    : 'bg-kosha-surface text-ink-3 border-kosha-border'}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Icon picker */}
          <p className="text-[13px] font-medium text-ink-3 mb-2">Choose an icon</p>
          <div className="grid grid-cols-6 gap-2 mb-4">
            {iconOptions.map((iconName, index) => {
              const Icon = ICON_MAP[iconName]
              if (!Icon) return null
              const selected = icon === iconName
              const swatch = getIconSwatch(selectedType, index)
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  disabled={saving}
                  className={`w-full aspect-square rounded-card flex items-center justify-center
                    border transition-[background-color,border-color] duration-150 disabled:opacity-50
                    ${selected
                      ? ''
                      : 'bg-kosha-surface-2 border-transparent'}`}
                  style={selected ? { backgroundColor: swatch.bg, borderColor: swatch.color } : undefined}
                >
                  <Icon size={20} weight="duotone" style={{ color: swatch.color }} />
                </button>
              )
            })}
          </div>

          {/* Error */}
          {error && <p className="text-expense-text text-[13px] mb-3 px-1" role="alert" aria-live="polite">{error}</p>}

          {/* Create button */}
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || name.trim().length < 2}
            className={`w-full py-3.5 rounded-card text-[15px] font-semibold flex items-center
                        justify-center gap-2 transition-[transform,background-color,opacity] duration-150 will-change-transform
                        ${saving
                          ? 'bg-brand/70 text-white/90 cursor-not-allowed'
                          : 'bg-brand text-white active:scale-[0.97] disabled:opacity-50 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]'}`}
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg"
                  fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{isEditing ? 'Saving...' : 'Creating...'}</span>
              </>
            ) : (
              <>
                <Check size={16} weight="bold" />
                <span>{isEditing ? 'Save Changes' : 'Create Category'}</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </>
  )
}
