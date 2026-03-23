/**
 * AddTransactionSheet.jsx — Strict Server-Truth UI Contract
 *
 * UI BLOCKING CONTRACT:
 *
 * The sheet must NOT call onClose() until the full mutation + refetch
 * Promise chain resolves. This is enforced by:
 *
 *   1. isSaving state disables all inputs and the submit button
 *      the moment the user taps "Save".
 *
 *   2. The save handler awaits addTransaction() / updateTransaction(),
 *      which themselves await the full invalidateCache() cycle before
 *      resolving (see useTransactions.js).
 *
 *   3. onClose() is called ONLY inside the try block AFTER the await
 *      resolves — never in a finally block, never before the server confirms.
 *
 *   4. On error, isSaving is reset to false so the user can retry.
 *
 * This means the user sees a spinner for 200-500ms after tapping save.
 * That is the correct and intentional UX for a financial application.
 * The dashboard, monthly summary, and running balance will all be accurate
 * the moment the sheet closes because the refetch has already completed.
 */

import { useReducer, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, NotePencil } from '@phosphor-icons/react'
import { ChevronRight } from 'lucide-react'
import { addTransaction, updateTransaction } from '../hooks/useTransactions'
import CategoryIcon, { ICON_MAP } from './CategoryIcon'
import { CATEGORIES, PAYMENT_MODES, INVESTMENT_VEHICLES } from '../lib/categories'
import { parseTransactionSmart } from '../lib/nlp'
import { Sparkle } from '@phosphor-icons/react'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const TYPES = [
  { id: 'expense',    label: 'Expense',    color: 'text-expense-text', bg: 'bg-expense-bg' },
  { id: 'income',     label: 'Income',     color: 'text-income-text',  bg: 'bg-income-bg'  },
  { id: 'investment', label: 'Investment', color: 'text-invest-text',  bg: 'bg-invest-bg'  },
]

// ── Form state via useReducer ─────────────────────────────────────────────
function buildInitialState(editTxn, duplicateTxn, initialType) {
  if (editTxn) {
    return {
      type:       editTxn.type,
      amount:     String(editTxn.amount),
      desc:       editTxn.description,
      category:   editTxn.category    || 'other',
      vehicle:    editTxn.investment_vehicle || 'Other',
      mode:       editTxn.payment_mode || 'upi',
      date:       editTxn.date        || todayStr(),
      notes:      editTxn.notes       || '',
      showNotes:  !!(editTxn.notes),
      smartMode:  false,
      smartText:  '',
      isSaving:   false,
      error:      '',
    }
  }
  if (duplicateTxn) {
    return {
      type:       duplicateTxn.type,
      amount:     String(duplicateTxn.amount),
      desc:       duplicateTxn.description,
      category:   duplicateTxn.category    || 'other',
      vehicle:    duplicateTxn.investment_vehicle || 'Other',
      mode:       duplicateTxn.payment_mode || 'upi',
      date:       todayStr(),
      notes:      duplicateTxn.notes       || '',
      showNotes:  !!(duplicateTxn.notes),
      smartMode:  false,
      smartText:  '',
      isSaving:   false,
      error:      '',
    }
  }
  return {
    type:      initialType || 'expense',
    amount:    '',
    desc:      '',
    category:  'other',
    vehicle:   'Other',
    mode:      'upi',
    date:      todayStr(),
    notes:     '',
    showNotes: false,
    smartMode: false,
    smartText: '',
    isSaving:  false,
    error:     '',
  }
}

function formReducer(state, action) {
  switch (action.type) {
    case 'SET':         return { ...state, [action.key]: action.value }
    // SAVING_START: disable all inputs immediately when user taps submit
    case 'SAVING_START': return { ...state, isSaving: true, error: '' }
    // SAVING_ERROR: re-enable inputs so user can retry
    case 'SAVING_ERROR': return { ...state, isSaving: false, error: action.value }
    case 'SMART_PARSE': return { ...state, ...action.parsed, smartText: action.smartText }
    default:            return state
  }
}

