import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { X, NotePencil, CaretRight, Plus, CalendarDots, PencilSimple, Trash } from '@phosphor-icons/react'
import Button from '../ui/Button'
import PixelDatePicker from '../ui/PixelDatePicker'
import {
  saveTransactionMutation,
} from '../../hooks/useTransactions'
import CategoryIcon, { ICON_MAP } from '../categories/CategoryIcon'
import {
  CATEGORIES,
  PAYMENT_MODES,
  INVESTMENT_VEHICLES,
  getCategoriesForType,
  normalizeCategoryForType,
} from '../../lib/categories'
import { archiveUserCategory, useUserCategories } from '../../hooks/useUserCategories'
import useOverlayFocusTrap from '../../hooks/useOverlayFocusTrap'
import CreateCategorySheet from '../categories/CreateCategorySheet'
import { useSplitwise, addSplitExpenseMutation, buildEqualSplits } from '../../hooks/useSplitwise'
import { supabase } from '../../lib/supabase'


function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const TYPES = [
  { id: 'expense', label: 'Expense', color: 'text-expense-text', bg: 'bg-expense-bg' },
  { id: 'income', label: 'Income', color: 'text-income-text', bg: 'bg-income-bg' },
  { id: 'investment', label: 'Investment', color: 'text-invest-text', bg: 'bg-invest-bg' },
]

const RECURRENCE_OPTIONS = ['monthly', 'quarterly', 'yearly']
const PICKER_PEEK_X = 140
const PICKER_OPEN_THRESHOLD = PICKER_PEEK_X * 0.42
const PICKER_ACTIONS_ENABLE_X = -36
const CATEGORY_SWIPE_HINT_DISMISSED_KEY = 'kosha:category-swipe-manage-hint-dismissed-v1'
const CATEGORY_SWIPE_HINT_LEARNED_KEY = 'kosha:category-swipe-manage-hint-learned-v1'

function SwipeManagePickerRow({
  selected,
  label,
  onSelect,
  canManage,
  onEdit,
  onDelete,
  onSwipeLearned,
  leading,
  showTopBorder,
}) {
  const x = useMotionValue(0)
  const actionOpacity = useTransform(x, [0, -30, -PICKER_PEEK_X], [0, 0.5, 1])
  const actionScale = useTransform(x, [-PICKER_PEEK_X * 0.4, -PICKER_PEEK_X], [0.92, 1])
  const [actionsEnabled, setActionsEnabled] = useState(false)
  const swipeLearnedRef = useRef(false)

  const markSwipeLearned = () => {
    if (swipeLearnedRef.current) return
    swipeLearnedRef.current = true
    onSwipeLearned?.()
  }

  useEffect(() => {
    const unsubscribe = x.on('change', (latest) => {
      const nextEnabled = latest <= PICKER_ACTIONS_ENABLE_X
      setActionsEnabled((prev) => (prev === nextEnabled ? prev : nextEnabled))
    })
    return () => unsubscribe()
  }, [x])

  const snapToPeek = () => {
    animate(x, -PICKER_PEEK_X, { type: 'spring', stiffness: 600, damping: 45 })
  }

  const snapToRest = () => {
    animate(x, 0, { type: 'spring', stiffness: 600, damping: 45 })
  }

  const handleDragEnd = (_, info) => {
    if (!canManage) return
    const ox = info.offset.x
    if (ox > 0) {
      snapToRest()
      return
    }
    if (ox < -PICKER_OPEN_THRESHOLD) {
      markSwipeLearned()
      snapToPeek()
    } else {
      snapToRest()
    }
  }

  const handleTap = () => {
    if (canManage && x.get() < -10) {
      snapToRest()
      return
    }
    onSelect?.()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleTap()
    }
  }

  const handleEditTap = (e) => {
    e.preventDefault()
    e.stopPropagation()
    snapToRest()
    onEdit?.()
  }

  const handleDeleteTap = (e) => {
    e.preventDefault()
    e.stopPropagation()
    snapToRest()
    onDelete?.()
  }

  const borderClass = showTopBorder ? 'border-t border-kosha-border' : ''

  return (
    <div className={`relative overflow-hidden bg-kosha-surface ${borderClass}`}>
      {canManage && (
        <motion.div
          className="absolute inset-y-0 right-0 flex items-stretch"
          style={{
            opacity: actionOpacity,
            scale: actionScale,
            pointerEvents: actionsEnabled ? 'auto' : 'none',
          }}
          aria-hidden={!actionsEnabled}
        >
          <button
            type="button"
            onClick={handleEditTap}
            className="w-[70px] flex flex-col items-center justify-center gap-1 px-5
                     bg-brand-container active:scale-[0.96] active:opacity-80 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform"
          >
            <PencilSimple size={20} weight="bold" color="var(--c-brand)" />
            <span className="text-[10px] font-semibold" style={{ color: 'var(--c-brand)' }}>
              Edit
            </span>
          </button>

          <button
            type="button"
            onClick={handleDeleteTap}
            className="w-[70px] flex flex-col items-center justify-center gap-1 px-5
                     active:scale-[0.96] active:opacity-80 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform"
            style={{ backgroundColor: 'rgba(232,69,60,0.96)', color: 'rgba(255,255,255,1)' }}
          >
            <Trash size={18} weight="bold" color="currentColor" />
            <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,1)' }}>
              Delete
            </span>
          </button>
        </motion.div>
      )}

      <motion.div
        role="button"
        tabIndex={0}
        className={`list-row w-full ${selected ? 'bg-brand-container' : ''}`}
        style={{ x }}
        drag={canManage ? 'x' : false}
        dragConstraints={{ left: -PICKER_PEEK_X * 1.5, right: 0 }}
        dragElastic={{ left: 0.12, right: 0.02 }}
        onDragEnd={handleDragEnd}
        onClick={handleTap}
        onKeyDown={handleKeyDown}
        whileTap={{ scale: 0.992 }}
        transition={{ scale: { duration: 0.08 } }}
      >
        {leading}
        <span className={`flex-1 text-[15px] ${selected ? 'text-brand font-medium' : 'text-ink'}`}>
          {label}
        </span>
        <span className={`text-lg w-5 text-right ${selected ? 'text-ink' : 'invisible'}`}>✓</span>
      </motion.div>
    </div>
  )
}

