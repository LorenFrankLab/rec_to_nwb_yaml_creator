import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useLegacyForm } from './useLegacyForm';
import { useWorkspace } from './useWorkspace';
import { useEpochCleanup } from './useEpochCleanup';
import { createWorkspaceActions } from './workspaceActions';
import type { InitialWorkspaceState } from './workspaceHydration';
import type { Workspace } from './workspaceTypes';
import type { WorkspacePersistence } from './useWorkspacePersistence';

// The legacy JavaScript form remains permissive, but it is contained here instead of allowing one
// `any` destructure to erase the typed workspace API returned by this facade.
type LegacyFormModel = Record<string, any>;
type LegacyActions = Record<string, (...args: any[]) => any>;
interface LegacySelectors {
  getCameraIds: () => string[];
  getTaskEpochs: () => number[];
  getDioEvents: () => string[];
  [key: string]: (...args: any[]) => any;
}
interface LegacyStoreSlice {
  formData: LegacyFormModel;
  setFormData: Dispatch<SetStateAction<LegacyFormModel>>;
  legacyActions: LegacyActions;
  legacySelectors: LegacySelectors;
}

export type WorkspaceActions = ReturnType<typeof createWorkspaceActions>;
export interface WorkspaceSelectors {
  getAnimalDays: ReturnType<typeof useWorkspace>['workspaceSelectors']['getAnimalDays'];
}
export interface StoreValue {
  model: LegacyFormModel & { workspace: Workspace };
  actions: LegacyActions & WorkspaceActions;
  selectors: LegacySelectors & WorkspaceSelectors;
  persistence: WorkspacePersistence;
}

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
export function useStore(initialState: InitialWorkspaceState | null = null): StoreValue {
  const { formData, setFormData, legacyActions, legacySelectors } =
    useLegacyForm(initialState) as unknown as LegacyStoreSlice;
  const { workspace, workspaceActions, workspaceSelectors, persistence } = useWorkspace(initialState);

  // Cross-slice data integrity: clear orphaned task epochs from associated files,
  // for both the legacy form and every workspace day.
  useEpochCleanup({ formData, setFormData });

  // Actions combine all mutation functions; same key set as before the decomposition.
  const actions = useMemo<LegacyActions & WorkspaceActions>(
    () => ({ ...legacyActions, ...workspaceActions }),
    [legacyActions, workspaceActions]
  );

  // Selectors combine legacy (formData-derived) and workspace (workspace-derived) selectors.
  const selectors = useMemo<LegacySelectors & WorkspaceSelectors>(
    () => ({ ...legacySelectors, ...workspaceSelectors }),
    [legacySelectors, workspaceSelectors]
  );

  // Memoize model to prevent unnecessary re-renders; only rebuild when formData or
  // workspace actually change. `formData` is initialized to defaultYMLValues and never
  // set to a falsy value, so an undefined here is a real bug — fail loudly rather than
  // masking it with a silent fallback.
  const model = useMemo<LegacyFormModel & { workspace: Workspace }>(() => {
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
