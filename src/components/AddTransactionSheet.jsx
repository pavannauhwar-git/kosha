import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, Calendar, CreditCard } from 'lucide-react'
import { addTransaction, updateTransaction } from '../hooks/useTransactions'
import CategoryIcon from './CategoryIcon'
import { CATEGORIES } from '../lib/categories'

const TYPES = [
  { id:'expense',    label:'Expense',    bg:'bg-expense-bg',  color:'text-expense-text',  border:'border-expense-border'  },
  { id:'income',     label:'Income',     bg:'bg-income-bg',   color:'text-income-text',   border:'border-income-border'   },
  { id:'investment', label:'Investment', bg:'bg-invest-bg',   color:'text-invest-text',   border:'border-invest-border'   },
]

const PAYMENT_MODES = [
  { id:'upi',         label:'UPI'         },
  { id:'credit_card', label:'Credit Card' },
  { id:'debit_card',  label:'Debit Card'  },
  { id:'cash',        label:'Cash'        },
  { id:'net_banking', label:'Net Banking' },
  { id:'other',       label:'Other'       },
]

const INVESTMENT_VEHICLES = [
  'ESOPs','Adobe ESPP','PPF','NPS','Zerodha','Indriya',
  'HSBC','Gold','SGB','Term Plan','CBI','Mutual Fund','Other',
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function CategoryPicker({ selected, onSelect, onClose }) {
  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0, pointerEvents:'none' }}
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
          <h3 className="text-[17px] font-semibold text-ink">Category</h3>
          <button onClick={onClose} className="close-btn"><X size={16} className="text-ink-3" /></button>
        </div>
        <div className="list-card mx-4 overflow-y-auto max-h-[55vh]">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => { onSelect(cat.id); onClose() }}
              className={`list-row w-full text-left ${selected === cat.id ? 'bg-brand-container' : ''}`}>
              <CategoryIcon categoryId={cat.id} size={16} />
              <span className={`flex-1 text-[15px] ${selected === cat.id ? 'text-brand font-medium' : 'text-ink'}`}>{cat.label}</span>
              {selected === cat.id && <span className="text-brand text-lg">✓</span>}
            </button>
          ))}
        </div>
        <div className="h-4" />
      </motion.div>
    </>
  )
}

function ModePicker({ selected, onSelect, onClose }) {
  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0, pointerEvents:'none' }}
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
          <button onClick={onClose} className="close-btn"><X size={16} className="text-ink-3" /></button>
        </div>
        <div className="list-card mx-4">
          {PAYMENT_MODES.map(m => (
            <button key={m.id} onClick={() => { onSelect(m.id); onClose() }}
              className={`list-row w-full text-left ${selected === m.id ? 'bg-brand-container' : ''}`}>
              <span className={`flex-1 text-[15px] ${selected === m.id ? 'text-brand font-medium' : 'text-ink'}`}>{m.label}</span>
              {selected === m.id && <span className="text-brand text-lg">✓</span>}
            </button>
          ))}
        </div>
      </motion.div>
    </>
  )
}

function VehiclePicker({ selected, onSelect, onClose }) {
  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0, pointerEvents:'none' }}
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
          <h3 className="text-[17px] font-semibold text-ink">Investment Type</h3>
          <button onClick={onClose} className="close-btn"><X size={16} className="text-ink-3" /></button>
        </div>
        <div className="list-card mx-4">
          {INVESTMENT_VEHICLES.map(v => (
            <button key={v} onClick={() => { onSelect(v); onClose() }}
              className={`list-row w-full text-left ${selected === v ? 'bg-brand-container' : ''}`}>
              <span className={`flex-1 text-[15px] ${selected === v ? 'text-brand font-medium' : 'text-ink'}`}>{v}</span>
              {selected === v && <span className="text-brand text-lg">✓</span>}
            </button>
          ))}
        </div>
      </motion.div>
    </>
  )
}

