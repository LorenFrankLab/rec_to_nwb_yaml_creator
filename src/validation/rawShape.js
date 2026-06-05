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
 * Every issue carries the explicit ownership contract (Boundary 2): `ownerSurface`,
 * `repairStep`, `focusPath` — set by the producer, never inferred from `path` later. The
 * legacy `repairSurface`/`step`/`path` fields are mirrored until consumers migrate.
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
 * The animal-owned ARRAY fields. A corrupt one routes to the Animal Editor.
 * @type {Array<{ key: string, label: string }>}
 */
export const RAW_ANIMAL_ARRAY_FIELDS = [
  { key: 'cameras', label: 'cameras' },
  { key: 'configurationHistory', label: 'device configuration history' },
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
 * @returns {object} Issue.
 */
function malformedCollectionIssue({ code, field, ownerSurface, repairStep, label }) {
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
    actionLabel: `Reset ${label}`,
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
  for (const { key, label } of RAW_ANIMAL_ARRAY_FIELDS) {
    const value = animal[key];
    if (value != null && !Array.isArray(value)) {
      issues.push(
        malformedCollectionIssue({
          code: 'malformed_animal_collection',
          field: key,
          ownerSurface: 'animal',
          repairStep: 'overview',
          label,
        })
      );
    }
  }
  return issues;
}
