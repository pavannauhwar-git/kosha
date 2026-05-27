import { useState, useEffect, useCallback, useRef } from 'react'
import Popover from '@mui/material/Popover'
import Grow from '@mui/material/Grow'
import Box from '@mui/material/Box'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import MuiButton from '@mui/material/Button'
import { LogOut, Bug, Info, BookOpen, Link2, Unlink } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useActiveWallet, setActiveWalletUserId } from '../../lib/walletStore'
import { unlinkPartner } from '../../lib/walletSync'
import { useLocation, useNavigate } from 'react-router-dom'
import SecureAvatar from '../ui/SecureAvatar'

export default function ProfileMenu({ className = '', dropUp = false }) {
  const { user, profile, signOut, linkedProfiles, reloadLinkedData } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState(null)
  const [unlinkingId, setUnlinkingId] = useState('')
  const closeRafRef = useRef(null)

  const initial = (profile?.display_name || user?.email || 'K')[0].toUpperCase()
  const avatarUrl = profile?.avatar_url || null
  const displayName = profile?.display_name || 'My Account'
  const activeWalletUserId = useActiveWallet()
  const isViewingPartner = !!activeWalletUserId && !!user?.id && activeWalletUserId !== user.id
  const activePartner = isViewingPartner ? (linkedProfiles || []).find(p => p.id === activeWalletUserId) : null

  const handleOpen = (event) => {
    if (menuOpen) {
      setMenuOpen(false)
      return
    }
    setAnchorEl(event.currentTarget)
    setMenuOpen(true)
  }

  const handleClose = () => {
    setMenuOpen(false)
  }

  const open = menuOpen
  const id = open ? 'profile-popover' : undefined
  const scheduleClose = useCallback(() => {
    if (closeRafRef.current) return
    closeRafRef.current = requestAnimationFrame(() => {
      closeRafRef.current = null
      setMenuOpen(false)
    })
  }, [])
  const closeOnViewportChange = useCallback(() => {
    scheduleClose()
  }, [scheduleClose])

  useEffect(() => {
    if (!open) return undefined

    window.addEventListener('scroll', closeOnViewportChange, { passive: true, capture: true })
    window.addEventListener('resize', closeOnViewportChange, { passive: true })

    const visualViewport = window.visualViewport
    visualViewport?.addEventListener('resize', closeOnViewportChange)
    visualViewport?.addEventListener('scroll', closeOnViewportChange)

    return () => {
      if (closeRafRef.current) {
        cancelAnimationFrame(closeRafRef.current)
        closeRafRef.current = null
      }
      window.removeEventListener('scroll', closeOnViewportChange, true)
      window.removeEventListener('resize', closeOnViewportChange)
      visualViewport?.removeEventListener('resize', closeOnViewportChange)
      visualViewport?.removeEventListener('scroll', closeOnViewportChange)
    }
  }, [open, closeOnViewportChange])

  return (
    <Box className={className} sx={{ display: 'inline-block' }}>
      {/* ── Trigger Avatar Button ────────────────────────────────── */}
      <Box sx={{ position: 'relative' }}>
        <button
          type="button"
          onClick={handleOpen}
          aria-describedby={id}
          aria-label={open ? 'Close profile menu' : 'Open profile menu'}
          className={`w-9 h-9 rounded-full bg-kosha-surface-2
                     flex items-center justify-center overflow-hidden
                     active:scale-95 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20
                     border border-kosha-border shadow-sm hover:shadow-md transition-shadow
                     ${isViewingPartner ? 'ring-2 ring-warning-text/60 ring-offset-1 ring-offset-kosha-bg' : ''}`}
        >
          {isViewingPartner && activePartner?.avatar_url ? (
            <SecureAvatar src={activePartner.avatar_url} alt={activePartner.display_name} className="w-full h-full object-cover" />
          ) : avatarUrl ? (
            <SecureAvatar src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : isViewingPartner && activePartner?.display_name ? (
            <span className="text-label font-semibold" style={{ color: 'var(--ds-warning)' }}>
              {activePartner.display_name[0].toUpperCase()}
            </span>
          ) : (
            <span className="text-label font-semibold text-ink">{initial}</span>
          )}
        </button>
        {isViewingPartner && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-kosha-bg"
            style={{ background: 'var(--ds-warning)' }}
          />
        )}
      </Box>

      {/* ── Profile popover ───────────────────────────────────────────── */}
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        disableScrollLock
        slots={{ transition: Grow }}
        anchorOrigin={{
          vertical: dropUp ? 'top' : 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: dropUp ? 'bottom' : 'top',
          horizontal: 'right',
        }}
        slotProps={{
          transition: { timeout: { enter: 190, exit: 160 } },
          paper: {
            sx: {
              mt: 1.5,
              mr: 0,
              mb: dropUp ? 1.5 : 0,
              width: '300px',
              maxWidth: 'calc(100vw - 2rem)',
              borderRadius: '28px',
              overflow: 'hidden',
              backgroundColor: 'var(--ds-surface)',
              border: '1px solid var(--ds-border)',
              boxShadow: 'var(--ds-shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
              backgroundImage: 'none',
            },
          },
        }}
      >
        {/* Identity Section (Centered Header Card) */}
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Box sx={{ position: 'relative', mb: 1.5 }}>
            <Avatar
              sx={{
                width: 72,
                height: 72,
                fontSize: '28px',
                fontWeight: 'bold',
                backgroundColor: 'var(--ds-primary-container)',
                color: 'var(--ds-on-primary-container)',
                border: '1px solid var(--ds-border)',
              }}
            >
              {avatarUrl ? (
                <SecureAvatar src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </Avatar>
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'var(--ds-text)', lineHeight: 1.2 }}>
            {displayName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--ds-text-tertiary)', mb: 1.5 }}>
            {user?.email}
          </Typography>
          <MuiButton
            variant="outlined"
            onClick={() => {
              handleClose()
              navigate('/settings')
            }}
            sx={{
              borderRadius: '9999px',
              px: 3,
              py: 0.75,
              borderColor: 'var(--ds-border)',
              color: 'var(--ds-text-secondary)',
              fontSize: '12px',
              fontWeight: 500,
              '&:hover': {
                borderColor: 'var(--ds-border-strong)',
                backgroundColor: 'var(--ds-surface-container)',
              },
            }}
          >
            Manage your Account
          </MuiButton>
        </Box>

        <Divider />

        {/* Wallets & Sync Section (if partner linked) */}
        {linkedProfiles && linkedProfiles.length > 0 && (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="overline" sx={{ px: 1.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ds-text-tertiary)' }}>
              Active Wallet
            </Typography>
            <List dense disablePadding>
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => {
                    handleClose()
                    setActiveWalletUserId(user?.id)
                  }}
                  sx={{
                    borderRadius: '12px',
                    backgroundColor: activeWalletUserId === user?.id ? 'var(--ds-primary-container)' : 'transparent',
                    color: activeWalletUserId === user?.id ? 'var(--ds-on-primary-container)' : 'var(--ds-text)',
                    '&:hover': {
                      backgroundColor: activeWalletUserId === user?.id ? 'var(--ds-primary-container)' : 'var(--ds-surface-container)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: '2px solid var(--ds-border-strong)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {activeWalletUserId === user?.id && (
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--ds-primary)' }} />
                      )}
                    </Box>
                  </ListItemIcon>
                  <ListItemText primary={<Typography sx={{ fontSize: '13px', fontWeight: 600 }}>My Wallet</Typography>} />
                </ListItemButton>
              </ListItem>

              {linkedProfiles.map((p) => (
                <ListItem
                  key={p.id}
                  disablePadding
                  secondaryAction={
                    <MuiButton
                      size="small"
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (confirm(`Unlink ${p.display_name}? You will no longer access their wallet.`)) {
                          setUnlinkingId(p.id)
                          try {
                            await unlinkPartner(user.id, p.id)
                            if (activeWalletUserId === p.id) setActiveWalletUserId(user.id)
                            await reloadLinkedData?.()
                          } catch (e) {
                            alert(e.message)
                          } finally {
                            setUnlinkingId('')
                          }
                        }
                      }}
                      sx={{
                        color: 'var(--ds-expense-text)',
                        minWidth: 'auto',
                        fontSize: '11px',
                        fontWeight: 600,
                        '&:hover': { backgroundColor: 'var(--ds-expense-bg)' },
                      }}
                    >
                      Unlink
                    </MuiButton>
                  }
                >
                  <ListItemButton
                    onClick={() => {
                      handleClose()
                      setActiveWalletUserId(p.id)
                    }}
                    sx={{
                      borderRadius: '12px',
                      backgroundColor: activeWalletUserId === p.id ? 'var(--ds-primary-container)' : 'transparent',
                      color: activeWalletUserId === p.id ? 'var(--ds-on-primary-container)' : 'var(--ds-text)',
                      '&:hover': {
                        backgroundColor: activeWalletUserId === p.id ? 'var(--ds-primary-container)' : 'var(--ds-surface-container)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid var(--ds-border-strong)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {activeWalletUserId === p.id ? (
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--ds-primary)' }} />
                        ) : p.avatar_url ? (
                          <SecureAvatar src={p.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : null}
                      </Box>
                    </ListItemIcon>
                    <ListItemText primary={<Typography sx={{ fontSize: '13px', fontWeight: 600 }}>{p.display_name}</Typography>} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
            <Divider sx={{ my: 1.5 }} />
          </Box>
        )}

        {/* Drawer Options List */}
        <Box sx={{ px: 1, pb: 1 }}>
          <List dense disablePadding>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  handleClose()
                  navigate('/reconciliation')
                }}
                sx={{ borderRadius: '12px', color: 'var(--ds-text)' }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'var(--ds-text-secondary)' }}>
                  <Link2 size={16} />
                </ListItemIcon>
                <ListItemText primary={<Typography sx={{ fontSize: '13px', fontWeight: 500 }}>Reconciliation</Typography>} />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  handleClose()
                  const currentPath = `${location.pathname}${location.search || ''}`
                  navigate('/report-bug', {
                    state: { source: 'profile-menu', returnTo: currentPath, reportedRoute: currentPath },
                  })
                }}
                sx={{ borderRadius: '12px', color: 'var(--ds-text)' }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'var(--ds-text-secondary)' }}>
                  <Bug size={16} />
                </ListItemIcon>
                <ListItemText primary={<Typography sx={{ fontSize: '13px', fontWeight: 500 }}>Report a Bug</Typography>} />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  handleClose()
                  navigate('/about')
                }}
                sx={{ borderRadius: '12px', color: 'var(--ds-text)' }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'var(--ds-text-secondary)' }}>
                  <Info size={16} />
                </ListItemIcon>
                <ListItemText primary={<Typography sx={{ fontSize: '13px', fontWeight: 500 }}>About Kosha</Typography>} />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  handleClose()
                  navigate('/guide')
                }}
                sx={{ borderRadius: '12px', color: 'var(--ds-text)' }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'var(--ds-text-secondary)' }}>
                  <BookOpen size={16} />
                </ListItemIcon>
                <ListItemText primary={<Typography sx={{ fontSize: '13px', fontWeight: 500 }}>Setup Guide</Typography>} />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>

        <Divider />

        {/* Footer Center Signout Button */}
        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'center' }}>
          <MuiButton
            onClick={() => {
              handleClose()
              signOut()
            }}
            variant="outlined"
            startIcon={<LogOut size={15} />}
            sx={{
              borderRadius: '9999px',
              borderColor: 'var(--ds-border)',
              color: 'var(--ds-expense-text)',
              fontSize: '12px',
              fontWeight: 600,
              width: '100%',
              py: 1,
              '&:hover': {
                borderColor: 'var(--ds-expense-border)',
                backgroundColor: 'var(--ds-expense-bg)',
              },
            }}
          >
            Sign out of your account
          </MuiButton>
        </Box>
      </Popover>
    </Box>
  )
}
