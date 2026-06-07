/**
 * @fileoverview Ownership descriptor for the workflow-clarity UX (Phase 8.7, sub-stream A).
 *
 * The user-facing promise is **blast-radius transparency + no silent retroactive change**:
 * every edit is either a "today-only edit" or a "heads up — this touches these N days"
 * (enumerated before commit). Internally that resolves to one of seven ownership patterns
 * (plus a `recovered_data` repair pseudo-pattern). This module is the single place that maps a
 * validation issue / field path / section id to:
 *   - the internal ownership pattern,
 *   - the plain-language label, the visible ownership cue, the day-behavior copy, and the
 *     suggested primary action (the user-facing vocabulary), and
 *   - the edit surface (`animal` / `day` / `none`).
 *
 * Components render these descriptors instead of inventing local ownership explanations. The
 * field-level contract is [`workflow-ownership-matrix.md`]; the screen-level contract is
 * [`workflow-screen-map.md`] (both under `.claude/docs/plans/pre-cutover-export-correctness/`).
 *
 * IMPORTANT — no third `code → meaning` table. Ownership reuses the two existing authoritative
 * tables rather than re-deciding surface/category:
 *   1. EDIT SURFACE comes from `repairTargetForIssue` (which consults `SURFACE_BY_CODE`).
 *   2. WORKFLOW CATEGORY comes from `workflowCategoryForIssue` (which consults `CATEGORY_BY_CODE`).
 *   3. The ownership PATTERN is the genuinely-new dimension: each category has a default pattern,
 *      and a SPARSE `PATTERN_REFINEMENT_BY_CODE` overrides only the codes whose ownership is finer
 *      than their category default (geometry vs. catalog vs. shared, inside `animal_setup`, etc.).
 * A completeness test (`workflowOwnership.test.js`) mirrors the existing
 * `CATEGORY_BY_CODE` ↔ `SURFACE_BY_CODE` invariant: every validator code resolves to a
 * well-formed descriptor, and the refinement may not name a stale code. This module lives in
 * `src/domain/` and must not import from `pages/` (the architecture-boundary guard enforces it).
 */

import { repairTargetForIssue } from './validation';
import { WORKFLOW_CATEGORY, workflowCategoryForIssue } from './workflowCategories';

/**
 * The seven internal ownership patterns plus the `recovered_data` repair pseudo-pattern.
 * `recovered_data` is NOT one of the seven ownership patterns — it is the state of
 * imported/corrupt data that must be cleaned up before it is trusted, kept here so every
 * validator issue code resolves to a descriptor (the completeness invariant).
 *
 * @type {Readonly<Record<string, string>>}
 */
export const OWNERSHIP_PATTERN = Object.freeze({
  ANIMAL_SETUP: 'animal_setup',
  CONFIGURATION_VERSION: 'configuration_version',
  SETUP_DEFAULT_TO_DAY: 'setup_default_to_day',
  ANIMAL_CATALOG_REFERENCE: 'animal_catalog_reference',
  DAY_FACT: 'day_fact',
  TASK_EPOCH_ASSIGNMENT: 'task_epoch_assignment',
  DAY_EXPORTED_LIST: 'day_exported_list',
  RECOVERED_DATA: 'recovered_data',
});

/**
 * User-facing vocabulary for each pattern. `reachesBeyondDay` is the headline two-state switch:
 * `false` → the UI says "today-only edit"; `true` → the UI must enumerate the affected days
 * before commit ("touches these N days"). It describes whether a CORRECTION to this kind of
 * field can reach days other than the one in front of the user — not whether the common-case
 * edit propagates automatically (it never does silently).
 *
 * @type {Readonly<Record<string, {label: string, cue: string, altCue?: string, dayBehavior: string, primaryAction: string, reachesBeyondDay: boolean}>>}
 */
