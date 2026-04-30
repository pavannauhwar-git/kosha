import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { UsersThree, Handshake, ArrowRight, CheckCircle, XCircle } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { previewSplitGroupInviteMutation, consumeSplitGroupInviteMutation } from '../hooks/useSplitwise'
import { consumeInviteToken } from '../lib/invites'
import KoshaLogo from '../components/brand/KoshaLogo'
import Button from '../components/ui/Button'
import { createFadeUp, createStagger } from '../lib/animations'

const fadeUp = createFadeUp(12, 0.4)
const stagger = createStagger(0.08, 0.05)

export default function InviteLanding() {
  const { token, splitToken } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()

  const [status, setStatus] = useState('loading') // loading, preview, error, success
  const [details, setDetails] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isSplitwise = !!splitToken
  const activeToken = splitToken || token

  useEffect(() => {
    if (authLoading) return
    void fetchPreview()
  }, [activeToken, authLoading])

  async function fetchPreview() {
    if (!activeToken) {
      setStatus('error')
      setError('No invite token found.')
      return
    }

    setStatus('loading')
    try {
      if (isSplitwise) {
        const preview = await previewSplitGroupInviteMutation(activeToken)
        setDetails({
          type: 'splitwise',
          title: preview.group_name || 'Shared Trip',
          subtitle: 'Group Transfer Sync',
          icon: <UsersThree size={32} weight="duotone" className="text-brand" />,
          data: preview
        })
      } else {
        // Wallet linked invite
        // Since we don't have a preview RPC for wallet invites yet, 
        // we'll just show a generic "Linked Wallet" invitation
        setDetails({
          type: 'wallet',
          title: 'Linked Wallet',
          subtitle: 'Live Financial Sync',
          icon: <Handshake size={32} weight="duotone" className="text-brand" />,
          data: { token: activeToken }
        })
      }
      setStatus('preview')
    } catch (e) {
      console.error('Invite preview failed', e)
      setStatus('error')
      setError(e.message || 'This invite link is invalid or has expired.')
    }
  }

  async function handleAccept() {
    if (!user) {
      // Save token and go to login
      const storageKey = isSplitwise ? 'pendingSplitGroupInviteToken' : 'pendingInviteToken'
      sessionStorage.setItem(storageKey, activeToken)
      navigate('/login', { state: { from: location.pathname } })
      return
    }

    setBusy(true)
    try {
      if (isSplitwise) {
        const joined = await consumeSplitGroupInviteMutation(activeToken)
        setStatus('success')
        setTimeout(() => { window.location.href = '/splitwise' }, 1500)
      } else {
        const result = await consumeInviteToken({
          supabaseClient: supabase,
          inviteToken: activeToken,
          userId: user.id
        })
        if (!result.consumed) throw new Error(result.reason || 'Could not join wallet.')
        setStatus('success')
        setTimeout(() => { window.location.href = '/' }, 1500)
      }
    } catch (e) {
      setError(e.message || 'Failed to accept invitation.')
      setStatus('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-dvh bg-kosha-bg px-4 flex flex-col items-center justify-center overscroll-none overflow-y-auto">
      <div className="w-full max-w-[400px] py-12">
        <AnimatePresence mode="wait">
          {status === 'loading' && (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <KoshaLogo size={48} className="animate-pulse" />
              <p className="text-label text-ink-3 font-medium">Validating invitation...</p>
            </motion.div>
          )}

          {status === 'preview' && details && (
            <motion.div
              key="preview"
              variants={stagger}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              <motion.div variants={fadeUp} className="card p-6">
                {/* ── Header ───────────────────────────────────────────────── */}
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-kosha-border">
                  <KoshaLogo size={40} />
                  <div className="text-left">
                    <p className="text-[17px] font-bold text-ink leading-tight">Kosha</p>
                    <p className="text-[12px] text-ink-2 mt-0.5">Personal finance, simplified</p>
                  </div>
                </div>

                {/* ── Content ──────────────────────────────────────────────── */}
                <div className="text-center">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-brand-container flex items-center justify-center mb-4">
                    {details.icon}
                  </div>
                  
                  <p className="text-caption text-brand font-bold uppercase tracking-widest mb-1">
                    Invitation
                  </p>
                  <h1 className="text-[24px] font-bold text-ink leading-tight mb-2">
                    {details.title}
                  </h1>
                  <p className="text-label text-ink-3">
                    {details.subtitle}
                  </p>

                  <div className="mt-8 pt-6 border-t border-kosha-border">
                    <p className="text-[13px] text-ink-2 mb-6 leading-relaxed">
                      {details.type === 'splitwise' 
                        ? 'You have been invited to join this shared trip. All expenses and settlements will stay in sync.'
                        : 'Link your wallet to share transactions, bills, and loans in real-time with your partner.'}
                    </p>

                    {user ? (
                      <Button
                        variant="primary"
                        size="xl"
                        fullWidth
                        onClick={handleAccept}
                        loading={busy}
                        iconRight={<ArrowRight size={18} weight="bold" />}
                      >
                        Accept Invitation
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <Button
                          variant="primary"
                          size="xl"
                          fullWidth
                          onClick={() => {
                            const storageKey = isSplitwise ? 'pendingSplitGroupInviteToken' : 'pendingInviteToken'
                            sessionStorage.setItem(storageKey, activeToken)
                            navigate('/login?mode=signup', { state: { from: location.pathname } })
                          }}
                        >
                          Create Account to Join
                        </Button>
                        <button
                          onClick={() => {
                            const storageKey = isSplitwise ? 'pendingSplitGroupInviteToken' : 'pendingInviteToken'
                            sessionStorage.setItem(storageKey, activeToken)
                            navigate('/login', { state: { from: location.pathname } })
                          }}
                          className="text-label font-semibold text-accent-text py-2"
                        >
                          Already a member? Sign In
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => navigate(user ? '/' : '/login')}
                    className="mt-4 text-label font-semibold text-ink-3 hover:text-ink transition-colors"
                  >
                    Maybe later
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-8 text-center"
            >
              <div className="mx-auto w-16 h-16 rounded-2xl bg-expense-bg flex items-center justify-center mb-6">
                <XCircle size={32} weight="duotone" className="text-expense-text" />
              </div>
              <h2 className="text-[20px] font-bold text-ink mb-2">Invitation Error</h2>
              <p className="text-label text-ink-2 mb-8 leading-relaxed">
                {error}
              </p>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => navigate('/')}
              >
                Back to dashboard
              </Button>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center gap-6"
            >
              <div className="w-20 h-20 rounded-full bg-income-bg flex items-center justify-center text-income-text">
                <CheckCircle size={48} weight="fill" />
              </div>
              <div>
                <h2 className="text-[22px] font-bold text-ink mb-2">Welcome aboard!</h2>
                <p className="text-label text-ink-3">Redirecting to your shared workspace...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