function nextRecurringDate(dateStr, recurrence) {
  if (!dateStr || !recurrence) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null

  const origDay = d.getDate()
  if (recurrence === 'monthly') {
    d.setMonth(d.getMonth() + 1)
    if (d.getDate() !== origDay) d.setDate(0)
  } else if (recurrence === 'quarterly') {
    d.setMonth(d.getMonth() + 3)
    if (d.getDate() !== origDay) d.setDate(0)
  } else if (recurrence === 'yearly') {
    d.setFullYear(d.getFullYear() + 1)
    if (d.getDate() !== origDay) d.setDate(0)
  }

  return d.toISOString().slice(0, 10)
}

// ── Form state via useReducer ─────────────────────────────────────────────
function buildInitialState(editTxn, duplicateTxn, initialType) {
  if (editTxn) {
    return {
      type: editTxn.type,
      amount: String(editTxn.amount),
      desc: editTxn.description,
      category: editTxn.category || 'other',
      vehicle: editTxn.investment_vehicle || 'Other',
      mode: editTxn.payment_mode || 'upi',
      date: editTxn.date || todayStr(),
      isRecurring: !!editTxn.is_recurring,
      recurrence: editTxn.recurrence || 'monthly',
      notes: editTxn.notes || '',
      showNotes: !!(editTxn.notes),
      isSplitwise: false,
      splitGroupId: null,
      linkedSplitExpenseId: editTxn.linked_split_expense_id || null,
      isSplitwiseLinked: !!editTxn.linked_split_expense_id,
      isSaving: false,
      error: '',
    }
  }
  if (duplicateTxn) {
    return {
      type: duplicateTxn.type,
      amount: String(duplicateTxn.amount),
      desc: duplicateTxn.description,
      category: duplicateTxn.category || 'other',
      vehicle: duplicateTxn.investment_vehicle || 'Other',
      mode: duplicateTxn.payment_mode || 'upi',
      date: todayStr(),
      isRecurring: !!duplicateTxn.is_recurring,
      recurrence: duplicateTxn.recurrence || 'monthly',
      notes: duplicateTxn.notes || '',
      showNotes: !!(duplicateTxn.notes),
      isSplitwise: false,
      splitGroupId: null,
      linkedSplitExpenseId: null,
      isSplitwiseLinked: false,
      isSaving: false,
      error: '',
    }
  }
  return {
    type: initialType || 'expense',
    amount: '',
    desc: '',
    category: initialType === 'income' ? 'salary' : 'other',
    vehicle: 'Other',
    mode: 'upi',
    date: todayStr(),
    isRecurring: false,
    recurrence: 'monthly',
    notes: '',
    showNotes: false,
    isSplitwise: false,
    splitGroupId: null,
    linkedSplitExpenseId: null,
    isSplitwiseLinked: false,
    isSaving: false,
    error: '',
  }
}

function formReducer(state, action) {
  switch (action.type) {
    case 'SET': return { ...state, [action.key]: action.value }
    // SAVING_START: disable all inputs immediately when user taps submit
    case 'SAVING_START': return { ...state, isSaving: true, error: '' }
    // SAVING_ERROR: re-enable inputs so user can retry
    case 'SAVING_ERROR': return { ...state, isSaving: false, error: action.value }
    default: return state
  }
}

