import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Check, Repeat } from 'lucide-react'
import { useLiabilities, addLiability, markPaid, deleteLiability } from '../hooks/useLiabilities'
import DeleteDialog from '../components/DeleteDialog'
import { fmt, fmtDate, daysUntil, dueLabel, dueChipClass, dueShadow } from '../lib/utils'

const RECURRENCE = ['monthly','quarterly','yearly']

export default function Bills() {
  const { pending, paid, loading, refetch } = useLiabilities()
  const [tab,     setTab]     = useState('pending')
  const [showAdd, setShowAdd] = useState(false)
  const [delId,   setDelId]   = useState(null)
  const [paying,  setPaying]  = useState(null)

  // Add form state
  const [form, setForm] = useState({
    description:'', amount:'', due_date:'', is_recurring:false, recurrence:'monthly',
  })
  const [formErr, setFormErr] = useState('')
  const [saving,  setSaving]  = useState(false)

  const totalPending = pending.reduce((s, b) => s + +b.amount, 0)

  async function handleAdd() {
    if (!form.description.trim()) { setFormErr('Enter a description'); return }
    if (!form.amount || isNaN(+form.amount)) { setFormErr('Enter a valid amount'); return }
    if (!form.due_date) { setFormErr('Select a due date'); return }
    setFormErr(''); setSaving(true)
    try {
      await addLiability({
        description:  form.description.trim(),
        amount:       +form.amount,
        due_date:     form.due_date,
        is_recurring: form.is_recurring,
        recurrence:   form.is_recurring ? form.recurrence : null,
        paid:         false,
      })
      setForm({ description:'', amount:'', due_date:'', is_recurring:false, recurrence:'monthly' })
      setShowAdd(false)
      refetch()
    } catch (e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function handleMarkPaid(bill) {
    setPaying(bill.id)
    try { await markPaid(bill); refetch() }
    catch (e) { alert(e.message) }
    finally { setPaying(null) }
  }

  async function confirmDelete() {
    await deleteLiability(delId)
    setDelId(null)
    refetch()
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <h1 className="font-display text-display text-ink">Bills & Dues</h1>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-pill bg-brand text-white text-xs font-semibold">
          <Plus size={14} /> Add Bill
        </button>
      </div>

      {/* Total pending */}
      {pending.length > 0 && (
        <div className="card-hard-amber mb-4 px-4 py-3">
          <p className="text-xs text-warning-text font-medium">Total Pending</p>
          <p className="font-display text-2xl text-warning-text">{fmt(totalPending)}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { id:'pending', label:`Pending (${pending.length})` },
          { id:'paid',    label:`Paid (${paid.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-card text-sm font-semibold border transition-all
              ${tab === t.id
                ? 'bg-brand-container text-brand-on border-brand-container'
                : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <p className="text-ink-3 text-sm">Loading…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tab === 'pending' && pending.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-ink-2 text-sm font-medium">All clear!</p>
              <p className="text-ink-3 text-xs mt-1">No pending bills.</p>
            </div>
          )}
          {tab === 'paid' && paid.length === 0 && (
            <div className="card p-6 text-center">
              <p className="text-ink-2 text-sm">No paid bills yet.</p>
            </div>
          )}

          {(tab === 'pending' ? pending : paid).map(bill => {
            const days    = daysUntil(bill.due_date)
            const shadow  = tab === 'pending' ? dueShadow(days) : 'card'
            const chipCls = dueChipClass(days)
            return (
              <motion.div key={bill.id}
                layout
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0 }}
                className={`${shadow} p-4`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {bill.is_recurring && (
                        <Repeat size={12} className="text-brand shrink-0" />
                      )}
                      <p className="text-sm font-semibold text-ink truncate">
                        {bill.description}
                      </p>
                    </div>
                    <p className="text-xl font-bold amt-expense mb-2">{fmt(+bill.amount)}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {tab === 'pending' ? (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill ${chipCls}`}>
                          {dueLabel(days)}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-income-bg text-income-text">
                          Paid {fmtDate(bill.due_date)}
                        </span>
                      )}
                      {bill.is_recurring && (
                        <span className="text-[11px] text-ink-3 capitalize">{bill.recurrence}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {tab === 'pending' && (
                      <button
                        onClick={() => handleMarkPaid(bill)}
                        disabled={paying === bill.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-card
                                   bg-income-bg text-income-text text-xs font-semibold
                                   border border-income-border active:scale-95 transition-all
                                   disabled:opacity-60"
                      >
                        <Check size={13} />
                        {paying === bill.id ? 'Paying…' : 'Paid'}
                      </button>
                    )}
                    <button
                      onClick={() => setDelId(bill.id)}
                      className="flex items-center justify-center px-3 py-2 rounded-card
                                 bg-expense-bg text-expense-text text-xs font-semibold
                                 border border-expense-border active:scale-95 transition-all"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Add Bill Sheet */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div className="sheet-backdrop"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setShowAdd(false)}
            />
            <motion.div className="sheet-panel"
              initial={{ y:'100%' }}
              animate={{ y:0, transition:{ type:'spring', stiffness:400, damping:32 } }}
              exit={{ y:'100%', transition:{ duration:0.22 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-display text-ink">Add Bill</h2>
                  <button onClick={() => setShowAdd(false)} className="btn-ghost p-2 rounded-pill">
                    <X size={20} className="text-ink-2" />
                  </button>
                </div>

                <input className="input mb-3" placeholder="Description (e.g. Car EMI)"
                  value={form.description}
                  onChange={e => setForm(f=>({...f, description:e.target.value}))} />

                <div className="bg-kosha-bg border border-kosha-border rounded-card px-4 py-3 mb-3 flex items-center gap-2">
                  <span className="font-display text-xl text-brand">₹</span>
                  <input className="flex-1 bg-transparent font-display text-2xl text-ink outline-none"
                    type="number" inputMode="decimal" placeholder="0"
                    value={form.amount}
                    onChange={e => setForm(f=>({...f, amount:e.target.value}))} />
                </div>

                <input className="input mb-3" type="date"
                  value={form.due_date}
                  onChange={e => setForm(f=>({...f, due_date:e.target.value}))} />

                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => setForm(f=>({...f, is_recurring:!f.is_recurring}))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-card text-sm font-medium border transition-all
                      ${form.is_recurring
                        ? 'bg-brand-container text-brand-on border-brand-container'
                        : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
                  >
                    <Repeat size={14} /> Recurring
                  </button>
                  {form.is_recurring && (
                    <div className="flex gap-2">
                      {RECURRENCE.map(r => (
                        <button key={r}
                          onClick={() => setForm(f=>({...f, recurrence:r}))}
                          className={`px-3 py-1.5 rounded-pill text-xs font-semibold border capitalize transition-all
                            ${form.recurrence===r
                              ? 'bg-brand-container text-brand-on border-brand-container'
                              : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
                        >{r}</button>
                      ))}
                    </div>
                  )}
                </div>

                {formErr && <p className="text-expense-text text-sm mb-3">{formErr}</p>}

                <button onClick={handleAdd} disabled={saving}
                  className="w-full py-4 rounded-card bg-brand-container text-brand-on
                             font-semibold border border-brand-container
                             active:scale-[0.98] disabled:opacity-60 transition-all">
                  {saving ? 'Saving…' : 'Add Bill'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <DeleteDialog
        open={!!delId} label="this bill"
        onConfirm={confirmDelete} onCancel={() => setDelId(null)}
      />
    </div>
  )
}
