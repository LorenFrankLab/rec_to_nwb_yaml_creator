/**
 * @fileoverview Boundary 1 of the validation contract — RAW-SHAPE validation.
 *
 * The app normalizes persisted state before merging/exporting (laundering a corrupt
 * `tasks: {}` into `[]`, a malformed override into a snapshot fallback, etc.). That is
 * safe for clean user-entered data but DANGEROUS for restored/imported corrupt state:
 * the corruption dissolves into a default and validation — which runs on the NORMALIZED
 * merged model — never sees it. Export then proceeds with silently-emptied data.
 *
 * The contract: **the export gate validates raw shape AND normalized content;
 * normalization only produces bytes, never decides validity.** These validators run on
 * the PERSISTED object (the raw day/animal), before any merge, and block export on a
 * corrupt shape regardless of how the merge would launder it.
 *
 * Every issue THIS MODULE produces carries the explicit ownership contract
 * (`ownerSurface`/`repairStep`/`focusPath`), with the legacy `repairSurface`/`step`/`path`
 * mirrored. (System-wide this is not yet universal — `dayOverrideIssues` and AJV schema
 * issues still resolve their surface via the fallback chain in `repairTargetForIssue`;
 * `normalizeIssue` at the `validateDay` boundary is what guarantees EVERY emitted issue
 * ends up with a resolved `ownerSurface`/`focusPath`.)
 */

/**
 * Whether `value` is a plain object record (not null, not an array).
 * @param {*} value
 * @returns {boolean}
 */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The day-owned ARRAY fields whose persisted shape the merge would launder to `[]`.
 * The owning Day-Editor step (`repairStep`) and a human label are shared with the UI
 * reset controls (one source of truth), so a flagged collection is repairable on the
 * step that renders it.
 *
 * @type {Array<{ key: string, repairStep: string, label: string }>}
 */
export const RAW_DAY_ARRAY_FIELDS = [
  { key: 'tasks', repairStep: 'epochs', label: 'tasks' },
  { key: 'associated_files', repairStep: 'epochs', label: 'associated files' },
  { key: 'associated_video_files', repairStep: 'epochs', label: 'associated video files' },
  { key: 'behavioral_events', repairStep: 'epochs', label: 'behavioral events' },
  { key: 'fs_gui_yamls', repairStep: 'epochs', label: 'FsGUI protocol files' },
  { key: 'keywords', repairStep: 'overview', label: 'keywords' },
];

/**
 * The animal-owned ARRAY fields. A corrupt one routes to the Animal Editor. Each carries
 * its executable repair command (Phase 2): cameras reset to none, and the device
 * configuration history REBUILT from the animal's current devices (not emptied — an empty
 * history would itself fail the merge), with a label that names that distinction.
 *
 * @type {Array<{ key: string, label: string, repairCommand: object, actionLabel?: string }>}
 */
export const RAW_ANIMAL_ARRAY_FIELDS = [
  { key: 'cameras', label: 'cameras', repairCommand: { type: 'resetAnimalCameras' } },
  {
    key: 'configurationHistory',
    label: 'device configuration history',
    repairCommand: { type: 'rebuildConfigurationHistory' },
    actionLabel: 'Rebuild device configuration history',
  },
];

/**
 * Build a malformed-collection issue in the explicit ownership contract.
 *
 * @param {object} opts
 * @param {string} opts.code - Issue code.
 * @param {string} opts.field - The corrupt field key (also the focus anchor).
 * @param {'day'|'animal'} opts.ownerSurface - Who can edit the fix.
 * @param {string} opts.repairStep - The owning step id (day) — used for routing/focus.
 * @param {string} opts.label - Human label for the collection.
 * @param {object} [opts.repairCommand] - The serializable executable repair (Phase 2);
 *   executing it performs the reset this issue describes (see `repairCommands.js`).
 * @param {string} [opts.actionLabel] - Override the default `Reset ${label}` button label
 *   (e.g. "Rebuild …" for a configurationHistory rebuild rather than an empty reset).
 * @returns {object} Issue.
 */
function malformedCollectionIssue({ code, field, ownerSurface, repairStep, label, repairCommand, actionLabel }) {
  const where = ownerSurface === 'day'
    ? 'It is treated as empty on export, which would silently drop data'
    : 'It shadows valid data and blocks export';
  return {
    code,
    severity: 'error',
    field,
    // Explicit ownership contract (Boundary 2).
    ownerSurface,
    repairStep,
    focusPath: field,
    actionLabel: actionLabel || `Reset ${label}`,
    // The executable repair: a button can run this to PERFORM the reset, not just navigate.
    repairCommand,
    // Legacy mirror — consumers read these until Boundary 2 migration.
    repairSurface: ownerSurface,
    step: repairStep,
    path: field,
    message:
      `This ${ownerSurface}'s "${field}" is corrupt (expected a list). ${where} — reset it to clear this error.`,
  };
}

