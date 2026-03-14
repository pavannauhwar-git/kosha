import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { CATEGORIES, INVESTMENT_VEHICLES, PAYMENT_MODES } from '../lib/categories'
import { addTransaction, updateTransaction } from '../hooks/useTransactions'
import { todayStr } from '../lib/utils'
import CategoryIcon from './CategoryIcon'

const TYPES = [
  { id:'expense',    label:'Expense',    color:'text-expense-text', bg:'bg-expense-bg',  border:'border-expense-border' },
  { id:'income',     label:'Income',     color:'text-income-text',  bg:'bg-income-bg',   border:'border-income-border'  },
  { id:'investment', label:'Invest',     color:'text-invest-text',  bg:'bg-invest-bg',   border:'border-invest-border'  },
]

export default function AddTransactionSheet({ open, onClose, onSaved, editTxn = null }) {
  const [type,       setType]       = useState('expense')
  const [amount,     setAmount]     = useState('')
  const [desc,       setDesc]       = useState('')
  const [category,   setCategory]   = useState('other')
  const [vehicle,    setVehicle]    = useState('Other')
  const [mode,       setMode]       = useState('upi')
  const [date,       setDate]       = useState(todayStr())
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

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
        type, description: desc.trim(), amount: +amount,
        category, date, payment_mode: mode,
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

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={onClose}
          />
          <motion.div
            className="sheet-panel"
            initial={{ y:'100%' }}
            animate={{ y:0, transition:{ type:'spring', stiffness:400, damping:32 } }}
            exit={{ y:'100%', transition:{ duration:0.22 } }}
          >
            <div className="sheet-handle" />

            <div className="px-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-display text-ink">
                  {editTxn ? 'Edit' : 'Add'}
                </h2>
                <button onClick={onClose} className="btn-ghost p-2 rounded-pill">
                  <X size={20} className="text-ink-2" />
                </button>
              </div>

              {/* Type toggle */}
              <div className="flex gap-2 mb-5">
                {TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={`flex-1 py-2.5 rounded-card text-sm font-semibold border transition-all
                      ${type === t.id
                        ? `${t.bg} ${t.color} ${t.border}`
                        : 'bg-kosha-bg text-ink-2 border-kosha-border'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div className="bg-kosha-bg border border-kosha-border rounded-card px-4 py-3 mb-4 flex items-center gap-2">
                <span className={`font-display text-2xl ${activeType.color}`}>₹</span>
                <input
                  className="flex-1 bg-transparent font-display text-3xl text-ink outline-none"
                  type="number" inputMode="decimal" placeholder="0"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Description */}
              <input
                className="input mb-4"
                placeholder="Description (e.g. Zomato dinner)"
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />

              {/* Date */}
              <input
                className="input mb-4"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />

              {/* Category */}
              <p className="section-label mb-2">Category</p>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-card border shrink-0 transition-all
                      ${category === cat.id
                        ? 'border-brand bg-brand-container'
                        : 'border-kosha-border bg-kosha-surface'}`}
                  >
                    <CategoryIcon categoryId={cat.id} size={16} />
                    <span className={`text-[10px] font-medium whitespace-nowrap
                      ${category === cat.id ? 'text-brand-on' : 'text-ink-2'}`}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Investment vehicle */}
              {type === 'investment' && (
                <>
                  <p className="section-label mb-2">Investment</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
                    {INVESTMENT_VEHICLES.map(v => (
                      <button
                        key={v}
                        onClick={() => setVehicle(v)}
                        className={`px-3 py-1.5 rounded-pill text-xs font-semibold border shrink-0 transition-all
                          ${vehicle === v
                            ? 'bg-invest-bg text-invest-text border-invest-border'
                            : 'bg-kosha-bg text-ink-2 border-kosha-border'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Payment mode */}
              <p className="section-label mb-2">Via</p>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-5 no-scrollbar">
                {PAYMENT_MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`px-3 py-1.5 rounded-pill text-xs font-semibold border shrink-0 transition-all
                      ${mode === m.id
                        ? 'bg-brand-container text-brand-on border-brand-container'
                        : 'bg-kosha-bg text-ink-2 border-kosha-border'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {error && <p className="text-expense-text text-sm mb-3">{error}</p>}

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className={`w-full py-4 rounded-card font-semibold text-base transition-all
                  ${activeType.bg} ${activeType.color} border ${activeType.border}
                  active:scale-[0.98] disabled:opacity-60`}
              >
                {saving ? 'Saving…' : editTxn ? 'Save Changes' : `Add ${activeType.label}`}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}