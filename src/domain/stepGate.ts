/**
 * @fileoverview Shared day-editor export gate (domain).
 *
 * The day-level YAML download must fail closed: it may only fire when every prerequisite
 * step is valid AND the authoritative `export` status has zero error-severity issues. This is
 * the SINGLE place that decision lives, so every consumer agrees — the step-nav click gate,
 * the keyboard stepper, the Export step's own download handler, and the workflow-status helper
 * (`workflowStatus.getDayWorkflowStatus`). It lives in the domain layer (not a page folder) so
 * domain code can consult the same gate the UI enforces without a page→page or domain→page
 * import.
 */

import { STEP_STATUS } from './validation';

/**
 * Steps that must be valid before Export is reachable, in addition to the authoritative
 * `export` status. The data-entry steps gate on completeness; the `export` status gates on
 * zero error-severity validation issues (see {@link computeStepStatus}).
 */
const EXPORT_PREREQUISITE_STEPS: string[] = ['overview', 'devices', 'epochs', 'validation'];

/** A step-status map: `{ stepId: 'valid'|'incomplete'|'error'|'pending' }`. */
type StepStatusMap = Record<string, string> | null | undefined;

/**
 * Whether the Export step is reachable for the current validation state.
 *
 * Export unlocks only when every prerequisite step is valid AND the authoritative `export`
 * status is `'valid'` (zero error-severity issues). A schema/rule error that leaves the
 * data-entry steps "valid" (e.g. a device-field error the Devices completeness check ignores)
 * still keeps export closed.
 *
 * @param stepStatus - Status map: `{ stepId: 'valid'|'incomplete'|'error'|'pending' }`.
 * @returns True when Export may be reached / the download may fire.
 */
export function isExportEnabled(stepStatus: StepStatusMap): boolean {
  return (
    stepStatus?.export === STEP_STATUS.VALID &&
    EXPORT_PREREQUISITE_STEPS.every((stepId) => stepStatus?.[stepId] === STEP_STATUS.VALID)
  );
}

/**
 * Why Export is locked, so the UI can point the user at the right repair. Returns `null` when
 * Export is enabled. Distinguishes an incomplete prerequisite step (the user still has data to
 * enter) from an export-blocking validation error on a day whose steps all look complete (the
 * user must resolve errors, not revisit the already-finished steps).
 *
 * @param stepStatus - Status map.
 * @returns The reason Export is locked, or `null` when enabled.
 */
export function exportBlockReason(
  stepStatus: StepStatusMap
): 'incomplete-steps' | 'validation-errors' | null {
  if (isExportEnabled(stepStatus)) return null;
  const prerequisitesComplete = EXPORT_PREREQUISITE_STEPS.every(
    (stepId) => stepStatus?.[stepId] === STEP_STATUS.VALID
  );
  return prerequisitesComplete ? 'validation-errors' : 'incomplete-steps';
}