/**
 * Validate a RAW (persisted, pre-merge) day's owned array collections. A present
 * non-array value is corruption the merge would launder; surface it as a blocking,
 * day-routed, repairable issue.
 *
 * @param {object} day - The persisted day record.
 * @returns {Array} Raw-shape issues (empty for a clean or non-record day).
 */
export function validateRawDay(day) {
  if (!isRecord(day)) return [];
  const issues = [];
  for (const { key, repairStep, label } of RAW_DAY_ARRAY_FIELDS) {
    const value = day[key];
    if (value != null && !Array.isArray(value)) {
      issues.push(
        malformedCollectionIssue({
          code: 'malformed_day_collection',
          field: key,
          ownerSurface: 'day',
          repairStep,
          label,
          repairCommand: { type: 'resetDayCollection', field: key },
        })
      );
    }
  }
  return issues;
}

/**
 * Validate a RAW (persisted) animal's owned array collections.
 *
 * @param {object} animal - The persisted animal record.
 * @returns {Array} Raw-shape issues (empty for a clean or non-record animal).
 */
export function validateRawAnimal(animal) {
  if (!isRecord(animal)) return [];
  const issues = [];
  for (const { key, label, repairCommand, actionLabel } of RAW_ANIMAL_ARRAY_FIELDS) {
    const value = animal[key];
    if (value != null && !Array.isArray(value)) {
      issues.push(
        malformedCollectionIssue({
          code: 'malformed_animal_collection',
          field: key,
          ownerSurface: 'animal',
          // An animal-collection fix has no day data-entry step that owns it (the repair
          // is in the Animal Editor); route the day-step grouping to the catch-all so it
          // doesn't mislabel a specific day step.
          repairStep: 'validation',
          label,
          repairCommand,
          actionLabel,
        })
      );
    }
  }

  // A corrupt (non-array) nested `devices.data_acq_device` is laundered to `[]` by
  // normalizeDevices and blocked only by the schema's generic minItems message. Surface a
  // precise animal-routed issue so the user sees "corrupt (expected a list)".
  const daq = isRecord(animal.devices) ? animal.devices.data_acq_device : undefined;
  if (daq != null && !Array.isArray(daq)) {
    issues.push(
      malformedCollectionIssue({
        code: 'malformed_animal_collection',
        field: 'data_acq_device',
        ownerSurface: 'animal',
        repairStep: 'validation',
        label: 'data acquisition devices',
        repairCommand: { type: 'resetDataAcqDevice' },
      })
    );
  }

  // A MISSING (null/undefined) or EMPTY ([]) configurationHistory on a REAL animal can
  // resolve no day's probe geometry — `resolveDayConfig` throws and export fails closed.
  // Phase 2 makes that REPAIRABLE rather than only blocked: surface a commandable rebuild
  // issue whose `rebuildConfigurationHistory` command reseeds a v1 snapshot from the
  // animal's current devices. "Real animal" is gated on a `devices` record so this never
  // false-fires on the minimal animal stubs some callers pass (which have no devices). A
  // non-array history is NOT handled here — it is the laundering shape already flagged as
  // `malformed_animal_collection` above (also with a rebuild command) — so the two never
  // double-flag the same animal.
  const history = animal.configurationHistory;
  const historyMissingOrEmpty =
    history == null || (Array.isArray(history) && history.length === 0);
  if (isRecord(animal.devices) && historyMissingOrEmpty) {
    issues.push({
      code: 'missing_configuration_history',
      severity: 'error',
      field: 'configurationHistory',
      ownerSurface: 'animal',
      repairStep: 'validation',
      focusPath: 'configurationHistory',
      actionLabel: 'Rebuild device configuration history',
      repairCommand: { type: 'rebuildConfigurationHistory' },
      // Legacy mirror — consumers read these until Boundary 2 migration.
      repairSurface: 'animal',
      step: 'validation',
      path: 'configurationHistory',
      message:
        `This animal's device configuration history is missing or empty, so no recording day ` +
        `can resolve its probe geometry to export. Rebuild it from the animal's current devices ` +
        `to clear this error.`,
    });
  }

  return issues;
}