// ── Sub-pickers ───────────────────────────────────────────────────────────

function CategoryPicker({ selected, onSelect, onClose }) {
  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div className="sheet-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
        exit={{ y: '100%', transition: { duration: 0.2 } }}
      >
        <div className="sheet-handle" />
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] font-bold text-ink">Category</h3>
            <button onClick={onClose} className="close-btn">
              <X size={16} className="text-ink-3" />
            </button>
          </div>
          <div className="list-card">
            {CATEGORIES.map(cat => (
              <button key={cat.id}
                className={`list-row w-full ${selected === cat.id ? 'bg-brand-container' : ''}`}
                onClick={() => { onSelect(cat.id); onClose() }}
              >
                <div className="w-8 h-8 rounded-chip flex items-center justify-center shrink-0"
                  style={{ background: cat.bg }}>
                  <CategoryIcon categoryId={cat.id} size={16} />
                </div>
                <span className={`flex-1 text-[15px] ${selected === cat.id ? 'text-brand font-medium' : 'text-ink'}`}>
                  {cat.label}
                </span>
                <span className={`text-lg w-5 text-right ${selected === cat.id ? 'text-brand' : 'invisible'}`}>✓</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  )
}

function ModePicker({ selected, onSelect, onClose }) {
  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div className="sheet-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
        exit={{ y: '100%', transition: { duration: 0.2 } }}
      >
        <div className="sheet-handle" />
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] font-bold text-ink">Payment Mode</h3>
            <button onClick={onClose} className="close-btn">
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
                    <div className="w-8 h-8 rounded-chip flex items-center justify-center shrink-0"
                      style={{ background: m.bg }}>
                      <Icon size={16} weight="duotone" color={m.color} />
                    </div>
                  )}
                  <span className={`flex-1 text-[15px] ${selected === m.id ? 'text-brand font-medium' : 'text-ink'}`}>
                    {m.label}
                  </span>
                  <span className={`text-lg w-5 text-right ${selected === m.id ? 'text-brand' : 'invisible'}`}>✓</span>
                </button>
              )
            })}
          </div>
        </div>
      </motion.div>
    </>
  )
}

