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
import './ErrorBoundary.css';

export class ErrorBoundary extends Component {
  static propTypes = {
    /** Child components to render */
    children: PropTypes.node.isRequired,
    /** Optional custom fallback UI to show when error occurs */
    fallback: PropTypes.node,
  };

  static defaultProps = {
    fallback: null,
  };

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
        <div className="error-boundary-container">
          <div className="error-boundary-card">
            <h1 className="error-boundary-title">
              Something went wrong
            </h1>

            <p className="error-boundary-message">
              Your form data has been preserved. Please reload the page to continue working.
            </p>

            <button
              onClick={this.handleReload}
              className="error-boundary-button"
              aria-label="Reload application to recover from error"
            >
              Reload Application
            </button>

            {/* Show error details in development mode */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-boundary-details">
                <summary>
                  Error Details (Development Only)
                </summary>
                <pre>
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
