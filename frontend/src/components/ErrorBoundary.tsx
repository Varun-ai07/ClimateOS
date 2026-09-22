import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('UI error boundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-decided/5 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-alert/30 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-alert mb-2">Something went wrong</h2>
            <p className="text-sm text-ink/80 mb-4">
              The dashboard hit an unexpected error. You can try reloading the page or switching to another city.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink/90"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
