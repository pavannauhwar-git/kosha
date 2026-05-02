import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import Loans from '../components/obligations/Loans'
import PageHeaderPage from '../components/layout/PageHeaderPage'
import { createFadeUp, createStagger } from '../lib/animations'

const fadeUp = createFadeUp(12, 0.4)
const stagger = createStagger(0.06, 0.04)

export default function LoansPage() {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)

  const backButton = (
    <button
      type="button"
      onClick={() => navigate('/obligations')}
      className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-kosha-surface-2 active:bg-kosha-surface-2 transition-colors"
      aria-label="Back to Obligations"
    >
      <ArrowLeft size={20} weight="bold" color="var(--ds-ink)" />
    </button>
  )

  return (
    <PageHeaderPage title="Loans" leftSlot={backButton}>
      <motion.div variants={stagger} initial="hidden" animate="show" className="page-stack h-full">
        <motion.div variants={fadeUp} className="h-full">
          <Loans
            embedded
            showAddExternal={showAdd}
            onShowAddChange={setShowAdd}
          />
        </motion.div>
      </motion.div>

      <motion.button
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="fab"
        aria-label="Add loan"
        onClick={() => setShowAdd(true)}
      >
        <Plus size={24} className="text-white" />
      </motion.button>
    </PageHeaderPage>
  )
}
