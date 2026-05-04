import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: 24,
          textAlign: 'center',
        }}>
          <h2 style={{ marginBottom: 16 }}>页面出现错误</h2>
          <p style={{ color: '#666', marginBottom: 24, maxWidth: 600 }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 24px',
              fontSize: 14,
              cursor: 'pointer',
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              background: '#fff',
            }}
          >
            重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
