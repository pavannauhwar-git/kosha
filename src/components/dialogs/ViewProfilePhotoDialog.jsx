import Sheet from '../ui/Sheet'
import { X } from '@phosphor-icons/react'
import SecureAvatar from '../ui/SecureAvatar'

export default function ViewProfilePhotoDialog({ open, onClose, avatarUrl, displayName, initial }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant="center"
      showClose={false}
      showHandle={false}
      contentClassName=""
      className="bg-transparent shadow-none w-full max-w-md p-4"
    >
      <div className="relative w-full aspect-square bg-kosha-surface-2 rounded-hero overflow-hidden shadow-2xl pointer-events-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/40 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {avatarUrl ? (
          <SecureAvatar
            src={avatarUrl}
            alt={displayName || 'Profile photo'}
            fallbackInitial={initial}
            version={avatarUrl}
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
      
      <div className="mt-6 text-center pointer-events-auto">
        <p className="text-white font-bold text-[20px]">{displayName}</p>
        <p className="text-white/60 text-[14px] mt-1">Profile Photo</p>
      </div>
    </Sheet>
  )
}
