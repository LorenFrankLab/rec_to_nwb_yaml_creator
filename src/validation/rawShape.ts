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

/** A serializable executable repair command (run by `repairCommands.js` to perform the reset). */
export interface RepairCommand {
  type: string;
  field?: string;
}

/**
 * A raw-shape validation issue, in the explicit ownership contract (`ownerSurface`/`repairStep`/
 * `focusPath` + the executable `repairCommand`) with the legacy `repairSurface`/`step`/`path`
 * mirror. Distinct from the rules' {@link module:validation/issueTypes.ValidationIssue} (a wider
 * shape that carries ownership + a repair command); kept local like `taskCatalogValidation`'s
 * `CatalogValidationIssue`.
 */
export interface RawShapeIssue {
  /** Stable issue code (`malformed_day_collection`, `missing_configuration_history`, …). */
  code: string;
  /** Always a blocking error. */
  severity: 'error';
  /** The corrupt field key (also the focus anchor). */
  field: string;
  /** Who can edit the fix. */
  ownerSurface: 'day' | 'animal';
  /** The owning step id (used for day-step grouping / focus). */
  repairStep: string;
  /** Explicit focus anchor for repair deep-linking. */
  focusPath: string;
  /** Repair call-to-action label. */
  actionLabel: string;
  /** The serializable executable repair (a button can run it to perform the reset). */
  repairCommand?: RepairCommand;
  /** Legacy mirror of `ownerSurface` (consumers read until Boundary 2 migration). */
  repairSurface: 'day' | 'animal';
  /** Legacy mirror of `repairStep`. */
  step: string;
  /** Legacy mirror of `focusPath`. */
  path: string;
  /** Human-readable explanation. */
  message: string;
}

/**
 * Whether `value` is a plain object record (not null, not an array).
 * @param value
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The day-owned ARRAY fields whose persisted shape the merge would launder to `[]`.
 * The owning Day-Editor step (`repairStep`) and a human label are shared with the UI
 * reset controls (one source of truth), so a flagged collection is repairable on the
 * step that renders it.
 */
export const RAW_DAY_ARRAY_FIELDS: Array<{ key: string; repairStep: string; label: string }> = [
  { key: 'tasks', repairStep: 'epochs', label: 'tasks' },
  // Task-type catalog (Phase 8C): the day's ordered references into the animal catalog. A corrupt
  // non-array would be laundered (getDayTaskInstances returns null → export falls back to inline
  // tasks) instead of surfacing a repairable error — so it joins the raw-shape family.
  { key: 'taskInstances', repairStep: 'epochs', label: 'task instances' },
  { key: 'associated_files', repairStep: 'epochs', label: 'associated files' },
  { key: 'associated_video_files', repairStep: 'epochs', label: 'associated video files' },
  { key: 'behavioral_events', repairStep: 'behavioral', label: 'behavioral events' },
  { key: 'fs_gui_yamls', repairStep: 'epochs', label: 'FsGUI protocol files' },
  { key: 'keywords', repairStep: 'overview', label: 'keywords' },
];

/**
 * The animal-owned ARRAY fields. A corrupt one routes to the Animal Editor. Each carries
 * its executable repair command: cameras reset to none, and the device
 * configuration history REBUILT from the animal's current devices (not emptied — an empty
 * history would itself fail the merge), with a label that names that distinction.
 */
export const RAW_ANIMAL_ARRAY_FIELDS: Array<{
  key: string;
  label: string;
  repairCommand: { type: string };
  actionLabel?: string;
}> = [
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
 * @param opts
 * @param opts.code - Issue code.
 * @param opts.field - The corrupt field key (also the focus anchor).
 * @param opts.ownerSurface - Who can edit the fix.
 * @param opts.repairStep - The owning step id (day) — used for routing/focus.
 * @param opts.label - Human label for the collection.
 * @param opts.repairCommand - The serializable executable repair; executing it
 *   performs the reset this issue describes (see `repairCommands.js`).
 * @param opts.actionLabel - Override the default `Reset ${label}` button label
 *   (e.g. "Rebuild …" for a configurationHistory rebuild rather than an empty reset).
 * @returns Issue.
 */
function malformedCollectionIssue({
  code,
  field,
  ownerSurface,
  repairStep,
  label,
  repairCommand,
  actionLabel,
}: {
  code: string;
  field: string;
  ownerSurface: 'day' | 'animal';
  repairStep: string;
  label: string;
  repairCommand?: RepairCommand;
  actionLabel?: string;
}): RawShapeIssue {
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
 * @param day - The persisted day record.
 * @returns Raw-shape issues (empty for a clean or non-record day).
 */
export function validateRawDay(day: unknown): RawShapeIssue[] {
  if (!isRecord(day)) return [];
  const issues: RawShapeIssue[] = [];
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

  // A present-but-non-record `session` (e.g. a restored scalar/array) is corruption the
  // merge reads through `getDaySession` as `{}` — so the read-only, derived session_id is
  // LOST and the user cannot re-enter it (the field is read-only), a dead-end. Surface it as
  // a day-routed, Overview-owned blocker whose `resetDaySession` command rebuilds a clean
  // session with the canonical session_id. (`null` is "absent", handled by schema-required
  // checks, not flagged here.)
  if (day.session != null && !isRecord(day.session)) {
    issues.push({
      code: 'malformed_day_session',
      severity: 'error',
      field: 'session',
      ownerSurface: 'day',
      repairStep: 'overview',
      focusPath: 'session',
      actionLabel: 'Reset session',
      repairCommand: { type: 'resetDaySession' },
      // Legacy mirror.
      repairSurface: 'day',
      step: 'overview',
      path: 'session',
      message:
        `This day's session metadata is corrupt (expected an object), so its read-only ` +
        `session ID is lost and cannot be re-entered. Reset the session to restore the ` +
        `canonical session ID, then re-enter the descriptions.`,
    });
  }

  return issues;
}

/**
 * Validate a RAW (persisted) animal's owned array collections.
 *
 * @param animal - The persisted animal record.
 * @returns Raw-shape issues (empty for a clean or non-record animal).
 */
export function validateRawAnimal(animal: unknown): RawShapeIssue[] {
  if (!isRecord(animal)) return [];
  const issues: RawShapeIssue[] = [];
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
  // Make that REPAIRABLE rather than only blocked: surface a commandable rebuild issue whose
  // `rebuildConfigurationHistory` command reseeds a v1 snapshot from the animal's current
  // devices. "Real animal" is gated on a `devices` record so this never
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