// ── Sub-pickers ───────────────────────────────────────────────────────────

function CategoryPicker({
  selected,
  onSelect,
  onClose,
  categories,
  title = 'Category',
  onCreateNew,
  onEditCustom,
  onDeleteCustom,
}) {
  const sheetRef = useOverlayFocusTrap(true, { onClose })
  const hasManageableCategories = categories.some((cat) => Boolean(cat.isCustom && cat.dbId))
  const [showSwipeHint, setShowSwipeHint] = useState(false)

  useEffect(() => {
    if (!hasManageableCategories) {
      setShowSwipeHint(false)
      return
    }

    try {
      const dismissed = localStorage.getItem(CATEGORY_SWIPE_HINT_DISMISSED_KEY) === '1'
      const learned = localStorage.getItem(CATEGORY_SWIPE_HINT_LEARNED_KEY) === '1'
      setShowSwipeHint(!dismissed && !learned)
    } catch {
      setShowSwipeHint(true)
    }
  }, [hasManageableCategories])

  const dismissSwipeHint = () => {
    setShowSwipeHint(false)
    try {
      localStorage.setItem(CATEGORY_SWIPE_HINT_DISMISSED_KEY, '1')
    } catch {
      // no-op
    }
  }

  const handleSwipeHintLearned = () => {
    setShowSwipeHint(false)
    try {
      localStorage.setItem(CATEGORY_SWIPE_HINT_LEARNED_KEY, '1')
    } catch {
      // no-op
    }
  }

  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        ref={sheetRef}
        className="sheet-panel"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
        exit={{ y: '100%', transition: { duration: 0.2 } }}
      >
        <div className="sheet-handle" />
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] font-bold text-ink">{title}</h3>
            <button type="button" aria-label="Close category picker" onClick={onClose} className="close-btn">
              <X size={16} className="text-ink-3" />
            </button>
          </div>

          {showSwipeHint && (
            <div className="mini-panel px-3 py-2 mb-2.5 flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-brand-container text-brand text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                i
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-ink-2 leading-relaxed">
                  Quick tip: swipe left on a custom category to Edit or Delete.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissSwipeHint}
                className="text-ink-4 hover:text-ink-2 transition-colors"
                aria-label="Dismiss swipe hint"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div className="list-card">
            {categories.map((cat, index) => (
              <SwipeManagePickerRow
                key={cat.id}
                selected={selected === cat.id}
                label={cat.label}
                showTopBorder={index > 0}
                leading={(
                  <div className="w-8 h-8 rounded-chip flex items-center justify-center shrink-0">
                    <CategoryIcon categoryId={cat.id} size={16} />
                  </div>
                )}
                canManage={Boolean(cat.isCustom && cat.dbId)}
                onSwipeLearned={handleSwipeHintLearned}
                onSelect={() => {
                  onSelect(cat.id)
                  onClose()
                }}
                onEdit={() => onEditCustom?.(cat)}
                onDelete={() => onDeleteCustom?.(cat)}
              />
            ))}
          </div>
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="list-row w-full mt-2 rounded-card border border-dashed border-kosha-border
                         hover:bg-kosha-surface-2 transition-colors"
            >
              <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 flex items-center justify-center shrink-0">
                <Plus size={16} className="text-ink-3" />
              </div>
              <span className="flex-1 text-[15px] text-ink-3 text-left">Create Category</span>
            </button>
          )}
        </div>
      </motion.div>
    </>
  )
}

function ModePicker({ selected, onSelect, onClose }) {
  const sheetRef = useOverlayFocusTrap(true, { onClose })

  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        ref={sheetRef}
        className="sheet-panel"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Payment mode"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
        exit={{ y: '100%', transition: { duration: 0.2 } }}
      >
        <div className="sheet-handle" />
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] font-bold text-ink">Payment Mode</h3>
            <button type="button" aria-label="Close payment mode picker" onClick={onClose} className="close-btn">
              <X size={16} className="text-ink-3" />
            </button>
          </div>
          <div className="list-card">
            {PAYMENT_MODES.map(m => {
              const Icon = ICON_MAP[m.icon]
              return (
                <button key={m.id}
                  className={`list-row w-full ${selected === m.id ? 'bg-brand-container' : ''}`}
                  onClick={() => { onSelect(m.id); onClose() }}
                >
                  {Icon && (
                    <div
                      className="w-8 h-8 rounded-chip border border-kosha-border flex items-center justify-center shrink-0"
                      style={m?.color ? {
                        backgroundColor: m.bg,
                        background: `color-mix(in srgb, ${m.color} 18%, var(--ds-surface))`
                      } : undefined}
                    >
                      <Icon
                        size={16}
                        weight="duotone"
                        className={m?.color ? '' : 'text-ink-2'}
                        style={m?.color ? { color: m.color } : undefined}
                      />
                    </div>
                  )}
                  <span className={`flex-1 text-[15px] ${selected === m.id ? 'text-brand font-medium' : 'text-ink'}`}>
                    {m.label}
                  </span>
                  <span className={`text-lg w-5 text-right ${selected === m.id ? 'text-ink' : 'invisible'}`}>✓</span>
                </button>
              )
            })}
          </div>
        </div>
      </motion.div>
    </>
  )
}

