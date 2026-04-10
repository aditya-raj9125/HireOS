'use client'

import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center px-4 py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-base font-medium text-neutral-700">
            Something went wrong
          </h3>
          <p className="mt-1 text-sm text-neutral-400">
            An unexpected error occurred. Please try again.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-4 max-w-lg overflow-auto rounded-lg bg-neutral-100 p-4 text-xs text-red-600">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm text-white transition-colors hover:bg-brand-600"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
