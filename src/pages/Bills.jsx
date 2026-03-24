import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Check, Repeat, Loader2, Download, BookOpen, ArrowRight } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useLiabilities,
  addLiability,
  markPaid,
  deleteLiability,
} from '../hooks/useLiabilities'
import { supabase } from '../lib/supabase'
import { getAuthUserId } from '../lib/authStore'
import { downloadCsv, toCsv } from '../lib/csv'
import { fmt, fmtDate, daysUntil, dueLabel, dueChipClass, dueShadow } from '../lib/utils'
import PageHeader from '../components/PageHeader'
import SkeletonLayout from '../components/common/SkeletonLayout'

const RECURRENCE = ['monthly', 'quarterly', 'yearly']
const BILLS_GUIDE_HINT_KEY = 'kosha:dismiss-guide-bills-v1'

export default function Bills() {
  const navigate = useNavigate()
  const { pending, paid, loading } = useLiabilities()
  const [tab, setTab] = useState('pending')
  const [showAdd, setShowAdd] = useState(false)
  const [payingId, setPayingId] = useState(null)
  const [highlightedBillId, setHighlightedBillId] = useState(null)
  const [showGuideHint, setShowGuideHint] = useState(true)
  const [pendingDeleteIds, setPendingDeleteIds] = useState([])
  const [undoToast, setUndoToast] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const deleteTimersRef = useRef(new Map())

  const [form, setForm] = useState({
    description: '', amount: '', due_date: '', is_recurring: false, recurrence: 'monthly',
  })
  const [formErr, setFormErr] = useState('')
  const [errToast, setErrToast] = useState(null)
  const [addSaving, setAddSaving] = useState(false)

  const pendingDeleteSet = useMemo(() => new Set(pendingDeleteIds), [pendingDeleteIds])
  const visiblePending = useMemo(() => pending.filter((b) => !pendingDeleteSet.has(b.id)), [pending, pendingDeleteSet])
  const visiblePaid = useMemo(() => paid.filter((b) => !pendingDeleteSet.has(b.id)), [paid, pendingDeleteSet])

  const totalPending = useMemo(() => visiblePending.reduce((s, b) => s + +b.amount, 0), [visiblePending])
  const dueSoonAmount = useMemo(() => visiblePending
    .filter(b => daysUntil(b.due_date) <= 7)
    .reduce((s, b) => s + +b.amount, 0), [visiblePending])
  const dueSoonCount = useMemo(() => visiblePending.filter(b => daysUntil(b.due_date) <= 7).length, [visiblePending])
  const barPct = totalPending > 0 ? Math.round((dueSoonAmount / totalPending) * 100) : 0
  const totalBills = visiblePending.length + visiblePaid.length
  const focusBillId = searchParams.get('focus')
  const tabFromQuery = searchParams.get('tab')

  useEffect(() => {
    try {
      const hidden = localStorage.getItem(BILLS_GUIDE_HINT_KEY) === '1'
      if (hidden) setShowGuideHint(false)
    } catch {
      // no-op
    }
  }, [])

  useEffect(() => {
    if (tabFromQuery === 'pending' || tabFromQuery === 'paid') {
      setTab(tabFromQuery)
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      setSearchParams(next, { replace: true })
    }
  }, [tabFromQuery, searchParams, setSearchParams])

  useEffect(() => {
    if (!focusBillId) return

    const sourceRows = tab === 'paid' ? paid : pending
    const found = sourceRows.find(b => b.id === focusBillId)
    if (!found) return

    setHighlightedBillId(focusBillId)
    setTimeout(() => {
      const el = document.getElementById(`bill-${focusBillId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 40)

    const timeoutId = setTimeout(() => setHighlightedBillId(null), 2400)

    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })

    return () => clearTimeout(timeoutId)
  }, [focusBillId, tab, pending, paid, searchParams, setSearchParams])

  async function handleExportCsv() {
    try {
      const userId = getAuthUserId()
      const paidFilter = tab === 'paid'
      const { data: rows, error } = await supabase
        .from('liabilities')
        .select('description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id')
        .eq('user_id', userId)
        .eq('paid', paidFilter)
        .order('due_date', { ascending: true })

      if (error) throw error
      if (!rows?.length) {
        setErrToast(`No ${tab} bills to export.`)
        return
      }

      const headers = [
        'Description',
        'Amount',
        'Due Date',
        'Status',
        'Recurring',
        'Recurrence',
        'Linked Transaction ID',
      ]

      const csvRows = rows.map((row) => [
        row.description || '',
        row.amount,
        row.due_date || '',
        row.paid ? 'paid' : 'pending',
        row.is_recurring ? 'yes' : 'no',
        row.recurrence || '',
        row.linked_transaction_id || '',
      ])

      const csv = toCsv(headers, csvRows)
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(`kosha-${tab}-bills-${date}.csv`, csv)
    } catch (e) {
      setErrToast(e.message || 'Could not export bills CSV.')
    }
  }

  async function handleAdd() {
    if (!form.description.trim()) { setFormErr('Enter a description'); return }
    if (!form.amount || isNaN(+form.amount)) { setFormErr('Enter a valid amount'); return }
    if (!form.due_date) { setFormErr('Select a due date'); return }

    const billData = {
      description: form.description.trim(),
      amount: +form.amount,
      due_date: form.due_date,
      is_recurring: form.is_recurring,
      recurrence: form.is_recurring ? form.recurrence : null,
      paid: false,
    }

    setFormErr('')
    setAddSaving(true)

    try {
      await addLiability(billData)
      setShowAdd(false)
      setAddSaving(false)
      setForm({ description: '', amount: '', due_date: '', is_recurring: false, recurrence: 'monthly' })
    } catch (e) {
      setAddSaving(false)
      setErrToast(e.message || 'Could not add bill. Check your connection.')
    }
  }

  async function handleMarkPaid(bill) {
    if (!bill?.id || payingId) return
    setPayingId(bill.id)
    try {
      await markPaid(bill)
      setPayingId(null)
    } catch (e) {
      setPayingId(null)
      setErrToast(e.message || 'Could not mark bill as paid. Check your connection.')
    }
  }

  async function handleDelete(id) {
    if (!id || payingId) return
    if (deleteTimersRef.current.has(id)) return

    const bill = [...pending, ...paid].find((item) => item.id === id)
    const description = bill?.description || 'Bill'

    setPendingDeleteIds((prev) => [...prev, id])
    setUndoToast({ id, description })

    const timerId = setTimeout(async () => {
      try {
        await deleteLiability(id)
      } catch (e) {
        setErrToast(e.message || 'Could not delete bill. Check your connection.')
      } finally {
        deleteTimersRef.current.delete(id)
        setPendingDeleteIds((prev) => prev.filter((item) => item !== id))
        setUndoToast((prev) => (prev?.id === id ? null : prev))
      }
    }, 5000)

    deleteTimersRef.current.set(id, timerId)
  }

  function undoDelete() {
    if (!undoToast?.id) return
    const id = undoToast.id
    const timerId = deleteTimersRef.current.get(id)
    if (timerId) clearTimeout(timerId)
    deleteTimersRef.current.delete(id)
    setPendingDeleteIds((prev) => prev.filter((item) => item !== id))
    setUndoToast(null)
  }

  function dismissGuideHint() {
    setShowGuideHint(false)
    try {
      localStorage.setItem(BILLS_GUIDE_HINT_KEY, '1')
    } catch {
      // no-op
    }
  }

  useEffect(() => {
    return () => {
      for (const timerId of deleteTimersRef.current.values()) {
        clearTimeout(timerId)
      }
      deleteTimersRef.current.clear()
    }
  }, [])

  return (
    <div className="page">
      <PageHeader title="Bills & Dues" />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-ink-3 tracking-wide uppercase">Payment runway</p>
          {visiblePending.length > 0 ? (
            <p className="text-[15px] font-semibold text-ink mt-0.5 truncate">
              Next due in {Math.min(...visiblePending.map(b => Math.max(0, daysUntil(b.due_date))))} days
            </p>
          ) : (
            <p className="text-[15px] font-semibold text-ink mt-0.5">{totalBills} bill{totalBills !== 1 ? 's' : ''}</p>
          )}
        </div>
        {totalBills > 0 && (
          <button
            onClick={handleExportCsv}
            title={`Export ${tab} bills CSV`}
            className="close-btn border border-kosha-border shrink-0"
          >
            <Download size={16} className="text-ink-2" />
          </button>
        )}
      </div>

      {showGuideHint && (
        <div className="card mb-4 p-4 border border-brand-border bg-gradient-to-r from-brand-container/55 to-kosha-surface">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/75 border border-brand-border/55 flex items-center justify-center shrink-0">
              <BookOpen size={16} className="text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body font-semibold text-ink">Bills setup tip</p>
              <p className="text-label text-ink-3 mt-0.5">Mark recurring bills properly to keep due alerts and auto-generation accurate.</p>
              <button
                onClick={() => navigate('/guide')}
                className="text-label font-semibold text-brand mt-2 inline-flex items-center gap-1"
              >
                Open guide <ArrowRight size={13} />
              </button>
            </div>
            <button onClick={dismissGuideHint} className="text-ink-4 hover:text-ink-2 transition-colors" aria-label="Dismiss bills hint">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Structured summary card ───────────────────────────────────── */}
      {visiblePending.length > 0 && (
        <div className="card mb-4 p-4 bg-gradient-to-b from-kosha-surface to-kosha-surface-2/40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-caption text-ink-3">Total pending</span>
            <span className="text-caption font-semibold text-ink-3 bg-kosha-surface-2
                             px-2 py-0.5 rounded-pill">
              {visiblePending.length} bill{visiblePending.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[28px] font-bold text-ink tracking-tight tabular-nums mb-3">
            {fmt(totalPending)}
          </p>
          {/* Progress bar — due-this-week proportion of total */}
          <div className="h-1.5 bg-kosha-border rounded-pill overflow-hidden mb-2">
            <motion.div
              className="h-full rounded-pill"
              style={{ background: dueSoonCount > 0 ? '#B35A00' : '#38A169' }}
              initial={{ width: 0 }} animate={{ width: `${barPct || 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-caption text-ink-3">
              {dueSoonCount > 0
                ? `Due this week · ${fmt(dueSoonAmount)}`
                : 'All bills on schedule'}
            </span>
            {barPct > 0 && (
              <span className="text-caption font-semibold text-warning-text">{barPct}% urgent</span>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-5">
        {[
          { id: 'pending', label: `Pending (${visiblePending.length})` },
          { id: 'paid', label: `Paid (${visiblePaid.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 rounded-pill text-sm font-semibold border transition-all
              ${tab === t.id
                ? 'bg-brand-container text-brand-on border-brand-border shadow-card'
                : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonLayout
          className="space-y-3"
          sections={[
            { type: 'block', height: 'h-[120px]' },
            { type: 'block', height: 'h-[92px]' },
            { type: 'block', height: 'h-[92px]' },
            { type: 'block', height: 'h-[92px]' },
          ]}
        />
      ) : (
        <div className="space-y-3">

          {/* ── Pending empty state ── */}
          {tab === 'pending' && visiblePending.length === 0 && (
            <div className="card py-10 px-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-income-bg flex items-center
                              justify-center mb-4">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M9 16.5l5 5 9-9"
                    stroke="#276749" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-[17px] font-bold text-ink mb-2">You're all clear</p>
              <p className="text-label text-ink-3 mb-5 max-w-[200px] leading-relaxed">
                No pending bills. You're on top of your finances.
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="px-6 py-2.5 rounded-pill bg-warning text-white text-label font-semibold
                           active:scale-95 transition-transform duration-75"
              >
                Add a bill
              </button>
            </div>
          )}

          {tab === 'paid' && visiblePaid.length === 0 && (
            <div className="card p-6 text-center">
              <p className="text-ink-2 text-sm">No paid bills yet.</p>
            </div>
          )}

          {/* ── Bill cards ── */}
          {(tab === 'pending' ? visiblePending : visiblePaid).map(bill => {
            const days = daysUntil(bill.due_date)
            const shadow = tab === 'pending' ? dueShadow(days) : 'card'
            const chipCls = dueChipClass(days)
            return (
              <div
                key={bill.id}
                id={`bill-${bill.id}`}
                className={`${shadow} p-4 ${highlightedBillId === bill.id ? 'txn-focus-highlight' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {bill.is_recurring && (
                        <Repeat size={12} className="text-brand shrink-0" />
                      )}
                      <p className="text-[15px] font-semibold text-ink truncate">
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
                        disabled={!!payingId}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-card
                                   bg-income-bg text-income-text text-xs font-semibold
                                   border border-income-border active:scale-[0.98] transition-all duration-100
                                   disabled:opacity-60"
                      >
                        {payingId === bill.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        {payingId === bill.id ? 'Paying…' : 'Paid'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(bill.id)}
                      disabled={!!payingId}
                      className="flex items-center justify-center px-3 py-2 rounded-card
                                 bg-expense-bg text-expense-text text-xs font-semibold
                                 border border-expense-border active:scale-[0.98] transition-all duration-100
                                 disabled:opacity-60"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add Bill Sheet ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div className="sheet-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={() => setShowAdd(false)}
            />
            <motion.div className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
              exit={{ y: '100%', transition: { duration: 0.22 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5 overflow-x-hidden">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-display text-ink">Add Bill</h2>
                  <button onClick={() => setShowAdd(false)} className="close-btn">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                <input
                  className="input mb-3"
                  placeholder="Description (e.g. Car EMI)"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />

                <div className="bg-kosha-surface-2 rounded-card px-4 py-3.5 mb-3 overflow-hidden
                                flex items-center gap-2 border border-transparent
                                focus-within:border-brand
                                focus-within:ring-2 focus-within:ring-brand/25
                                transition-all duration-100">
                  <span className="font-display text-xl text-warning-text">₹</span>
                  <input className="flex-1 bg-transparent font-display text-2xl text-ink outline-none min-w-0"
                    type="number" inputMode="decimal" placeholder="0"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>

                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <div className="w-8 h-8 rounded-chip bg-warning-bg flex items-center justify-center shrink-0">
                      <span className="text-warning-text text-xs font-bold">📅</span>
                    </div>
                    <span className="flex-1 text-[15px] text-ink">Due Date</span>
                    <input type="date"
                      value={form.due_date}
                      onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                      className="text-[15px] text-ink-3 bg-transparent outline-none text-right
                                 focus:text-warning-text" />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <button
                    onClick={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-card text-sm font-medium
                                border transition-all
                      ${form.is_recurring
                        ? 'bg-warning-bg text-warning-text border-warning-border'
                        : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
                  >
                    <Repeat size={14} /> Recurring
                  </button>
                  {form.is_recurring && (
                    <div className="flex flex-wrap gap-2">
                      {RECURRENCE.map(r => (
                        <button key={r}
                          onClick={() => setForm(f => ({ ...f, recurrence: r }))}
                          className={`px-3 py-1.5 rounded-pill text-xs font-semibold border capitalize transition-all
                            ${form.recurrence === r
                              ? 'bg-warning-bg text-warning-text border-warning-border'
                              : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
                        >{r}</button>
                      ))}
                    </div>
                  )}
                </div>

                {formErr && <p className="text-expense-text text-sm mb-3">{formErr}</p>}

                <div className="sticky bottom-0 pt-2 pb-2 bg-gradient-to-t from-kosha-surface via-kosha-surface to-transparent">
                  <button onClick={handleAdd}
                    disabled={addSaving}
                    className={`w-full py-4 rounded-card font-semibold transition-all
                               ${addSaving ? 'bg-warning/70 text-white/90 scale-[0.99]' : 'bg-warning text-white active:scale-[0.99]'}`}>
                    {addSaving ? 'Adding…' : 'Add Bill'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FAB */}
      <button className="fab-bills" onClick={() => setShowAdd(true)}>
        <Plus size={28} weight="bold" color="white" />
      </button>

      {/* Error toast — shown when addLiability fails after the sheet has closed */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-44 left-4 right-4 md:left-[236px] md:bottom-20 z-50
                   flex items-center gap-3 bg-brand text-white px-4 py-3 rounded-card shadow-card-lg"
          >
            <span className="text-[13px] font-medium flex-1 truncate">{undoToast.description} removed</span>
            <button
              onClick={undoDelete}
              className="text-white text-xs font-semibold underline underline-offset-2"
            >
              Undo
            </button>
          </motion.div>
        )}

        {errToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-32 left-4 right-4 md:left-[236px] md:bottom-8 z-50
                   flex items-center gap-3 bg-ink text-white px-4 py-3 rounded-card shadow-card-lg"
          >
            <span className="text-[13px] font-medium flex-1">{errToast}</span>
            <button
              onClick={() => setErrToast(null)}
              className="text-white opacity-60 text-xs font-semibold shrink-0 px-2 py-1
                     rounded-pill border border-white/20 active:opacity-100"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
