import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { C } from '../lib/colors'
import { saveTransactionMutation } from '../hooks/useTransactions'
import { supabase } from '../lib/supabase'
import { consumeInviteToken, getInviteToken } from '../lib/invites'
import { EXPENSE_CATEGORIES } from '../lib/categories'
import CategoryIcon from '../components/categories/CategoryIcon'
import KoshaLogo from '../components/brand/KoshaLogo'
import { createFadeUp, createStagger } from '../lib/animations'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const fadeUp = createFadeUp(8, 0.2)
const stepStagger = createStagger(0.07, 0)

const EXPENSE_CATS = EXPENSE_CATEGORIES

// ── Step indicator — green pills ──────────────────────────────────────────
function StepDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8 mt-6">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width:      i === current ? 20 : 6,
            background: i === current ? C.brand : C.brandBorder,
          }}
          transition={{ duration: 0.25, ease: [0.05, 0.7, 0.1, 1] }}
          className="h-1.5 rounded-pill"
        />
      ))}
    </div>
  )
}

// ── Step 1 — Name ─────────────────────────────────────────────────────────
function StepName({ onNext }) {
  const { user } = useAuth()
  const [name, setName] = useState(
    user?.user_metadata?.full_name?.split(' ')[0] || ''
  )

  return (
    <motion.div
      key="step-name"
      variants={stepStagger}
      initial="hidden" animate="show"
      className="flex flex-col"
    >
      <motion.p variants={fadeUp} className="text-caption text-ink-3 font-medium mb-2">
        Step 1 of 3
      </motion.p>
      <motion.h2 variants={fadeUp} className="text-display font-bold text-ink tracking-tight mb-2">
        What should we call you?
      </motion.h2>
      <motion.p variants={fadeUp} className="text-label text-ink-3 mb-8">
        This appears on your dashboard greeting.
      </motion.p>

      <motion.div variants={fadeUp} className="mb-3">
        <Input
          placeholder="Your first name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && name.trim() && onNext(name.trim())}
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={() => onNext(name.trim())}
          disabled={!name.trim()}
        >
          Continue
        </Button>
      </motion.div>
    </motion.div>
  )
}

// ── Step 2 — Monthly income ───────────────────────────────────────────────
function StepIncome({ name, onNext, onBack }) {
  const [income, setIncome] = useState('')
  const [confirmSkipIncome, setConfirmSkipIncome] = useState(false)

  function handleContinue() {
    const parsed = Number.parseFloat(income)
    const normalized = Number.isFinite(parsed) && parsed > 0 ? parsed : 0

    if (normalized === 0 && !confirmSkipIncome) {
      setConfirmSkipIncome(true)
      return
    }

    onNext(normalized)
  }

  return (
    <motion.div
      key="step-income"
      variants={stepStagger}
      initial="hidden" animate="show"
      className="flex flex-col"
    >
      <motion.p variants={fadeUp} className="text-caption text-ink-3 font-medium mb-2">
        Step 2 of 3
      </motion.p>
      <motion.h2 variants={fadeUp} className="text-display font-bold text-ink tracking-tight mb-2">
        Hey {name}, what's your monthly income?
      </motion.h2>
      <motion.p variants={fadeUp} className="text-label text-ink-3 mb-8">
        Used to calculate your savings rate. You can change this anytime.
      </motion.p>

      <motion.div variants={fadeUp} className="mb-3">
        <Input
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={income}
          onChange={e => setIncome(e.target.value)}
          autoFocus
        />
      </motion.div>

      <motion.div variants={fadeUp} className="mb-3">
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleContinue}
        >
          {income ? 'Continue' : 'Skip for now'}
        </Button>
      </motion.div>

      {confirmSkipIncome && (
        <motion.div variants={fadeUp} className="rounded-card border border-warning-border bg-warning-bg p-3 mb-3">
          <p className="text-[12px] font-semibold text-warning-text">No monthly income entered</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Savings rate will be less accurate until you set income in Settings.</p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => onNext(0)}
              className="chip-control chip-control-sm bg-warning-bg text-warning-text border-warning-border"
            >
              Continue anyway
            </button>
            <button
              type="button"
              onClick={() => setConfirmSkipIncome(false)}
              className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border"
            >
              Add income
            </button>
          </div>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <Button
          variant="ghost"
          size="md"
          fullWidth
          onClick={onBack}
        >
          Back
        </Button>
      </motion.div>
    </motion.div>
  )
}

