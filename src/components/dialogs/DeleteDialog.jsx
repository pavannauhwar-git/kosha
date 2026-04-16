import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash } from '@phosphor-icons/react'
import { C } from '../../lib/colors'
import Button from '../ui/Button'

export default function DeleteDialog({ open, onConfirm, onCancel, label = 'this transaction' }) {
  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onCancel()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 bg-ink/30 z-50"
                style={{ backdropFilter: 'blur(2px)' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="fixed left-4 right-4 bottom-6 z-50 bg-kosha-surface rounded-hero p-6 shadow-card-lg"
                style={{
                  maxWidth: 480,
                  margin: '0 auto',
                  bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
                }}
                initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
                exit={{ y: 60, opacity: 0, transition: { duration: 0.2 } }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-card bg-expense-bg flex items-center justify-center">
                    <Trash size={20} color={C.expense} weight="duotone" />
                  </div>
                  <Dialog.Title className="font-semibold text-ink text-base">
                    Delete {label}?
                  </Dialog.Title>
                </div>
                <Dialog.Description className="text-ink-2 text-sm mb-5">
                  This cannot be undone. The transaction will be permanently removed.
                </Dialog.Description>
                <div className="flex gap-3">
                  <Button variant="ghost" fullWidth onClick={onCancel} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="danger" fullWidth onClick={onConfirm} className="flex-1">
                    Delete
                  </Button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
