import { createContext, useContext } from 'react';
import PropTypes from 'prop-types';

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
 *
 * @type {import('react').Context<null | {
 *   animal: object,
 *   day: object,
 *   mergedDay: object,
 *   animalDays: object[],
 *   onFieldUpdate: Function,
 *   actions: object,
 *   animalKey: string,
 * }>}
 */
export const DayEditorContext = createContext(null);

/**
 * Provide the shared Day-Editor bundle to the section subtree.
 *
 * @param {object} props
 * @param {object} props.value - The bundle (the seven shared fields).
 * @param {import('react').ReactNode} props.children
 * @returns {JSX.Element}
 */
export function DayEditorProvider({ value, children }) {
  return <DayEditorContext.Provider value={value}>{children}</DayEditorContext.Provider>;
}

DayEditorProvider.propTypes = {
  value: PropTypes.object.isRequired,
  children: PropTypes.node,
};

/**
 * Read the shared Day-Editor bundle, falling back to the section's own props when no provider is
 * present. Inside `DayEditorStepper` the provider supplies all seven fields; isolated renders
 * (unit tests) pass them as props instead — so a section never has to know which wiring it got,
 * and the seven shared props never have to be drilled through the stepper's JSX.
 *
 * @param {object} fallbackProps - The section's props (the isolated-render fallback source).
 * @returns {object} The shared bundle (from context) or `fallbackProps` (no provider).
 */
export function useDayEditorContext(fallbackProps) {
  return useContext(DayEditorContext) ?? fallbackProps;
}
