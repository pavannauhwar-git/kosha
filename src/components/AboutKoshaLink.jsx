import { useLocation, useNavigate } from 'react-router-dom'
import { Heart } from '@phosphor-icons/react'

export default function AboutKoshaLink({ className = 'text-center pt-4' }) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => navigate('/about', { state: { backgroundLocation: location } })}
        className="inline-flex items-center gap-1 text-caption text-ink-4 active:text-brand transition-colors"
      >
        About Kosha
        <Heart size={11} weight="fill" className="text-expense-text" style={{ verticalAlign: '-0.06em' }} />
      </button>
    </div>
  )
}