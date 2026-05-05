import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import Bills from '../components/obligations/Bills'
import PageBackHeaderPage from '../components/layout/PageBackHeaderPage'
import { createFadeUp, createStagger } from '../lib/animations'

const fadeUp = createFadeUp(12, 0.4)
const stagger = createStagger(0.06, 0.04)

export default function BillsPage() {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)

  return (
    <PageBackHeaderPage
      title="Bills & Dues"
      onBack={() => navigate('/obligations')}
      rightSlot={(
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-kosha-surface-2 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-95 active:bg-kosha-border"
          aria-label="Go to home"
        >
          <Home size={16} className="text-ink-2" />
        </button>
      )}
    >
      <motion.div variants={stagger} initial="hidden" animate="show" className="page-stack h-full">
        <motion.div variants={fadeUp} className="h-full">
          <Bills
            embedded
            tabParam="billsTab"
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
        aria-label="Add bill"
        onClick={() => setShowAdd(true)}
      >
        <Plus size={24} className="text-white" />
      </motion.button>
    </PageBackHeaderPage>
  )
}