export const OWNERSHIP_PATTERN_META = Object.freeze({
  [OWNERSHIP_PATTERN.ANIMAL_SETUP]: {
    label: 'Animal setup',
    cue: 'Shared setup',
    dayBehavior: 'Defined once for the animal; a correction announces it affects all recording days.',
    primaryAction: 'Fix shared animal setup',
    reachesBeyondDay: true,
  },
  [OWNERSHIP_PATTERN.CONFIGURATION_VERSION]: {
    label: 'Configuration version',
    cue: 'Configuration version',
    dayBehavior:
      'A physical setup snapshot pinned by each recording day; past days keep their version, a physical change is a new version.',
    primaryAction: 'Pin or fix the configuration version',
    reachesBeyondDay: true,
  },
  [OWNERSHIP_PATTERN.SETUP_DEFAULT_TO_DAY]: {
    label: 'Recording-system default',
    cue: 'Using recording-system default',
    altCue: 'Different from current recording-system default',
    dayBehavior:
      'Copied from recording-system defaults into the day at creation; editing the default affects future days only unless applied to named existing days.',
    primaryAction: 'Override this day’s technical value',
    reachesBeyondDay: true,
  },
  [OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE]: {
    label: 'Animal catalog → day reference',
    cue: 'Selected from animal catalog',
    dayBehavior:
      'A reusable animal-level item selected by a day/task/epoch row; recalibration is a new catalog item, so past days are unchanged.',
    primaryAction: 'Select the item used on this day',
    reachesBeyondDay: true,
  },
  [OWNERSHIP_PATTERN.DAY_FACT]: {
    label: 'Day recording fact',
    cue: 'This day only',
    dayBehavior: 'Belongs only to this recording day; editing it changes nothing else.',
    primaryAction: 'Fix this day’s recording facts',
    reachesBeyondDay: false,
  },
  [OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT]: {
    label: 'Task-epoch setup assignment',
    cue: 'Used in these epochs',
    dayBehavior:
      'A day-owned choice scoped to one or more task epochs; each epoch belongs to exactly one task.',
    primaryAction: 'Set the room/camera/protocol for these epochs',
    reachesBeyondDay: false,
  },
  [OWNERSHIP_PATTERN.DAY_EXPORTED_LIST]: {
    label: 'Day exported list',
    cue: 'Exported with this day',
    dayBehavior:
      'Exported from this day; any animal-level items are reusable templates that are not themselves exported.',
    primaryAction: 'Use on this day',
    reachesBeyondDay: false,
  },
  [OWNERSHIP_PATTERN.RECOVERED_DATA]: {
    label: 'Recovered data repair',
    cue: 'Needs review',
    dayBehavior:
      'Imported or recovered state that must be reviewed and cleaned up before the data is trusted.',
    primaryAction: 'Repair recovered data',
    reachesBeyondDay: false,
  },
});

/**
 * Default ownership pattern for each workflow category (`export_preflight` is a readiness state,
 * not an issue destination, so it is intentionally absent).
 *
 * @type {Readonly<Record<string, string>>}
 */
export const CATEGORY_DEFAULT_PATTERN = Object.freeze({
  [WORKFLOW_CATEGORY.ANIMAL_SETUP]: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  [WORKFLOW_CATEGORY.DAY_METADATA]: OWNERSHIP_PATTERN.DAY_FACT,
  [WORKFLOW_CATEGORY.FAILED_CHANNELS]: OWNERSHIP_PATTERN.DAY_FACT,
  [WORKFLOW_CATEGORY.EXISTING_DATA]: OWNERSHIP_PATTERN.RECOVERED_DATA,
});

