import { motion, AnimatePresence } from 'framer-motion'
import { X, User } from 'lucide-react'

export default function ViewProfilePhotoDialog({ open, onClose, avatarUrl, displayName, initial }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[70] flex flex-col items-center justify-center p-4 pointer-events-none"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="relative w-full max-w-md aspect-square bg-kosha-surface-2 rounded-hero overflow-hidden shadow-2xl pointer-events-auto">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/40 transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>

              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-brand-container">
                  <div className="w-32 h-32 rounded-full bg-kosha-surface/20 flex items-center justify-center border-4 border-kosha-surface/30">
                    <span className="text-[64px] font-bold text-brand">{initial}</span>
                  </div>
                  <p className="text-brand font-semibold text-[18px]">{displayName}</p>
                </div>
              )}
            </div>
            
            <motion.div 
              className="mt-6 text-center pointer-events-auto"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1, transition: { delay: 0.1 } }}
            >
              <p className="text-white font-bold text-[20px]">{displayName}</p>
              <p className="text-white/60 text-[14px] mt-1">Profile Photo</p>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
