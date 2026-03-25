import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import CategoryIcon from '../CategoryIcon'

const ONE_UI_SPRING = { type: 'spring', stiffness: 500, damping: 35 }

export default function BudgetSheet({ cat, current, onSave, onRemove, onClose }) {
  const [value, setValue] = useState(current ? String(current) : '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const amt = parseFloat(value)
    if (!amt || amt <= 0) return
    setSaving(true)
    try {
      await onSave(cat.id, amt)
      onClose()
    } catch {
      // Optional: show error UI here
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setSaving(true)
    try {
      await onRemove(cat.id)
      onClose()
    } catch {
      // Optional: show error UI here
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <motion.div
        className="sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, pointerEvents: 'none' }}
        onClick={saving ? undefined : onClose}
      />
      <motion.div
        className="sheet-panel oneui-sheet-radius"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: ONE_UI_SPRING }}
        exit={{ y: '100%', transition: { duration: 0.22 } }}
      >
        <div className="sheet-handle" />
        <div className="px-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <CategoryIcon categoryId={cat.id} size={18} />
              <h2 className="text-[20px] font-bold text-ink">{cat.label} Budget</h2>
            </div>
            <button onClick={saving ? undefined : onClose} className="close-btn" disabled={saving}>
              <X size={16} className="text-ink-3" />
            </button>
          </div>

          <p className="text-caption text-ink-3 mb-2">Monthly limit</p>
          <div className="bg-kosha-surface-2 rounded-card px-4 py-3 mb-5 flex items-center gap-2">
            <span className="font-display text-2xl font-bold text-brand">₹</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={value}
              onChange={e => setValue(e.target.value)}
              autoFocus
              disabled={saving}
              className="flex-1 bg-transparent font-display text-3xl font-bold text-ink
                         outline-none tabular-nums placeholder-ink-4 disabled:opacity-50"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !value || +value <= 0}
            className="w-full py-4 rounded-card text-[17px] font-semibold bg-brand text-white
                       active:scale-[0.98] disabled:opacity-40 transition-all mb-3"
          >
            {saving ? 'Saving…' : current ? 'Update Budget' : 'Set Budget'}
          </button>

          {current > 0 && (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="w-full py-3 rounded-card text-[15px] font-semibold
                         bg-expense-bg text-expense-text border border-expense-border
                         active:scale-[0.98] disabled:opacity-40 transition-all"
            >
              Remove Budget
            </button>
          )}
          <div className="h-2" />
        </div>
      </motion.div>
    </>
  )
}
