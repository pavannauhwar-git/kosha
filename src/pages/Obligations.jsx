import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Receipt, Handshake, Plus } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import PageHeaderPage from '../components/layout/PageHeaderPage'
import Bills from '../components/obligations/Bills'
import Loans from '../components/obligations/Loans'
import { createFadeUp, createStagger } from '../lib/animations'

const fadeUp = createFadeUp(12, 0.4)
const stagger = createStagger(0.06, 0.04)

const TABS = [
  { key: 'bills', label: 'Bills', Icon: Receipt, hint: 'Due dates & payments' },
  { key: 'loans', label: 'Loans', Icon: Handshake, hint: 'Given & taken' },
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
        <motion.div variants={fadeUp} className="bg-kosha-surface-2 px-1.5 py-1 rounded-[22px] border border-kosha-border/60 mb-3 flex items-center">
          {TABS.map((item) => {
            const Icon = item.Icon
            const active = tab === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  import('../lib/haptics').then(m => m.hapticTap())
                  handleTabChange(item.key)
                }}
                className="flex-1 flex flex-col items-center justify-center min-h-[54px] relative"
                aria-pressed={active}
              >
                <div className="nav-icon-wrap mb-1">
                  {active && (
                    <motion.div 
                      layoutId="obligations-nav-pill" 
                      className="nav-icon-bg"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 40, mass: 1 }} 
                    />
                  )}
                  <span className="nav-icon-layer" style={{ opacity: active ? 1 : 0, transition: 'opacity 180ms cubic-bezier(0.2, 0, 0, 1)' }}>
                    <Icon size={21} weight="fill" color="var(--ds-primary)" />
                  </span>
                  <span className="nav-icon-layer" style={{ opacity: active ? 0 : 1, transition: 'opacity 180ms cubic-bezier(0.2, 0, 0, 1)' }}>
                    <Icon size={21} weight="regular" color="var(--ds-text-tertiary)" />
                  </span>
                </div>
                <span 
                  className="nav-label"
                  style={{
                    color: active ? 'var(--ds-primary)' : 'var(--ds-text-tertiary)',
                    fontWeight: active ? 600 : 400,
                    opacity: active ? 1 : 0.75,
                    transition: 'color 180ms cubic-bezier(0.2, 0, 0, 1), opacity 180ms cubic-bezier(0.2, 0, 0, 1)',
                  }}
                >
                  {item.label}
                </span>
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