/**
 * SPARSE per-code refinement: only the codes whose ownership pattern is FINER than their
 * category default. Everything else inherits {@link CATEGORY_DEFAULT_PATTERN}. This is not a
 * parallel re-tabling of surface/category (those are reused) — it is the genuinely-new
 * ownership dimension. Keys must all exist in `SURFACE_BY_CODE` (locked by the completeness
 * test); values must be valid {@link OWNERSHIP_PATTERN}s.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const PATTERN_REFINEMENT_BY_CODE = Object.freeze({
  // animal_setup → configuration_version: probe/electrode geometry, locations, and channel maps
  // are the versioned physical snapshot that each day pins.
  channel_value_out_of_range: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  channel_key_out_of_range: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  channel_partition_invalid: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  channel_row_count_mismatch: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  duplicate_channels: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  missing_channels: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  duplicate_ntrode_id: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  unknown_device_type: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  duplicate_electrode_group_id: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  dangling_electrode_group_ref: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  empty_location: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  empty_targeted_location: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  inconsistent_location_case: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  inconsistent_probe_catalog: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,

  // animal_setup → animal_catalog_reference: a camera is a reusable catalog identity.
  duplicate_camera_id: OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE,
  divergent_camera_identity: OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE,

  // day_metadata → animal_catalog_reference: the day side of a camera reference (selection).
  dangling_camera_ref: OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE,
  missing_camera: OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE,

  // day_metadata → task_epoch_assignment: room/camera/opto scoped to the task's epochs.
  duplicate_task_epoch: OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT,
  divergent_task_identity: OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT,
  orphaned_fs_gui_epoch: OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT,

  // day_metadata → day_exported_list: behavioral events export from the day, not the library.
  duplicate_behavioral_event_name: OWNERSHIP_PATTERN.DAY_EXPORTED_LIST,
  duplicate_behavioral_event_description: OWNERSHIP_PATTERN.DAY_EXPORTED_LIST,

  // existing_data → configuration_version: a recovered/unpinned day is repaired by pinning a
  // version (not a generic "clean up corrupt shape" repair).
  unpinned_configuration: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
});

/**
 * Leading path token / section id → ownership pattern, for `ownershipForFieldPath` and
 * `ownershipForSection` (the path/section dimension the helper provides alongside issue codes).
 * Order does not matter; lookup is by the normalized leading token (see {@link sectionToken}).
 *
 * @type {Readonly<Record<string, string>>}
 */
const PATTERN_BY_SECTION = Object.freeze({
  electrode_groups: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  ntrode_electrode_group_channel_map: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
  cameras: OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE,
  data_acq_device: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  optogenetics: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  opto_excitation_source: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  optical_fiber: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  virus_injection: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  optogenetic_stimulation_software: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  fs_gui_yamls: OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT,
  tasks: OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT,
  behavioral_events: OWNERSHIP_PATTERN.DAY_EXPORTED_LIST,
  associated_video_files: OWNERSHIP_PATTERN.DAY_FACT,
  subject: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  subject_id: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  species: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  sex: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  genotype: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  date_of_birth: OWNERSHIP_PATTERN.ANIMAL_SETUP,
  raw_data_to_volts: OWNERSHIP_PATTERN.SETUP_DEFAULT_TO_DAY,
  times_period_multiplier: OWNERSHIP_PATTERN.SETUP_DEFAULT_TO_DAY,
  default_header_file_path: OWNERSHIP_PATTERN.DAY_FACT,
  weight: OWNERSHIP_PATTERN.DAY_FACT,
  session: OWNERSHIP_PATTERN.DAY_FACT,
  session_description: OWNERSHIP_PATTERN.DAY_FACT,
  session_id: OWNERSHIP_PATTERN.DAY_FACT,
});

/**
 * Build the full descriptor for a resolved pattern + edit surface. The cue/label/etc. come
 * from {@link OWNERSHIP_PATTERN_META}; the edit surface is passed in (always derived from
 * `repairTargetForIssue`, never re-decided here).
 *
 * @param {string} pattern - A valid {@link OWNERSHIP_PATTERN}.
 * @param {'day'|'animal'|'none'} editSurface
 * @returns {{pattern: string, label: string, cue: string, altCue?: string, dayBehavior: string, primaryAction: string, reachesBeyondDay: boolean, editSurface: string}}
 */
function buildDescriptor(pattern, editSurface) {
  const meta = OWNERSHIP_PATTERN_META[pattern] || OWNERSHIP_PATTERN_META[OWNERSHIP_PATTERN.DAY_FACT];
  return {
    pattern,
    label: meta.label,
    cue: meta.cue,
    ...(meta.altCue ? { altCue: meta.altCue } : {}),
    dayBehavior: meta.dayBehavior,
    primaryAction: meta.primaryAction,
    reachesBeyondDay: meta.reachesBeyondDay,
    editSurface,
  };
}

