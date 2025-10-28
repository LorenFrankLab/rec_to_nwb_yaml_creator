/**
 * StoreContext - React Context Provider for shared store
 *
 * Provides a single shared store instance to all components in the tree.
 * Eliminates prop drilling by allowing components to access store via useStoreContext hook.
 *
 * Architecture:
 * - StoreProvider creates store ONCE at the top of the component tree
 * - useStoreContext allows any descendant component to access the shared store
 * - All components share the same state instance (no more separate useState calls)
 *
 * @example
 * // In index.js or App.js
 * import { StoreProvider } from './state/StoreContext';
 *
 * function App() {
 *   return (
 *     <StoreProvider>
 *       <MyComponents />
 *     </StoreProvider>
 *   );
 * }
 *
 * @example
 * // In any component
 * import { useStoreContext } from './state/StoreContext';
 *
 * function MyComponent() {
 *   const { model, actions, selectors } = useStoreContext();
 *
 *   return (
 *     <div>
 *       <p>Session: {model.session_id}</p>
 *       <button onClick={() => actions.updateFormData('session_id', 'new-id')}>
 *         Update
 *       </button>
 *     </div>
 *   );
 * }
 */

import { createContext, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useStore } from './store';

/**
 * React Context for the store.
 * Provides access to shared form state, actions, and selectors.
 */
const StoreContext = createContext(null);

/**
 * StoreProvider Component
 *
 * Creates a single store instance and provides it to all descendant components.
 * Must wrap the entire component tree that needs access to the store.
 *
 * Performance Optimization (P0.4):
 * Memoizes the context value to prevent unnecessary re-renders of all consumers
 * when the store object reference changes. Without memoization, every formData change
 * would create a new store object, causing ALL consumers to re-render even if their
 * specific slice of data hasn't changed.
 *
 * The memoization ensures that:
 * - model (formData) is only updated when data actually changes
 * - actions and selectors maintain stable references (they're already memoized in useStore)
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {object} [props.initialState] - Optional initial state for the store (for testing)
 * @returns {JSX.Element} Provider component
 *
 * @example
 * <StoreProvider>
 *   <App />
 * </StoreProvider>
 *
 * @example
 * // With initial state (useful for testing)
 * <StoreProvider initialState={{ subject: { subject_id: 'rat01' } }}>
 *   <SubjectFields />
 * </StoreProvider>
 */
export function StoreProvider({ children, initialState }) {
  const store = useStore(initialState);

  // Memoize context value to prevent unnecessary re-renders
  // useStore returns a new object { model, actions, selectors } on every render,
  // but actions and selectors are already memoized internally via useMemo.
  // We recreate the store object here only when the dependencies actually change.
  // This prevents ALL context consumers from re-rendering when unrelated state changes.
  const memoizedStore = useMemo(
    () => ({
      model: store.model,
      actions: store.actions,
      selectors: store.selectors,
    }),
    [store.model, store.actions, store.selectors]
  );

  return (
    <StoreContext.Provider value={memoizedStore}>
      {children}
    </StoreContext.Provider>
  );
}

StoreProvider.propTypes = {
  children: PropTypes.node.isRequired,
  initialState: PropTypes.object,
};

/**
 * useStoreContext Hook
 *
 * Provides access to the shared store from any component within StoreProvider.
 * Throws an error if used outside StoreProvider to prevent silent bugs.
 *
 * @returns {object} Store object
 * @returns {object} return.model - Current form state (read-only)
 * @returns {object} return.actions - State mutation functions
 * @returns {object} return.selectors - Computed/derived data functions
 *
 * @throws {Error} If used outside StoreProvider
 *
 * @example
 * function MyComponent() {
 *   const { model, actions, selectors } = useStoreContext();
 *
 *   // Read state
 *   const sessionId = model.session_id;
 *
 *   // Update state
 *   actions.updateFormData('session_id', 'new-value');
 *
 *   // Use selectors
 *   const cameraIds = selectors.getCameraIds();
 *
 *   return <div>Session: {sessionId}</div>;
 * }
 */
export function useStoreContext() {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error('useStoreContext must be used within StoreProvider');
  }

  return context;
}
