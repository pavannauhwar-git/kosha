import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CreditCard, NotePencil } from '@phosphor-icons/react'
import { ChevronRight } from 'lucide-react'
import { addTransaction, updateTransaction, invalidateCache, applyOptimisticUpdate } from '../hooks/useTransactions'
import CategoryIcon from './CategoryIcon'
import { CATEGORIES } from '../lib/categories'
import { parseTransactionSmart } from '../lib/nlp'
import { Sparkle } from '@phosphor-icons/react'

// ── Helpers ───────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const TYPES = [
  { id: 'expense', label: 'Expense', color: 'text-expense-text', bg: 'bg-expense-bg' },
  { id: 'income', label: 'Income', color: 'text-income-text', bg: 'bg-income-bg' },
  { id: 'investment', label: 'Investment', color: 'text-invest-text', bg: 'bg-invest-bg' },
]

const PAYMENT_MODES = [
  { id: 'upi', label: 'UPI' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'debit_card', label: 'Debit Card' },
  { id: 'cash', label: 'Cash' },
  { id: 'net_banking', label: 'Net Banking' },
  { id: 'other', label: 'Other' },
]

const INVESTMENT_VEHICLES = [
  'Mutual Fund', 'Stocks', 'Fixed Deposit', 'PPF', 'NPS',
  'Gold', 'Real Estate', 'Crypto', 'Bonds', 'Other',
]

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
            <button onClick={onClose} className="close-btn"><X size={16} className="text-ink-3" /></button>
          </div>
          <div className="list-card">
            {CATEGORIES.map((cat, i) => (
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
                {selected === cat.id && <span className="text-brand text-lg">✓</span>}
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
            <button onClick={onClose} className="close-btn"><X size={16} className="text-ink-3" /></button>
          </div>
          <div className="list-card">
            {PAYMENT_MODES.map(m => (
              <button key={m.id}
                className={`list-row w-full ${selected === m.id ? 'bg-brand-container' : ''}`}
                onClick={() => { onSelect(m.id); onClose() }}
              >
                <span className={`flex-1 text-[15px] ${selected === m.id ? 'text-brand font-medium' : 'text-ink'}`}>
                  {m.label}
                </span>
                {selected === m.id && <span className="text-brand text-lg">✓</span>}
              </button>
            ))}
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
            <button onClick={onClose} className="close-btn"><X size={16} className="text-ink-3" /></button>
          </div>
          <div className="list-card">
            {INVESTMENT_VEHICLES.map(v => (
              <button key={v}
                className={`list-row w-full ${selected === v ? 'bg-brand-container' : ''}`}
                onClick={() => { onSelect(v); onClose() }}
              >
                <span className={`flex-1 text-[15px] ${selected === v ? 'text-brand font-medium' : 'text-ink'}`}>
                  {v}
                </span>
                {selected === v && <span className="text-brand text-lg">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ── Main sheet ─────────────────────────────────────────────────────────────
export default function AddTransactionSheet({
  open, onClose, onSaved, onConfirmed, onFailed,
  editTxn = null, duplicateTxn = null, initialType = 'expense',
}) {
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('other')
  const [vehicle, setVehicle] = useState('Other')
  const [mode, setMode] = useState('upi')
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [error, setError] = useState('')
  const [smartMode, setSmartMode] = useState(false)
  const [smartText, setSmartText] = useState('')

  const [showCatPicker, setShowCatPicker] = useState(false)
  const [showModePicker, setShowModePicker] = useState(false)
  const [showVehPicker, setShowVehPicker] = useState(false)

  const amountRef = useRef(null)

  // ── Synchronous form re-initialization ──────────────────────────────────
  // React's recommended "adjusting state when a prop changes" pattern.
  // Unlike useEffect (which fires AFTER render, causing a flash of stale
  // default state), this runs synchronously DURING render so the very first
  // frame already shows the correct edit/duplicate/add form.
  const [prevInitSource, setPrevInitSource] = useState(null)

  
  const handleSmartTextChange = (val) => {
    setSmartText(val)
    const { amount: a, desc: d, category: c, mode: m, type: t } = parseTransactionSmart(val)
    if (a) setAmount(a)
    if (d) setDesc(d)
    if (c) setCategory(c)
    if (m) setMode(m)
    // could set t but maybe not override type if they already picked it
  }

  const initSource = editTxn?.id
    ? `edit-${editTxn.id}`
    : duplicateTxn?.id
      ? `dup-${duplicateTxn.id}`
      : open ? '__add__' : null

  if (initSource !== prevInitSource) {
    setPrevInitSource(initSource)
    if (editTxn) {
      setType(editTxn.type)
      setAmount(String(editTxn.amount))
      setDesc(editTxn.description)
      setCategory(editTxn.category || 'other')
      setVehicle(editTxn.investment_vehicle || 'Other')
      setMode(editTxn.payment_mode || 'upi')
      setDate(editTxn.date || todayStr())
      setNotes(editTxn.notes || '')
      setShowNotes(!!(editTxn.notes))
    } else if (duplicateTxn) {
      setType(duplicateTxn.type)
      setAmount(String(duplicateTxn.amount))
      setDesc(duplicateTxn.description)
      setCategory(duplicateTxn.category || 'other')
      setVehicle(duplicateTxn.investment_vehicle || 'Other')
      setMode(duplicateTxn.payment_mode || 'upi')
      setDate(todayStr())
      setNotes(duplicateTxn.notes || '')
      setShowNotes(!!(duplicateTxn.notes))
    } else if (open) {
      setType(initialType)
      setAmount(''); setDesc(''); setCategory('other')
      setVehicle('Other'); setMode('upi'); setDate(todayStr())
      setNotes(''); setShowNotes(false)
    }
    setError('')
  }

  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    if (!amount || isNaN(+amount) || +amount <= 0) { setError('Enter a valid amount'); return }
    if (!desc.trim()) { setError('Enter a description'); return }

    const payload = {
      type,
      description: desc.trim(),
      amount: +amount,
      category: type === 'investment' ? 'other' : category,
      date,
      payment_mode: mode,
      is_repayment: false,
      notes: notes.trim() || null,
      ...(type === 'investment' ? { investment_vehicle: vehicle } : {}),
    }

    setIsSaving(true)
    let serverTxn = null
    try {
      if (editTxn) {
        serverTxn = await updateTransaction(editTxn.id, payload)
        if (onConfirmed) await onConfirmed(serverTxn)
        const d = new Date(serverTxn?.date || payload.date)
        invalidateCache(`month:${d.getFullYear()}:${d.getMonth() + 1}`)
        invalidateCache(`year:${d.getFullYear()}`)
      } else {
        serverTxn = await addTransaction(payload)
        if (onConfirmed) await onConfirmed(serverTxn)
      }
      
      // Pessimistic Invalidation (Ensures UI is mathematically flawless)
      invalidateCache('balance:')
      invalidateCache('txns:')
      
      onClose()
    } catch (e) {
      onFailed && onFailed(e.message || 'Could not save. Check your connection.')
    } finally {
      setIsSaving(false)
    }
  }

  const activeType = TYPES.find(t => t.id === type)
  const selectedCat = CATEGORIES.find(c => c.id === category)
  const selectedMode = PAYMENT_MODES.find(m => m.id === mode)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="sheet-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={onClose}
          />
          <motion.div
            className="sheet-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', stiffness: 380, damping: 32 } }}
            exit={{ y: '100%', transition: { duration: 0.22 } }}
            onAnimationComplete={() => { if (open) amountRef.current?.focus() }}
          >
            <div className="sheet-handle" />
            <div className="px-4">

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[20px] font-bold text-ink">
                  {editTxn ? 'Edit Transaction' : 'Add Transaction'}
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSmartMode(!smartMode)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${smartMode ? 'bg-brand text-white shadow-sm' : 'bg-surface text-ink-3'}`}>
                    <Sparkle size={14} weight={smartMode ? 'fill' : 'regular'} />
                    Smart Entry
                  </button>
                  <button onClick={onClose} className="close-btn">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>
              </div>

              
              {/* Smart Input Mode */}
              <AnimatePresence>
                {smartMode && (
                  <motion.div initial={{ opacity: 0, height: 0, marginBottom: 0 }} animate={{ opacity: 1, height: 'auto', marginBottom: 16 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} className="overflow-hidden">
                    <textarea 
                      placeholder="e.g. Paid 400 for lunch using UPI..."
                      value={smartText}
                      onChange={e => handleSmartTextChange(e.target.value)}
                      className="w-full bg-brand/5 border border-brand/20 text-brand font-medium rounded-2xl p-4 min-h-[100px] outline-none focus:ring-2 ring-brand/50 resize-none shadow-inner"
                    />
                    <p className="text-[11px] text-ink-4 mt-2 px-2 flex items-center gap-1"><Sparkle size={12} /> Auto-fills amount, description, category, and mode.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Type selector */}
              <div className="flex gap-2 mb-5">
                {TYPES.map(t => (
                  <button key={t.id}
                    onClick={() => setType(t.id)}
                    className={`flex-1 py-2 rounded-card text-[13px] font-semibold border transition-all
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
                  onChange={e => setAmount(e.target.value)}
                  className={`flex-1 bg-transparent font-display text-3xl font-bold text-ink
                              outline-none tabular-nums placeholder-ink-4`}
                />
              </div>

              {/* Description */}
              <input
                type="text" placeholder="Description"
                value={desc} onChange={e => setDesc(e.target.value)}
                className="input mb-3"
              />

              {/* Field rows */}
              <div className="list-card mb-3">

                {/* Date */}
                <label className="list-row w-full cursor-pointer">
                  <div className="w-8 h-8 rounded-chip bg-brand-container flex items-center justify-center shrink-0">
                    <span className="text-brand text-xs font-bold">📅</span>
                  </div>
                  <span className="flex-1 text-[15px] text-ink">Date</span>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="text-[15px] text-ink-3 bg-transparent outline-none text-right" />
                </label>

                {/* Category (expense/income only) */}
                {type !== 'investment' && (
                  <button className="list-row w-full" onClick={() => setShowCatPicker(true)}>
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
                  <button className="list-row w-full" onClick={() => setShowVehPicker(true)}>
                    <div className="w-8 h-8 rounded-chip bg-invest-bg flex items-center justify-center shrink-0">
                      <span className="text-invest-text text-xs font-bold">₹</span>
                    </div>
                    <span className="flex-1 text-[15px] text-ink text-left">Type of Investment</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] text-ink-3">{vehicle}</span>
                      <ChevronRight size={14} className="text-ink-4" />
                    </div>
                  </button>
                )}

                {/* Payment mode */}
                <button className="list-row w-full" onClick={() => setShowModePicker(true)}>
                  <div className="w-8 h-8 rounded-chip bg-brand-container flex items-center justify-center shrink-0">
                    <CreditCard size={15} className="text-brand" />
                  </div>
                  <span className="flex-1 text-[15px] text-ink text-left">Payment Mode</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] text-ink-3">{selectedMode?.label}</span>
                    <ChevronRight size={14} className="text-ink-4" />
                  </div>
                </button>

                {/* ── Notes row — tap to expand/collapse ── */}
                <button
                  className="list-row w-full"
                  onClick={() => setShowNotes(v => !v)}
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

                {/* Collapsible textarea */}
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
                          onChange={e => setNotes(e.target.value)}
                          className="w-full bg-kosha-surface-2 rounded-card px-3 py-2.5 text-[14px]
                                     text-ink placeholder-ink-4 outline-none resize-none
                                     border border-transparent focus:border-brand-border
                                     transition-colors duration-150"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>

              {error && <p className="text-expense-text text-[13px] mb-3 px-1">{error}</p>}

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`w-full py-4 rounded-card text-[17px] font-semibold flex items-center justify-center gap-2 transition-all ${isSaving ? 'bg-brand/70 text-white/90 scale-[0.98]' : 'bg-brand text-white active:scale-[0.98]'}`}
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
            {showCatPicker && <CategoryPicker selected={category} onSelect={setCategory} onClose={() => setShowCatPicker(false)} />}
            {showModePicker && <ModePicker selected={mode} onSelect={setMode} onClose={() => setShowModePicker(false)} />}
            {showVehPicker && <VehiclePicker selected={vehicle} onSelect={setVehicle} onClose={() => setShowVehPicker(false)} />}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  )
}
