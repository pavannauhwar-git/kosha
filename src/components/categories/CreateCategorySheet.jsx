import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Check } from '@phosphor-icons/react'
import { ICON_MAP } from './CategoryIcon'
import { createUserCategory } from '../../hooks/useUserCategories'

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

export default function CreateCategorySheet({ type, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Tag')
  const [selectedType, setSelectedType] = useState(type || 'expense')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const iconOptions = ICON_OPTIONS_BY_TYPE[selectedType] || ICON_OPTIONS_BY_TYPE.expense

  const selectedIconTone = selectedType === 'expense'
    ? 'text-expense-text'
    : selectedType === 'income'
      ? 'text-income-text'
      : 'text-invest-text'

  const selectedIconBg = selectedType === 'expense'
    ? 'bg-expense-bg border-expense-border'
    : selectedType === 'income'
      ? 'bg-income-bg border-income-border'
      : 'bg-invest-bg border-invest-border'

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
      const cat = await createUserCategory({ label: trimmed, type: selectedType, icon })
      onCreated(cat)
      onClose()
    } catch (e) {
      setError(e.message || 'Could not create category')
      setSaving(false)
    }
  }

  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={saving ? undefined : onClose}
      />
      <motion.div className="sheet-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
        exit={{ y: '100%', transition: { duration: 0.2 } }}
      >
        <div className="sheet-handle" />
        <div className="px-4 pb-4">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[18px] font-bold text-ink">Create Category</h3>
            <button onClick={saving ? undefined : onClose} disabled={saving} className="close-btn disabled:opacity-40">
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
                  setSelectedType(option.id)
                  const nextOptions = ICON_OPTIONS_BY_TYPE[option.id] || []
                  if (!nextOptions.includes(icon) && nextOptions.length > 0) {
                    setIcon(nextOptions[0])
                  }
                }}
                disabled={saving}
                className={`h-9 rounded-card text-[12px] font-semibold border transition-all disabled:opacity-50
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
            {iconOptions.map(iconName => {
              const Icon = ICON_MAP[iconName]
              if (!Icon) return null
              const selected = icon === iconName
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  disabled={saving}
                  className={`w-full aspect-square rounded-card flex items-center justify-center
                    border transition-all disabled:opacity-50
                    ${selected
                      ? selectedIconBg
                      : 'bg-kosha-surface-2 border-transparent'}`}
                >
                  <Icon size={20} weight="duotone" className={selected ? selectedIconTone : 'text-ink-3'} />
                </button>
              )
            })}
          </div>

          {/* Error */}
          {error && <p className="text-expense-text text-[13px] mb-3 px-1">{error}</p>}

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={saving || name.trim().length < 2}
            className={`w-full py-3.5 rounded-card text-[15px] font-semibold flex items-center
                        justify-center gap-2 transition-all
                        ${saving
                          ? 'bg-brand/70 text-white/90 cursor-not-allowed'
                          : 'bg-brand text-white active:scale-[0.97] disabled:opacity-50'}`}
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
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Check size={16} weight="bold" />
                <span>Create Category</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </>
  )
}
