import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Home,
  Sparkles,
  ShieldCheck,
  LayoutGrid,
  LineChart,
  Receipt,
  Wallet,
  Link2,
  Handshake,
  Users,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createFadeUp, createStagger } from '../lib/animations'
import PageBackHeaderPage from '../components/layout/PageBackHeaderPage'
import Button from '../components/ui/Button'
import useOverlayFocusTrap from '../hooks/useOverlayFocusTrap'

const fadeUp = createFadeUp(4, 0.18)
const stagger = createStagger(0.05, 0.04)

const START_HERE = [
  'Add 5-10 recent transactions so your Dashboard and Analytics have enough signal.',
  'Set upcoming bills and record active loans in Obligations to track dues and settlements.',
  'Use consistent categories for repeated spends to improve trend quality.',
  'Create a Splitwise group for your next trip or shared expense with friends.',
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
    accent: 'bg-brand-container text-ink',
    summary: 'One-screen view of balance, pace, dues, and recent movement.',
    whenToUse: 'Use this every morning and evening for quick financial orientation.',
    workflow: [
      'Check the hero card for balance direction and savings pace.',
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
    id: 'obligations',
    title: 'Obligations',
    subtitle: 'Never miss due dates & track loans',
    icon: Receipt,
    route: '/obligations',
    category: 'weekly',
    accent: 'bg-warning-bg text-warning-text',
    summary: 'Track upcoming bills, run recurrence, and manage personal loans in one place.',
    whenToUse: 'Use this at least once weekly and before month end to track cashflow.',
    workflow: [
      'Add recurring bills and subscriptions to track due dates.',
      'Log money lent or borrowed to track partial repayments.',
      'Mark items paid immediately to keep due signals and balances accurate.',
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
    accent: 'bg-brand-container text-brand',
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
    accent: 'bg-brand-container text-ink',
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

  {
    id: 'splitwise',
    title: 'Splitwise',
    subtitle: 'Split expenses with friends',
    icon: Users,
    route: '/splitwise',
    category: 'weekly',
    accent: 'bg-brand-container text-brand',
    summary: 'Create trip groups, invite friends via link, split expenses equally or by custom shares, and settle debts.',
    whenToUse: 'Use this whenever you travel or dine with others and need to track shared costs.',
    workflow: [
      'Create a group for each trip or shared event and pick a cover banner.',
      'Invite friends with a shareable link — they join with their Kosha account.',
      'Add expenses with split method (equal, exact, percent, or shares).',
      'Check suggested settlements and record payments to settle up.',
      'Archive the trip when all debts are cleared.',
    ],
    doThis: [
      'Record expenses immediately to avoid forgetting who paid.',
      'Use suggested settlements to minimize the number of transfers.',
      'Archive completed trips to keep your active list clean.',
    ],
    avoidThis: [
      'Do not delete a group with unsettled balances.',
      'Avoid adding duplicate expenses — use edit instead.',
      'Do not skip adding friends as members before logging expenses.',
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
  const currentViewedCount = useMemo(() => {
    return Array.from(viewed).filter(id => FEATURE_CARDS.some(card => card.id === id)).length
  }, [viewed])

  const progressPct = useMemo(
    () => Math.round((currentViewedCount / FEATURE_CARDS.length) * 100),
    [currentViewedCount]
  )
  const nextFeature = useMemo(
    () => FEATURE_CARDS.find((item) => !viewed.has(item.id)) || FEATURE_CARDS[0],
    [viewed]
  )

  const closeFeatureDetail = useCallback(() => {
    setSelectedId(null)
  }, [])

  const guideDetailRef = useOverlayFocusTrap(!!selectedFeature, {
    onClose: closeFeatureDetail,
    initialFocusSelector: 'button[aria-label="Close feature details"]',
  })

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
    <PageBackHeaderPage
      title="Guide"
      onBack={() => navigate(-1)}
      rightSlot={(
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Go to dashboard"
          className="w-9 h-9 rounded-pill flex items-center justify-center bg-kosha-surface-2 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-95 active:bg-kosha-border"
        >
          <Home size={16} className="text-ink-2" />
        </button>
      )}
      contentClassName="px-4 pt-5 pb-24 max-w-[560px] mx-auto"
    >
      <motion.div variants={stagger} initial="hidden" animate="show" className="page-stack">
        <motion.div variants={fadeUp} className="card p-0 overflow-hidden">
          <div className="px-4 py-5 bg-kosha-surface-2 border-b border-kosha-border flex items-center justify-between gap-4">
            <div className="flex flex-col items-start text-left min-w-0">
              <p className="text-[22px] font-bold text-ink tracking-tight leading-tight truncate">Kosha Guide</p>
              <p className="text-[12px] text-ink-3 mt-1 leading-relaxed">
                Practical workflows, mistakes to avoid, and quick next actions for every page.
              </p>
            </div>
            <img src="/illustrations/guide_hero.png" alt="Guide Hero" className="w-40 h-auto object-contain illustration shrink-0" />
          </div>

          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 mb-3.5">
              <div className="mini-panel px-2.5 py-2 text-center">
                <p className="text-[16px] font-semibold text-ink leading-none">{FEATURE_CARDS.length}</p>
                <p className="text-[10px] text-ink-3 mt-1">Playbooks</p>
              </div>
              <div className="mini-panel px-2.5 py-2 text-center">
                <p className="text-[16px] font-semibold text-ink leading-none">{currentViewedCount}</p>
                <p className="text-[10px] text-ink-3 mt-1">Viewed</p>
              </div>
              <div className="mini-panel px-2.5 py-2 text-center">
                <p className="text-[16px] font-semibold text-brand leading-none">{progressPct}%</p>
                <p className="text-[10px] text-ink-3 mt-1">Progress</p>
              </div>
            </div>

            <div className="mb-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold text-ink-2">Guide progress</p>
                <p className="text-[11px] font-semibold text-brand">{currentViewedCount} / {FEATURE_CARDS.length}</p>
              </div>
              <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                <motion.div
                  className="h-full rounded-pill bg-brand"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.35, ease: [0.05, 0.7, 0.1, 1] }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => openFeature(nextFeature.id)}
                icon={<Sparkles size={15} />}
              >
                Continue with {nextFeature.title}
              </Button>
              <Button
                variant="tonal"
                size="md"
                fullWidth
                onClick={() => navigate(nextFeature.route)}
                icon={<ArrowRight size={15} />}
              >
                Open {nextFeature.title}
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.section variants={fadeUp} className="w-full">
          <p className="section-label mb-1.5">Start here</p>
          <div className="card p-3.5 space-y-2">
            {START_HERE.map((step, i) => (
              <div key={step} className="mini-panel px-3 py-2.5 flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-brand-container border border-brand/15 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-semibold text-brand">{i + 1}</span>
                </div>
                <p className="text-[12px] text-ink-2 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={fadeUp} className="w-full">
          <p className="section-label mb-1.5">Feature explorer</p>
          <div className="card-inset p-1.5 rounded-card flex gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-3">
            {GUIDE_TABS.map((tab) => {
              const active = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-9 px-3 rounded-pill text-[11px] font-semibold whitespace-nowrap border transition-[background-color,border-color,color,box-shadow] duration-150 will-change-transform
                    ${active
                      ? 'bg-brand text-white border-brand shadow-card-sm'
                      : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-brand-container/45'}`}
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
              Viewed {currentViewedCount}/{FEATURE_CARDS.length}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 place-items-stretch">
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
                  className="card p-0 overflow-hidden text-left flex flex-col"
                >
                  <div className="px-4 py-3.5 bg-kosha-surface-2 border-b border-kosha-border flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-pill font-semibold ${isViewed ? 'bg-income-bg text-income-text' : 'bg-kosha-surface text-ink-3 border border-kosha-border'}`}>
                          {isViewed ? 'Viewed' : 'New'}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-pill font-semibold bg-kosha-surface text-ink-3 border border-kosha-border capitalize">
                          {card.category}
                        </span>
                      </div>
                      <p className="text-[15px] font-semibold text-ink truncate">{card.title}</p>
                      <p className="text-[12px] text-ink-3 mt-0.5 truncate">{card.subtitle}</p>
                    </div>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${card.accent}`}>
                      <Icon size={16} />
                    </div>
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <p className="text-[12px] text-ink-3 leading-relaxed">{card.summary}</p>
                    <div className="mt-auto pt-3 flex">
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-pill border border-kosha-border bg-kosha-surface text-ink-2 shadow-[0_1px_2px_rgba(17,19,24,0.08)]">
                        Open details
                        <ArrowRight size={12} />
                      </div>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </motion.section>

        <motion.section variants={fadeUp} className="w-full">
          <p className="section-label mb-1.5">Playbook cadence</p>
          <div className="card p-3.5 space-y-2">
            <div className="mini-panel px-3 py-2.5">
              <p className="text-[12px] text-ink-2"><span className="font-semibold text-ink">Daily:</span> Dashboard pulse + quick capture</p>
            </div>
            <div className="mini-panel px-3 py-2.5">
              <p className="text-[12px] text-ink-2"><span className="font-semibold text-ink">Weekly:</span> Bills check + loan settlements + splitwise settle-ups + reconciliation cleanup</p>
            </div>
            <div className="mini-panel px-3 py-2.5">
              <p className="text-[12px] text-ink-2"><span className="font-semibold text-ink">Monthly:</span> Analytics review + export backup</p>
            </div>
          </div>
        </motion.section>

        <motion.section variants={fadeUp} className="w-full">
          <p className="section-label mb-1.5">Trust and privacy</p>
          <div className="card p-4 space-y-2.5">
            <div className="flex items-start gap-2">
              <ShieldCheck size={16} className="text-ink mt-0.5" />
              <p className="text-label text-ink-2">Your app data stays within your Supabase project under row-level security policies.</p>
            </div>
            <p className="text-label text-ink-3">Use monthly CSV export as a simple external backup ritual.</p>
            <p className="text-label text-ink-3">If network conditions are unstable, sync may slow down, but data can still be refreshed safely.</p>
          </div>
        </motion.section>

        <motion.div variants={fadeUp} className="card p-4 bg-brand-container border border-brand/20">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={15} className="text-brand" />
            <p className="text-body font-semibold text-ink">Today tip</p>
          </div>
          <p className="text-label text-ink-2">{todayTip}</p>
        </motion.div>

      </motion.div>

      <AnimatePresence>
        {selectedFeature && (
          <>
            <motion.button
              type="button"
              aria-label="Close guide detail"
              onClick={closeFeatureDetail}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/35"
            />

            <div className="fixed z-50 inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] px-4 flex justify-center">
              <motion.div
                ref={guideDetailRef}
                key={selectedFeature.id}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={`${selectedFeature.title} guide details`}
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
                    onClick={closeFeatureDetail}
                    className="close-btn shrink-0"
                    aria-label="Close feature details"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <p className="text-[11px] text-ink-3 shrink-0">
                    Card {selectedIndex + 1} of {navigationPool.length}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto">
                    <Button
                      variant="tonal"
                      size="sm"
                      className="whitespace-nowrap"
                      onClick={() => moveFeature(-1)}
                      disabled={selectedIndex <= 0}
                      icon={<ArrowLeft size={13} />}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="whitespace-nowrap"
                      onClick={() => moveFeature(1)}
                      disabled={selectedIndex >= navigationPool.length - 1}
                      iconRight={<ArrowRight size={13} />}
                    >
                      Next
                    </Button>
                  </div>
                </div>

                <div className="mini-panel p-2.5 mb-2.5">
                  <p className="text-[12px] text-ink-2">{selectedFeature.summary}</p>
                  <p className="text-[11px] text-ink-3 mt-1">{selectedFeature.whenToUse}</p>
                </div>

                <div className="mb-3">
                  <p className="text-[12px] font-semibold text-ink-2 mb-1.5">Recommended workflow</p>
                  <div className="space-y-1.5">
                    {selectedFeature.workflow.map((step, idx) => (
                      <p key={step} className="text-[12px] text-ink-3">
                        <span className="font-semibold text-accent-text">{idx + 1}.</span> {step}
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

                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  className="whitespace-nowrap"
                  iconRight={<ArrowRight size={14} />}
                  onClick={() => {
                    const route = selectedFeature.route
                    closeFeatureDetail()
                    navigate(route)
                  }}
                >
                  Open {selectedFeature.title}
                </Button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </PageBackHeaderPage>
  )
}
