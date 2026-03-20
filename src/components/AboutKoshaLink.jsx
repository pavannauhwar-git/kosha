import { useLocation, useNavigate } from 'react-router-dom'

export default function AboutKoshaLink({ className = 'text-center pt-4' }) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => navigate('/about', { state: { backgroundLocation: location } })}
        className="text-caption text-ink-4 active:text-brand transition-colors"
      >
        About Kosha
      </button>
    </div>
  )
}