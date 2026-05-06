import { Component, type ReactNode, type ErrorInfo } from 'react'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <p className="text-5xl mb-4">😵</p>
          <h2 className="text-xl font-bold text-gray-700 mb-2">Có lỗi xảy ra</h2>
          <p className="text-gray-500 text-sm mb-4 max-w-sm">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            Thử lại
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
