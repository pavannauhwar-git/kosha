import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { addTransaction } from '../hooks/useTransactions'
import { CATEGORIES } from '../lib/categories'
import CategoryIcon from '../components/CategoryIcon'

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

const EXPENSE_CATS = CATEGORIES.filter(c =>
  ['food', 'groceries', 'transport', 'utilities', 'entertainment', 'health', 'shopping'].includes(c.id)
)

// ── Step indicator ────────────────────────────────────────────────────────
function StepDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === current ? 20 : 6,
            background: i === current ? '#6C47FF' : '#C5C0D8',
          }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="h-1.5 rounded-pill"
        />
      ))}
    </div>
  )
}

// ── Step 1 — What's your name? ────────────────────────────────────────────
function StepName({ onNext }) {
  const { user } = useAuth()
  const [name, setName] = useState(
    user?.user_metadata?.full_name?.split(' ')[0] || ''
  )

  return (
    <motion.div
      key="step-name"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
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
                   active:scale-[0.98] transition-all duration-75
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
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
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

      {/* Amount input */}
      <motion.div variants={fadeUp} className="card px-4 py-4 flex items-center gap-2 mb-3">
        <span className="text-display font-medium text-ink-3">₹</span>
        <input
          className="flex-1 bg-transparent text-display text-ink outline-none placeholder-ink-4 tabular-nums"
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={income}
          onChange={e => setIncome(e.target.value)}
          autoFocus
        />
      </motion.div>

      <motion.button
        variants={fadeUp}
        onClick={() => onNext(parseFloat(income) || 0)}
        className="w-full py-4 rounded-card bg-brand text-white
                   text-body font-semibold mb-3
                   active:scale-[0.98] transition-all duration-75"
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
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('food')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    if (!amount || !desc.trim()) return
    setSaving(true)
    setError(null)
    try {
      await addTransaction({
        date: new Date().toISOString().slice(0, 10),
        type: 'expense',
        description: desc.trim(),
        amount: parseFloat(amount),
        category,
        is_repayment: false,
        payment_mode: 'upi',
        user_id: user.id,
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
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      initial="hidden" animate="show"
      className="flex flex-col"
    >
      <motion.p variants={fadeUp} className="text-caption text-ink-3 font-medium mb-2">
        Step 3 of 3
      </motion.p>
      <motion.h2 variants={fadeUp} className="text-display font-bold text-ink tracking-tight mb-2">
        Add your first expense
      </motion.h2>
      <motion.p variants={fadeUp} className="text-label text-ink-3 mb-6">
        Start with something recent — a coffee, groceries, anything.
      </motion.p>

      {/* Amount */}
      <motion.div variants={fadeUp} className="card px-4 py-4 flex items-center gap-2 mb-3">
        <span className="text-display font-medium text-ink-3">₹</span>
        <input
          className="flex-1 bg-transparent text-display text-ink outline-none placeholder-ink-4 tabular-nums"
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          autoFocus
        />
      </motion.div>

      {/* Description */}
      <motion.div variants={fadeUp} className="card px-4 py-3.5 mb-3">
        <input
          className="w-full bg-transparent text-body text-ink placeholder-ink-4 outline-none"
          placeholder="What was it for?"
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />
      </motion.div>

      {/* Category picker */}
      <motion.div variants={fadeUp} className="mb-6">
        <p className="text-caption text-ink-3 font-medium mb-2 px-1">Category</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {EXPENSE_CATS.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-pill shrink-0
                         text-label font-semibold border transition-all duration-100"
              style={category === cat.id
                ? { background: cat.color, borderColor: cat.color, color: '#fff' }
                : { background: 'transparent', borderColor: '#E8E6F0', color: '#3D3654' }
              }
            >
              <CategoryIcon categoryId={cat.id} size={13} />
              {cat.label}
            </button>
          ))}
        </div>
      </motion.div>

      {error && (
        <p className="text-caption text-expense-text mb-3 px-1">{error}</p>
      )}

      <motion.button
        variants={fadeUp}
        onClick={handleSave}
        disabled={saving || !amount || !desc.trim()}
        className="w-full py-4 rounded-card bg-brand text-white
                   text-body font-semibold mb-3
                   active:scale-[0.98] transition-all duration-75
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
  const { token } = useParams()
  const { user, updateProfile } = useAuth()

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  // If user arrived via /join/:token, mark the invite as used
  async function consumeInvite() {
    if (!token) return
    try {
      const { supabase } = await import('../lib/supabase')
      // Find the invite and stamp used_by
      const { data: invite } = await supabase
        .from('invites')
        .select('id')
        .eq('token', token)
        .is('used_by', null)
        .single()
      if (invite) {
        await supabase.from('invites').update({
          used_by: user.id,
          used_at: new Date().toISOString(),
        }).eq('id', invite.id)
      }
    } catch (_) {
      // Non-fatal — invite may already be used or invalid
    }
  }

  async function handleNameNext(displayName) {
    setName(displayName)
    setStep(1)
  }

  async function handleIncomeNext(monthlyIncome) {
    setStep(2)
    // Save name + income now, mark onboarded after step 3
    try {
      await updateProfile({ display_name: name, monthly_income: monthlyIncome })
    } catch (_) {
      // Non-fatal — will retry on finish
    }
  }

  async function finish() {
    setSaving(true)
    try {
      await consumeInvite()
      await updateProfile({ onboarded: true })
    } catch (_) {
      // Profile update failed — still navigate, app works without it
    } finally {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-dvh bg-kosha-bg flex flex-col px-5 pt-16 pb-10">
      <div className="w-full max-w-sm mx-auto flex flex-col flex-1">

        {/* Kosha wordmark */}
        <img
          src="/icons/icon-512.png"
          alt="Kosha"
          className="w-8 h-8 rounded-xl"
        />
        <span className="text-label font-bold text-ink tracking-tight">KOSHA</span>

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