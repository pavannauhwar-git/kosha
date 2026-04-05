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
          transition={{ duration: 0.25, ease: 'easeOut' }}
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

      <motion.input
        variants={fadeUp}
        className="input mb-3"
        placeholder="Your first name"
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
        onKeyDown={e => e.key === 'Enter' && name.trim() && onNext(name.trim())}
      />

      <motion.button
        variants={fadeUp}
        onClick={() => onNext(name.trim())}
        disabled={!name.trim()}
        className="w-full py-4 rounded-card bg-brand text-white
                   text-body font-semibold
                   active:scale-[0.97] transition-all duration-75
                   disabled:opacity-40"
      >
        Continue
      </motion.button>
    </motion.div>
  )
}

// ── Step 2 — Monthly income ───────────────────────────────────────────────
function StepIncome({ name, onNext, onBack }) {
  const [income, setIncome] = useState('')

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

      <motion.input
        variants={fadeUp}
        className="input mb-3"
        type="number"
        inputMode="numeric"
        placeholder="0"
        value={income}
        onChange={e => setIncome(e.target.value)}
        autoFocus
      />

      <motion.button
        variants={fadeUp}
        onClick={() => onNext(parseFloat(income) || 0)}
        className="w-full py-4 rounded-card bg-brand text-white
                   text-body font-semibold mb-3
                   active:scale-[0.97] transition-all duration-75"
      >
        {income ? 'Continue' : 'Skip for now'}
      </motion.button>

      <motion.button
        variants={fadeUp}
        onClick={onBack}
        className="w-full py-3 text-label font-medium text-ink-3"
      >
        Back
      </motion.button>
    </motion.div>
  )
}

// ── Step 3 — First transaction ────────────────────────────────────────────
function StepFirstTransaction({ onFinish, onSkip }) {
  const [amount,   setAmount]   = useState('')
  const [desc,     setDesc]     = useState('')
  const [category, setCategory] = useState('food')
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
          type:         'expense',
          description:  desc.trim(),
          amount:       parseFloat(amount),
          category,
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
        Add your first expense
      </motion.h2>
      <motion.p variants={fadeUp} className="text-label text-ink-3 mb-8">
        Start with something recent — a coffee, groceries, anything.
      </motion.p>

      <motion.input
        variants={fadeUp}
        className="input mb-3"
        type="number"
        inputMode="decimal"
        placeholder="0"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        autoFocus
      />

      <motion.input
        variants={fadeUp}
        className="input mb-3"
        placeholder="What was it for?"
        value={desc}
        onChange={e => setDesc(e.target.value)}
      />

      <motion.div variants={fadeUp} className="grid grid-cols-4 gap-2 mb-5 max-h-64 overflow-y-auto">
        {EXPENSE_CATS.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-card border transition-all
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

      {error && (
        <p className="text-caption text-expense-text mb-3">{error}</p>
      )}

      <motion.button
        variants={fadeUp}
        onClick={handleSave}
        disabled={!amount || !desc.trim() || saving}
        className="w-full py-4 rounded-card bg-brand text-white
                   text-body font-semibold mb-3
                   active:scale-[0.97] transition-all duration-75
                   disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Add & go to dashboard'}
      </motion.button>

      <motion.button
        variants={fadeUp}
        onClick={onSkip}
        className="w-full py-3 text-label font-medium text-ink-3"
      >
        Skip — go to dashboard
      </motion.button>
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

  async function consumeInvite() {
    const inviteToken = getInviteToken(location.search)
    if (!inviteToken || !user?.id) return
    try {
      await consumeInviteToken({
        supabaseClient: supabase,
        inviteToken,
        userId: user.id,
      })
    } catch (_) {}
    finally {
      sessionStorage.removeItem('pendingInviteToken')
    }
  }

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
      await consumeInvite()
      await updateProfile({ onboarded: true })
      navigate('/', { replace: true })
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
