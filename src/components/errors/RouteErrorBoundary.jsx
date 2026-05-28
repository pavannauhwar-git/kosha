import React from 'react'
import { captureError } from '../../lib/errorReporting'

/**
 * Per-route error boundary — catches render errors on individual pages
 * without blowing up the entire app shell (nav, other routes remain intact).
 */
export class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    captureError(error, {
      context: 'RouteErrorBoundary',
      extra: {
        pathname: this.props.pathname,
        componentStack: errorInfo?.componentStack?.slice(0, 500),
      },
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleGoHome = () => {
    window.location.assign('/')
  }

  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.message?.toLowerCase().includes('loading chunk') ||
        this.state.error?.message?.toLowerCase().includes('failed to fetch') ||
        this.state.error?.message?.toLowerCase().includes('network error')

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
            style={{ background: 'var(--ds-warning-bg)' }}
          >
            ⚠️
          </div>
          <div>
            <p className="text-[15px] font-semibold text-ink">
              {isChunkError ? 'Could not load this page' : 'Something went wrong'}
            </p>
            <p className="text-[13px] text-ink-3 mt-1 max-w-[280px]">
              {isChunkError
                ? 'Check your connection and try again.'
                : 'This screen hit an unexpected error. Other pages are unaffected.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={this.handleRetry}
              className="text-[13px] font-semibold px-4 py-2 rounded-pill bg-brand text-white"
            >
              Try again
            </button>
            <button
              onClick={this.handleGoHome}
              className="text-[13px] font-semibold px-4 py-2 rounded-pill bg-kosha-surface-2 border border-kosha-border text-ink-2"
            >
              Go home
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
