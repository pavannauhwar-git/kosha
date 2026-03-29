import React from 'react'
import { Bug, Home, RotateCw } from 'lucide-react'
import KoshaErrorPage from './KoshaErrorPage'
import { getRuntimeDiagnostics } from '../../lib/runtimeMonitor'

const RUNTIME_PREFILL_KEY = 'kosha-runtime-bug-prefill'

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

  handleReportBug = () => {
    const err = this.state.error
    const route = `${window.location.pathname}${window.location.search || ''}`
    const message = String(err?.message || 'Unexpected runtime rendering error')
    const stack = String(err?.stack || '').slice(0, 1200)
    let diagnosticsBlock = ''

    try {
      diagnosticsBlock = JSON.stringify(getRuntimeDiagnostics(), null, 2).slice(0, 1400)
    } catch {
      diagnosticsBlock = ''
    }

    const prefill = {
      title: `Runtime error on ${window.location.pathname || '/'}`.slice(0, 160),
      description: `The app crashed unexpectedly while rendering this screen. ${message}`.slice(0, 1500),
      steps: [
        stack ? `Crash stack:\n${stack}` : `App crashed while rendering ${route}.`,
        diagnosticsBlock ? `\nRecent runtime diagnostics:\n${diagnosticsBlock}` : '',
      ].join(''),
      tagsInput: 'runtime,crash',
      severity: 'high',
      includeDiagnostics: true,
      reportedRoute: route,
    }

    try {
      sessionStorage.setItem(RUNTIME_PREFILL_KEY, JSON.stringify(prefill))
    } catch {
      // Ignore storage errors and continue with navigation.
    }

    const routeParam = encodeURIComponent(route)
    window.location.assign(`/report-bug?source=runtime-error&route=${routeParam}`)
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
          helperText="A reload usually fixes temporary issues. If this keeps happening, use Report bug to send crash details."
          detail={detail}
          primaryLabel="Reload app"
          secondaryLabel="Go to dashboard"
          tertiaryLabel="Report bug"
          onPrimary={this.handleReload}
          onSecondary={this.handleGoHome}
          onTertiary={this.handleReportBug}
          primaryIcon={RotateCw}
          secondaryIcon={Home}
          tertiaryIcon={Bug}
        />
      )
    }

    return this.props.children
  }
}