/**
 * The ownership descriptor for a validation issue. The edit surface is reused verbatim from
 * `repairTargetForIssue`; the pattern is the per-code refinement when present, else the issue's
 * workflow-category default. Robust to a null/empty issue (falls back to the day-metadata
 * default, matching `workflowCategoryForIssue`'s own day fallback).
 *
 * @param {{code?: string, path?: string, instancePath?: string, step?: string, repairSurface?: string, ownerSurface?: string}} [issue]
 * @returns {{pattern: string, label: string, cue: string, altCue?: string, dayBehavior: string, primaryAction: string, reachesBeyondDay: boolean, editSurface: string}}
 */
export function ownershipForIssue(issue) {
  const safeIssue = issue || {};
  const editSurface = repairTargetForIssue(safeIssue).surface;
  const refined = PATTERN_REFINEMENT_BY_CODE[safeIssue.code];
  const pattern =
    refined ||
    CATEGORY_DEFAULT_PATTERN[workflowCategoryForIssue(safeIssue)] ||
    OWNERSHIP_PATTERN.DAY_FACT;
  return buildDescriptor(pattern, editSurface);
}

/**
 * Normalize a dotted/AJV/section string to its leading token (the section the field belongs
 * to). `"/cameras/0/lens"` and `"cameras[0].lens"` both → `"cameras"`; `"subject.weight"` →
 * `"subject"`. A bare token (`"raw_data_to_volts"`) is returned as-is.
 *
 * @param {string} [pathOrSection]
 * @returns {string}
 */
function sectionToken(pathOrSection) {
  return String(pathOrSection || '')
    .replace(/^\//, '')
    .replace(/\//g, '.')
    .split(/[.[]/)[0];
}

/**
 * The ownership descriptor for a field path (dotted app path or AJV instancePath). Resolves the
 * pattern from the leading section token; the edit surface is reused from `repairTargetForIssue`
 * (path derivation). For `weight`/`session.weight`, the leading token resolves directly; the
 * special-case below keeps `subject.weight` a day fact even though `subject` alone is animal setup.
 *
 * @param {string} [fieldPath]
 * @returns {{pattern: string, label: string, cue: string, altCue?: string, dayBehavior: string, primaryAction: string, reachesBeyondDay: boolean, editSurface: string}}
 */
export function ownershipForFieldPath(fieldPath) {
  const normalized = String(fieldPath || '').replace(/^\//, '').replace(/\//g, '.');
  // Weight is a day-exported session value even when it sits under the inherited subject record.
  const token = /(^|\.)weight$/.test(normalized) ? 'weight' : sectionToken(fieldPath);
  const pattern =
    PATTERN_BY_SECTION[token] ||
    CATEGORY_DEFAULT_PATTERN[workflowCategoryForIssue({ path: fieldPath })] ||
    OWNERSHIP_PATTERN.DAY_FACT;
  const editSurface = repairTargetForIssue({ path: fieldPath }).surface;
  return buildDescriptor(pattern, editSurface);
}

/**
 * The ownership descriptor for a known section id (e.g. `"cameras"`, `"data_acq_device"`,
 * `"electrode_groups"`). Unknown sections fall back to the day-metadata default. The edit
 * surface is reused from `repairTargetForIssue` so a section descriptor and an issue descriptor
 * on the same domain cannot disagree.
 *
 * @param {string} sectionId
 * @returns {{pattern: string, label: string, cue: string, altCue?: string, dayBehavior: string, primaryAction: string, reachesBeyondDay: boolean, editSurface: string}}
 */
export function ownershipForSection(sectionId) {
  const token = sectionToken(sectionId);
  const pattern =
    PATTERN_BY_SECTION[token] ||
    CATEGORY_DEFAULT_PATTERN[workflowCategoryForIssue({ path: sectionId })] ||
    OWNERSHIP_PATTERN.DAY_FACT;
  const editSurface = repairTargetForIssue({ path: sectionId }).surface;
  return buildDescriptor(pattern, editSurface);
}