function VehiclePicker({
  selected,
  onSelect,
  onClose,
  vehicles,
  onCreateNew,
  onEditCustom,
  onDeleteCustom,
}) {
  const sheetRef = useOverlayFocusTrap(true, { onClose })
  const hasManageableVehicles = vehicles.some((item) => Boolean(item.isCustom && item.dbId))
  const [showSwipeHint, setShowSwipeHint] = useState(false)

  useEffect(() => {
    if (!hasManageableVehicles) {
      setShowSwipeHint(false)
      return
    }

    try {
      const dismissed = localStorage.getItem(CATEGORY_SWIPE_HINT_DISMISSED_KEY) === '1'
      const learned = localStorage.getItem(CATEGORY_SWIPE_HINT_LEARNED_KEY) === '1'
      setShowSwipeHint(!dismissed && !learned)
    } catch {
      setShowSwipeHint(true)
    }
  }, [hasManageableVehicles])

  const dismissSwipeHint = () => {
    setShowSwipeHint(false)
    try {
      localStorage.setItem(CATEGORY_SWIPE_HINT_DISMISSED_KEY, '1')
    } catch {
      // no-op
    }
  }

  const handleSwipeHintLearned = () => {
    setShowSwipeHint(false)
    try {
      localStorage.setItem(CATEGORY_SWIPE_HINT_LEARNED_KEY, '1')
    } catch {
      // no-op
    }
  }

  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        ref={sheetRef}
        className="sheet-panel"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Investment type"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
        exit={{ y: '100%', transition: { duration: 0.2 } }}
      >
        <div className="sheet-handle" />
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] font-bold text-ink">Investment Type</h3>
            <button type="button" aria-label="Close investment type picker" onClick={onClose} className="close-btn">
              <X size={16} className="text-ink-3" />
            </button>
          </div>

          {showSwipeHint && (
            <div className="mini-panel px-3 py-2 mb-2.5 flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-brand-container text-brand text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                i
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-ink-2 leading-relaxed">
                  Quick tip: swipe left on a custom category to Edit or Delete.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissSwipeHint}
                className="text-ink-4 hover:text-ink-2 transition-colors"
                aria-label="Dismiss swipe hint"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div className="list-card">
            {vehicles.map((v, index) => {
              const Icon = ICON_MAP[v.icon]
              return (
                <SwipeManagePickerRow
                  key={v.id}
                  selected={selected === v.label}
                  label={v.label}
                  showTopBorder={index > 0}
                  leading={Icon ? (
                    <div
                      className={`w-8 h-8 rounded-chip border border-kosha-border flex items-center justify-center shrink-0 ${v.bg ? '' : 'bg-kosha-surface-2'}`}
                      style={v.color ? {
                        backgroundColor: v.bg,
                        background: `color-mix(in srgb, ${v.color} 18%, var(--ds-surface))`
                      } : undefined}
                    >
                      <Icon
                        size={16}
                        weight="duotone"
                        className={v.color ? '' : 'text-ink-2'}
                        style={v.color ? { color: v.color } : undefined}
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 border border-kosha-border flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-semibold text-ink-3">₹</span>
                    </div>
                  )}
                  canManage={Boolean(v.isCustom && v.dbId)}
                  onSwipeLearned={handleSwipeHintLearned}
                  onSelect={() => {
                    onSelect(v.label)
                    onClose()
                  }}
                  onEdit={() => onEditCustom?.(v)}
                  onDelete={() => onDeleteCustom?.(v)}
                />
              )
            })}
          </div>
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="list-row w-full mt-2 rounded-card border border-dashed border-kosha-border
                         hover:bg-kosha-surface-2 transition-colors"
            >
              <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 flex items-center justify-center shrink-0">
                <Plus size={16} className="text-ink-3" />
              </div>
              <span className="flex-1 text-[15px] text-ink-3 text-left">Create Category</span>
            </button>
          )}
        </div>
      </motion.div>
    </>
  )
}

// ── Inner sheet ───────────────────────────────────────────────────────────

