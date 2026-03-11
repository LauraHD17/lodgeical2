// src/components/shared/ErrorBoundary.jsx
// Top-level error boundary — catches unhandled render errors and shows a
// recovery UI so the whole app doesn't white-screen.

import { Component } from 'react'
import { ErrorState } from './ErrorState'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <ErrorState
            title="Something went wrong"
            message="An unexpected error occurred. Please reload the page to continue."
            onRetry={this.handleReload}
          />
        </div>
      )
    }

    return this.props.children
  }
}
