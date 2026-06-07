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

  // day_metadata → task_epoch_assignment: room/camera/opto scoped to the task's epochs,
  // including the day FsGUI (opto protocol) reference rules.
  duplicate_task_epoch: OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT,
  divergent_task_identity: OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT,
  orphaned_fs_gui_epoch: OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT,
  dangling_dio_output: OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT,
  fs_gui_requires_optogenetics: OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT,

  // day_metadata → day_exported_list: behavioral events export from the day, not the library.
  duplicate_behavioral_event_name: OWNERSHIP_PATTERN.DAY_EXPORTED_LIST,
  duplicate_behavioral_event_description: OWNERSHIP_PATTERN.DAY_EXPORTED_LIST,

  // existing_data → configuration_version: a recovered/unpinned day is repaired by pinning a
  // version (not a generic "clean up corrupt shape" repair).
  unpinned_configuration: OWNERSHIP_PATTERN.CONFIGURATION_VERSION,
});

/**
 * Ordered keyword → ownership-pattern scan, used to resolve a field PATH or section id (the
 * path/section dimension the helper provides alongside issue codes). Unlike a leading-token
 * lookup, this scans the WHOLE normalized path so it is robust to:
 *   - state-shape prefixes (`animal.cameras[0].lens`, `day.technical.raw_data_to_volts`,
 *     `day.configurationVersion`) — the prefix is stripped first;
 *   - nested fields (`technical.raw_data_to_volts` resolves to the rig-constant pattern, not the
 *     `technical` container).
 * ORDER MATTERS — earlier entries win. Specifics that would be shadowed by a broader keyword come
 * first: `weight` before `subject`; the rig constants before everything (they live under
 * `technical`); `fs_gui`/`tasks` before `camera` (a `tasks[].camera_id` / `fs_gui_yamls[].camera_id`
 * is a task-epoch assignment, not a catalog identity edit).
 *
 * @type {ReadonlyArray<[string, string]>}
 */
const PATTERN_BY_PATH_KEYWORD = Object.freeze([
  // Day-exported session value even under the inherited subject record (subject.weight).
  ['weight', OWNERSHIP_PATTERN.DAY_FACT],
  // Recording-system rig constants copied into day.technical.
  ['raw_data_to_volts', OWNERSHIP_PATTERN.SETUP_DEFAULT_TO_DAY],
  ['times_period_multiplier', OWNERSHIP_PATTERN.SETUP_DEFAULT_TO_DAY],
  // Day-only header path (also lives under technical, but is a day fact).
  ['default_header_file_path', OWNERSHIP_PATTERN.DAY_FACT],
  // Day FsGUI (opto protocol) and tasks — BEFORE camera, since both carry `camera_id`.
  ['fs_gui', OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT],
  ['task', OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT],
  // Day exported behavioral-events / DIO list.
  ['behavioral_event', OWNERSHIP_PATTERN.DAY_EXPORTED_LIST],
  ['dio_output', OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT],
  // Day video/file lists.
  ['associated_video', OWNERSHIP_PATTERN.DAY_FACT],
  ['associated_file', OWNERSHIP_PATTERN.DAY_FACT],
  // Animal camera catalog identity (and its calibration/lens fields).
  ['camera', OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE],
  ['meters_per_pixel', OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE],
  ['lens', OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE],
  // Versioned physical config: channel maps (ntrode) before electrode, then the pin itself.
  ['ntrode', OWNERSHIP_PATTERN.CONFIGURATION_VERSION],
  ['electrode', OWNERSHIP_PATTERN.CONFIGURATION_VERSION],
  ['configuration', OWNERSHIP_PATTERN.CONFIGURATION_VERSION],
  // Shared recording system (data-acq, option B).
  ['data_acq', OWNERSHIP_PATTERN.ANIMAL_SETUP],
  // Animal-level optogenetics implanted setup.
  ['opto', OWNERSHIP_PATTERN.ANIMAL_SETUP],
  ['virus', OWNERSHIP_PATTERN.ANIMAL_SETUP],
  ['fiber', OWNERSHIP_PATTERN.ANIMAL_SETUP],
  // Constant subject/animal facts.
  ['subject', OWNERSHIP_PATTERN.ANIMAL_SETUP],
  ['species', OWNERSHIP_PATTERN.ANIMAL_SETUP],
  ['genotype', OWNERSHIP_PATTERN.ANIMAL_SETUP],
  ['date_of_birth', OWNERSHIP_PATTERN.ANIMAL_SETUP],
  // Per-day session facts.
  ['session', OWNERSHIP_PATTERN.DAY_FACT],
]);

/**
 * Normalize a dotted/AJV/section string for keyword scanning: strip a leading slash, convert
 * AJV `/`-separators to `.`, lowercase, and drop a leading `animal.` / `day.` state-shape prefix
 * so a documented state path (`animal.cameras[0].lens`) scans the same as an export path
 * (`cameras[0].lens`).
 *
 * @param {string} [pathOrSection]
 * @returns {string}
 */