function AddTransactionSheetInner({ onClose, editTxn, duplicateTxn, initialType }) {
  const [state, dispatch] = useReducer(
    formReducer,
    buildInitialState(editTxn, duplicateTxn, initialType)
  )

  const {
    type, amount, desc, category, vehicle, mode, date,
    isRecurring, recurrence, notes, showNotes, isSplitwise, splitGroupId, linkedSplitExpenseId, isSplitwiseLinked, isSaving, error,
  } = state

  const set = (key, value) => dispatch({ type: 'SET', key, value })

  const { groups } = useSplitwise({ enabled: type === 'expense' })

  // Load user's custom categories — registers them into the module-level store
  useUserCategories()
  const categoryOptions = getCategoriesForType(type)
  const investmentOptions = useMemo(() => {
    const customInvestment = categoryOptions
      .filter(cat => cat.type === 'investment' && cat.id !== 'other')
      .map(cat => ({
        id: cat.id,
        label: cat.label,
        icon: cat.icon || 'Tag',
        color: cat.color,
        bg: cat.bg,
        dbId: cat.dbId,
        type: cat.type,
        isCustom: true,
      }))

    const seen = new Set()
    return [...INVESTMENT_VEHICLES, ...customInvestment].filter((option) => {
      const key = String(option.label || '').trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [categoryOptions])

  function setType(nextType) {
    set('type', nextType)
    if (nextType !== 'investment') {
      const normalized = normalizeCategoryForType(nextType, category)
      set('category', normalized === 'other' && nextType === 'income' ? 'salary' : normalized)
    }
  }


  const [showCatPicker, setShowCatPicker] = useReducer(v => !v, false)
  const [showModePicker, setShowModePicker] = useReducer(v => !v, false)
  const [showVehPicker, setShowVehPicker] = useReducer(v => !v, false)
  const [showCreateCat, setShowCreateCat] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)

  const mainSheetRef = useOverlayFocusTrap(
    !showCatPicker && !showModePicker && !showVehPicker && !showCreateCat,
    {
      onClose: isSaving ? undefined : onClose,
      initialFocusSelector: 'input[name="txn-amount"]',
    }
  )

  async function handleDeleteCustomCategory(customCategory) {
    const dbId = customCategory?.dbId
    if (!dbId) return

    const label = customCategory?.label || 'this category'
    const confirmed = window.confirm(`Delete "${label}"? Existing transactions will keep their saved category id, but this category will stop appearing in pickers.`)
    if (!confirmed) return

    try {
      await archiveUserCategory(dbId)

      if (type === 'investment' && vehicle === customCategory.label) {
        set('vehicle', 'Other')
      }

      if (type !== 'investment' && category === customCategory.id) {
        set('category', type === 'income' ? 'salary' : 'other')
      }
    } catch (e) {
      dispatch({ type: 'SAVING_ERROR', value: e?.message || 'Could not delete category' })
    }
  }

  async function handleSave() {
    // Client-side validation — fast, no async
    if (!amount || !Number.isFinite(+amount) || +amount <= 0) {
      dispatch({ type: 'SAVING_ERROR', value: 'Enter a valid amount' })
      return
    }
    if (!desc.trim()) {
      dispatch({ type: 'SAVING_ERROR', value: 'Enter a description' })
      return
    }

    const payload = {
      type,
      description: desc.trim(),
      amount: +amount,
      category: type === 'investment' ? 'other' : normalizeCategoryForType(type, category),
      date,
      payment_mode: mode,
      is_repayment: editTxn ? !!editTxn.is_repayment : false,
      is_recurring: isRecurring,
      recurrence: isRecurring ? recurrence : null,
      next_run_date: isRecurring ? nextRecurringDate(date, recurrence) : null,
      notes: notes.trim() || null,
      ...(type === 'investment' ? { investment_vehicle: vehicle } : {}),
    }

    // STEP 1: Disable UI immediately. User cannot interact until server confirms.
    dispatch({ type: 'SAVING_START' })

    try {
      if (isSplitwise && type === 'expense' && splitGroupId) {
        const { data: members, error: memErr } = await supabase
          .from('split_group_members')
          .select('id, is_self, linked_user_id')
          .eq('group_id', splitGroupId)

        if (memErr) throw memErr

        const { data: { user } } = await supabase.auth.getUser()
        const selfMember = members.find(m => m.is_self || m.linked_user_id === user?.id)

        if (!selfMember) throw new Error('You must be a member of the group to add an expense.')

        const splits = buildEqualSplits(members.map(m => m.id), +amount)

        await addSplitExpenseMutation({
          groupId: splitGroupId,
          paidByMemberId: selfMember.id,
          description: desc.trim(),
          amount: +amount,
          expenseDate: date,
          splitMethod: 'equal',
          notes: notes.trim() || null,
          splits,
          transactionCategory: category
        })
      } else {
        await saveTransactionMutation({
          id: editTxn?.id,
          payload,
        })
      }

      import('../../lib/haptics').then(m => m.hapticSuccess())
      onClose()
    } catch (e) {
      dispatch({
        type: 'SAVING_ERROR',
        value: e.message || 'Could not save. Check your connection and try again.',
      })
    }
  }

  const activeType = TYPES.find(t => t.id === type)
  const selectedCat = categoryOptions.find(c => c.id === category)
    || CATEGORIES.find(c => c.id === category)
  const selectedMode = PAYMENT_MODES.find(m => m.id === mode)
  const selectedVeh = investmentOptions.find(v => v.label === vehicle)
    || INVESTMENT_VEHICLES.find(v => v.label === vehicle)

  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}
        // Prevent closing by tapping backdrop while saving — data integrity
        onClick={isSaving ? undefined : onClose}
      />
      <motion.div
        ref={mainSheetRef}
        className="sheet-panel"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={editTxn ? 'Edit transaction' : 'Add transaction'}
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
        exit={{ y: '100%', transition: { duration: 0.22 } }}
      >
        <div className="sheet-handle" />
        <div className="px-4 overflow-x-hidden">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[20px] font-bold text-ink">
              {editTxn ? 'Edit Transaction' : 'Add Transaction'}
            </h2>
            <div className="flex items-center gap-3">
              {/* X button disabled while saving to prevent accidental close mid-flight */}
              <button
                type="button"
                aria-label="Close transaction sheet"
                onClick={isSaving ? undefined : onClose}
                disabled={isSaving}
                className="close-btn disabled:opacity-40"
              >
                <X size={16} className="text-ink-3" />
              </button>
            </div>
          </div>

          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2 mb-5 min-w-0">
            {TYPES.map(t => (
              <button key={t.id}
                onClick={() => setType(t.id)}
                disabled={isSaving}
                className={`flex-1 py-2 rounded-card text-[13px] font-semibold border transition-[background-color,border-color,color] duration-120
                  min-w-0 truncate disabled:opacity-50
                  ${type === t.id
                    ? `${t.bg} ${t.color} border-transparent`
                    : 'bg-kosha-surface text-ink-3 border-kosha-border'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="flex flex-col min-w-0 pb-2">
            <div className="bg-transparent px-1 py-2 mb-4 flex items-center gap-2 border-b-2 border-kosha-border">
            <span className={`text-2xl font-bold ${activeType?.color}`}>₹</span>
            <input
              type="text" inputMode="decimal" name="txn-amount" placeholder="0.00"
              enterKeyHint="next"
              value={amount}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) set('amount', raw);
              }}
              disabled={isSaving || !!linkedSplitExpenseId}
              className="min-w-0 flex-1 bg-transparent text-3xl font-bold text-ink
                         outline-none tabular-nums placeholder-ink-4 disabled:opacity-50"
            />
          </div>

          {/* Description */}
          <input
            type="text" name="txn-description" placeholder="Description"
            enterKeyHint="done"
            autoCapitalize="sentences"
            value={desc} onChange={e => set('desc', e.target.value)}
            disabled={isSaving}
            className="input mb-3 disabled:opacity-50"
          />

          {/* Field rows */}
          <div className="list-card mb-3">

            {/* Date */}
            <div className={`list-row w-full ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 border border-kosha-border flex items-center justify-center shrink-0">
                <CalendarDots size={15} weight="duotone" className="text-brand" />
              </div>
              <span className="flex-1 text-[15px] text-ink">Date</span>
              <PixelDatePicker
                name="txn-date"
                value={date}
                onChange={(nextDate) => set('date', nextDate)}
                disabled={isSaving}
                sheetTitle="Select transaction date"
              />
            </div>

            {/* Category */}
            {type !== 'investment' && (
              <button
                className="list-row w-full disabled:opacity-50"
                onClick={() => setShowCatPicker()}
                disabled={isSaving}
              >
                <CategoryIcon categoryId={category} size={16} />
                <span className="flex-1 text-[15px] text-ink text-left">Category</span>
                <div className="flex items-center gap-1">
                  <span className="text-[13px] text-ink-3">{selectedCat?.label}</span>
                  <CaretRight size={14} className="text-ink-4" />
                </div>
              </button>
            )}

            {/* Investment vehicle */}
            {type === 'investment' && (
              <button
                className="list-row w-full disabled:opacity-50"
                onClick={() => setShowVehPicker()}
                disabled={isSaving}
              >
                {(() => {
                  const VehIcon = selectedVeh ? ICON_MAP[selectedVeh.icon] : null
                  return VehIcon ? (
                    <div
                      className={`w-8 h-8 rounded-chip border border-kosha-border flex items-center justify-center shrink-0 ${selectedVeh?.bg ? '' : 'bg-kosha-surface-2'}`}
                      style={selectedVeh?.color ? {
                        backgroundColor: selectedVeh.bg,
                        background: `color-mix(in srgb, ${selectedVeh.color} 18%, var(--ds-surface))`
                      } : undefined}
                    >
                      <VehIcon
                        size={15}
                        weight="duotone"
                        className={selectedVeh?.color ? '' : 'text-ink-2'}
                        style={selectedVeh?.color ? { color: selectedVeh.color } : undefined}
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-chip bg-invest-bg flex items-center justify-center shrink-0">
                      <span className="text-invest-text text-xs font-bold">₹</span>
                    </div>
                  )
                })()}
                <span className="flex-1 text-[15px] text-ink text-left">Type of Investment</span>
                <div className="flex items-center gap-1">
                  <span className="text-[13px] text-ink-3">{vehicle}</span>
                  <CaretRight size={14} className="text-ink-4" />
                </div>
              </button>
            )}

            {/* Payment mode */}
            <button
              className="list-row w-full disabled:opacity-50"
              onClick={() => setShowModePicker()}
              disabled={isSaving}
            >
              {(() => {
                const ModeIcon = selectedMode ? ICON_MAP[selectedMode.icon] : null
                return ModeIcon ? (
                  <div
                    className="w-8 h-8 rounded-chip border border-kosha-border flex items-center justify-center shrink-0"
                    style={selectedMode?.color ? {
                      backgroundColor: selectedMode.bg,
                      background: `color-mix(in srgb, ${selectedMode.color} 18%, var(--ds-surface))`
                    } : undefined}
                  >
                    <ModeIcon
                      size={15}
                      weight="duotone"
                      className={selectedMode?.color ? '' : 'text-ink-2'}
                      style={selectedMode?.color ? { color: selectedMode.color } : undefined}
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-chip bg-brand-container flex items-center justify-center shrink-0">
                    <span className="text-ink text-xs font-semibold">₹</span>
                  </div>
                )
              })()}
              <span className="flex-1 text-[15px] text-ink text-left">Payment Mode</span>
              <div className="flex items-center gap-1">
                <span className="text-[13px] text-ink-3">{selectedMode?.label}</span>
                <CaretRight size={14} className="text-ink-4" />
              </div>
            </button>

            {/* Recurring */}
            <div className="px-4 py-3 border-t border-kosha-border">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-medium text-ink">Recurring transaction</p>
                  <p className="text-[12px] text-ink-3">Auto-generates based on selected frequency.</p>
                </div>
                <button
                  type="button"
                  onClick={() => set('isRecurring', !isRecurring)}
                  disabled={isSaving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${isRecurring ? 'bg-brand' : 'bg-kosha-border'}
                    ${isSaving ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform
                      ${isRecurring ? 'translate-x-5' : 'translate-x-1'}`}
                  />
                </button>
              </div>

              {isRecurring && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {RECURRENCE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => set('recurrence', option)}
                      disabled={isSaving}
                      className={`px-3 py-1.5 rounded-pill text-xs font-semibold border capitalize transition-[background-color,border-color,color] duration-120
                        ${recurrence === option
                          ? 'bg-brand-container text-brand border-brand/20'
                          : 'bg-kosha-surface text-ink-2 border-kosha-border'}
                        ${isSaving ? 'opacity-50' : ''}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <button
              className="list-row w-full disabled:opacity-50"
              onClick={() => set('showNotes', !showNotes)}
              disabled={isSaving}
            >
              <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 flex items-center justify-center shrink-0">
                <NotePencil size={15} className="text-ink-3" />
              </div>
              <span className="flex-1 text-[15px] text-ink text-left">
                {notes.trim() ? 'Note' : 'Add a note'}
              </span>
              {notes.trim()
                ? <span className="text-[12px] text-ink-3 max-w-[120px] truncate">{notes.trim()}</span>
                : <CaretRight size={14} className={`text-ink-4 transition-transform duration-200 ${showNotes ? 'rotate-90' : ''}`} />
              }
            </button>

            <AnimatePresence>
              {showNotes && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.05, 0.7, 0.1, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="px-4 pb-3 pt-1">
                    <textarea
                      rows={3}
                      name="txn-notes"
                      placeholder="e.g. Q1 advance tax, flight reimbursement…"
                      value={notes}
                      onChange={e => set('notes', e.target.value)}
                      disabled={isSaving}
                      className="w-full bg-kosha-surface-2 rounded-card px-3 py-2.5 text-[14px]
                                 text-ink placeholder-ink-4 outline-none resize-none
                                 border border-transparent focus:border-brand-border
                                 transition-colors duration-150 disabled:opacity-50"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Splitwise Integration */}
            {type === 'expense' && !editTxn && groups && groups.length > 0 && (
              <div className="px-4 py-3 border-t border-kosha-border">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-medium text-ink">Split this expense</p>
                    <p className="text-[12px] text-ink-3">Automatically adds it to a Splitwise group.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => set('isSplitwise', !isSplitwise)}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${isSplitwise ? 'bg-brand' : 'bg-kosha-border'}
                      ${isSaving ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform
                        ${isSplitwise ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </button>
                </div>

                {isSplitwise && (
                  <div className="mt-3">
                    <select
                      value={splitGroupId || ''}
                      onChange={(e) => set('splitGroupId', e.target.value)}
                      disabled={isSaving}
                      className="w-full bg-kosha-surface-2 rounded-card px-3 py-2.5 text-[14px] text-ink outline-none border border-transparent focus:border-brand-border disabled:opacity-50"
                    >
                      <option value="" disabled>Select a group...</option>
                      {groups.filter(g => !g.is_archived).map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {editTxn && linkedSplitExpenseId && (
              <div className="px-4 py-2 border-t border-kosha-border flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-container flex items-center justify-center shrink-0">
                  <span className="text-[10px] text-brand font-bold">🔗</span>
                </div>
                <span className="text-[13px] text-ink-2 font-medium">Linked to a Splitwise group. Edits will sync automatically.</span>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && <p className="text-expense-text text-[13px] mb-3 px-1">{error}</p>}

          {/*
            Save button — the most important element.

            States:
            - Normal:  "Add Expense" / "Save Changes" — full brand color
            - Saving:  Spinner + "Saving..." — dimmed, disabled
              The spinner persists for the ENTIRE mutation + refetch chain.
              When it disappears, the sheet closes and the data is accurate.
          */}
          <div className="sticky bottom-0 pt-2 pb-2 bg-gradient-to-t from-kosha-surface via-kosha-surface to-transparent">
            <Button
              variant="primary"
              size="xl"
              fullWidth
              onClick={handleSave}
              loading={isSaving}
            >
              {isSaving ? 'Saving...' : (editTxn ? 'Save Changes' : `Add ${activeType?.label}`)}
            </Button>
            <div className="h-2" />
          </div>
          </form>
        </div>
      </motion.div>

      <AnimatePresence>
        {showCatPicker && (
          <CategoryPicker
            selected={category}
            onSelect={v => set('category', v)}
            onClose={() => setShowCatPicker()}
            categories={categoryOptions}
            title={type === 'income' ? 'Income Source' : 'Expense Category'}
            onCreateNew={() => {
              setShowCatPicker()
              setEditingCategory(null)
              setShowCreateCat(true)
            }}
            onEditCustom={(customCategory) => {
              setShowCatPicker()
              setEditingCategory(customCategory)
              setShowCreateCat(true)
            }}
            onDeleteCustom={handleDeleteCustomCategory}
          />
        )}
        {showModePicker && <ModePicker selected={mode} onSelect={v => set('mode', v)} onClose={() => setShowModePicker()} />}
        {showVehPicker && (
          <VehiclePicker
            selected={vehicle}
            onSelect={v => set('vehicle', v)}
            onClose={() => setShowVehPicker()}
            vehicles={investmentOptions}
            onCreateNew={() => {
              setShowVehPicker()
              setEditingCategory(null)
              setShowCreateCat(true)
            }}
            onEditCustom={(customCategory) => {
              setShowVehPicker()
              setEditingCategory(customCategory)
              setShowCreateCat(true)
            }}
            onDeleteCustom={handleDeleteCustomCategory}
          />
        )}
        {showCreateCat && (
          <CreateCategorySheet
            type={type}
            existingCategory={editingCategory}
            onClose={() => {
              setShowCreateCat(false)
              setEditingCategory(null)
            }}
            onSaved={(savedCategory) => {
              const savedId = savedCategory?.id || savedCategory
              const savedType = savedCategory?.type
              const savedLabel = savedCategory?.label

              if (!editingCategory) {
                if (type === 'investment' && savedType === 'investment' && savedLabel) {
                  set('vehicle', savedLabel)
                  return
                }

                if (type !== 'investment' && savedId && savedType === type) {
                  set('category', savedId)
                }
                return
              }

              if (type === 'investment' && savedType === 'investment' && vehicle === editingCategory.label && savedLabel) {
                set('vehicle', savedLabel)
              }
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Outer wrapper — controls the key for clean reducer resets ─────────────
export default function AddTransactionSheet({
  open, onClose,
  editTxn = null, duplicateTxn = null, initialType = 'expense',
}) {
  const sheetKey = open
    ? editTxn ? `edit-${editTxn.id}`
      : duplicateTxn ? `dup-${duplicateTxn.id}`
        : '__add__'
    : null

  return (
    <AnimatePresence>
      {open && (
        <AddTransactionSheetInner
          key={sheetKey}
          onClose={onClose}
          editTxn={editTxn}
          duplicateTxn={duplicateTxn}
          initialType={initialType}
        />
      )}
    </AnimatePresence>
  )
}
