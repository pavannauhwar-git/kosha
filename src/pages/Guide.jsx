import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Sparkles,
  ShieldCheck,
  LayoutGrid,
  LineChart,
  Receipt,
  Wallet,
  Link2,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createFadeUp, createStagger } from '../lib/animations'

const fadeUp = createFadeUp(4, 0.18)
const stagger = createStagger(0.05, 0.04)

const START_HERE = [
  'Add 5-10 recent transactions so your Dashboard and Analytics have enough signal.',
  'Set all upcoming bills once, then keep the paid status up to date in Bills.',
  'Use consistent categories for repeated spends to improve trend quality.',
  'Run a quick Reconciliation pass weekly to keep summaries trustworthy.',
]

const GUIDE_VIEWED_KEY = 'kosha:guide:viewed:v2'

function getInitialViewed() {
  try {
    const raw = localStorage.getItem(GUIDE_VIEWED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((v) => String(v)))
  } catch {
    return new Set()
  }
}

function persistViewed(nextSet) {
  try {
    localStorage.setItem(GUIDE_VIEWED_KEY, JSON.stringify(Array.from(nextSet)))
  } catch {
    // Ignore storage restrictions.
  }
}

const FEATURE_CARDS = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Your daily control center',
    icon: LayoutGrid,
    route: '/',
    category: 'beginner',
    accent: 'bg-brand-container text-brand',
    summary: 'One-screen view of balance, pace, dues, and recent movement.',
    whenToUse: 'Use this every morning and evening for quick financial orientation.',
    workflow: [
      'Check the hero card for balance direction and surplus pace.',
      'Use quick actions to log income, expense, investment, or bill payment.',
      'Open recent transactions only if a number looks off.',
    ],
    doThis: [
      'Keep this for direction, then drill into Transactions for precision.',
      'Review pace at least 2-3 times per week.',
    ],
    avoidThis: [
      'Do not use Dashboard as your data-cleanup page.',
      'Avoid logging very detailed edits from here.',
    ],
  },
  {
    id: 'transactions',
    title: 'Transactions',
    subtitle: 'Source of truth for money movement',
    icon: Wallet,
    route: '/transactions',
    category: 'power',
    accent: 'bg-income-bg text-income-text',
    summary: 'Find, edit, duplicate, filter, and export your financial records.',
    whenToUse: 'Use this whenever you need exact corrections or audit-level confidence.',
    workflow: [
      'Search by merchant, note, or amount using top search.',
      'Fix category/type/payment mode for any inconsistent entries.',
      'Duplicate repeated purchases to speed up entry.',
    ],
    doThis: [
      'Standardize naming for recurring merchants.',
      'Split mixed spends into separate entries for cleaner analytics.',
    ],
    avoidThis: [
      'Avoid vague descriptions like misc or shopping.',
      'Do not leave old uncategorized entries unresolved.',
    ],
  },
  {
    id: 'bills',
    title: 'Bills',
    subtitle: 'Never miss due dates',
    icon: Receipt,
    route: '/bills',
    category: 'weekly',
    accent: 'bg-warning-bg text-warning-text',
    summary: 'Track upcoming bills, mark paid, and run recurrence confidently.',
    whenToUse: 'Use this at least once weekly and before month end.',
    workflow: [
      'Add each bill with due date and amount.',
      'Set recurrence for subscriptions, rent, EMIs, and premiums.',
      'Mark paid immediately after payment to keep due signals accurate.',
    ],
    doThis: [
      'Keep bill names precise and stable month to month.',
      'Review overdue and due-soon sections first.',
    ],
    avoidThis: [
      'Do not let paid bills remain pending.',
      'Avoid duplicate entries for the same bill cycle.',
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    subtitle: 'Behavior and trend intelligence',
    icon: LineChart,
    route: '/analytics',
    category: 'monthly',
    accent: 'bg-invest-bg text-invest-text',
    summary: 'Understand where money goes and how habits are changing.',
    whenToUse: 'Use this weekly for trend checks and monthly for decision-making.',
    workflow: [
      'Review annual summary and monthly net first.',
      'Check category and vehicle distributions for concentration risk.',
      'Read weekly digest to spot momentum shifts early.',
    ],
    doThis: [
      'Compare current month vs previous week trends.',
      'Use insights to adjust next week spending targets.',
    ],
    avoidThis: [
      'Do not overreact to one-day outliers.',
      'Avoid decision-making on uncategorized data.',
    ],
  },
  {
    id: 'reconciliation',
    title: 'Reconciliation',
    subtitle: 'Quality assurance for your records',
    icon: Link2,
    route: '/reconciliation',
    category: 'weekly',
    accent: 'bg-brand-bg text-brand',
    summary: 'Catch missing fields, duplicates, and bad statement matches quickly.',
    whenToUse: 'Use this weekly and before closing each month.',
    workflow: [
      'Start with In queue and clear missing category/details first.',
      'Use statement matching for high-confidence linking.',
      'Report mismatches to improve future suggestion quality.',
    ],
    doThis: [
      'Clear queue to keep dashboard metrics trustworthy.',
      'Use linked/reviewed filters to monitor progress.',
    ],
    avoidThis: [
      'Do not skip unresolved warnings before month-close.',
      'Avoid marking low-confidence links blindly.',
    ],
  },
]

