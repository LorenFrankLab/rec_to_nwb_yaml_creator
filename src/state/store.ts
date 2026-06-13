import { useMemo } from 'react';
import { useLegacyForm } from './useLegacyForm';
import { useWorkspace } from './useWorkspace';
import { useEpochCleanup } from './useEpochCleanup';
import type { InitialWorkspaceState } from './workspaceHydration';

/**
 * Lightweight store facade that provides unified access to form state, actions, and selectors.
 *
 * Composed from three focused hooks:
 * - {@link useLegacyForm} — the legacy single-session `formData` slice (backward compatible).
 * - {@link useWorkspace} — multi-animal / multi-day workspace state, its persistence, and actions.
 * - {@link useEpochCleanup} — the cross-slice data-integrity effect that clears orphaned
 *   task-epoch references from associated files (legacy form AND workspace days).
 *
 * The public shape returned here (`{ model, selectors, actions, persistence }`) is the same
 * object graph today's consumers (e.g. `StoreContext`) rely on.
 *
 * @param initialState - Optional initial state (defaults to defaultYMLValues)
 * @returns The store object (`{ model, selectors, actions, persistence }`).
 *
 * @example
 * // Legacy single-session mode (backward compatible)
 * const { model, actions, selectors } = useStore();
 * const sessionId = model.session_id;
 * actions.updateFormData('session_id', 'experiment_001');
 *
 * @example
 * // Workspace mode (multi-animal)
 * const { model, actions, selectors } = useStore();
 * const animal = model.workspace.animals['remy'];
 * actions.createAnimal('remy', { species: 'Rattus norvegicus', ... });
 * const days = selectors.getAnimalDays('remy');
 */
export function useStore(initialState: InitialWorkspaceState | null = null) {
  // `useLegacyForm` is still untyped JS (the legacy form slice, converted in a later phase); treat
  // its result loosely until then.
  const { formData, setFormData, legacyActions, legacySelectors }: any = useLegacyForm(initialState);
  const { workspace, workspaceActions, workspaceSelectors, persistence } = useWorkspace(initialState);

  // Cross-slice data integrity: clear orphaned task epochs from associated files,
  // for both the legacy form and every workspace day.
  useEpochCleanup({ formData, setFormData, workspace, updateDay: workspaceActions.updateDay });

  // Actions combine all mutation functions; same key set as before the decomposition.
  const actions = useMemo(
    () => ({ ...legacyActions, ...workspaceActions }),
    [legacyActions, workspaceActions]
  );

  // Selectors combine legacy (formData-derived) and workspace (workspace-derived) selectors.
  const selectors = useMemo(
    () => ({ ...legacySelectors, ...workspaceSelectors }),
    [legacySelectors, workspaceSelectors]
  );

  // Memoize model to prevent unnecessary re-renders; only rebuild when formData or
  // workspace actually change. `formData` is initialized to defaultYMLValues and never
  // set to a falsy value, so an undefined here is a real bug — fail loudly rather than
  // masking it with a silent fallback.
  const model = useMemo(() => {
    if (!formData) {
      throw new Error('useStore: formData is undefined');
    }
    return { ...formData, workspace };
  }, [formData, workspace]);

  return {
    model,
    selectors,
    actions,
    persistence,
  };
}
