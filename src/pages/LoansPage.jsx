import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import Loans from '../components/obligations/Loans'
import PageBackHeaderPage from '../components/layout/PageBackHeaderPage'
import PartnerViewBanner from '../components/common/PartnerViewBanner'
import { getAuthUserId } from '../lib/authStore'
import { useActiveWallet } from '../lib/walletStore'
import { createFadeUp, createStagger } from '../lib/animations'

const fadeUp = createFadeUp(12, 0.4)
const stagger = createStagger(0.06, 0.04)

export default function LoansPage() {
  const navigate = useNavigate()
  const activeWalletUserId = useActiveWallet()
  const isViewingPartner = !!activeWalletUserId && activeWalletUserId !== getAuthUserId()
  const [showAdd, setShowAdd] = useState(false)

  return (
    <PageBackHeaderPage
      title="Loans"
      onBack={() => navigate('/obligations')}
      contentClassName="page"
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
          <Loans
            embedded
            showAddExternal={showAdd}
            onShowAddChange={setShowAdd}
            isViewingPartner={isViewingPartner}
          />
        </motion.div>
      </motion.div>

      {!isViewingPartner && (
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
      )}
      <PartnerViewBanner />
    </PageBackHeaderPage>
  )
}
