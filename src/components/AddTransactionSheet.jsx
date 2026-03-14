import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, Calendar, CreditCard } from 'lucide-react'
import { CATEGORIES, INVESTMENT_VEHICLES, PAYMENT_MODES } from '../lib/categories'
import { addTransaction, updateTransaction } from '../hooks/useTransactions'
import { todayStr } from '../lib/utils'
import CategoryIcon from './CategoryIcon'

const TYPES = [
  { id:'expense',    label:'Expense',    color:'text-expense-text', bg:'bg-expense-bg',  border:'border-expense-border',  active:'#FF3B30' },
  { id:'income',     label:'Income',     color:'text-income-text',  bg:'bg-income-bg',   border:'border-income-border',   active:'#34C759' },
  { id:'investment', label:'Invest',     color:'text-invest-text',  bg:'bg-invest-bg',   border:'border-invest-border',   active:'#007AFF' },
]

// ── Category picker sub-sheet ─────────────────────────────────────────────
function CategoryPicker({ selected, onSelect, onClose }) {
  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed bottom-0 inset-x-0 bg-kosha-surface z-[60] rounded-t-3xl"
        style={{ paddingBottom:'calc(1.5rem + env(safe-area-inset-bottom,0px))', maxHeight:'80dvh', overflowY:'auto' }}
        initial={{ y:'100%' }}
        animate={{ y:0, transition:{ type:'spring', stiffness:380, damping:32 } }}
        exit={{ y:'100%', transition:{ duration:0.22 } }}
      >
        <div className="sheet-handle" />
        <div className="flex items-center justify-between px-5 mb-4">
          <h3 className="text-[17px] font-semibold text-ink">Category</h3>
          <button onClick={onClose} className="close-btn">
            <X size={16} className="text-ink-3" />
          </button>
        </div>
        <div className="list-card mx-4">
          {CATEGORIES.map((cat, i) => (
            <button
              key={cat.id}
              onClick={() => { onSelect(cat.id); onClose() }}
              className={`list-row w-full text-left ${selected === cat.id ? 'bg-brand-container' : ''}`}
            >
              <CategoryIcon categoryId={cat.id} size={16} />
              <span className={`flex-1 text-[15px] ${selected === cat.id ? 'text-brand font-medium' : 'text-ink'}`}>
                {cat.label}
              </span>
              {selected === cat.id && (
                <span className="text-brand text-lg">✓</span>
              )}
            </button>
          ))}
        </div>
        <div className="h-4" />
      </motion.div>
    </>
  )
}

// ── Payment mode picker ────────────────────────────────────────────────────
function ModePicker({ selected, onSelect, onClose }) {
  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed bottom-0 inset-x-0 bg-kosha-surface z-[60] rounded-t-3xl"
        style={{ paddingBottom:'calc(1.5rem + env(safe-area-inset-bottom,0px))' }}
        initial={{ y:'100%' }}
        animate={{ y:0, transition:{ type:'spring', stiffness:380, damping:32 } }}
        exit={{ y:'100%', transition:{ duration:0.22 } }}
      >
        <div className="sheet-handle" />
        <div className="flex items-center justify-between px-5 mb-4">
          <h3 className="text-[17px] font-semibold text-ink">Payment Mode</h3>
          <button onClick={onClose} className="close-btn">
            <X size={16} className="text-ink-3" />
          </button>
        </div>
        <div className="list-card mx-4">
          {PAYMENT_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => { onSelect(m.id); onClose() }}
              className={`list-row w-full text-left ${selected === m.id ? 'bg-brand-container' : ''}`}
            >
              <span className={`flex-1 text-[15px] ${selected === m.id ? 'text-brand font-medium' : 'text-ink'}`}>
                {m.label}
              </span>
              {selected === m.id && <span className="text-brand text-lg">✓</span>}
            </button>
          ))}
        </div>
      </motion.div>
    </>
  )
}

// ── Vehicle picker ─────────────────────────────────────────────────────────
function VehiclePicker({ selected, onSelect, onClose }) {
  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed bottom-0 inset-x-0 bg-kosha-surface z-[60] rounded-t-3xl"
        style={{ paddingBottom:'calc(1.5rem + env(safe-area-inset-bottom,0px))' }}
        initial={{ y:'100%' }}
        animate={{ y:0, transition:{ type:'spring', stiffness:380, damping:32 } }}
        exit={{ y:'100%', transition:{ duration:0.22 } }}
      >
        <div className="sheet-handle" />
        <div className="flex items-center justify-between px-5 mb-4">
          <h3 className="text-[17px] font-semibold text-ink">Type of Investment</h3>
          <button onClick={onClose} className="close-btn">
            <X size={16} className="text-ink-3" />
          </button>
        </div>
        <div className="list-card mx-4">
          {INVESTMENT_VEHICLES.map(v => (
            <button
              key={v}
              onClick={() => { onSelect(v); onClose() }}
              className={`list-row w-full text-left ${selected === v ? 'bg-brand-container' : ''}`}
            >
              <span className={`flex-1 text-[15px] ${selected === v ? 'text-brand font-medium' : 'text-ink'}`}>
                {v}
              </span>
              {selected === v && <span className="text-brand text-lg">✓</span>}
            </button>
          ))}
        </div>
      </motion.div>
    </>
  )
}

