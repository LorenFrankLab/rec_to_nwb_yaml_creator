import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Animal, Day } from '../../state/workspaceTypes';

/**
 * The per-day bundle every Day-Editor section needs to render and edit a day. `mergedDay` and
 * `actions` are intentionally loose (the merged-metadata object and the store-action factory);
 * canonical types are used where load-bearing.
 */
export interface DayEditorBundle {
  animal: Animal;
  day: Day;
  mergedDay: Record<string, unknown>;
  animalDays: Day[];
  onFieldUpdate: (fieldPath: string, value: unknown) => void;
  actions: Record<string, unknown>;
  animalKey: string;
}

/**
 * Shared Day-Editor context: the per-day bundle every section needs to render and edit a day —
 * `{ animal, day, mergedDay, animalDays, onFieldUpdate, actions, animalKey }`.
 *
 * `DayEditorStepper` resolves these once (owner key, merged metadata, the animal's days, the
 * field-update writer, store actions) and provides them here, so the section components don't
 * receive the same seven props drilled through identically on every render. Section-specific
 * props (e.g. `onNavigate`, `onRepair`, `copyableDioSources`) are NOT
 * part of this bundle and stay as ordinary props on the sections that use them.
 *
 * The default is `null` so a section rendered WITHOUT a provider (isolated unit tests, which pass
 * the bundle as props) falls back to its props — see {@link useDayEditorContext}.
 */
export const DayEditorContext = createContext<DayEditorBundle | null>(null);

interface DayEditorProviderProps {
  /** The bundle (the seven shared fields). */
  value: DayEditorBundle;
  children?: ReactNode;
}

/**
 * Provide the shared Day-Editor bundle to the section subtree.
 */
export function DayEditorProvider({ value, children }: DayEditorProviderProps) {
  return <DayEditorContext.Provider value={value}>{children}</DayEditorContext.Provider>;
}

/**
 * Read the shared Day-Editor bundle, falling back to the section's own props when no provider is
 * present. Inside `DayEditorStepper` the provider supplies all seven fields; isolated renders
 * (unit tests) pass them as props instead — so a section never has to know which wiring it got,
 * and the seven shared props never have to be drilled through the stepper's JSX.
 */
export function useDayEditorContext(fallbackProps: DayEditorBundle): DayEditorBundle {
  return useContext(DayEditorContext) ?? fallbackProps;
}
