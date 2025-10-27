/**
 * Tests for StoreContext - React Context Provider for shared store
 *
 * Tests verify:
 * 1. StoreProvider creates a single shared store instance
 * 2. useStoreContext provides access to the shared store
 * 3. Multiple components share the same state
 * 4. Error handling when used outside provider
 * 5. State updates propagate to all consumers
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../StoreContext';

// Test component that uses the store context
function TestConsumer({ testId = 'consumer' }) {
  const { model, actions, selectors } = useStoreContext();

  return (
    <div data-testid={testId}>
      <div data-testid="session-id">{model.session_id || 'empty'}</div>
      <div data-testid="camera-count">{selectors.getCameraIds().length}</div>
      <button
        data-testid="update-session"
        onClick={() => actions.updateFormData('session_id', 'test-session-123')}
      >
        Update Session
      </button>
    </div>
  );
}

describe('StoreContext', () => {
  describe('Provider Creation', () => {
    it('should create a StoreProvider that wraps children', () => {
      render(
        <StoreProvider>
          <TestConsumer />
        </StoreProvider>
      );

      expect(screen.getByTestId('consumer')).toBeInTheDocument();
    });

    it('should provide store to nested children', () => {
      render(
        <StoreProvider>
          <div>
            <div>
              <TestConsumer />
            </div>
          </div>
        </StoreProvider>
      );

      expect(screen.getByTestId('session-id')).toHaveTextContent('empty');
    });

    it('should initialize store with default values', () => {
      render(
        <StoreProvider>
          <TestConsumer />
        </StoreProvider>
      );

      expect(screen.getByTestId('session-id')).toHaveTextContent('empty');
      expect(screen.getByTestId('camera-count')).toHaveTextContent('0');
    });
  });

  describe('useStoreContext Hook', () => {
    it('should provide model, actions, and selectors', () => {
      let hookResult;

      function TestComponent() {
        hookResult = useStoreContext();
        return <div>Test</div>;
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      );

      expect(hookResult).toHaveProperty('model');
      expect(hookResult).toHaveProperty('actions');
      expect(hookResult).toHaveProperty('selectors');
    });

    it('should throw error when used outside StoreProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = () => {};

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useStoreContext must be used within StoreProvider');

      console.error = originalError;
    });
  });

  describe('Shared State Between Components', () => {
    it('should share the same store instance between multiple consumers', async () => {
      const user = userEvent.setup();

      render(
        <StoreProvider>
          <TestConsumer testId="consumer-1" />
          <TestConsumer testId="consumer-2" />
        </StoreProvider>
      );

      // Both consumers should show same initial state
      expect(screen.getAllByTestId('session-id')[0]).toHaveTextContent('empty');
      expect(screen.getAllByTestId('session-id')[1]).toHaveTextContent('empty');

      // Update from consumer 1
      await user.click(screen.getAllByTestId('update-session')[0]);

      // Both consumers should reflect the update
      expect(screen.getAllByTestId('session-id')[0]).toHaveTextContent('test-session-123');
      expect(screen.getAllByTestId('session-id')[1]).toHaveTextContent('test-session-123');
    });

    it('should persist state across re-renders (same provider instance)', async () => {
      const user = userEvent.setup();

      const { rerender } = render(
        <StoreProvider>
          <TestConsumer />
        </StoreProvider>
      );

      // Update state
      await user.click(screen.getByTestId('update-session'));
      expect(screen.getByTestId('session-id')).toHaveTextContent('test-session-123');

      // Re-render with same provider (does NOT create new store)
      rerender(
        <StoreProvider>
          <TestConsumer />
        </StoreProvider>
      );

      // State persists because it's the SAME provider instance
      // This is correct React behavior - provider maintains state across re-renders
      expect(screen.getByTestId('session-id')).toHaveTextContent('test-session-123');
    });
  });

  describe('Store Actions', () => {
    it('should expose updateFormData action', async () => {
      const user = userEvent.setup();

      render(
        <StoreProvider>
          <TestConsumer />
        </StoreProvider>
      );

      await user.click(screen.getByTestId('update-session'));
      expect(screen.getByTestId('session-id')).toHaveTextContent('test-session-123');
    });

    it('should expose all array management actions', () => {
      let hookResult;

      function TestComponent() {
        hookResult = useStoreContext();
        return <div>Test</div>;
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      );

      expect(hookResult.actions).toHaveProperty('addArrayItem');
      expect(hookResult.actions).toHaveProperty('removeArrayItem');
      expect(hookResult.actions).toHaveProperty('duplicateArrayItem');
    });

    it('should expose all electrode group actions', () => {
      let hookResult;

      function TestComponent() {
        hookResult = useStoreContext();
        return <div>Test</div>;
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      );

      expect(hookResult.actions).toHaveProperty('nTrodeMapSelected');
      expect(hookResult.actions).toHaveProperty('removeElectrodeGroupItem');
      expect(hookResult.actions).toHaveProperty('duplicateElectrodeGroupItem');
    });
  });

  describe('Store Selectors', () => {
    it('should expose getCameraIds selector', () => {
      let hookResult;

      function TestComponent() {
        hookResult = useStoreContext();
        return <div>Test</div>;
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      );

      expect(hookResult.selectors).toHaveProperty('getCameraIds');
      expect(hookResult.selectors.getCameraIds()).toEqual([]);
    });

    it('should expose getTaskEpochs selector', () => {
      let hookResult;

      function TestComponent() {
        hookResult = useStoreContext();
        return <div>Test</div>;
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      );

      expect(hookResult.selectors).toHaveProperty('getTaskEpochs');
      expect(hookResult.selectors.getTaskEpochs()).toEqual([]);
    });

    it('should expose getDioEvents selector', () => {
      let hookResult;

      function TestComponent() {
        hookResult = useStoreContext();
        return <div>Test</div>;
      }

      render(
        <StoreProvider>
          <TestComponent />
        </StoreProvider>
      );

      expect(hookResult.selectors).toHaveProperty('getDioEvents');
      expect(hookResult.selectors.getDioEvents()).toEqual([]);
    });
  });

  describe('Integration with Testing Library', () => {
    it('should work with render helper from test-utils', () => {
      const { container } = render(
        <StoreProvider>
          <TestConsumer />
        </StoreProvider>
      );

      expect(container.querySelector('[data-testid="consumer"]')).toBeInTheDocument();
    });
  });
});