// ── Step 3 — First transaction ────────────────────────────────────────────
function StepFirstTransaction({ onFinish, onSkip }) {
  const [amount,   setAmount]   = useState('')
  const [desc,     setDesc]     = useState('')
  const [category, setCategory] = useState('food')
  const [txnType,  setTxnType]  = useState('expense')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState(null)

  async function handleSave() {
    if (!amount || !desc.trim()) return
    setSaving(true)
    setError(null)
    try {
      await saveTransactionMutation({
        payload: {
          date:         new Date().toISOString().slice(0, 10),
          type:         txnType,
          description:  desc.trim(),
          amount:       parseFloat(amount),
          category:     txnType === 'expense' ? category : 'salary',
          is_repayment: false,
          payment_mode: 'upi',
        },
      })
      onFinish()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <motion.div
      key="step-txn"
      variants={stepStagger}
      initial="hidden" animate="show"
      className="flex flex-col"
    >
      <motion.p variants={fadeUp} className="text-caption text-ink-3 font-medium mb-2">
        Step 3 of 3
      </motion.p>
      <motion.h2 variants={fadeUp} className="text-display font-bold text-ink tracking-tight mb-2">
        Add your first transaction
      </motion.h2>
      <motion.p variants={fadeUp} className="text-label text-ink-3 mb-8">
        Start with something recent so your dashboard can calibrate correctly.
      </motion.p>

      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTxnType('expense')}
          className={`h-10 rounded-card text-[12px] font-semibold border transition-[background-color,border-color,color] duration-150 will-change-transform active:scale-[0.98] ${
            txnType === 'expense'
              ? 'bg-expense-bg text-expense-text border-expense-border'
              : 'bg-kosha-surface text-ink-3 border-kosha-border'
          }`}
        >
          I spent
        </button>
        <button
          type="button"
          onClick={() => setTxnType('income')}
          className={`h-10 rounded-card text-[12px] font-semibold border transition-[background-color,border-color,color] duration-150 will-change-transform active:scale-[0.98] ${
            txnType === 'income'
              ? 'bg-income-bg text-income-text border-income-border'
              : 'bg-kosha-surface text-ink-3 border-kosha-border'
          }`}
        >
          I received
        </button>
      </motion.div>

      <motion.div variants={fadeUp} className="mb-3">
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          autoFocus
        />
      </motion.div>

      <motion.div variants={fadeUp} className="mb-3">
        <Input
          placeholder={txnType === 'expense' ? 'What was it for?' : 'Where did it come from?'}
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />
      </motion.div>

      {txnType === 'expense' && (
        <motion.div variants={fadeUp} className="grid grid-cols-4 gap-2 mb-5 max-h-64 overflow-y-auto">
          {EXPENSE_CATS.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-card border transition-[background-color,border-color] duration-150 will-change-transform
                ${category === cat.id
                  ? 'border-brand bg-brand-container'
                  : 'border-kosha-border bg-kosha-surface'}`}
            >
              <CategoryIcon categoryId={cat.id} size={16} />
              <span className="text-[10px] font-medium text-ink-3 text-center leading-tight truncate w-full">
                {cat.label.split(' ')[0]}
              </span>
            </button>
          ))}
        </motion.div>
      )}

      {error && (
        <p className="text-caption text-expense-text mb-3" role="alert" aria-live="polite">{error}</p>
      )}

      <motion.div variants={fadeUp} className="mb-3">
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleSave}
          disabled={!amount || !desc.trim()}
          loading={saving}
        >
          {saving ? 'Saving…' : 'Add & go to dashboard'}
        </Button>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Button
          variant="ghost"
          size="md"
          fullWidth
          onClick={onSkip}
        >
          Skip — go to dashboard
        </Button>
      </motion.div>
    </motion.div>
  )
}

// ── Main Onboarding page ──────────────────────────────────────────────────
export default function Onboarding() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, updateProfile } = useAuth()

  const [step,   setStep]   = useState(0)
  const [name,   setName]   = useState('')
  const [saving, setSaving] = useState(false)


  async function handleNameNext(displayName) {
    setName(displayName)
    setStep(1)
  }

  async function handleIncomeNext(monthlyIncome) {
    setStep(2)
    try {
      await updateProfile({ display_name: name, monthly_income: monthlyIncome })
    } catch (_) {}
  }

  async function finish() {
    setSaving(true)
    try {
      await updateProfile({ onboarded: true })

      const hasPendingSplitInvite = (() => {
        try {
          return !!sessionStorage.getItem('pendingSplitGroupInviteToken')
        } catch {
          return false
        }
      })()

      navigate(hasPendingSplitInvite ? '/splitwise' : '/', { replace: true })
    } catch (e) {
      console.error('[Kosha] Onboarding finish failed', e)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh bg-kosha-bg flex flex-col px-5 pt-12 pb-10">
      <div className="w-full max-w-sm mx-auto flex flex-col flex-1">

        {/* Logo mark — replaces the old KOSHA text badge */}
        <KoshaLogo size={44} />

        <StepDots current={step} total={3} />

        <AnimatePresence mode="wait">
          {step === 0 && (
            <StepName key="name" onNext={handleNameNext} />
          )}
          {step === 1 && (
            <StepIncome
              key="income"
              name={name}
              onNext={handleIncomeNext}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <StepFirstTransaction
              key="txn"
              onFinish={finish}
              onSkip={finish}
            />
          )}
        </AnimatePresence>

      </div>

    </div>
  )
}