function VehiclePicker({ selected, onSelect, onClose }) {
  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div className="sheet-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
        exit={{ y: '100%', transition: { duration: 0.2 } }}
      >
        <div className="sheet-handle" />
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[18px] font-bold text-ink">Investment Type</h3>
            <button onClick={onClose} className="close-btn">
              <X size={16} className="text-ink-3" />
            </button>
          </div>
          <div className="list-card">
            {INVESTMENT_VEHICLES.map(v => {
              const Icon = ICON_MAP[v.icon]
              return (
                <button key={v.id}
                  className={`list-row w-full ${selected === v.label ? 'bg-brand-container' : ''}`}
                  onClick={() => { onSelect(v.label); onClose() }}
                >
                  {Icon && (
                    <div className="w-8 h-8 rounded-chip flex items-center justify-center shrink-0"
                      style={{ background: v.bg }}>
                      <Icon size={16} weight="duotone" color={v.color} />
                    </div>
                  )}
                  <span className={`flex-1 text-[15px] ${selected === v.label ? 'text-brand font-medium' : 'text-ink'}`}>
                    {v.label}
                  </span>
                  <span className={`text-lg w-5 text-right ${selected === v.label ? 'text-brand' : 'invisible'}`}>✓</span>
                </button>
              )
            })}
          </div>
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
    notes, showNotes, smartMode, smartText, isSaving, error,
  } = state

  const set = (key, value) => dispatch({ type: 'SET', key, value })

  const amountRef = useRef(null)

  const [showCatPicker,  setShowCatPicker]  = useReducer(v => !v, false)
  const [showModePicker, setShowModePicker] = useReducer(v => !v, false)
  const [showVehPicker,  setShowVehPicker]  = useReducer(v => !v, false)

  function handleSmartTextChange(val) {
    const { amount: a, desc: d, category: c, mode: m } = parseTransactionSmart(val)
    dispatch({
      type:      'SMART_PARSE',
      smartText: val,
      parsed: {
        ...(a ? { amount:   a } : {}),
        ...(d ? { desc:     d } : {}),
        ...(c ? { category: c } : {}),
        ...(m ? { mode:     m } : {}),
      },
    })
  }

  async function handleSave() {
    // Client-side validation — fast, no async
    if (!amount || isNaN(+amount) || +amount <= 0) {
      dispatch({ type: 'SAVING_ERROR', value: 'Enter a valid amount' })
      return
    }
    if (!desc.trim()) {
      dispatch({ type: 'SAVING_ERROR', value: 'Enter a description' })
      return
    }

    const payload = {
      type,
      description:  desc.trim(),
      amount:       +amount,
      category:     type === 'investment' ? 'other' : category,
      date,
      payment_mode: mode,
      is_repayment: false,
      notes:        notes.trim() || null,
      ...(type === 'investment' ? { investment_vehicle: vehicle } : {}),
    }

    // STEP 1: Disable UI immediately. User cannot interact until server confirms.
    dispatch({ type: 'SAVING_START' })

    try {
      if (editTxn) {
        await updateTransaction(editTxn.id, payload)
      } else {
        await addTransaction(payload)
      }

      // Mutation includes cache invalidation; close only after fresh data is available.
      onClose()
    } catch (e) {
      dispatch({
        type: 'SAVING_ERROR',
        value: e.message || 'Could not save. Check your connection and try again.',
      })
    }
  }

  const activeType   = TYPES.find(t => t.id === type)
  const selectedCat  = CATEGORIES.find(c => c.id === category)
  const selectedMode = PAYMENT_MODES.find(m => m.id === mode)

  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}
        // Prevent closing by tapping backdrop while saving — data integrity
        onClick={isSaving ? undefined : onClose}
      />
      <motion.div
        className="sheet-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 380, damping: 32 } }}
        exit={{ y: '100%', transition: { duration: 0.22 } }}
        onAnimationComplete={() => amountRef.current?.focus()}
      >
        <div className="sheet-handle" />
        <div className="px-4">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[20px] font-bold text-ink">
              {editTxn ? 'Edit Transaction' : 'Add Transaction'}
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => set('smartMode', !smartMode)}
                disabled={isSaving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors
                  ${smartMode ? 'bg-brand text-white shadow-sm' : 'bg-surface text-ink-3'}
                  disabled:opacity-50`}
              >
                <Sparkle size={14} weight={smartMode ? 'fill' : 'regular'} />
                Smart Entry
              </button>
              {/* X button disabled while saving to prevent accidental close mid-flight */}
              <button
                onClick={isSaving ? undefined : onClose}
                disabled={isSaving}
                className="close-btn disabled:opacity-40"
              >
                <X size={16} className="text-ink-3" />
              </button>
            </div>
          </div>

          {/* Smart Input */}
          <AnimatePresence>
            {smartMode && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <textarea
                  placeholder="e.g. Paid 400 for lunch using UPI..."
                  value={smartText}
                  onChange={e => handleSmartTextChange(e.target.value)}
                  disabled={isSaving}
                  className="w-full bg-brand/5 border border-brand/20 text-brand font-medium
                             rounded-2xl p-4 min-h-[100px] outline-none focus:ring-2
                             ring-brand/50 resize-none shadow-inner disabled:opacity-50"
                />
                <p className="text-[11px] text-ink-4 mt-2 px-2 flex items-center gap-1">
                  <Sparkle size={12} /> Auto-fills amount, description, category, and mode.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Type selector */}
          <div className="flex gap-2 mb-5">
            {TYPES.map(t => (
              <button key={t.id}
                onClick={() => set('type', t.id)}
                disabled={isSaving}
                className={`flex-1 py-2 rounded-card text-[13px] font-semibold border transition-all
                  disabled:opacity-50
                  ${type === t.id
                    ? `${t.bg} ${t.color} border-transparent`
                    : 'bg-kosha-surface text-ink-3 border-kosha-border'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="bg-kosha-surface-2 rounded-card px-4 py-3 mb-4 flex items-center gap-2">
            <span className={`font-display text-2xl font-bold ${activeType?.color}`}>₹</span>
            <input
              ref={amountRef}
              type="number" inputMode="decimal" placeholder="0.00"
              value={amount}
              onChange={e => set('amount', e.target.value)}
              disabled={isSaving}
              className="flex-1 bg-transparent font-display text-3xl font-bold text-ink
                         outline-none tabular-nums placeholder-ink-4 disabled:opacity-50"
            />
          </div>

          {/* Description */}
          <input
            type="text" placeholder="Description"
            value={desc} onChange={e => set('desc', e.target.value)}
            disabled={isSaving}
            className="input mb-3 disabled:opacity-50"
          />

          {/* Field rows */}
          <div className="list-card mb-3">

            {/* Date */}
            <label className={`list-row w-full cursor-pointer ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="w-8 h-8 rounded-chip bg-brand-container flex items-center justify-center shrink-0">
                <span className="text-brand text-xs font-bold">📅</span>
              </div>
              <span className="flex-1 text-[15px] text-ink">Date</span>
              <input type="date" value={date} onChange={e => set('date', e.target.value)}
                disabled={isSaving}
                className="text-[15px] text-ink-3 bg-transparent outline-none text-right disabled:opacity-50" />
            </label>

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
                  <ChevronRight size={14} className="text-ink-4" />
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
                  const selVeh  = INVESTMENT_VEHICLES.find(v => v.label === vehicle)
                  const VehIcon = selVeh ? ICON_MAP[selVeh.icon] : null
                  return VehIcon ? (
                    <div className="w-8 h-8 rounded-chip flex items-center justify-center shrink-0"
                      style={{ background: selVeh.bg }}>
                      <VehIcon size={15} weight="duotone" color={selVeh.color} />
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
                  <ChevronRight size={14} className="text-ink-4" />
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
                  <div className="w-8 h-8 rounded-chip flex items-center justify-center shrink-0"
                    style={{ background: selectedMode.bg }}>
                    <ModeIcon size={15} weight="duotone" color={selectedMode.color} />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-chip bg-brand-container flex items-center justify-center shrink-0">
                    <span className="text-brand text-xs font-bold">₹</span>
                  </div>
                )
              })()}
              <span className="flex-1 text-[15px] text-ink text-left">Payment Mode</span>
              <div className="flex items-center gap-1">
                <span className="text-[13px] text-ink-3">{selectedMode?.label}</span>
                <ChevronRight size={14} className="text-ink-4" />
              </div>
            </button>

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
                : <ChevronRight size={14} className={`text-ink-4 transition-transform duration-200 ${showNotes ? 'rotate-90' : ''}`} />
              }
            </button>

            <AnimatePresence>
              {showNotes && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="px-4 pb-3 pt-1">
                    <textarea
                      rows={3}
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
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full py-4 rounded-card text-[17px] font-semibold flex items-center
                        justify-center gap-2 transition-all
                        ${isSaving
                          ? 'bg-brand/70 text-white/90 scale-[0.98] cursor-not-allowed'
                          : 'bg-brand text-white active:scale-[0.98]'}`}
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg"
                  fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              editTxn ? 'Save Changes' : `Add ${activeType?.label}`
            )}
          </button>
          <div className="h-2" />
        </div>
      </motion.div>

      <AnimatePresence>
        {showCatPicker  && <CategoryPicker  selected={category} onSelect={v => set('category', v)} onClose={() => setShowCatPicker()}  />}
        {showModePicker && <ModePicker      selected={mode}     onSelect={v => set('mode', v)}     onClose={() => setShowModePicker()} />}
        {showVehPicker  && <VehiclePicker   selected={vehicle}  onSelect={v => set('vehicle', v)}  onClose={() => setShowVehPicker()}  />}
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
    ? editTxn      ? `edit-${editTxn.id}`
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
