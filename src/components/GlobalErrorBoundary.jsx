import React from 'react'
import { Home, RotateCw } from 'lucide-react'
import KoshaErrorPage from './KoshaErrorPage'

export class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught rendering error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.assign('/')
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error
      const detail = [err?.message, err?.stack]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 1800)

      return (
        <KoshaErrorPage
          type="runtime"
          title="Kosha hit an unexpected snag"
          description="Something broke while rendering this screen. Your financial data remains safe."
          helperText="A reload usually fixes temporary issues. If this keeps happening, copy details and use Profile > Report bug."
          detail={detail}
          primaryLabel="Reload app"
          secondaryLabel="Go to dashboard"
          onPrimary={this.handleReload}
          onSecondary={this.handleGoHome}
          primaryIcon={RotateCw}
          secondaryIcon={Home}
        />
      )
    }

    return this.props.children
  }
}
