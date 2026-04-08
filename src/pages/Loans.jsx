import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Check, Loader2, Download, ArrowDownLeft, ArrowUpRight,
  HandCoins, Users, Percent, Calendar, FileText, Pencil,
} from 'lucide-react'
import {
  useLoans,
  addLoanMutation,
  updateLoanMutation,
  recordLoanPaymentMutation,
  deleteLoanMutation,
  accruedInterest,
  loanProgress,
} from '../hooks/useLoans'
import { supabase } from '../lib/supabase'
import { getAuthUserId } from '../lib/authStore'
import { downloadCsv, toCsv } from '../lib/csv'
import { fmt, fmtDate, daysUntil, dueLabel, dueChipClass } from '../lib/utils'
import PageHeader from '../components/layout/PageHeader'
import SkeletonLayout from '../components/common/SkeletonLayout'
import EmptyState from '../components/common/EmptyState'
import AppToast from '../components/common/AppToast'

const LOAN_COLUMNS_EXPORT =
  'id, direction, counterparty, amount, amount_settled, interest_rate, loan_date, due_date, note, settled'

export default function Loans() {
  const { given, taken, settled, loading, settledLoading } = useLoans()
  const [tab, setTab] = useState('given')
  const [showAdd, setShowAdd] = useState(false)
  const [editLoan, setEditLoan] = useState(null)
  const [payLoan, setPayLoan] = useState(null)      // loan object being paid
  const [deletingId, setDeletingId] = useState(null)
  const [errToast, setErrToast] = useState(null)
  const [hiddenIds, setHiddenIds] = useState(() => new Set())

  // ── Form state ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    direction: 'given', counterparty: '', amount: '', interest_rate: '',
    loan_date: new Date().toISOString().slice(0, 10), due_date: '', note: '',
  })
  const [formErr, setFormErr] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // ── Payment form state ──────────────────────────────────────────────
  const [payAmount, setPayAmount] = useState('')
  const [payErr, setPayErr] = useState('')
  const [paySaving, setPaySaving] = useState(false)

  // ── Derived data ────────────────────────────────────────────────────
  const visibleGiven   = useMemo(() => given.filter(l => !hiddenIds.has(l.id)),   [given, hiddenIds])
  const visibleTaken   = useMemo(() => taken.filter(l => !hiddenIds.has(l.id)),   [taken, hiddenIds])
  const visibleSettled = useMemo(() => settled.filter(l => !hiddenIds.has(l.id)), [settled, hiddenIds])

  const activeLoans = tab === 'given' ? visibleGiven : tab === 'taken' ? visibleTaken : visibleSettled

  const totalGiven = useMemo(() => visibleGiven.reduce((s, l) => s + (+l.amount - +l.amount_settled), 0), [visibleGiven])
  const totalTaken = useMemo(() => visibleTaken.reduce((s, l) => s + (+l.amount - +l.amount_settled), 0), [visibleTaken])
  const netPosition = totalGiven - totalTaken

  const totalCount = visibleGiven.length + visibleTaken.length + visibleSettled.length

  // ── Handlers ────────────────────────────────────────────────────────

  function resetForm() {
    setForm({
      direction: 'given', counterparty: '', amount: '', interest_rate: '',
      loan_date: new Date().toISOString().slice(0, 10), due_date: '', note: '',
    })
    setFormErr('')
  }

  async function handleAdd() {
    if (!form.counterparty.trim()) { setFormErr('Enter a name'); return }
    if (!form.amount || !Number.isFinite(+form.amount) || +form.amount <= 0) { setFormErr('Enter a valid positive amount'); return }
    if (!form.loan_date) { setFormErr('Select a loan date'); return }

    const loanData = {
      direction: form.direction,
      counterparty: form.counterparty.trim(),
      amount: +form.amount,
      interest_rate: form.interest_rate ? +form.interest_rate : 0,
      loan_date: form.loan_date,
      due_date: form.due_date || null,
      note: form.note.trim() || null,
    }

    setFormErr('')
    setAddSaving(true)

    if (editLoan) {
      try {
        await updateLoanMutation(editLoan.id, loanData)
        setTab(loanData.direction)
        setShowAdd(false)
        setEditLoan(null)
        setAddSaving(false)
        resetForm()
      } catch (e) {
        setAddSaving(false)
        setErrToast(e.message || 'Could not update loan.')
      }
      return
    }

    try {
      await addLoanMutation({ ...loanData, amount_settled: 0, settled: false })
      setTab(loanData.direction)
      setShowAdd(false)
      setAddSaving(false)
      resetForm()
    } catch (e) {
      setAddSaving(false)
      setErrToast(e.message || 'Could not add loan.')
    }
  }

  async function handleRecordPayment() {
    if (!payLoan) return
    const amt = +payAmount
    const remaining = +payLoan.amount - +payLoan.amount_settled
    if (!Number.isFinite(amt) || amt <= 0) { setPayErr('Enter a valid positive amount'); return }
    if (amt > remaining) { setPayErr(`Max payment is ${fmt(remaining)}`); return }

    setPayErr('')
    setPaySaving(true)

    try {
      await recordLoanPaymentMutation(payLoan, amt)
      setPaySaving(false)
      setPayLoan(null)
      setPayAmount('')
    } catch (e) {
      setPaySaving(false)
      setErrToast(e.message || 'Could not record payment.')
    }
  }

  const handleSettleFull = useCallback(async (loan) => {
    const remaining = +loan.amount - +loan.amount_settled
    if (remaining <= 0) return

    try {
      await recordLoanPaymentMutation(loan, remaining)
    } catch (e) {
      setErrToast(e.message || 'Could not settle loan.')
    }
  }, [])

  async function handleDelete(id) {
    if (!id || deletingId) return
    setDeletingId(id)
    setHiddenIds(prev => { const n = new Set(prev); n.add(id); return n })

    try {
      await deleteLoanMutation(id)
    } catch (e) {
      setHiddenIds(prev => { const n = new Set(prev); n.delete(id); return n })
      setErrToast(e.message || 'Could not delete loan.')
    } finally {
      setDeletingId(null)
    }
  }

  function openEditLoan(loan) {
    setEditLoan(loan)
    setForm({
      direction: loan.direction || 'given',
      counterparty: loan.counterparty || '',
      amount: String(loan.amount || ''),
      interest_rate: loan.interest_rate ? String(loan.interest_rate) : '',
      loan_date: loan.loan_date || new Date().toISOString().slice(0, 10),
      due_date: loan.due_date || '',
      note: loan.note || '',
    })
    setFormErr('')
    setShowAdd(true)
  }

  async function handleExportCsv() {
    try {
      const userId = getAuthUserId()
      const { data: rows, error } = await supabase
        .from('loans')
        .select(LOAN_COLUMNS_EXPORT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!rows?.length) {
        setErrToast('No loans to export.')
        setTimeout(() => setErrToast(null), 4000)
        return
      }

      const headers = ['Direction', 'Counterparty', 'Amount', 'Settled Amount', 'Interest %', 'Loan Date', 'Due Date', 'Note', 'Settled']
      const csvRows = rows.map(r => [
        r.direction, r.counterparty, r.amount, r.amount_settled,
        r.interest_rate, r.loan_date || '', r.due_date || '', r.note || '',
        r.settled ? 'yes' : 'no',
      ])
      const csv = toCsv(headers, csvRows)
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(`kosha-loans-${date}.csv`, csv)
    } catch (e) {
      setErrToast(e.message || 'Could not export CSV.')
      setTimeout(() => setErrToast(null), 4000)
    }
  }

  return (
    <div className="page">
      <PageHeader title="Loans" className="mb-3" />

      {/* ── Subheader ─────────────────────────────────────────────────── */}
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="text-caption text-ink-3 mt-0.5">
          {totalCount} loan{totalCount !== 1 ? 's' : ''} · {visibleGiven.length + visibleTaken.length} active
        </p>
        {totalCount > 0 && (
          <button type="button" onClick={handleExportCsv} className="btn-secondary h-9 px-3 text-[11px]">
            <Download size={14} className="mr-1" /> Export CSV
          </button>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { key: 'given',   label: 'Given',   count: visibleGiven.length,   activeClass: 'bg-income text-white border-income shadow-card' },
          { key: 'taken',   label: 'Taken',   count: visibleTaken.length,   activeClass: 'bg-expense text-white border-expense shadow-card' },
          { key: 'settled', label: 'Settled', count: visibleSettled.length, activeClass: 'bg-repay text-white border-repay shadow-card' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`h-9 sm:h-10 w-full rounded-card text-[11px] sm:text-[12px] font-semibold transition-all duration-100 active:scale-[0.97]
              ${tab === t.key ? t.activeClass : 'bg-kosha-surface text-ink-3 border border-kosha-border'}`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* ── Summary card ──────────────────────────────────────────────── */}
      {(visibleGiven.length > 0 || visibleTaken.length > 0) && tab !== 'settled' && (
        <div className="card mb-3.5 p-3.5 sm:p-4 border border-kosha-border bg-kosha-surface">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-kosha-surface-2 rounded-card border border-kosha-border px-3 py-2.5">
              <p className="text-caption text-ink-3 mb-1">You're owed</p>
              <p className="text-base font-semibold amt-income tabular-nums leading-none">{fmt(totalGiven)}</p>
              <p className="text-caption text-ink-3 mt-1">{visibleGiven.length} loan{visibleGiven.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-kosha-surface-2 rounded-card border border-kosha-border px-3 py-2.5">
              <p className="text-caption text-ink-3 mb-1">You owe</p>
              <p className="text-base font-semibold amt-expense tabular-nums leading-none">{fmt(totalTaken)}</p>
              <p className="text-caption text-ink-3 mt-1">{visibleTaken.length} loan{visibleTaken.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="mt-3 bg-kosha-surface-2 rounded-card border border-kosha-border px-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-caption text-ink-3">Net position</p>
              <p className={`text-base font-semibold tabular-nums leading-none ${netPosition >= 0 ? 'amt-income' : 'amt-expense'}`}>
                {netPosition >= 0 ? '+' : ''}{fmt(netPosition)}
              </p>
            </div>
            <p className="text-caption text-ink-3 mt-0.5">
              {netPosition > 0 ? 'In your favor' : netPosition < 0 ? 'You owe more' : 'Balanced'}
            </p>
          </div>
        </div>
      )}

      {/* ── Loading / Empty states ────────────────────────────────────── */}
      {loading && activeLoans.length === 0 ? (
        <SkeletonLayout
          className="space-y-3"
          sections={[
            { type: 'block', height: 'h-[120px]' },
            { type: 'block', height: 'h-[100px]' },
            { type: 'block', height: 'h-[100px]' },
          ]}
        />
      ) : (
        <div className="space-y-3">
          {tab !== 'settled' && activeLoans.length === 0 && (
            <EmptyState
              className="py-8"
              icon={<HandCoins size={24} className="text-accent" />}
              title={tab === 'given' ? 'No loans given' : 'No loans taken'}
              description={tab === 'given'
                ? 'Track money you\u2019ve lent to friends, family, or others.'
                : 'Track money you\u2019ve borrowed from others.'}
              actionLabel="Add a loan"
              onAction={() => { setForm(f => ({ ...f, direction: tab })); setShowAdd(true) }}
            />
          )}

          {tab === 'settled' && settledLoading && visibleSettled.length === 0 && (
            <div className="card p-4">
              <p className="section-label">Settled loans</p>
              <p className="text-[12px] text-ink-3 mt-1">Loading history…</p>
            </div>
          )}

          {tab === 'settled' && !settledLoading && visibleSettled.length === 0 && (
            <EmptyState
              className="py-8"
              title="No settled loans"
              description="Loans you fully repay will show up here."
              actionLabel="View active"
              onAction={() => setTab('given')}
            />
          )}

          {/* ── Loan cards ───────────────────────────────────────────── */}
          {activeLoans.map((loan) => {
            const remaining = +loan.amount - +loan.amount_settled
            const pct = loanProgress(loan.amount, loan.amount_settled)
            const interest = accruedInterest(loan.amount, loan.interest_rate, loan.loan_date)
            const days = loan.due_date ? daysUntil(loan.due_date) : null
            const isOptimistic = loan.__optimistic || String(loan.id || '').startsWith('optimistic-')

            return (
              <div key={loan.id} className="card p-3 sm:p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Direction icon + counterparty */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                        ${loan.direction === 'given' ? 'bg-income-bg' : 'bg-expense-bg'}`}>
                        {loan.direction === 'given'
                          ? <ArrowUpRight size={14} className="text-income-text" />
                          : <ArrowDownLeft size={14} className="text-expense-text" />}
                      </div>
                      <p className="text-[13px] sm:text-sm font-semibold text-ink truncate">
                        {loan.counterparty}
                      </p>
                    </div>

                    {/* Amount */}
                    <p className={`text-[17px] sm:text-lg font-semibold mb-1 ${loan.direction === 'given' ? 'amt-income' : 'amt-expense'}`}>
                      {fmt(+loan.amount)}
                    </p>

                    {/* Interest if applicable */}
                    {interest > 0 && (
                      <p className="text-[11px] text-ink-3 mb-1">
                        +{fmt(Math.round(interest * 100) / 100)} interest ({loan.interest_rate}%/yr)
                      </p>
                    )}

                    {/* Progress bar (active loans only) */}
                    {!loan.settled && (
                      <div className="mb-2">
                        <div className="h-1.5 bg-kosha-border rounded-pill overflow-hidden mb-1">
                          <motion.div
                            className={`h-full rounded-pill ${loan.direction === 'given' ? 'bg-income-text' : 'bg-expense-text'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-ink-3">
                            {fmt(+loan.amount_settled)} / {fmt(+loan.amount)}
                          </span>
                          <span className={`text-[10px] font-semibold ${pct >= 100 ? 'text-income-text' : 'text-ink-3'}`}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Meta chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-kosha-surface-2 text-ink-3 border border-kosha-border">
                        {loan.direction === 'given' ? 'Given' : 'Taken'} {fmtDate(loan.loan_date)}
                      </span>
                      {loan.due_date && !loan.settled && days !== null && (
                        <span className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill ${dueChipClass(days)}`}>
                          {dueLabel(days)}
                        </span>
                      )}
                      {loan.settled && (
                        <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-income-bg text-income-text border border-income-border">
                          Settled
                        </span>
                      )}
                      {loan.interest_rate > 0 && (
                        <span className="text-[10px] sm:text-[11px] text-ink-3">{loan.interest_rate}%/yr</span>
                      )}
                      {loan.interest_rate === 0 && !loan.settled && (
                        <span className="text-[10px] sm:text-[11px] text-ink-3">0% interest</span>
                      )}
                      {isOptimistic && (
                        <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-warning-bg text-warning-text">
                          Syncing…
                        </span>
                      )}
                    </div>

                    {/* Note */}
                    {loan.note && (
                      <p className="text-[11px] text-ink-3 mt-1.5 truncate">{loan.note}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {!loan.settled && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => openEditLoan(loan)}
                        disabled={!!deletingId || isOptimistic}
                        className="h-8 w-8 flex items-center justify-center rounded-card
                                   bg-kosha-surface-2 text-ink-3 text-[11px] font-semibold
                                   border border-kosha-border active:scale-[0.97] transition-all duration-100
                                   disabled:opacity-60"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => { setPayLoan(loan); setPayAmount(''); setPayErr('') }}
                        disabled={!!deletingId || isOptimistic}
                        className="h-8 flex items-center gap-1.5 px-2.5 rounded-card
                                   bg-income-bg text-income-text text-[11px] font-semibold
                                   border border-income-border active:scale-[0.97] transition-all duration-100
                                   disabled:opacity-60"
                      >
                        <HandCoins size={13} /> Payment
                      </button>
                      <button
                        onClick={() => handleDelete(loan.id)}
                        disabled={!!deletingId || isOptimistic}
                        className="h-8 w-8 flex items-center justify-center rounded-card
                                   bg-expense-bg text-expense-text text-[11px] font-semibold
                                   border border-expense-border active:scale-[0.97] transition-all duration-100
                                   disabled:opacity-60"
                      >
                        {deletingId === loan.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                      </button>
                    </div>
                  )}

                  {loan.settled && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleDelete(loan.id)}
                        disabled={!!deletingId || isOptimistic}
                        className="h-8 w-8 flex items-center justify-center rounded-card
                                   bg-expense-bg text-expense-text text-[11px] font-semibold
                                   border border-expense-border active:scale-[0.97] transition-all duration-100
                                   disabled:opacity-60"
                      >
                        {deletingId === loan.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Record Payment Sheet ──────────────────────────────────────── */}
      <AnimatePresence>
        {payLoan && (
          <>
            <motion.div className="sheet-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={() => { setPayLoan(null); setPayAmount(''); setPayErr('') }}
            />
            <motion.div className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
              exit={{ y: '100%', transition: { duration: 0.22 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5 overflow-x-hidden">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-display font-bold text-ink">Record Payment</h2>
                  <button onClick={() => { setPayLoan(null); setPayAmount(''); setPayErr('') }} className="close-btn">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                {/* Loan context */}
                <div className="card p-3 mb-4 border border-kosha-border bg-kosha-surface-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center
                      ${payLoan.direction === 'given' ? 'bg-income-bg' : 'bg-expense-bg'}`}>
                      {payLoan.direction === 'given'
                        ? <ArrowUpRight size={12} className="text-income-text" />
                        : <ArrowDownLeft size={12} className="text-expense-text" />}
                    </div>
                    <p className="text-[13px] font-semibold text-ink">{payLoan.counterparty}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-ink-3">
                    <span>Total: {fmt(+payLoan.amount)}</span>
                    <span>Paid: {fmt(+payLoan.amount_settled)}</span>
                    <span className="font-semibold text-ink">Remaining: {fmt(+payLoan.amount - +payLoan.amount_settled)}</span>
                  </div>
                </div>

                {/* Amount input */}
                <div className="bg-kosha-surface-2 rounded-card px-4 py-3.5 mb-3 overflow-hidden
                                flex items-center gap-2 border border-transparent
                                focus-within:border-income-border
                                focus-within:ring-2 focus-within:ring-income/25
                                transition-all duration-100">
                  <span className="text-xl font-bold text-income-text">₹</span>
                  <input className="flex-1 bg-transparent text-2xl font-bold text-ink outline-none min-w-0"
                    type="number" inputMode="decimal" name="payment-amount" placeholder="0"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Quick fill buttons */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {(() => {
                    const remaining = +payLoan.amount - +payLoan.amount_settled
                    const options = [
                      { label: 'Full', value: remaining },
                      remaining >= 2 ? { label: 'Half', value: Math.round(remaining / 2) } : null,
                    ].filter(Boolean)
                    return options.map(o => (
                      <button key={o.label}
                        onClick={() => setPayAmount(String(o.value))}
                        className="px-3 py-1.5 rounded-pill text-xs font-semibold border
                                   bg-kosha-surface text-ink-2 border-kosha-border
                                   active:scale-[0.97] transition-all"
                      >
                        {o.label} ({fmt(o.value)})
                      </button>
                    ))
                  })()}
                </div>

                {payErr && <p className="text-expense-text text-sm mb-3">{payErr}</p>}

                <div className="sticky bottom-0 pt-2 pb-2 bg-gradient-to-t from-kosha-surface via-kosha-surface to-transparent">
                  <button onClick={handleRecordPayment}
                    disabled={paySaving}
                    className={`w-full py-4 rounded-card font-semibold transition-all
                               ${paySaving ? 'bg-income/70 text-white/90 scale-[0.97]' : 'bg-income text-white active:scale-[0.97]'}`}>
                    {paySaving ? 'Recording…' : 'Record Payment'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Add Loan Sheet ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div className="sheet-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={() => { setShowAdd(false); setEditLoan(null); resetForm() }}
            />
            <motion.div className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
              exit={{ y: '100%', transition: { duration: 0.22 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5 overflow-x-hidden">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-display font-bold text-ink">{editLoan ? 'Edit Loan' : 'Add Loan'}</h2>
                  <button onClick={() => { setShowAdd(false); setEditLoan(null); resetForm() }} className="close-btn">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                {/* Direction toggle */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={() => setForm(f => ({ ...f, direction: 'given' }))}
                    className={`h-11 flex items-center justify-center gap-2 rounded-card text-[13px] font-semibold border transition-all active:scale-[0.97]
                      ${form.direction === 'given'
                        ? 'bg-income-bg text-income-text border-income-border'
                        : 'bg-kosha-surface text-ink-3 border-kosha-border'}`}
                  >
                    <ArrowUpRight size={16} /> I Gave
                  </button>
                  <button
                    onClick={() => setForm(f => ({ ...f, direction: 'taken' }))}
                    className={`h-11 flex items-center justify-center gap-2 rounded-card text-[13px] font-semibold border transition-all active:scale-[0.97]
                      ${form.direction === 'taken'
                        ? 'bg-expense-bg text-expense-text border-expense-border'
                        : 'bg-kosha-surface text-ink-3 border-kosha-border'}`}
                  >
                    <ArrowDownLeft size={16} /> I Took
                  </button>
                </div>

                {/* Counterparty */}
                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 flex items-center justify-center shrink-0 border border-kosha-border">
                      <Users size={14} className="text-ink-3" />
                    </div>
                    <input className="flex-1 bg-transparent text-[15px] text-ink outline-none min-w-0"
                      name="loan-counterparty"
                      placeholder={form.direction === 'given' ? 'Who did you lend to?' : 'Who did you borrow from?'}
                      value={form.counterparty}
                      onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))}
                    />
                  </label>
                </div>

                {/* Amount */}
                <div className="bg-kosha-surface-2 rounded-card px-4 py-3.5 mb-3 overflow-hidden
                                flex items-center gap-2 border border-transparent
                                focus-within:border-accent-border
                                focus-within:ring-2 focus-within:ring-accent/25
                                transition-all duration-100">
                  <span className="text-xl font-bold text-accent">₹</span>
                  <input className="flex-1 bg-transparent text-2xl font-bold text-ink outline-none min-w-0"
                    type="number" inputMode="decimal" name="loan-amount" placeholder="0"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>

                {/* Interest rate */}
                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <div className="w-8 h-8 rounded-chip bg-warning-bg flex items-center justify-center shrink-0">
                      <Percent size={14} className="text-warning-text" />
                    </div>
                    <span className="text-[15px] text-ink-3 shrink-0">Interest</span>
                    <input className="flex-1 bg-transparent text-[15px] text-ink outline-none text-right min-w-0"
                      type="number" inputMode="decimal" name="loan-interest-rate" placeholder="0"
                      value={form.interest_rate}
                      onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))}
                    />
                    <span className="text-[13px] text-ink-3 shrink-0">% /yr</span>
                  </label>
                </div>

                {/* Loan date */}
                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 flex items-center justify-center shrink-0 border border-kosha-border">
                      <Calendar size={14} className="text-ink-3" />
                    </div>
                    <span className="flex-1 text-[15px] text-ink">Loan Date</span>
                    <input type="date" name="loan-date"
                      value={form.loan_date}
                      onChange={e => setForm(f => ({ ...f, loan_date: e.target.value }))}
                      className="text-[15px] text-ink-3 bg-transparent outline-none text-right focus:text-accent"
                    />
                  </label>
                </div>

                {/* Due date */}
                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <div className="w-8 h-8 rounded-chip bg-warning-bg flex items-center justify-center shrink-0">
                      <span className="text-warning-text text-xs font-bold">📅</span>
                    </div>
                    <span className="flex-1 text-[15px] text-ink">Expected Repayment</span>
                    <input type="date" name="loan-due-date"
                      value={form.due_date}
                      onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                      className="text-[15px] text-ink-3 bg-transparent outline-none text-right focus:text-warning-text"
                    />
                  </label>
                </div>

                {/* Note */}
                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 flex items-center justify-center shrink-0 border border-kosha-border">
                      <FileText size={14} className="text-ink-3" />
                    </div>
                    <input className="flex-1 bg-transparent text-[15px] text-ink outline-none min-w-0"
                      name="loan-note"
                      placeholder="Note (optional)"
                      value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    />
                  </label>
                </div>

                {formErr && <p className="text-expense-text text-sm mb-3">{formErr}</p>}

                <div className="sticky bottom-0 pt-2 pb-2 bg-gradient-to-t from-kosha-surface via-kosha-surface to-transparent">
                  <button onClick={handleAdd}
                    disabled={addSaving}
                    className={`w-full py-4 rounded-card font-semibold transition-all
                               ${addSaving
                                  ? 'bg-brand/70 text-white/90 scale-[0.97]'
                                  : 'bg-brand text-white active:scale-[0.97]'}`}>
                    {addSaving ? (editLoan ? 'Saving…' : 'Adding…') : (editLoan ? 'Save Changes' : 'Add Loan')}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FAB */}
      <button className="fab-loans" onClick={() => setShowAdd(true)}>
        <Plus size={24} className="text-white" />
      </button>

      <AppToast message={errToast} onDismiss={() => setErrToast(null)} />
    </div>
  )
}