// ── Main sheet ─────────────────────────────────────────────────────────────
export default function AddTransactionSheet({ open, onClose, onSaved, editTxn = null, initialType = 'expense' }) {
  const [type,     setType]     = useState('expense')
  const [amount,   setAmount]   = useState('')
  const [desc,     setDesc]     = useState('')
  const [category, setCategory] = useState('other')
  const [vehicle,  setVehicle]  = useState('Other')
  const [mode,     setMode]     = useState('upi')
  const [date,     setDate]     = useState(todayStr())
  const [error,    setError]    = useState('')

  const [showCatPicker,  setShowCatPicker]  = useState(false)
  const [showModePicker, setShowModePicker] = useState(false)
  const [showVehPicker,  setShowVehPicker]  = useState(false)

  const amountRef = useRef(null)

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
      setType(initialType); setAmount(''); setDesc('')
      setCategory('other'); setVehicle('Other'); setMode('upi'); setDate(todayStr())
    }
    setError('')
  }, [editTxn, open])

  async function handleSave() {
    if (!amount || isNaN(+amount) || +amount <= 0) { setError('Enter a valid amount'); return }
    if (!desc.trim()) { setError('Enter a description'); return }

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

    // ── Optimistic close: sheet dismisses instantly, save happens in bg ──
    // This eliminates the "stuck" feel — the user never waits for the network.
    // The 8-second timeout in addTransaction/updateTransaction ensures the
    // promise always resolves, even on a dead connection.
    onClose()

    try {
      if (editTxn) await updateTransaction(editTxn.id, payload)
      else         await addTransaction(payload)
    } catch (e) {
      // Save failed silently (timeout / network error).
      // onSaved() is still called to trigger a refetch — if the item
      // never made it to Supabase, it simply won't appear in the list.
      console.error('[Kosha] Save failed:', e.message)
    } finally {
      onSaved && onSaved()
    }
  }

  const activeType   = TYPES.find(t => t.id === type)
  const selectedCat  = CATEGORIES.find(c => c.id === category)
  const selectedMode = PAYMENT_MODES.find(m => m.id === mode)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="sheet-backdrop"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0, pointerEvents:'none' }}
            onClick={onClose}
          />
          <motion.div
            className="sheet-panel"
            initial={{ y:'100%' }}
            animate={{ y:0, transition:{ type:'spring', stiffness:380, damping:32 } }}
            exit={{ y:'100%', transition:{ duration:0.22 } }}
            onAnimationComplete={() => { if (open) amountRef.current?.focus() }}
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

              {/* ── Type selector — iOS pill track ── */}
              <div className="bg-kosha-surface-2 rounded-pill p-1 flex mb-5">
                {TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className="flex-1 py-2.5 rounded-pill text-[13px] font-semibold
                               transition-colors duration-150 relative z-0"
                  >
                    {type === t.id && (
                      <motion.div
                        layoutId="type-pill-bg"
                        className="absolute inset-0 rounded-pill bg-kosha-surface shadow-card"
                        transition={{ type:'spring', stiffness:400, damping:36 }}
                      />
                    )}
                    <span className={`relative z-10 ${type === t.id ? activeType.color : 'text-ink-3'}`}>
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div className="card mb-3 px-4 py-4 flex items-center gap-2">
                <span className={`font-display text-2xl font-medium ${activeType.color}`}>₹</span>
                <input
                  ref={amountRef}
                  className="flex-1 bg-transparent font-display text-4xl text-ink outline-none placeholder-ink-4"
                  type="number" inputMode="decimal" placeholder="0"
                  value={amount} onChange={e => setAmount(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="card mb-3 px-4 py-3.5">
                <input
                  className="w-full bg-transparent text-[15px] text-ink placeholder-ink-4 outline-none"
                  placeholder="Description"
                  value={desc} onChange={e => setDesc(e.target.value)}
                />
              </div>

              {/* Options */}
              <div className="list-card mb-3">
                <label className="list-row">
                  <div className="w-8 h-8 rounded-chip bg-brand-container flex items-center justify-center shrink-0">
                    <Calendar size={15} className="text-brand" />
                  </div>
                  <span className="flex-1 text-[15px] text-ink">Date</span>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="text-[15px] text-ink-3 bg-transparent outline-none text-right" />
                </label>

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

              {/* Save — solid forest green */}
              <button
                onClick={handleSave}
                className="w-full py-4 rounded-card text-[17px] font-semibold bg-brand text-white
                           active:scale-[0.98] transition-all"
              >
                {editTxn ? 'Save Changes' : `Add ${activeType.label}`}
              </button>
              <div className="h-2" />
            </div>
          </motion.div>

          <AnimatePresence>
            {showCatPicker  && <CategoryPicker selected={category} onSelect={setCategory} onClose={() => setShowCatPicker(false)} />}
            {showModePicker && <ModePicker     selected={mode}     onSelect={setMode}     onClose={() => setShowModePicker(false)} />}
            {showVehPicker  && <VehiclePicker  selected={vehicle}  onSelect={setVehicle}  onClose={() => setShowVehPicker(false)} />}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  )
}
