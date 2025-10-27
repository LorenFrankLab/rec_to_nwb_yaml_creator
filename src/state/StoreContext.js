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

import { createContext, useContext } from 'react';
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
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Provider component
 *
 * @example
 * <StoreProvider>
 *   <App />
 * </StoreProvider>
 */
export function StoreProvider({ children }) {
  const store = useStore(); // Created ONCE at top level

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

StoreProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * useStoreContext Hook
 *
 * Provides access to the shared store from any component within StoreProvider.
 * Throws an error if used outside StoreProvider to prevent silent bugs.
 *
 * @returns {Object} Store object
 * @returns {Object} return.model - Current form state (read-only)
 * @returns {Object} return.actions - State mutation functions
 * @returns {Object} return.selectors - Computed/derived data functions
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
