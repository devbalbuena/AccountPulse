import { Component } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AccountPulse ErrorBoundary]', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleGoDashboard = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/dashboard'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Something went wrong in this view
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              AccountPulse caught an unexpected runtime error so your session and active timers remain safe.
            </p>
            {this.state.error?.message && (
              <div className="mt-3 p-2.5 rounded-lg bg-muted/60 border border-border text-left font-mono text-[11px] text-muted-foreground break-words max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="mt-5 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry View</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoDashboard}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-border bg-card hover:bg-muted text-foreground transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
