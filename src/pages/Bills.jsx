import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Check, Repeat, Loader2, Download, BookOpen, ArrowRight } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useLiabilities,
  addLiabilityMutation,
  markLiabilityPaidMutation,
  deleteLiabilityMutation,
} from '../hooks/useLiabilities'
import { supabase } from '../lib/supabase'
import { getAuthUserId } from '../lib/authStore'
import { downloadCsv, toCsv } from '../lib/csv'
import { fmt, fmtDate, daysUntil, dueLabel, dueChipClass, dueShadow } from '../lib/utils'
import PageHeader from '../components/layout/PageHeader'
import SkeletonLayout from '../components/common/SkeletonLayout'
import EmptyState from '../components/common/EmptyState'
import AppToast from '../components/common/AppToast'
import BillPaymentInsights from '../components/cards/bills/BillPaymentInsights'

const RECURRENCE = ['monthly', 'quarterly', 'yearly']
const BILLS_GUIDE_HINT_KEY = 'kosha:dismiss-guide-bills-v1'
const BUCKET_LABEL_CLASS = {
  overdue: 'bg-expense-bg text-expense-text border border-expense-border',
  dueSoon: 'bg-warning-bg text-warning-text border border-warning-border',
  later: 'bg-kosha-surface-2 text-ink-3 border border-kosha-border',
}

