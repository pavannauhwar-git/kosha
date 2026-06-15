import { useEffect } from 'react'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

/**
 * BottomSheet — wraps MUI SwipeableDrawer to provide a swipe-dismissable bottom sheet
 * on mobile and a centered modal dialog on desktop screens.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  description = 'Dialog content.',
  children,
  className = '',
}) {
  useEffect(() => {
    if (open) {
      import('../../lib/haptics').then((m) => m.hapticTap())
    }
  }, [open])

  useEffect(() => {
    function handleCloseAll() {
      if (open && onClose) {
        onClose()
      }
    }
    window.addEventListener('bottomsheet:close-all', handleCloseAll)
    return () => window.removeEventListener('bottomsheet:close-all', handleCloseAll)
  }, [open, onClose])

  const ios = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableScrollLock={true}
      disableBackdropTransition={!ios}
      disableDiscovery={ios}
      transitionDuration={{
        enter: 300,
        exit: 200,
      }}
      slotProps={{
        backdrop: {
          sx: {
            // Touch devices skip the blur — see FIX-014.
            '@media (hover: hover) and (pointer: fine)': {
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            },
            backgroundColor: 'rgba(17, 19, 24, 0.40)',
            transition: 'opacity 240ms cubic-bezier(0.2, 0, 0, 1) !important',
          },
        },
        paper: {
          sx: {
            borderTopLeftRadius: '28px',
            borderTopRightRadius: '28px',
            backgroundColor: 'var(--ds-surface)',
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
            maxHeight: 'calc(100vh - var(--ds-safe-top, 0px) - 8px)',
            backgroundImage: 'none',
            boxShadow: 'var(--ds-shadow-lg)',
            left: 0,
            right: 0,
            margin: '0 auto',
            width: '100%',
            maxWidth: 'var(--app-shell-max)',
            // M3 Expressive emphasized — fast, decisive, no overshoot.
            transition:
              'transform 300ms cubic-bezier(0.05, 0.7, 0.1, 1), opacity 240ms cubic-bezier(0.2, 0, 0, 1) !important',
            // Desktop styling transformation
            '@media (min-width: 600px)': {
              bottom: 'auto',
              top: '50%',
              left: '50%',
              right: 'auto',
              transform: 'translate(-50%, -50%) !important',
              maxWidth: '512px',
              borderRadius: '28px',
              height: 'auto',
              maxHeight: 'calc(100vh - 4rem)',
              paddingBottom: '1.5rem',
            },
          },
        },
      }}
    >
      {/* Drag handle for mobile */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          pt: 1.5,
          pb: 1,
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
          '@media (min-width: 600px)': { display: 'none' },
        }}
        aria-hidden="true"
      >
        <Box
          sx={{
            width: '40px',
            height: '4px',
            borderRadius: '2px',
            backgroundColor: 'var(--ds-border-strong)',
          }}
        />
      </Box>

      {/* Header */}
      {title && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            pb: 2,
            pt: { xs: 0, sm: 2 },
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              color: 'var(--ds-text)',
              fontSize: '18px',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="Close"
            sx={{
              backgroundColor: 'var(--ds-surface-container)',
              color: 'var(--ds-text-tertiary)',
              '&:hover': {
                backgroundColor: 'var(--ds-surface-container-high)',
              },
            }}
            size="small"
          >
            {/* Custom vector X representing Close so we don't depend on mui icons font if it takes long to load */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 1L13 13M13 1L1 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </IconButton>
        </Box>
      )}

      {/* Content wrapper */}
      <Box
        className={className}
        sx={{
          overflowY: 'auto',
          px: 3,
          py: 0.5,
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {children}
      </Box>
    </SwipeableDrawer>
  )
}
