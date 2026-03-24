import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Sparkles, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import PageHeader from '../components/PageHeader'
import { createFadeUp, createStagger } from '../lib/animations'

const fadeUp = createFadeUp(4, 0.18)
const stagger = createStagger(0.05, 0.04)

const START_HERE = [
  'Connect your account and add your first three transactions.',
  'Add upcoming bills so due-soon alerts become useful.',
  'Turn on recurring for fixed monthly items you never want to miss.',
  'Review dashboard pace once a day for spending control.',
]

const FEATURE_MAP = [
  { title: 'Dashboard', text: 'Cashflow pulse, bill alerts, and quick actions for daily control.' },
  { title: 'Transactions', text: 'Search, filter, duplicate, recurring labels, and CSV export.' },
  { title: 'Bills', text: 'Track pending/paid dues, recurrence, and payment flow in one place.' },
  { title: 'Analytics', text: 'Monthly and yearly trends by category, vehicle, and behavior.' },
  { title: 'Export + Portability', text: 'Take your data out anytime with spreadsheet-compatible CSV files.' },
  { title: 'Trust timeline', text: 'Recent activity feed helps verify key money actions fast.' },
]

const PLAYBOOKS = [
  {
    title: 'Monthly routine in 10 minutes',
    items: [
      'Log salary and fixed obligations first.',
      'Set recurring on stable expenses and EMIs.',
      'Review pace card every 3 to 4 days.',
    ],
  },
  {
    title: 'Bill discipline setup',
    items: [
      'Add every due date once and mark as paid from Bills.',
      'Keep recurrence accurate for autop-run continuity.',
      'Use due-soon total to avoid end-of-month surprises.',
    ],
  },
  {
    title: 'Cleaner analytics in one week',
    items: [
      'Use consistent categories for repeated spending.',
      'Split large mixed purchases into meaningful entries.',
      'Keep notes for unusual spends to improve future reviews.',
    ],
  },
]

export default function Guide() {
  const navigate = useNavigate()
  const todayTip = useMemo(() => {
    const tips = [
      'If a card feels noisy, use Transactions for precision and Dashboard for direction.',
      'Recurring works best when your source transactions are clean and consistently categorized.',
      'Use exports monthly as a lightweight backup ritual.',
    ]
    const idx = new Date().getDate() % tips.length
    return tips[idx]
  }, [])

  return (
    <div className="page">
      <PageHeader title="Guide" />

      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
        <motion.div variants={fadeUp} className="card p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-container flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-brand" />
            </div>
            <div>
              <p className="text-body font-semibold text-ink">Getting started in 3 minutes</p>
              <p className="text-label text-ink-3 mt-1">
                This page helps new users understand what Kosha does, where to start, and how to get value fast.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.section variants={fadeUp}>
          <p className="section-label mb-2">Start here</p>
          <div className="list-card">
            {START_HERE.map((step, i) => (
              <div key={step} className={`px-4 py-3.5 ${i === START_HERE.length - 1 ? '' : 'border-b border-kosha-border'}`}>
                <p className="text-body text-ink"><span className="font-semibold text-brand">{i + 1}.</span> {step}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={fadeUp}>
          <p className="section-label mb-2">Core features</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FEATURE_MAP.map((f) => (
              <div key={f.title} className="card p-4">
                <p className="text-body font-semibold text-ink">{f.title}</p>
                <p className="text-label text-ink-3 mt-1">{f.text}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={fadeUp}>
          <p className="section-label mb-2">How-to playbooks</p>
          <div className="space-y-3">
            {PLAYBOOKS.map((playbook) => (
              <div key={playbook.title} className="card p-4">
                <p className="text-body font-semibold text-ink mb-2">{playbook.title}</p>
                <div className="space-y-1.5">
                  {playbook.items.map((item) => (
                    <p key={item} className="text-label text-ink-3">• {item}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={fadeUp}>
          <p className="section-label mb-2">FAQ and privacy</p>
          <div className="card p-4 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheck size={16} className="text-brand mt-0.5" />
              <p className="text-label text-ink-2">Data stays in your Supabase project under row-level security policies.</p>
            </div>
            <p className="text-label text-ink-3">Realtime sync may be disabled automatically on unstable networks; the app still works with server refresh.</p>
            <p className="text-label text-ink-3">Use monthly CSV exports as an easy backup habit.</p>
          </div>
        </motion.section>

        <motion.div variants={fadeUp} className="card p-4 bg-brand-container border border-brand-border">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={15} className="text-brand" />
            <p className="text-body font-semibold text-brand-on">Today tip</p>
          </div>
          <p className="text-label text-brand-on/90">{todayTip}</p>
        </motion.div>

        <motion.div variants={fadeUp} className="flex gap-2">
          <button
            onClick={() => navigate('/')}
            className="btn-tonal flex-1 py-3"
          >
            <ArrowLeft size={15} /> Back to dashboard
          </button>
          <button
            onClick={() => navigate('/transactions')}
            className="btn-primary flex-1 py-3"
          >
            Open transactions <ArrowRight size={15} />
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}