const GUIDE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'power', label: 'Power User' },
]

export default function Guide() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('all')
  const [viewed, setViewed] = useState(() => getInitialViewed())
  const [selectedId, setSelectedId] = useState(null)
  const filteredCards = useMemo(() => {
    if (activeTab === 'all') return FEATURE_CARDS
    return FEATURE_CARDS.filter((item) => item.category === activeTab)
  }, [activeTab])
  const selectedFeature = useMemo(
    () => FEATURE_CARDS.find((item) => item.id === selectedId) || null,
    [selectedId]
  )
  const navigationPool = useMemo(() => {
    if (!selectedFeature) return filteredCards
    const inFiltered = filteredCards.some((item) => item.id === selectedFeature.id)
    return inFiltered ? filteredCards : FEATURE_CARDS
  }, [filteredCards, selectedFeature])
  const selectedIndex = useMemo(
    () => navigationPool.findIndex((item) => item.id === selectedId),
    [navigationPool, selectedId]
  )
  const viewedCount = viewed.size
  const progressPct = useMemo(
    () => Math.round((viewedCount / FEATURE_CARDS.length) * 100),
    [viewedCount]
  )
  const nextFeature = useMemo(
    () => FEATURE_CARDS.find((item) => !viewed.has(item.id)) || FEATURE_CARDS[0],
    [viewed]
  )

  function openFeature(featureId) {
    setSelectedId(featureId)
    setViewed((prev) => {
      if (prev.has(featureId)) return prev
      const next = new Set(prev)
      next.add(featureId)
      persistViewed(next)
      return next
    })
  }

  function moveFeature(direction) {
    if (!navigationPool.length || selectedIndex < 0) return
    const nextIndex = selectedIndex + direction
    if (nextIndex < 0 || nextIndex >= navigationPool.length) return
    const nextId = navigationPool[nextIndex]?.id
    if (nextId) openFeature(nextId)
  }

  const todayTip = useMemo(() => {
    const tips = [
      'Direction on Dashboard, precision in Transactions. Use each page for its strength.',
      'Your analytics quality is directly tied to category consistency in raw entries.',
      'A 5-minute weekly reconciliation saves 30+ minutes at month close.',
    ]
    const idx = new Date().getDate() % tips.length
    return tips[idx]
  }, [])

  return (
    <div className="min-h-dvh bg-kosha-bg">
      <div
        className="sticky top-0 z-20 bg-kosha-bg/90 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-kosha-border"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)', paddingBottom: '0.75rem' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border flex items-center justify-center active:bg-kosha-surface-2"
        >
          <ArrowLeft size={16} className="text-ink-2" />
        </button>
        <h1 className="text-[17px] font-bold text-ink tracking-tight">Guide</h1>
      </div>

      <div className="px-4 pt-6 pb-24 max-w-[860px] mx-auto">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5 max-w-[760px] mx-auto">
        <motion.div variants={fadeUp} className="card p-4 md:p-5 relative overflow-hidden">
          <div className="absolute -right-8 -top-10 w-28 h-28 rounded-full bg-brand/10 blur-2xl" />
          <div className="absolute -left-10 -bottom-10 w-36 h-36 rounded-full bg-brand/10 blur-2xl" />

          <div className="relative z-[1]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-container flex items-center justify-center shrink-0">
                <BookOpen size={18} className="text-brand" />
              </div>
              <div>
                <p className="text-body font-semibold text-ink">Kosha Guide</p>
                <p className="text-label text-ink-3 mt-1">
                  Explore each page with practical workflows, common mistakes to avoid, and fast next actions.
                </p>
              </div>
            </div>

            <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-3 mt-3.5">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <p className="text-[12px] font-semibold text-ink-2">Guide completion</p>
                <p className="text-[11px] font-semibold text-brand">{progressPct}%</p>
              </div>
              <div className="h-2 rounded-pill bg-kosha-border overflow-hidden">
                <motion.div
                  className="h-full rounded-pill bg-brand"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[11px] text-ink-3 mt-1.5">
                {viewedCount}/{FEATURE_CARDS.length} feature cards viewed
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={() => openFeature(nextFeature.id)}
                className="btn-primary h-10 px-4 text-[12px] whitespace-nowrap"
              >
                Continue with {nextFeature.title}
              </button>
              <button
                type="button"
                onClick={() => navigate(nextFeature.route)}
                className="btn-secondary h-10 px-4 text-[12px] whitespace-nowrap"
              >
                Open {nextFeature.title}
              </button>
            </div>
          </div>
        </motion.div>

        <motion.section variants={fadeUp} className="w-full">
          <p className="section-label mb-1.5">Start here</p>
          <div className="list-card">
            {START_HERE.map((step, i) => (
              <div key={step} className={`px-4 py-3.5 ${i === START_HERE.length - 1 ? '' : 'border-b border-kosha-border'}`}>
                <p className="text-body text-ink"><span className="font-semibold text-brand">{i + 1}.</span> {step}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={fadeUp} className="w-full">
          <p className="section-label mb-1.5">Feature explorer</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-3">
            {GUIDE_TABS.map((tab) => {
              const active = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`chip-control ${active ? 'chip-control-active shadow-card' : 'chip-control-muted'}`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between gap-3 mb-3 px-1">
            <p className="text-[12px] text-ink-3">
              {activeTab === 'all' ? 'All feature cards' : `${GUIDE_TABS.find((tab) => tab.id === activeTab)?.label || 'Filtered'} cards`}
            </p>
            <p className="text-[12px] font-semibold text-ink-2">
              Viewed {viewedCount}/{FEATURE_CARDS.length}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 place-items-stretch">
            {filteredCards.map((card) => {
              const Icon = card.icon
              const isViewed = viewed.has(card.id)
              return (
                <motion.button
                  key={card.id}
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ duration: 0.1 }}
                  onClick={() => openFeature(card.id)}
                  className="card p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body font-semibold text-ink truncate">{card.title}</p>
                      <p className="text-[12px] text-ink-3 mt-0.5 truncate">{card.subtitle}</p>
                    </div>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${card.accent}`}>
                      <Icon size={16} />
                    </div>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isViewed ? 'bg-income-bg text-income-text' : 'bg-kosha-surface-2 text-ink-3'}`}>
                      {isViewed ? 'Viewed' : 'New'}
                    </span>
                  </div>
                  <p className="text-label text-ink-3 mt-2.5">{card.summary}</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
                    Open details <ArrowRight size={13} />
                  </div>
                </motion.button>
              )
            })}
          </div>
        </motion.section>

        <motion.section variants={fadeUp} className="w-full">
          <p className="section-label mb-1.5">Playbook cadence</p>
          <div className="card p-4 space-y-2.5">
            <p className="text-[13px] text-ink-2"><span className="font-semibold">Daily:</span> Dashboard pulse + quick capture</p>
            <p className="text-[13px] text-ink-2"><span className="font-semibold">Weekly:</span> Bills check + Reconciliation cleanup</p>
            <p className="text-[13px] text-ink-2"><span className="font-semibold">Monthly:</span> Analytics review + export backup</p>
          </div>
        </motion.section>

        <motion.section variants={fadeUp} className="w-full">
          <p className="section-label mb-1.5">Trust and privacy</p>
          <div className="card p-4 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheck size={16} className="text-brand mt-0.5" />
              <p className="text-label text-ink-2">Your app data stays within your Supabase project under row-level security policies.</p>
            </div>
            <p className="text-label text-ink-3">Use monthly CSV export as a simple external backup ritual.</p>
            <p className="text-label text-ink-3">If network conditions are unstable, sync may slow down, but data can still be refreshed safely.</p>
          </div>
        </motion.section>

        <motion.div variants={fadeUp} className="card p-4 bg-brand-container border border-brand-border">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={15} className="text-brand" />
            <p className="text-body font-semibold text-brand-on">Today tip</p>
          </div>
          <p className="text-label text-brand-on/90">{todayTip}</p>
        </motion.div>

        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => navigate('/')}
            className="btn-tonal flex-1 py-3 whitespace-nowrap text-[12px] sm:text-[13px]"
          >
            <ArrowLeft size={15} /> Back to dashboard
          </button>
          <button
            onClick={() => navigate('/transactions')}
            className="btn-primary flex-1 py-3 whitespace-nowrap text-[12px] sm:text-[13px]"
          >
            Open transactions <ArrowRight size={15} />
          </button>
        </motion.div>
      </motion.div>
      </div>

      <AnimatePresence>
        {selectedFeature && (
          <>
            <motion.button
              type="button"
              aria-label="Close guide detail"
              onClick={() => setSelectedId(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-ink/35"
            />

            <div className="fixed z-50 inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] px-4 flex justify-center">
              <motion.div
                key={selectedFeature.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.2 }}
                className="card p-4 md:p-5 max-h-[78vh] overflow-y-auto w-full max-w-[560px]"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-body font-semibold text-ink">{selectedFeature.title}</p>
                    <p className="text-[12px] text-ink-3 mt-0.5">{selectedFeature.subtitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="close-btn shrink-0"
                    aria-label="Close"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <p className="text-[11px] text-ink-3 shrink-0">
                    Card {selectedIndex + 1} of {navigationPool.length}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto">
                    <button
                      type="button"
                      className="h-9 px-3 rounded-pill border border-kosha-border bg-kosha-surface text-[12px] font-semibold text-ink-2 inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => moveFeature(-1)}
                      disabled={selectedIndex <= 0}
                    >
                      <ArrowLeft size={13} />
                      <span className="truncate">Prev</span>
                    </button>
                    <button
                      type="button"
                      className="h-9 px-3 rounded-pill border border-kosha-border bg-kosha-surface text-[12px] font-semibold text-ink-2 inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => moveFeature(1)}
                      disabled={selectedIndex >= navigationPool.length - 1}
                    >
                      <span className="truncate">Next</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>

                <div className="rounded-card bg-kosha-surface-2 p-3 mb-3">
                  <p className="text-[12px] text-ink-2">{selectedFeature.summary}</p>
                  <p className="text-[11px] text-ink-3 mt-1">{selectedFeature.whenToUse}</p>
                </div>

                <div className="mb-3">
                  <p className="text-[12px] font-semibold text-ink-2 mb-1.5">Recommended workflow</p>
                  <div className="space-y-1.5">
                    {selectedFeature.workflow.map((step, idx) => (
                      <p key={step} className="text-[12px] text-ink-3">
                        <span className="font-semibold text-brand">{idx + 1}.</span> {step}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4">
                  <div className="rounded-card border border-income-border bg-income-bg/30 p-2.5">
                    <p className="text-[12px] font-semibold text-income-text mb-1 inline-flex items-center gap-1">
                      <CheckCircle2 size={13} /> Do this
                    </p>
                    <div className="space-y-1">
                      {selectedFeature.doThis.map((point) => (
                        <p key={point} className="text-[11px] text-ink-3">- {point}</p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-card border border-warning-border bg-warning-bg/35 p-2.5">
                    <p className="text-[12px] font-semibold text-warning-text mb-1 inline-flex items-center gap-1">
                      <AlertCircle size={13} /> Avoid this
                    </p>
                    <div className="space-y-1">
                      {selectedFeature.avoidThis.map((point) => (
                        <p key={point} className="text-[11px] text-ink-3">- {point}</p>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary w-full py-3 whitespace-nowrap"
                  onClick={() => {
                    const route = selectedFeature.route
                    setSelectedId(null)
                    navigate(route)
                  }}
                >
                  Open {selectedFeature.title} <ArrowRight size={15} />
                </button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
