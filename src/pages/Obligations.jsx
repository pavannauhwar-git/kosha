import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Receipt, Handshake, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import PageHeaderPage from '../components/layout/PageHeaderPage'
import Bills from '../components/obligations/Bills'
import Loans from '../components/obligations/Loans'
import { createFadeUp, createStagger } from '../lib/animations'

const fadeUp = createFadeUp(12, 0.4)
const stagger = createStagger(0.06, 0.04)

const TABS = [
  { key: 'bills', label: 'Bills', icon: Receipt, hint: 'Due dates & payments' },
  { key: 'loans', label: 'Loans', icon: Handshake, hint: 'Given & taken' },
]

function resolveTab(value) {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'loans' ? 'loans' : 'bills'
}

export default function Obligations() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showAdd, setShowAdd] = useState(false)
  const tab = resolveTab(searchParams.get('tab'))

  function handleTabChange(nextTab) {
    if (nextTab === tab) return
    const next = new URLSearchParams(searchParams)
    next.set('tab', nextTab)
    setSearchParams(next, { replace: true })
  }

  return (
    <PageHeaderPage title="Obligations">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="page-stack"
      >
        <motion.div variants={fadeUp} className="flex border-b border-kosha-border overflow-x-auto no-scrollbar relative">
          {TABS.map((item) => {
            const Icon = item.icon
            const active = tab === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleTabChange(item.key)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 h-10 text-[13px] font-semibold transition-colors
                  ${active ? 'text-brand' : 'text-ink-3 hover:text-ink'}`}
                aria-pressed={active}
              >
                <Icon size={14} className={active ? 'text-brand' : 'text-ink-3'} />
                <span>{item.label}</span>
                <span className={`text-[10px] font-medium ${active ? 'text-brand/70' : 'text-ink-4'} hidden sm:inline`}>
                  · {item.hint}
                </span>
                {active && (
                  <motion.div
                    layoutId="obligations-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
              </button>
            )
          })}
        </motion.div>

        <motion.div variants={fadeUp}>
          {tab === 'loans' ? (
            <Loans embedded showAddExternal={showAdd} onShowAddChange={setShowAdd} />
          ) : (
            <Bills embedded tabParam="billsTab" showAddExternal={showAdd} onShowAddChange={setShowAdd} />
          )}
        </motion.div>
      </motion.div>

      <button
        className="fab"
        aria-label={tab === 'loans' ? 'Add loan' : 'Add bill'}
        onClick={() => setShowAdd(true)}
      >
        <Plus size={24} className="text-white" />
      </button>
    </PageHeaderPage>
  )
}