export default function Bills() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(() => (searchParams.get('tab') === 'paid' ? 'paid' : 'pending'))
  const { pending, paid, loading, pendingLoading, paidLoading } = useLiabilities({ includePaid: true })
  const [showAdd, setShowAdd] = useState(false)
  const [payingId, setPayingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [highlightedBillId, setHighlightedBillId] = useState(null)
  const [showGuideHint, setShowGuideHint] = useState(true)

  const [form, setForm] = useState({
    description: '', amount: '', due_date: '', is_recurring: false, recurrence: 'monthly',
  })
  const [formErr, setFormErr] = useState('')
  const [errToast, setErrToast] = useState(null)
  const [addSaving, setAddSaving] = useState(false)
  const [hiddenBillIds, setHiddenBillIds] = useState(() => new Set())

  const visiblePending = useMemo(() => pending.filter((bill) => !hiddenBillIds.has(bill.id)), [pending, hiddenBillIds])
  const visiblePaid = useMemo(() => paid.filter((bill) => !hiddenBillIds.has(bill.id)), [paid, hiddenBillIds])

  const totalPending = useMemo(() => visiblePending.reduce((s, b) => s + +b.amount, 0), [visiblePending])
  const dueSoonAmount = useMemo(() => visiblePending
    .filter(b => daysUntil(b.due_date) <= 7)
    .reduce((s, b) => s + +b.amount, 0), [visiblePending])
  const dueSoonCount = useMemo(() => visiblePending.filter(b => daysUntil(b.due_date) <= 7).length, [visiblePending])
  const dueThisMonth = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const rows = visiblePending.filter((bill) => {
      const parsed = new Date(`${bill.due_date}T00:00:00`)
      if (Number.isNaN(parsed.getTime())) return false
      return parsed.getFullYear() === y && parsed.getMonth() === m
    })
    return {
      count: rows.length,
      amount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    }
  }, [visiblePending])

  const pendingWithBucket = useMemo(() => {
    const bucketRank = { overdue: 0, dueSoon: 1, later: 2 }
    return visiblePending
      .map((bill) => {
        const days = daysUntil(bill.due_date)
        const bucket = days < 0 ? 'overdue' : days <= 7 ? 'dueSoon' : 'later'
        return { ...bill, _days: days, _bucket: bucket }
      })
      .sort((a, b) => {
        const rankDiff = bucketRank[a._bucket] - bucketRank[b._bucket]
        if (rankDiff !== 0) return rankDiff
        return String(a.due_date || '').localeCompare(String(b.due_date || ''))
      })
  }, [visiblePending])

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
        setTimeout(() => setErrToast(null), 4000)
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
      setTimeout(() => setErrToast(null), 4000)
    }
  }

  async function handleAdd() {
    if (!form.description.trim()) { setFormErr('Enter a description'); return }
    if (!form.amount || !Number.isFinite(+form.amount) || +form.amount <= 0) { setFormErr('Enter a valid positive amount'); return }
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
      await addLiabilityMutation(billData)

      setTab('pending')
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
      await markLiabilityPaidMutation(bill)
      setPayingId(null)
    } catch (e) {
      setPayingId(null)
      setErrToast(e.message || 'Could not mark bill as paid. Check your connection.')
    }
  }

  async function handleDelete(id) {
    if (!id || payingId || deletingId) return
    setDeletingId(id)
    setHiddenBillIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    try {
      await deleteLiabilityMutation(id)
    } catch (e) {
      setHiddenBillIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setErrToast(e.message || 'Could not delete bill. Check your connection.')
    } finally {
      setDeletingId(null)
    }
  }

  function dismissGuideHint() {
    setShowGuideHint(false)
    try {
      localStorage.setItem(BILLS_GUIDE_HINT_KEY, '1')
    } catch {
      // no-op
    }
  }

  return (
    <div className="page">
      <PageHeader title="Bills & Dues" className="mb-3" />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div>
          {tab === 'pending' && visiblePending.length > 0 ? (
            <p className="text-caption text-ink-3 mt-0.5">
              Next due in {Math.min(...visiblePending.map(b => Math.max(0, daysUntil(b.due_date) || 0)).filter(Number.isFinite))} days
            </p>
          ) : tab === 'paid' ? (
            <p className="text-caption text-ink-3 mt-0.5">{visiblePaid.length} paid bill{visiblePaid.length !== 1 ? 's' : ''}</p>
          ) : (
            <p className="text-caption text-ink-3 mt-0.5">{totalBills} bill{totalBills !== 1 ? 's' : ''}</p>
          )}
        </div>
        {totalBills > 0 && (
          <button
            type="button"
            onClick={handleExportCsv}
            className="btn-secondary h-9 px-3 text-[11px]"
          >
            <Download size={14} className="mr-1" />
            Export CSV
          </button>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`h-9 sm:h-10 w-full rounded-card text-[11px] sm:text-[12px] font-semibold transition-all duration-100 active:scale-[0.97]
            ${tab === 'pending'
              ? 'bg-brand text-white border border-brand shadow-card'
              : 'bg-kosha-surface text-ink-3 border border-kosha-border'}`}
        >
          Pending ({visiblePending.length})
        </button>
        <button
          onClick={() => setTab('paid')}
          className={`h-9 sm:h-10 w-full rounded-card text-[11px] sm:text-[12px] font-semibold transition-all duration-100 active:scale-[0.97]
            ${tab === 'paid'
              ? 'bg-income text-white border border-income shadow-card'
              : 'bg-kosha-surface text-ink-3 border border-kosha-border'}`}
        >
          Paid ({visiblePaid.length})
        </button>
      </div>

      {/* ── Summary card ─────────────────────────────────────────────── */}
      {tab === 'pending' && visiblePending.length > 0 && (
        <div className="card mb-3.5 p-3.5 sm:p-4 border border-kosha-border bg-kosha-surface">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-kosha-border">
            <div>
              <p className="section-label mb-0.5">Total pending</p>
              <p className="text-value font-semibold text-ink tracking-tight tabular-nums leading-none">
                {fmt(totalPending)}
              </p>
            </div>
            <span className="text-caption font-semibold text-ink-3 bg-kosha-surface-2 px-2.5 py-1 rounded-pill border border-kosha-border">
              {visiblePending.length} bill{visiblePending.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-kosha-surface-2 rounded-card border border-kosha-border px-3 py-2.5">
              <p className="text-caption text-ink-3 mb-1">Due in 7 days</p>
              <p className="text-base font-semibold text-warning-text tabular-nums leading-none">{fmt(dueSoonAmount)}</p>
              <p className="text-caption text-ink-3 mt-1">{dueSoonCount} bill{dueSoonCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-kosha-surface-2 rounded-card border border-kosha-border px-3 py-2.5">
              <p className="text-caption text-ink-3 mb-1">Due this month</p>
              <p className="text-base font-semibold text-ink tabular-nums leading-none">{fmt(dueThisMonth.amount)}</p>
              <p className="text-caption text-ink-3 mt-1">{dueThisMonth.count} bill{dueThisMonth.count !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="mt-3.5">
            <div className="h-1.5 bg-kosha-border rounded-pill overflow-hidden mb-1.5">
              <motion.div
                className={`h-full rounded-pill ${dueSoonCount > 0 ? 'bg-warning-text' : 'bg-income-text'}`}
                initial={{ width: 0 }} animate={{ width: `${barPct || 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-caption text-ink-3">
                {dueSoonCount > 0 ? `${fmt(dueSoonAmount)} due this week` : 'All bills on schedule'}
              </span>
              <span className={`text-caption font-semibold ${barPct > 0 ? 'text-warning-text' : 'text-income-text'}`}>
                {barPct > 0 ? `${barPct}% urgent` : 'Stable'}
              </span>
            </div>
          </div>
        </div>
      )}

      {showGuideHint && (
        <div className="card mb-3.5 p-3.5 sm:p-4 border border-kosha-border bg-kosha-surface">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-kosha-surface-2 flex items-center justify-center shrink-0 border border-kosha-border">
              <BookOpen size={16} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-ink">Bills setup tip</p>
              <p className="text-[12px] text-ink-3 mt-0.5 leading-relaxed">Mark recurring bills properly to keep due alerts and auto-generation accurate.</p>
              <button
                onClick={() => navigate('/guide')}
                className="text-[12px] font-semibold text-accent mt-2 inline-flex items-center gap-1"
              >
                Open guide <ArrowRight size={12} />
              </button>
            </div>
            <button onClick={dismissGuideHint} className="text-ink-4 hover:text-ink-2 transition-colors shrink-0" aria-label="Dismiss bills hint">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {loading && pendingLoading && visiblePending.length === 0 ? (
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
            <EmptyState
              className="py-8"
              icon={<Check size={24} className="text-income-text" />}
              title="You're all clear"
              description="No pending bills right now. Add recurring dues to keep reminders and cashflow planning accurate."
              actionLabel="Add a bill"
              onAction={() => setShowAdd(true)}
            />
          )}

          {tab === 'paid' && !paidLoading && visiblePaid.length > 0 && (
            <BillPaymentInsights paidBills={visiblePaid} pendingBills={visiblePending} />
          )}

          {tab === 'paid' && paidLoading && visiblePaid.length === 0 && (
            <div className="card p-4">
              <p className="section-label">Paid bills</p>
              <p className="text-[12px] text-ink-3 mt-1">Loading paid history...</p>
            </div>
          )}

          {tab === 'paid' && !paidLoading && visiblePaid.length === 0 && (
            <EmptyState
              className="py-8"
              title="No paid bills yet"
              description="Bills you mark as paid will show up here for history and tracking."
              actionLabel="View pending"
              onAction={() => setTab('pending')}
            />
          )}

          {/* ── Bill cards ── */}
          {(tab === 'pending' ? pendingWithBucket : visiblePaid).map((bill, index, rows) => {
            const days = daysUntil(bill.due_date)
            const shadow = tab === 'pending' ? dueShadow(days) : 'card'
            const chipCls = dueChipClass(days)
            const showBucketHeader = tab === 'pending' && (index === 0 || rows[index - 1]._bucket !== bill._bucket)
            const bucketLabelClass = BUCKET_LABEL_CLASS[bill._bucket] || BUCKET_LABEL_CLASS.later
            return (
              <div key={bill.id}>
                {showBucketHeader && (
                  <div className="px-1 mb-1 mt-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-semibold uppercase tracking-wide ${bucketLabelClass}`}>
                      {bill._bucket === 'overdue' ? 'Overdue' : bill._bucket === 'dueSoon' ? 'Due this week' : 'Later'}
                    </span>
                  </div>
                )}
                <div
                  id={`bill-${bill.id}`}
                  className={`${shadow} p-3 sm:p-3.5 ${highlightedBillId === bill.id ? 'txn-focus-highlight' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {bill.is_recurring && (
                          <Repeat size={12} className="text-ink-3 shrink-0" />
                        )}
                        <p className="text-[13px] sm:text-sm font-semibold text-ink truncate">
                          {bill.description}
                        </p>
                      </div>
                      <p className="text-[17px] sm:text-lg font-semibold amt-expense mb-2">{fmt(+bill.amount)}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {tab === 'pending' ? (
                          <span className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill ${chipCls}`}>
                            {dueLabel(days)}
                          </span>
                        ) : (
                          <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-kosha-surface-2 text-ink-3 border border-kosha-border">
                            Paid {fmtDate(bill.due_date)}
                          </span>
                        )}
                        {bill.is_recurring && (
                          <span className="text-[10px] sm:text-[11px] text-ink-3 capitalize">{bill.recurrence}</span>
                        )}
                        {(bill.__optimistic || String(bill.id || '').startsWith('optimistic-')) && (
                          <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-warning-bg text-warning-text">
                            Syncing...
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {tab === 'pending' && (
                        <button
                          onClick={() => handleMarkPaid(bill)}
                          disabled={!!payingId || !!deletingId || !!bill.__optimistic}
                          className="h-8 flex items-center gap-1.5 px-2.5 rounded-card
                                     bg-income-bg text-income-text text-[11px] font-semibold
                                     border border-income-border active:scale-[0.97] transition-all duration-100
                                     disabled:opacity-60"
                        >
                          {payingId === bill.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          {payingId === bill.id ? 'Paying…' : 'Paid'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(bill.id)}
                        disabled={!!payingId || !!deletingId || !!bill.__optimistic}
                        className="h-8 w-8 flex items-center justify-center rounded-card
                                   bg-expense-bg text-expense-text text-[11px] font-semibold
                                   border border-expense-border active:scale-[0.97] transition-all duration-100
                                   disabled:opacity-60"
                      >
                        {deletingId === bill.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                      </button>
                    </div>
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
              onClick={() => { setShowAdd(false); setFormErr(''); setForm({ description: '', amount: '', due_date: '', is_recurring: false, recurrence: 'monthly' }) }}
            />
            <motion.div className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
              exit={{ y: '100%', transition: { duration: 0.22 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5 overflow-x-hidden">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-display font-bold text-ink">Add Bill</h2>
                  <button onClick={() => setShowAdd(false)} className="close-btn">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                <input
                  className="input mb-3"
                  name="bill-description"
                  placeholder="Description (e.g. Car EMI)"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />

                <div className="bg-kosha-surface-2 rounded-card px-4 py-3.5 mb-3 overflow-hidden
                                flex items-center gap-2 border border-transparent
                                focus-within:border-warning-border
                                focus-within:ring-2 focus-within:ring-warning/25
                                transition-all duration-100">
                  <span className="text-xl font-bold text-warning-text">₹</span>
                  <input className="flex-1 bg-transparent text-2xl font-bold text-ink outline-none min-w-0"
                    type="number" inputMode="decimal" name="bill-amount" placeholder="0"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>

                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <div className="w-8 h-8 rounded-chip bg-warning-bg flex items-center justify-center shrink-0">
                      <span className="text-warning-text text-xs font-bold">📅</span>
                    </div>
                    <span className="flex-1 text-[15px] text-ink">Due Date</span>
                    <input type="date" name="bill-due-date"
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
                               ${addSaving ? 'bg-repay/70 text-white/90 scale-[0.97]' : 'bg-gradient-to-r from-warning to-repay text-white active:scale-[0.97]'}`}>
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
        <Plus size={24} className="text-white" />
      </button>

      <AppToast message={errToast} onDismiss={() => setErrToast(null)} />

    </div>
  )
}