// ── Main sheet ─────────────────────────────────────────────────────────────
export default function AddTransactionSheet({ open, onClose, onSaved, editTxn = null }) {
  const [type,     setType]     = useState('expense')
  const [amount,   setAmount]   = useState('')
  const [desc,     setDesc]     = useState('')
  const [category, setCategory] = useState('other')
  const [vehicle,  setVehicle]  = useState('Other')
  const [mode,     setMode]     = useState('upi')
  const [date,     setDate]     = useState(todayStr())
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const [showCatPicker,  setShowCatPicker]  = useState(false)
  const [showModePicker, setShowModePicker] = useState(false)
  const [showVehPicker,  setShowVehPicker]  = useState(false)

  useEffect(() => {
    if (editTxn) {
      setType(editTxn.type)
      setAmount(String(editTxn.amount))
      setDesc(editTxn.description)
      setCategory(editTxn.category || 'other')
      setVehicle(editTxn.investment_vehicle || 'Other')
      setMode(editTxn.payment_mode || 'upi')
      setDate(editTxn.date || todayStr())
    } else {
      setType('expense'); setAmount(''); setDesc('')
      setCategory('other'); setVehicle('Other'); setMode('upi'); setDate(todayStr())
    }
    setError('')
  }, [editTxn, open])

  async function handleSave() {
    if (!amount || isNaN(+amount) || +amount <= 0) { setError('Enter a valid amount'); return }
    if (!desc.trim()) { setError('Enter a description'); return }
    setError(''); setSaving(true)
    try {
      const payload = {
        type,
        description:  desc.trim(),
        amount:       +amount,
        category:     type === 'investment' ? 'other' : category,
        date,
        payment_mode: mode,
        is_repayment: false,
        ...(type === 'investment' ? { investment_vehicle: vehicle } : {}),
      }
      if (editTxn) await updateTransaction(editTxn.id, payload)
      else         await addTransaction(payload)
      onSaved && onSaved()
      onClose()
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
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
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={onClose}
          />
          <motion.div
            className="sheet-panel"
            initial={{ y:'100%' }}
            animate={{ y:0, transition:{ type:'spring', stiffness:380, damping:32 } }}
            exit={{ y:'100%', transition:{ duration:0.22 } }}
          >
            <div className="sheet-handle" />
            <div className="px-4">

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[20px] font-bold text-ink">
                  {editTxn ? 'Edit Transaction' : 'Add Transaction'}
                </h2>
                <button onClick={onClose} className="close-btn">
                  <X size={16} className="text-ink-3" />
                </button>
              </div>

              {/* Type selector — Apple Pay card style */}
              <div className="flex gap-2.5 mb-5">
                {TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={`flex-1 py-3 rounded-card text-[13px] font-semibold border-2 transition-all
                      ${type === t.id
                        ? `${t.bg} ${t.color} border-current`
                        : 'bg-kosha-surface-2 text-ink-3 border-transparent'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Amount card */}
              <div className="card mb-3 px-4 py-4 flex items-center gap-2">
                <span className={`font-display text-2xl font-medium ${activeType.color}`}>₹</span>
                <input
                  className="flex-1 bg-transparent font-display text-4xl text-ink outline-none placeholder-ink-4"
                  type="number" inputMode="decimal" placeholder="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Description card */}
              <div className="card mb-3 px-4 py-3.5">
                <input
                  className="w-full bg-transparent text-[15px] text-ink placeholder-ink-4 outline-none"
                  placeholder="Description"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                />
              </div>

              {/* Options list — Apple Pay card style */}
              <div className="list-card mb-3">

                {/* Date */}
                <label className="list-row">
                  <div className="w-8 h-8 rounded-chip bg-brand-container flex items-center justify-center shrink-0">
                    <Calendar size={15} className="text-brand" />
                  </div>
                  <span className="flex-1 text-[15px] text-ink">Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="text-[15px] text-ink-3 bg-transparent outline-none text-right"
                  />
                </label>

                {/* Category — only for non-investment */}
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

              </div>

              {error && <p className="text-expense-text text-[13px] mb-3 px-1">{error}</p>}

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className={`w-full py-4 rounded-card text-[17px] font-semibold transition-all
                  active:scale-[0.98] disabled:opacity-60
                  ${activeType.bg} ${activeType.color} border-2 ${activeType.border}`}
              >
                {saving ? 'Saving…' : editTxn ? 'Save Changes' : `Add ${activeType.label}`}
              </button>

              <div className="h-2" />
            </div>
          </motion.div>

          {/* Sub-pickers */}
          <AnimatePresence>
            {showCatPicker && (
              <CategoryPicker
                selected={category}
                onSelect={setCategory}
                onClose={() => setShowCatPicker(false)}
              />
            )}
            {showModePicker && (
              <ModePicker
                selected={mode}
                onSelect={setMode}
                onClose={() => setShowModePicker(false)}
              />
            )}
            {showVehPicker && (
              <VehiclePicker
                selected={vehicle}
                onSelect={setVehicle}
                onClose={() => setShowVehPicker(false)}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  )
}
