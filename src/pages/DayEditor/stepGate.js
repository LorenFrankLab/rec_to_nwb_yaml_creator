/**
 * Shared day-editor export gate.
 *
 * The day-level YAML download must fail closed: it may only fire when the day has
 * no error-severity validation issues. This single helper is the one place that
 * decides whether Export is reachable, so every route into Export — the step-nav
 * click gate, the keyboard stepper shortcut, and the Export step's own download
 * handler — agrees. Keeping the step-id list here (rather than duplicated in each
 * caller) prevents the routes from drifting apart.
 *
 * @module pages/DayEditor/stepGate
 */

/**
 * Steps that must be valid before Export is reachable, in addition to the
 * authoritative `export` status. The data-entry steps gate on completeness; the
 * `export` status gates on zero error-severity validation issues (see
 * {@link module:pages/DayEditor/validation.computeStepStatus}).
 *
 * @type {string[]}
 */
const EXPORT_PREREQUISITE_STEPS = ['overview', 'devices', 'epochs', 'validation'];

/**
 * Whether the Export step is reachable for the current validation state.
 *
 * Export unlocks only when every prerequisite step is valid AND the authoritative
 * `export` status is `'valid'` (zero error-severity issues). A schema/rule error
 * that leaves the data-entry steps "valid" (e.g. a device-field error the Devices
 * completeness check ignores) still keeps export closed.
 *
 * @param {object} stepStatus - Status map: `{ stepId: 'valid'|'incomplete'|'error'|'pending' }`.
 * @returns {boolean} True when Export may be reached / the download may fire.
 */
export function isExportEnabled(stepStatus) {
  return (
    stepStatus?.export === 'valid' &&
    EXPORT_PREREQUISITE_STEPS.every((stepId) => stepStatus?.[stepId] === 'valid')
  );
}

/**
 * Why Export is locked, so the UI can point the user at the right repair. Returns
 * `null` when Export is enabled. Distinguishes an incomplete prerequisite step
 * (the user still has data to enter) from an export-blocking validation error on a
 * day whose steps all look complete (the user must resolve errors, not revisit the
 * already-finished steps).
 *
 * @param {object} stepStatus - Status map.
 * @returns {'incomplete-steps'|'validation-errors'|null}
 */
export function exportBlockReason(stepStatus) {
  if (isExportEnabled(stepStatus)) return null;
  const prerequisitesComplete = EXPORT_PREREQUISITE_STEPS.every(
    (stepId) => stepStatus?.[stepId] === 'valid'
  );
  return prerequisitesComplete ? 'validation-errors' : 'incomplete-steps';
}
