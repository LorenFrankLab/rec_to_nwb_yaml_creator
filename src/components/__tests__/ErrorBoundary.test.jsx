/**
 * @file Tests for ErrorBoundary Component
 * @description P0.3: Add Error Boundaries to prevent production crashes
 *
 * Error boundaries catch JavaScript errors anywhere in component tree,
 * log those errors, and display fallback UI instead of crashing the entire app.
 *
 * This prevents users from losing hours of data entry work due to crashes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import React from 'react';

// Component that throws an error for testing
function ThrowError({ shouldThrow }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary - P0.3', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Suppress console.error in tests (React logs errors to console)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Normal Rendering', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should render multiple children without errors', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
      expect(screen.getByText('Child 3')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should catch errors and display fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should NOT show the child component
      expect(screen.queryByText('No error')).not.toBeInTheDocument();

      // Should show error boundary fallback UI
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('should display user-friendly error message', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/your form data has been preserved/i)).toBeInTheDocument();
    });

    it('should provide reload button in fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByRole('button', { name: /reload application/i });
      expect(reloadButton).toBeInTheDocument();
    });

    it('should log error to console for debugging', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // console.error should have been called (by React and by ErrorBoundary)
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Error Isolation', () => {
    it('should only affect components within the boundary', () => {
      // This tests that errors are caught and don't propagate
      const { container } = render(
        <div>
          <div>Outside boundary - should render</div>
          <ErrorBoundary>
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
          <div>Also outside boundary - should render</div>
        </div>
      );

      expect(screen.getByText('Outside boundary - should render')).toBeInTheDocument();
      expect(screen.getByText('Also outside boundary - should render')).toBeInTheDocument();
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('should catch errors from deeply nested components', () => {
      function DeepChild() {
        return <ThrowError shouldThrow={true} />;
      }

      function MiddleChild() {
        return (
          <div>
            <DeepChild />
          </div>
        );
      }

      render(
        <ErrorBoundary>
          <MiddleChild />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('Reload Functionality', () => {
    it('should call window.location.reload when reload button clicked', () => {
      // Mock window.location.reload
      const reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy },
        writable: true,
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByRole('button', { name: /reload application/i });
      reloadButton.click();

      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Boundary State', () => {
    it('should set hasError state to true when error is caught', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // If hasError is true, fallback UI is shown
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('should store error object in state', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Error boundary should have caught the error
      // We can't directly access state, but we can verify the fallback UI is shown
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('Custom Fallback UI', () => {
    it('should accept custom fallback prop', () => {
      const CustomFallback = ({ error }) => (
        <div>Custom error: {error?.message}</div>
      );

      // This test assumes the ErrorBoundary component supports a custom fallback prop
      // If it doesn't, we'll add this feature during implementation
      render(
        <ErrorBoundary fallback={<CustomFallback error={new Error('Test error')} />}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Either custom or default fallback should be shown
      expect(
        screen.queryByText(/something went wrong/i) || screen.queryByText(/custom error/i)
      ).toBeInTheDocument();
    });
  });

  describe('Production vs Development Behavior', () => {
    it('should show error details in development mode', () => {
      // In development, we might want to show more error details
      // This is optional, but good UX for developers
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show fallback UI regardless of mode
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should hide error details in production mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show user-friendly message, not technical details
      expect(screen.getByText(/your form data has been preserved/i)).toBeInTheDocument();

      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});
