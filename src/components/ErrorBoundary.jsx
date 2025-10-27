/**
 * @file Error Boundary Component
 * @description Catches JavaScript errors anywhere in component tree,
 * logs those errors, and displays fallback UI instead of crashing the app.
 *
 * This prevents users from losing hours of data entry work due to crashes.
 *
 * Error boundaries catch errors during rendering, in lifecycle methods,
 * and in constructors of the whole tree below them.
 *
 * They do NOT catch errors for:
 * - Event handlers (use try-catch)
 * - Asynchronous code (use try-catch)
 * - Server side rendering
 * - Errors thrown in the error boundary itself
 *
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state so the next render will show the fallback UI
   * Called during the "render" phase, so side effects are not allowed
   */
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log error details to console (and eventually to monitoring service)
   * Called during the "commit" phase, so side effects are allowed
   */
  componentDidCatch(error, errorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);

    // Store errorInfo in state for potential display in development mode
    this.setState({
      errorInfo,
    });

    // TODO: Send error to monitoring service (e.g., Sentry, LogRocket)
    // Example: logErrorToService(error, errorInfo);
  }

  /**
   * Handle reload button click
   */
  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            backgroundColor: '#f5f5f5',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '600px',
              padding: '2rem',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
            }}
          >
            <h1
              style={{
                color: '#d32f2f',
                fontSize: '1.5rem',
                marginBottom: '1rem',
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                color: '#666',
                fontSize: '1rem',
                lineHeight: '1.6',
                marginBottom: '1.5rem',
              }}
            >
              Your form data has been preserved. Please reload the page to continue working.
            </p>

            <button
              onClick={this.handleReload}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                color: 'white',
                backgroundColor: '#1976d2',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#1565c0';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#1976d2';
              }}
            >
              Reload Application
            </button>

            {/* Show error details in development mode */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details
                style={{
                  marginTop: '2rem',
                  textAlign: 'left',
                  padding: '1rem',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginBottom: '0.5rem',
                  }}
                >
                  Error Details (Development Only)
                </summary>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#d32f2f',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <>
                      {'\n\nComponent Stack:'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  /** Child components to render */
  children: PropTypes.node.isRequired,
  /** Optional custom fallback UI to show when error occurs */
  fallback: PropTypes.node,
};

ErrorBoundary.defaultProps = {
  fallback: null,
};
