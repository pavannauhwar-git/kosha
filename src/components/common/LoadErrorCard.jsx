import { useState } from 'react'
import { Warning } from '@phosphor-icons/react'
import Button from '../ui/Button'

// Shown instead of an empty state when a screen's data failed to load, so a
// network error never reads as "you have nothing here".
export default function LoadErrorCard({ title = 'Couldn’t load this', onRetry, className = '' }) {
  const [retrying, setRetrying] = useState(false)
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false

  async function handleRetry() {
    if (!onRetry || retrying) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div role="alert" className={`card p-5 flex flex-col items-center text-center ${className}`.trim()}>
      <Warning size={28} className="text-warning-text mb-2" aria-hidden="true" />
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1 mb-4 text-[12px] text-ink-3 max-w-[260px]">
        {offline
          ? 'You’re offline. Your data is safe — connect to the internet and try again.'
          : 'Something went wrong while loading. Your data is safe — try again in a moment.'}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={() => { void handleRetry() }} loading={retrying}>
          Try again
        </Button>
      )}
    </div>
  )
}
