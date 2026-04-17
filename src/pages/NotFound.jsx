import { ArrowLeft, Home } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import KoshaErrorPage from '../components/errors/KoshaErrorPage'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const homePath = user ? '/' : '/login'

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate(homePath, { replace: true })
  }

  return (
    <KoshaErrorPage
      type="not-found"
      title="This page slipped off the ledger"
      description="The URL may be outdated, or this screen was moved during a recent update."
      helperText="No data was changed. You can safely return to the app from here."
      imageUrl="/illustrations/404_not_found.png"
      primaryLabel={user ? 'Go to dashboard' : 'Go to login'}
      secondaryLabel="Go back"
      onPrimary={() => navigate(homePath, { replace: true })}
      onSecondary={handleBack}
      primaryIcon={Home}
      secondaryIcon={ArrowLeft}
    />
  )
}