function normalizePath(pathOrSection) {
  return String(pathOrSection || '')
    .replace(/^\//, '')
    .replace(/\//g, '.')
    .toLowerCase()
    .replace(/^(animal|day)\./, '');
}

/**
 * Resolve the ownership pattern for a field path or section id via the ordered keyword scan,
 * falling back to the workflow-category default (then `day_fact`) when nothing matches.
 *
 * @param {string} [pathOrSection]
 * @returns {string} A valid {@link OWNERSHIP_PATTERN}.
 */
function patternForPath(pathOrSection) {
  const normalized = normalizePath(pathOrSection);
  for (const [keyword, pattern] of PATTERN_BY_PATH_KEYWORD) {
    if (normalized.includes(keyword)) return pattern;
  }
  return (
    CATEGORY_DEFAULT_PATTERN[workflowCategoryForIssue({ path: pathOrSection })] ||
    OWNERSHIP_PATTERN.DAY_FACT
  );
}

/**
 * Whether correcting THIS issue can reach days other than the one in front of the user (the
 * headline "today-only edit" vs "touches these N days" switch). Edit surface and ownership are
 * orthogonal, so this is computed per issue rather than read from the pattern default:
 *   - an `animal`-surface fix edits the shared/catalog/config item → reaches the days using it;
 *   - a `day`-surface fix is day-local (picking a camera for this day, pinning this day, a day
 *     fact) — EXCEPT a constant animal fact editable from the Day Overview (species/DOB, pattern
 *     `animal_setup`), which still propagates to all days;
 *   - a `none`-surface (read-only identity) keeps the pattern's inherent reach.
 *
 * @param {string} pattern - The resolved {@link OWNERSHIP_PATTERN}.
 * @param {'day'|'animal'|'none'} editSurface
 * @returns {boolean}
 */
function issueReachesBeyondDay(pattern, editSurface) {
  if (editSurface === 'animal') return true;
  if (editSurface === 'none') return OWNERSHIP_PATTERN_META[pattern].reachesBeyondDay;
  // day surface: local repair unless it is a constant animal fact edited from the day.
  return pattern === OWNERSHIP_PATTERN.ANIMAL_SETUP;
}

/**
 * Build the full descriptor for a resolved pattern + edit surface. The cue/label/etc. come
 * from {@link OWNERSHIP_PATTERN_META}; the edit surface is passed in (always derived from
 * `repairTargetForIssue`, never re-decided here). `reachesBeyondDay` defaults to the pattern's
 * inherent reach (used when describing a FIELD/section); an issue may override it with the
 * surface-aware {@link issueReachesBeyondDay}.
 *
 * @param {string} pattern - A valid {@link OWNERSHIP_PATTERN}.
 * @param {'day'|'animal'|'none'} editSurface
 * @param {boolean} [reachesBeyondDay] - Override for the pattern default.
 * @returns {{pattern: string, label: string, cue: string, altCue?: string, dayBehavior: string, primaryAction: string, reachesBeyondDay: boolean, editSurface: string}}
 */
function buildDescriptor(pattern, editSurface, reachesBeyondDay) {
  const meta = OWNERSHIP_PATTERN_META[pattern] || OWNERSHIP_PATTERN_META[OWNERSHIP_PATTERN.DAY_FACT];
  return {
    pattern,
    label: meta.label,
    cue: meta.cue,
    ...(meta.altCue ? { altCue: meta.altCue } : {}),
    dayBehavior: meta.dayBehavior,
    primaryAction: meta.primaryAction,
    reachesBeyondDay: typeof reachesBeyondDay === 'boolean' ? reachesBeyondDay : meta.reachesBeyondDay,
    editSurface,
  };
}

/**
 * The ownership descriptor for a validation issue. The edit surface is reused verbatim from
 * `repairTargetForIssue`; the pattern is the per-code refinement when present, else the issue's
 * workflow-category default; `reachesBeyondDay` is the surface-aware repair scope (so a day-side
 * camera selection or config pin does not falsely warn "touches N days"). Robust to a null/empty
 * issue (falls back to the day-metadata default, matching `workflowCategoryForIssue`).
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
  return buildDescriptor(pattern, editSurface, issueReachesBeyondDay(pattern, editSurface));
}

/**
 * The ownership descriptor for a field path (dotted app path, AJV instancePath, or a documented
 * state path like `day.technical.raw_data_to_volts`). The pattern is resolved by the whole-path
 * keyword scan; the edit surface is reused from `repairTargetForIssue` (path derivation).
 *
 * @param {string} [fieldPath]
 * @returns {{pattern: string, label: string, cue: string, altCue?: string, dayBehavior: string, primaryAction: string, reachesBeyondDay: boolean, editSurface: string}}
 */
export function ownershipForFieldPath(fieldPath) {
  return buildDescriptor(patternForPath(fieldPath), repairTargetForIssue({ path: fieldPath }).surface);
}

/**
 * The ownership descriptor for a known section id (e.g. `"cameras"`, `"data_acq_device"`,
 * `"electrode_groups"`). Unknown sections fall back to the workflow-category default. The edit
 * surface is reused from `repairTargetForIssue` so a section descriptor and an issue descriptor
 * on the same domain cannot disagree.
 *
 * @param {string} sectionId
 * @returns {{pattern: string, label: string, cue: string, altCue?: string, dayBehavior: string, primaryAction: string, reachesBeyondDay: boolean, editSurface: string}}
 */
export function ownershipForSection(sectionId) {
  return buildDescriptor(patternForPath(sectionId), repairTargetForIssue({ path: sectionId }).surface);
}
