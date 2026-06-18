/**
 * @fileoverview The PURE spine of the Import & Repair screen.
 *
 * Given a decoded flat NWB YAML model, this turns the EXISTING validator's findings into a list of
 * per-field repair items — each with a suggested fix derived from the SAME predicate that flagged
 * it — plus the new-animal vs existing-day decision and the benign (format-only) normalizations the
 * commit applies. It owns NO second validator: it calls {@link module:validation.validate} (the
 * export gate's own schema + rules) and {@link module:validation/dandiSubject.isValidSpecies}, and
 * every SUGGESTED value is gated by the predicate that flagged the original (a species suggestion
 * must pass `isValidSpecies`, a sex suggestion must be in the schema enum). Nothing is silently
 * dropped: each flagged item carries the original value verbatim, unmappable values surface as
 * user-input rows (never auto-erased), and any error this screen can't repair in place becomes a
 * `blocker` (fix-in-file) rather than a misleading editable row.
 *
 * The screen SUGGESTS; the user accepts/edits. {@link applyImportRepairs} then produces a repaired
 * model (deep-cloned, input never mutated) that the commit path ({@link module:state/yamlImportPlan}
 * + {@link module:state/yamlImportApply}) consumes unchanged — so there is exactly one importer.
 *
 * @module state/importRepair
 */

import { validate } from '../validation';
import { isValidSpecies } from '../validation/dandiSubject';
import { findIdentityDivergence } from './identityDivergence';
import { extractRecordingDate, findExistingAnimalId } from './yamlImportPlan';
import { getAnimalCameras, getDataAcqDevices } from './workspaceSelectors';
import type { IdentityRegistryEntry } from './identityDivergence';
import type { ValidationModel } from '../validation/issueTypes';

/** The schema enum for `subject.sex` (mirrors nwb_schema.json — single-letter NWB/DANDI codes). */
const SEX_ENUM: ReadonlyArray<string> = ['M', 'F', 'U', 'O'];

/**
 * Root-required fields that are structured collections (an array of strings / of device objects) —
 * a single inline value can't repair them, so a MISSING one is a fix-in-file blocker, not an input.
 * (The other root-required fields — `lab`, `institution`, `times_period_multiplier`,
 * `raw_data_to_volts` — and every required `subject.*` field are scalars the user can supply inline.)
 */
const STRUCTURED_REQUIRED_FIELDS: ReadonlySet<string> = new Set(['experimenter_name', 'data_acq_device']);

/**
 * Free-text → DANDI-valid species suggestions. The KEY is a lower-cased, trimmed lookup of the
 * source value; the VALUE is a Latin binomial that MUST pass `isValidSpecies` (a unit test asserts
 * this). A source value with no entry gets NO suggestion — it surfaces as a user-input row rather
 * than being laundered into a guess.
 */
const SPECIES_SUGGESTIONS: Readonly<Record<string, string>> = {
  rat: 'Rattus norvegicus',
  rats: 'Rattus norvegicus',
  'long evans': 'Rattus norvegicus',
  'long-evans': 'Rattus norvegicus',
  'long evans rat': 'Rattus norvegicus',
  'long-evans rat': 'Rattus norvegicus',
  'sprague dawley': 'Rattus norvegicus',
  'sprague-dawley': 'Rattus norvegicus',
  mouse: 'Mus musculus',
  mice: 'Mus musculus',
  marmoset: 'Callithrix jacchus',
  macaque: 'Macaca mulatta',
  'rhesus macaque': 'Macaca mulatta',
  human: 'Homo sapiens',
};

/** Free-text → schema-enum sex suggestions (lower-cased, trimmed lookup). */
const SEX_SUGGESTIONS: Readonly<Record<string, string>> = {
  m: 'M',
  male: 'M',
  f: 'F',
  female: 'F',
  u: 'U',
  unknown: 'U',
  unspecified: 'U',
  o: 'O',
  other: 'O',
  hermaphrodite: 'O',
};

/** Known legacy YAML key spellings that differ only by spaces vs underscores. */
const SPACE_KEY_ALIASES: Readonly<Record<string, string>> = {
  'subject id': 'subject_id',
  'data acq device': 'data_acq_device',
  'electrode groups': 'electrode_groups',
  'ntrode electrode group channel map': 'ntrode_electrode_group_channel_map',
};

/** Resolution value used when a choice row accepts importing the referenced catalog entry. */
const BRING_CATALOG_ENTRY = 'Bring referenced catalog entry';

/** Internal repair path prefix for existing-animal add camera mapping. */
const EXISTING_CAMERA_REF_PREFIX = '__importRepair.existingAnimal.camera.';

/** Internal repair path prefix for existing-animal add data-acq mapping. */
const EXISTING_DATA_ACQ_REF_PREFIX = '__importRepair.existingAnimal.data_acq_device.';

/** Internal repair path used when a legacy filename/session_id cannot provide the recording date. */
const IMPORT_RECORDING_DATE_PATH = '__importRepair.recording_date';

const CAMERA_IDENTITY_FIELDS = ['id', 'meters_per_pixel', 'lens', 'model', 'manufacturer'] as const;

const CAMERA_IDENTITY_FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  id: 'id',
  meters_per_pixel: 'meters_per_pixel',
  lens: 'lens',
  model: 'model',
  manufacturer: 'manufacturer',
});

/** How a repair item is resolved in the UI. */
export type RepairKind = 'suggestion' | 'input' | 'choice';

/** Where the item is grouped in the screen (mirrors the mockup's two sections). */
export type RepairGroup = 'attention' | 'required';

/** One repairable field: a suggestion the user accepts, or a value the user must supply. */
export interface RepairItem {
  /** Dot/bracket path into the flat model (e.g. `subject.species`, `electrode_groups[0].location`). */
  path: string;
  /** Short human label for the field. */
  label: string;
  /** The validator code (or shim id) that produced this item — the item's provenance. */
  code: string;
  /** The section grouping. */
  group: RepairGroup;
  /** Whether the user accepts a suggested value or supplies one. */
  kind: RepairKind;
  /** The original value, verbatim (present whenever the field had one — never laundered away). */
  was?: unknown;
  /** The suggested value (present for suggestion/choice rows), gated by the flagging predicate. */
  suggested?: unknown;
  /** Why this is flagged (the validator's own message, or the shim explanation). */
  why: string;
  /** Hint for the input control the screen renders. */
  inputType: 'text' | 'number' | 'date';
  /** Optional label for a choice-row alternate input. */
  mapInputLabel?: string;
  /** Optional structured action for import-only repairs. */
  action?: ExistingAnimalCatalogRepairAction;
}

/** An error this screen cannot repair in place (structural / cross-field) — fix in the file. */
export interface RepairBlocker {
  /** The error's path. */
  path: string;
  /** The validator code. */
  code: string;
  /** The validator's message. */
  why: string;
}

/** A format-only normalization the commit applies automatically (listed, never silent). */
export interface BenignNormalization {
  /** The path the normalization touches. */
  path: string;
  /** Short label. */
  label: string;
  /** What changed (and that no values were lost). */
  detail: string;
}

/** A selected catalog merge to apply before adding imported days to an existing animal. */
export interface ExistingAnimalCatalogAdditions {
  /** Camera catalog entries to append. */
  cameras?: unknown[];
  /** Data-acquisition device entries to append. */
  data_acq_device?: unknown[];
}

/** Catalog repair metadata carried by an import-repair row. */
interface ExistingAnimalCatalogRepairAction {
  /** Discriminator for custom import-repair actions. */
  kind: 'existing_animal_catalog_ref';
  /** The catalog whose reference would dangle after add-to-existing. */
  catalog: 'cameras' | 'data_acq_device';
  /** Existing animal that will receive the day. */
  targetAnimalId: string;
  /** The missing camera id or recording-system name. */
  missingValue: unknown;
  /** The source catalog entry that can be brought into the existing animal. */
  sourceEntry?: unknown;
  /** Whether accepting the suggestion is allowed for this row. */
  canBring: boolean;
  /** Valid existing values the user may map to instead. */
  validMapValues: unknown[];
}

/** The new-animal vs existing-day routing for the parsed file. */
export type ImportDecision =
  | { kind: 'new'; subjectId: string }
  | { kind: 'existing'; subjectId: string; existingAnimalId: string }
  | { kind: 'blocked'; reason: string };

/** The full repair plan for one parsed file. */
export interface ImportRepairPlan {
  /** The source filename (for date attribution + display). */
  sourceName: string;
  /** Repairable fields (suggestions + user inputs), in stable order. */
  items: RepairItem[];
  /** Errors that can't be repaired in this screen (fix in the file, re-import). */
  blockers: RepairBlocker[];
  /** Benign, format-only normalizations the commit applies. */
  benign: BenignNormalization[];
  /** New-animal vs existing-day routing. */
  decision: ImportDecision;
  /** Whether `validate` reported any error (so the screen knows the file isn't clean as-is). */
  hasErrors: boolean;
}

/** A parsed path segment: an object key or an array index. */
type PathSegment = string | number;

/**
 * Parse a dot/bracket path into segments. `electrode_groups[0].location` →
 * `['electrode_groups', 0, 'location']`; `subject.species` → `['subject', 'species']`.
 *
 * @param p - The path string.
 * @returns The ordered segments (numeric indices coerced to numbers).
 */
function parsePath(p: string): PathSegment[] {
  return p
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((s) => s !== '')
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

/**
 * Read the value at a path, or `undefined` when any segment is absent. Shape-safe.
 *
 * @param model - The flat model.
 * @param p - The path.
 * @returns The value, or undefined.
 */
function getAtPath(model: unknown, p: string): unknown {
  let cursor: unknown = model;
  for (const seg of parsePath(p)) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<PathSegment, unknown>)[seg];
  }
  return cursor;
}

/**
 * Set the value at a path on a (mutable) target, creating intermediate objects/arrays as needed.
 * A numeric segment creates/extends an array; a string segment creates/uses an object.
 *
 * @param target - The object to mutate.
 * @param p - The path.
 * @param value - The value to set.
 */
function setAtPath(target: Record<string, unknown>, p: string, value: unknown): void {
  const segments = parsePath(p);
  let cursor: Record<PathSegment, unknown> = target as Record<PathSegment, unknown>;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i];
    const next = segments[i + 1];
    if (cursor[seg] === null || typeof cursor[seg] !== 'object') {
      cursor[seg] = typeof next === 'number' ? [] : {};
    }
    cursor = cursor[seg] as Record<PathSegment, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
}

/**
 * Delete a key at a path on a mutable target. Missing parents are a no-op.
 *
 * @param target - The object to mutate.
 * @param p - The path to delete.
 */
function deleteAtPath(target: Record<string, unknown>, p: string): void {
  const segments = parsePath(p);
  if (segments.length === 0) return;
  let cursor: unknown = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    if (cursor === null || typeof cursor !== 'object') return;
    cursor = (cursor as Record<PathSegment, unknown>)[segments[i]];
  }
  if (cursor !== null && typeof cursor === 'object') {
    delete (cursor as Record<PathSegment, unknown>)[segments[segments.length - 1]];
  }
}

/**
 * Stable equality for decoded YAML values. Used only to decide whether dual legacy/current keys are
 * value-identical and therefore safe to normalize silently.
 *
 * @param a - First value.
 * @param b - Second value.
 * @returns True when the values are structurally equal.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Whether a decoded epoch reference is a one-item legacy list that can become the scalar schema form. */
function isSingleEpochList(value: unknown): value is [unknown] {
  return Array.isArray(value) && value.length === 1;
}

/** Whether a decoded epoch reference is a legacy list that cannot be picked losslessly. */
function isNonScalarEpochList(value: unknown): boolean {
  return Array.isArray(value) && value.length !== 1;
}

/**
 * Canonicalize a scalar-or-one-item-list epoch reference for equality and suggested values.
 * Multi-item lists are intentionally left as arrays so they do not compare equal to a scalar.
 */
function canonicalEpochReference(value: unknown): unknown {
  return isSingleEpochList(value) ? value[0] : value;
}

/**
 * Equality for legacy singular/plural epoch keys. `task_epoch: 2` and `task_epochs: [2]` are a
 * lossless spelling difference; `2` vs `[2, 3]` is not.
 */
function epochReferencesEqual(a: unknown, b: unknown): boolean {
  return valuesEqual(canonicalEpochReference(a), canonicalEpochReference(b));
}

/**
 * Encode an arbitrary decoded YAML scalar for use inside an internal repair path.
 *
 * @param value - The value to encode.
 * @returns A path-safe token.
 */
function encodeRepairToken(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

/**
 * Decode a token produced by {@link encodeRepairToken}.
 *
 * @param token - The encoded token.
 * @returns The decoded value.
 */
function decodeRepairToken(token: string): unknown {
  return JSON.parse(decodeURIComponent(token));
}

/**
 * Whether two catalog/reference values match exactly, without string laundering numeric ids.
 *
 * @param a - First value.
 * @param b - Second value.
 * @returns True when the values are the same reference key.
 */
function sameRefValue(a: unknown, b: unknown): boolean {
  return Object.is(a, b);
}

/**
 * Dependent fields that make a camera_name identity safe to reuse.
 *
 * @param camera - A decoded camera catalog entry.
 * @returns The comparable dependent-field record.
 */
function cameraIdentityFields(camera: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(CAMERA_IDENTITY_FIELDS.map((field) => [field, camera[field]]));
}

/**
 * Build a registry for existing-animal camera identities keyed by camera_name.
 *
 * @param cameras - Existing animal camera catalog rows.
 * @param animalId - Existing animal id for display.
 * @returns Comparable camera identity entries.
 */
function cameraIdentityRegistry(
  cameras: unknown[],
  animalId: string
): IdentityRegistryEntry[] {
  return cameras
    .filter(isRecord)
    .filter((camera) => String(camera.camera_name ?? '').trim() !== '')
    .map((camera) => ({
      name: String(camera.camera_name).trim(),
      fields: cameraIdentityFields(camera),
      label: `animal "${animalId}" camera id ${String(camera.id)}`,
    }));
}

/**
 * Human-readable field list for camera identity divergence messages.
 *
 * @param fields - Dependent fields that differ.
 * @returns A comma-separated field list.
 */
function formatCameraIdentityFields(fields: ReadonlyArray<string>): string {
  return fields.map((field) => CAMERA_IDENTITY_FIELD_LABELS[field] ?? field).join(', ');
}

/** A virus-injection array item carrying the two volume spellings. */
interface VolumeShimItem {
  volume_in_uL?: unknown;
  volume_in_ul?: unknown;
  [key: string]: unknown;
}

/**
 * Whether a decoded YAML value is a plain record that can carry schema keys.
 *
 * @param value - The value to check.
 * @returns True for mutable object records; false for arrays, null, Date, and scalars.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/**
 * Convert a path segment list to a stable human-readable import-repair path.
 *
 * @param parts - The path parts.
 * @returns A dot path, or `(root)` for the document root.
 */
function formatImportPath(parts: ReadonlyArray<string | number>): string {
  if (parts.length === 0) return '(root)';
  return parts.map((part) => String(part)).join('.');
}

/**
 * Apply known legacy space-key aliases in place, returning the listed benign normalizations.
 * Only known schema-key aliases are rewritten; arbitrary user keys are preserved.
 *
 * @param value - The decoded model or nested value.
 * @param path - The current traversal path.
 * @returns The benign normalizations applied.
 */
function applySpaceKeyAliases(
  value: unknown,
  path: Array<string | number> = []
): BenignNormalization[] {
  const benign: BenignNormalization[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      benign.push(...applySpaceKeyAliases(item, [...path, index]));
    });
    return benign;
  }

  if (!isRecord(value)) return benign;

  for (const [legacyKey, canonicalKey] of Object.entries(SPACE_KEY_ALIASES)) {
    if (!Object.prototype.hasOwnProperty.call(value, legacyKey)) continue;
    if (Object.prototype.hasOwnProperty.call(value, canonicalKey)) continue;

    value[canonicalKey] = value[legacyKey];
    delete value[legacyKey];
    const parentPath = formatImportPath(path);
    benign.push({
      path: parentPath,
      label: `${legacyKey} → ${canonicalKey}`,
      detail:
        `Renamed legacy key \`${legacyKey}\` → \`${canonicalKey}\` ` +
        `at ${parentPath} — no values changed.`,
    });
  }

  for (const [key, child] of Object.entries(value)) {
    benign.push(...applySpaceKeyAliases(child, [...path, key]));
  }

  return benign;
}

/**
 * Add a non-empty decoded YAML camera id to a mutable list.
 *
 * @param refs - The list to append to.
 * @param value - The candidate camera id.
 */
function pushCameraRef(refs: unknown[], value: unknown): void {
  if (value === undefined || value === null || value === '') return;
  if (!refs.some((existing) => sameRefValue(existing, value))) refs.push(value);
}

/**
 * Camera ids a flat YAML day will reference after decompose/import.
 *
 * @param model - The normalized flat model.
 * @returns Referenced camera ids in first-seen order.
 */
function collectFlatCameraRefs(model: ValidationModel): unknown[] {
  const refs: unknown[] = [];

  if (Array.isArray(model.cameras)) {
    model.cameras.forEach((camera) => pushCameraRef(refs, camera?.id));
  }
  if (Array.isArray(model.tasks)) {
    model.tasks.forEach((task) => {
      if (Array.isArray(task?.camera_id)) {
        task.camera_id.forEach((cameraId: unknown) => pushCameraRef(refs, cameraId));
      }
    });
  }
  if (Array.isArray(model.associated_video_files)) {
    model.associated_video_files.forEach((video) => pushCameraRef(refs, video?.camera_id));
  }
  if (Array.isArray(model.fs_gui_yamls)) {
    model.fs_gui_yamls.forEach((protocol) => pushCameraRef(refs, protocol?.camera_id));
  }

  return refs;
}

/**
 * Replace every occurrence of a camera id in the decoded flat model.
 *
 * @param model - The mutable normalized model.
 * @param missingId - The imported camera id being mapped.
 * @param mappedId - The existing animal camera id to use instead.
 */
function mapCameraReference(
  model: Record<string, unknown>,
  missingId: unknown,
  mappedId: unknown
): void {
  const replace = (value: unknown): unknown => (sameRefValue(value, missingId) ? mappedId : value);

  if (Array.isArray(model.cameras)) {
    model.cameras.forEach((camera) => {
      if (camera && typeof camera === 'object' && sameRefValue((camera as { id?: unknown }).id, missingId)) {
        (camera as { id?: unknown }).id = mappedId;
      }
    });
  }
  if (Array.isArray(model.tasks)) {
    model.tasks.forEach((task) => {
      if (task && typeof task === 'object' && Array.isArray((task as { camera_id?: unknown }).camera_id)) {
        (task as { camera_id: unknown[] }).camera_id = (task as { camera_id: unknown[] }).camera_id.map(replace);
      }
    });
  }
  if (Array.isArray(model.associated_video_files)) {
    model.associated_video_files.forEach((video) => {
      if (video && typeof video === 'object') {
        const row = video as { camera_id?: unknown };
        row.camera_id = replace(row.camera_id);
      }
    });
  }
  if (Array.isArray(model.fs_gui_yamls)) {
    model.fs_gui_yamls.forEach((protocol) => {
      if (protocol && typeof protocol === 'object') {
        const row = protocol as { camera_id?: unknown };
        row.camera_id = replace(row.camera_id);
      }
    });
  }
}

/**
 * Replace the imported recording-system name in the flat model.
 *
 * @param model - The mutable normalized model.
 * @param missingName - The imported recording-system name being mapped.
 * @param mappedName - The existing animal recording-system name to use instead.
 */
function mapDataAcqDeviceReference(
  model: Record<string, unknown>,
  missingName: unknown,
  mappedName: unknown
): void {
  if (!Array.isArray(model.data_acq_device)) return;
  model.data_acq_device.forEach((device) => {
    if (device && typeof device === 'object') {
      const row = device as { name?: unknown };
      if (sameRefValue(row.name, missingName)) row.name = mappedName;
    }
  });
}

/**
 * Human-readable display for a camera reference.
 *
 * @param camera - The source camera entry.
 * @param id - The camera id.
 * @returns A compact label.
 */
function cameraRefLabel(camera: unknown, id: unknown): string {
  const name = camera && typeof camera === 'object' ? (camera as { camera_name?: unknown }).camera_name : undefined;
  return name ? `camera id ${String(id)} (${String(name)})` : `camera id ${String(id)}`;
}

/**
 * Human-readable list of valid existing values.
 *
 * @param values - Candidate values.
 * @returns A display string.
 */
function validValueList(values: unknown[]): string {
  return values.length > 0 ? values.map((value) => String(value)).join(', ') : '(none)';
}

/**
 * Existing-animal import repair items for catalog refs that would dangle after an `add`.
 *
 * @param model - The normalized flat model.
 * @param decision - The import-repair routing decision.
 * @param workspace - The current workspace.
 * @returns Additional repair items.
 */
function buildExistingAnimalCatalogItems(
  model: ValidationModel,
  decision: ImportDecision,
  workspace: { animals?: unknown } | null | undefined
): RepairItem[] {
  if (decision.kind !== 'existing') return [];
  const animals = workspace?.animals;
  if (animals === null || typeof animals !== 'object') return [];
  const existingAnimal = (animals as Record<string, unknown>)[decision.existingAnimalId];
  if (!existingAnimal || typeof existingAnimal !== 'object') return [];

  const items: RepairItem[] = [];
  const existingCameras = getAnimalCameras(existingAnimal);
  const existingCameraIds = existingCameras.map((camera) => camera.id);
  const existingCameraNames = new Set(
    existingCameras
      .map((camera) => camera.camera_name)
      .filter((name) => name !== undefined && name !== null)
      .map((name) => String(name))
  );
  const sourceCameras = Array.isArray(model.cameras) ? model.cameras : [];
  const cameraRefs = collectFlatCameraRefs(model);
  const existingCameraRegistry = cameraIdentityRegistry(existingCameras, decision.existingAnimalId);
  const divergentCameraRefs: unknown[] = [];

  for (const sourceCamera of sourceCameras) {
    if (!sourceCamera || typeof sourceCamera !== 'object') continue;
    const sourceRow = sourceCamera as Record<string, unknown>;
    const sourceId = sourceRow.id;
    if (sourceId === undefined || sourceId === null || sourceId === '') continue;
    if (!cameraRefs.some((cameraRef) => sameRefValue(cameraRef, sourceId))) continue;
    if (divergentCameraRefs.some((cameraRef) => sameRefValue(cameraRef, sourceId))) continue;

    const divergence = findIdentityDivergence(
      String(sourceRow.camera_name ?? ''),
      cameraIdentityFields(sourceRow),
      existingCameraRegistry
    );
    if (!divergence) continue;

    divergentCameraRefs.push(sourceId);
    const path = `${EXISTING_CAMERA_REF_PREFIX}${encodeRepairToken(sourceId)}`;
    const base = cameraRefLabel(sourceRow, sourceId);
    items.push({
      path,
      label: `Camera ${String(sourceId)}`,
      code: 'divergent_camera_identity',
      group: 'attention',
      kind: 'input',
      was: base,
      why:
        `${base} reuses camera_name "${String(sourceRow.camera_name)}" from ` +
        `${divergence.existing.label ?? `animal "${decision.existingAnimalId}"`} but differs in ` +
        `${formatCameraIdentityFields(divergence.differingFields)}. Spyglass keys cameras by ` +
        'camera_name; if this was recalibrated or repositioned, give it a distinct camera_name ' +
        'in the YAML, or map the day to an existing camera id.',
      inputType: 'number',
      mapInputLabel: `Map camera ${String(sourceId)} to existing camera id`,
      action: {
        kind: 'existing_animal_catalog_ref',
        catalog: 'cameras',
        targetAnimalId: decision.existingAnimalId,
        missingValue: sourceId,
        sourceEntry: structuredClone(sourceRow),
        canBring: false,
        validMapValues: existingCameraIds,
      },
    });
  }

  for (const cameraId of cameraRefs) {
    if (divergentCameraRefs.some((cameraRef) => sameRefValue(cameraRef, cameraId))) continue;
    if (existingCameraIds.some((id) => sameRefValue(id, cameraId))) continue;
    const sourceCamera = sourceCameras.find((camera) => sameRefValue(camera?.id, cameraId));
    if (!sourceCamera) continue;
    const sourceName = sourceCamera.camera_name;
    const nameConflicts =
      sourceName !== undefined &&
      sourceName !== null &&
      existingCameraNames.has(String(sourceName));
    const canBring = !nameConflicts;
    const path = `${EXISTING_CAMERA_REF_PREFIX}${encodeRepairToken(cameraId)}`;
    const base = cameraRefLabel(sourceCamera, cameraId);
    items.push({
      path,
      label: `Camera ${String(cameraId)}`,
      code: 'existing_animal_missing_camera',
      group: 'attention',
      kind: canBring ? 'choice' : 'input',
      was: base,
      suggested: canBring ? BRING_CATALOG_ENTRY : undefined,
      why: canBring
        ? `${base} is referenced by the imported day, but animal "${decision.existingAnimalId}" does not have it. Bring that camera into the animal, or map the day to an existing camera id.`
        : `${base} is referenced by the imported day, but animal "${decision.existingAnimalId}" already has a camera named "${String(sourceName)}". Map the day to an existing camera id instead of importing a conflicting catalog entry.`,
      inputType: 'number',
      mapInputLabel: `Map camera ${String(cameraId)} to existing camera id`,
      action: {
        kind: 'existing_animal_catalog_ref',
        catalog: 'cameras',
        targetAnimalId: decision.existingAnimalId,
        missingValue: cameraId,
        sourceEntry: structuredClone(sourceCamera),
        canBring,
        validMapValues: existingCameraIds,
      },
    });
  }

  const existingDataAcqDevices = getDataAcqDevices(existingAnimal);
  const existingDeviceNames = existingDataAcqDevices
    .map((device) => device.name)
    .filter((name) => name !== undefined && name !== null);
  const sourceDevices = Array.isArray(model.data_acq_device) ? model.data_acq_device : [];
  const importedDevice = sourceDevices[0];
  const importedName = importedDevice?.name;
  if (
    importedName !== undefined &&
    importedName !== null &&
    !existingDeviceNames.some((name) => sameRefValue(name, importedName))
  ) {
    const path = `${EXISTING_DATA_ACQ_REF_PREFIX}${encodeRepairToken(importedName)}`;
    items.push({
      path,
      label: 'Recording system',
      code: 'existing_animal_missing_data_acq_device',
      group: 'attention',
      kind: importedDevice ? 'choice' : 'input',
      was: String(importedName),
      suggested: importedDevice ? BRING_CATALOG_ENTRY : undefined,
      why: `Recording system "${String(importedName)}" is referenced by the imported day, but animal "${decision.existingAnimalId}" does not have it. Bring that recording-system entry into the animal, or map the day to an existing recording-system name.`,
      inputType: 'text',
      mapInputLabel: 'Map to existing recording-system name',
      action: {
        kind: 'existing_animal_catalog_ref',
        catalog: 'data_acq_device',
        targetAnimalId: decision.existingAnimalId,
        missingValue: importedName,
        sourceEntry: importedDevice ? structuredClone(importedDevice) : undefined,
        canBring: !!importedDevice,
        validMapValues: existingDeviceNames,
      },
    });
  }

  return items;
}

/**
 * Build the repair items + blockers for a model's `validate` errors. Known leaf codes map to
 * suggestions/inputs; everything else becomes a blocker (fix-in-file).
 *
 * @param model - The flat model.
 * @returns The items and blockers.
 */
function buildValidationItems(model: ValidationModel): {
  items: RepairItem[];
  blockers: RepairBlocker[];
} {
  const errors = validate(model).filter((issue) => issue.severity === 'error');
  const items: RepairItem[] = [];
  const blockers: RepairBlocker[] = [];
  // One field can draw multiple errors (e.g. a null location fails BOTH the schema `type` check and
  // the `empty_location` rule). Surface a path ONCE — the first matching error wins. `validate` sorts
  // by path then code, and today the repairable rule code sorts before the generic schema keyword at
  // each shared path (`empty_location` < `type`; species/sex/weight don't co-occur with a competing
  // same-path code), so the repairable item wins. NB: if a future repairable rule code at a shared
  // path sorted AFTER a co-occurring schema keyword, that keyword would win and shadow the repair as
  // a blocker — add an explicit "prefer the repairable code" rule here before that can happen.
  const handledPaths = new Set<string>();

  for (const issue of errors) {
    const { path, code, message } = issue;
    if (handledPaths.has(path)) continue;
    handledPaths.add(path);
    const was = getAtPath(model, path);

    // --- DANDI species: a free-text value → suggest a binomial from the shared canon. ---
    if (code === 'invalid_species') {
      const suggested = SPECIES_SUGGESTIONS[String(was).trim().toLowerCase()];
      if (suggested !== undefined && isValidSpecies(suggested)) {
        items.push({ path, label: 'Species', code, group: 'attention', kind: 'suggestion', was, suggested, why: message, inputType: 'text' });
      } else {
        items.push({ path, label: 'Species', code, group: 'attention', kind: 'input', was, why: message, inputType: 'text' });
      }
      continue;
    }

    // --- sex: not in the M/F/U/O set → suggest the single-letter code. ---
    if (code === 'enum' && path === 'subject.sex') {
      const suggested = SEX_SUGGESTIONS[String(was).trim().toLowerCase()];
      if (suggested !== undefined && SEX_ENUM.includes(suggested)) {
        items.push({ path, label: 'Sex', code, group: 'attention', kind: 'suggestion', was, suggested, why: message, inputType: 'text' });
      } else {
        items.push({ path, label: 'Sex', code, group: 'attention', kind: 'input', was, why: message, inputType: 'text' });
      }
      continue;
    }

    // --- weight: a "541g"-style string → suggest the parsed number. ---
    if (code === 'type' && path === 'subject.weight') {
      const parsed = parseFloat(String(was));
      if (Number.isFinite(parsed) && parsed >= 0) {
        items.push({ path, label: 'Weight (g)', code, group: 'attention', kind: 'suggestion', was, suggested: parsed, why: message, inputType: 'number' });
      } else {
        items.push({ path, label: 'Weight (g)', code, group: 'attention', kind: 'input', was, why: message, inputType: 'number' });
      }
      continue;
    }

    // --- technical scalar: a legacy string like "1.5cd" → suggest the numeric prefix. ---
    if (code === 'type' && path === 'times_period_multiplier') {
      const parsed = parseFloat(String(was));
      if (Number.isFinite(parsed)) {
        items.push({ path, label: 'Times period multiplier', code, group: 'attention', kind: 'suggestion', was, suggested: parsed, why: message, inputType: 'number' });
      } else {
        items.push({ path, label: 'Times period multiplier', code, group: 'attention', kind: 'input', was, why: message, inputType: 'number' });
      }
      continue;
    }

    // --- session_id: unlike subject_id, this is a day/session fact and can be repaired on import. ---
    if (code === 'session_id_slash' && path === 'session_id') {
      const suggested = String(was ?? '').replace(/[\\/]+/g, '_').trim();
      if (suggested !== '') {
        items.push({ path, label: 'Session ID', code, group: 'attention', kind: 'suggestion', was, suggested, why: message, inputType: 'text' });
      } else {
        items.push({ path, label: 'Session ID', code, group: 'attention', kind: 'input', was, why: message, inputType: 'text' });
      }
      continue;
    }

    // --- experimenter_name: a scalar string → suggest wrapping into a single-item list (verbatim). ---
    if (code === 'type' && path === 'experimenter_name') {
      if (typeof was === 'string' && was.trim() !== '') {
        items.push({ path, label: 'Experimenter name', code, group: 'attention', kind: 'suggestion', was, suggested: [was], why: message, inputType: 'text' });
      } else {
        items.push({ path, label: 'Experimenter name', code, group: 'attention', kind: 'input', was, why: message, inputType: 'text' });
      }
      continue;
    }

    // --- electrode-group location: empty/null → the user supplies a region (never auto-filled). ---
    if (code === 'empty_location' || code === 'empty_targeted_location') {
      const label = code === 'empty_location' ? 'Electrode group location' : 'Electrode group targeted location';
      items.push({ path, label, code, group: 'attention', kind: 'input', was, why: message, inputType: 'text' });
      continue;
    }

    // --- camera catalog identity/calibration: scalar repairs on the Animal camera catalog. ---
    if (code === 'placeholder_camera_name') {
      items.push({
        path,
        label: 'Camera name',
        code,
        group: 'attention',
        kind: 'input',
        was,
        why: message,
        inputType: 'text',
      });
      continue;
    }

    if (
      code === 'camera_meters_per_pixel_missing' ||
      code === 'camera_meters_per_pixel_nonpositive'
    ) {
      items.push({
        path,
        label: 'Meters per pixel',
        code,
        group: code === 'camera_meters_per_pixel_missing' ? 'required' : 'attention',
        kind: 'input',
        was,
        why: message,
        inputType: 'number',
      });
      continue;
    }

    // subject.subject_id is the animal's IDENTITY — the store key, the hash route, and the input to
    // the new-vs-existing decision (computed once from the file). It isn't meaningfully editable in
    // this screen (the create wizard likewise locks it; a slashed id is already a fix-in-file
    // blocker via the catch-all), so a missing/empty one is a fix-in-file blocker — not a text input
    // that could never enable import (the decision would stay `blocked` no matter what was typed).
    if (path === 'subject.subject_id' && (code === 'required' || code === 'pattern')) {
      blockers.push({ path, code, why: message });
      continue;
    }

    // A structured root-required field (an array/object) that is entirely MISSING can't be repaired
    // with a single inline value — surface it as a fix-in-file blocker instead of a text input that
    // could never satisfy the schema (which would falsely enable import, then fail at commit).
    if (code === 'required' && STRUCTURED_REQUIRED_FIELDS.has(path)) {
      blockers.push({ path, code, why: message });
      continue;
    }

    // --- required-but-missing / empty required field → blocks; the user supplies it. ---
    if (code === 'required' || code === 'pattern') {
      const inputType: RepairItem['inputType'] = path.endsWith('date_of_birth')
        ? 'date'
        : path.endsWith('weight')
          ? 'number'
          : 'text';
      const item: RepairItem = { path, label: leafLabel(path), code, group: 'required', kind: 'input', why: message, inputType };
      // A pattern violation has an (empty/whitespace) value; a required-missing field has none.
      if (code === 'pattern') item.was = was;
      items.push(item);
      continue;
    }

    // Anything else can't be repaired field-by-field here — surface it as a fix-in-file blocker.
    blockers.push({ path, code, why: message });
  }

  return { items, blockers };
}

/**
 * A human label for a leaf path (e.g. `subject.date_of_birth` → "Date of birth").
 *
 * @param p - The path.
 * @returns The label.
 */
function leafLabel(p: string): string {
  const leaf = parsePath(p).pop();
  return String(leaf ?? p)
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Detect the benign (format-only, lossless) normalizations the commit will apply, plus any
 * conflicting-volume reconcile items. Surfaces them so they are listed, never silent.
 *
 * @param model - The flat model.
 * @returns The benign normalizations and any extra reconcile items.
 */
function buildBenignAndShim(model: ValidationModel): {
  benign: BenignNormalization[];
  shimItems: RepairItem[];
} {
  const benign: BenignNormalization[] = [];
  const shimItems: RepairItem[] = [];

  benign.push(...applySpaceKeyAliases(structuredClone(model)));

  // --- task_epoch (singular) + one-item task_epochs lists → canonical scalar task_epochs. ---
  for (const key of ['associated_files', 'associated_video_files'] as const) {
    const list = (model as Record<string, unknown>)[key];
    if (!Array.isArray(list)) continue;
    let hasLosslessSingular = false;
    let hasLosslessListScalar = false;
    list.forEach((item, i) => {
      if (!item || typeof item !== 'object') return;
      const obj = item as Record<string, unknown>;
      const hasSingular = 'task_epoch' in obj;
      const hasPlural = 'task_epochs' in obj;
      const pluralValue = obj.task_epochs;
      const pluralIsRepairableList = isNonScalarEpochList(pluralValue);

      if (hasSingular && hasPlural && !epochReferencesEqual(obj.task_epoch, pluralValue)) {
        const canonicalPlural = canonicalEpochReference(pluralValue);
        const canSuggest = !Array.isArray(canonicalPlural);
        shimItems.push({
          path: `${key}[${i}].task_epochs`,
          label: 'Task epoch',
          code: 'task_epoch_conflict',
          group: 'attention',
          kind: canSuggest ? 'suggestion' : 'input',
          was: obj.task_epoch,
          ...(canSuggest ? { suggested: canonicalPlural } : {}),
          why:
            '`task_epoch` and `task_epochs` disagree. The app reads `task_epochs`; ' +
            'accept that value to reconcile the legacy key before import, or fix the file.',
          inputType: 'number',
        });
        return;
      }

      if (hasSingular) {
        hasLosslessSingular = true;
      }

      if (hasPlural && isSingleEpochList(pluralValue)) {
        hasLosslessListScalar = true;
      } else if (hasPlural && pluralIsRepairableList) {
        shimItems.push({
          path: `${key}[${i}].task_epochs`,
          label: 'Task epoch',
          code: 'task_epochs_multi_value',
          group: 'attention',
          kind: 'input',
          was: pluralValue,
          why:
            '`task_epochs` is a legacy list with more than one value. Associated files/videos ' +
            'import as one epoch reference here; choose the epoch this row belongs to, or fix the file.',
          inputType: 'number',
        });
      }
    });
    if (hasLosslessSingular) {
      benign.push({
        path: key,
        label: 'task_epoch → task_epochs',
        detail: `Renamed \`task_epoch\` → \`task_epochs\` in ${key} (the field the app reads) — no values changed.`,
      });
    }
    if (hasLosslessListScalar) {
      benign.push({
        path: key,
        label: 'task_epochs list → scalar',
        detail: `Converted one-item \`task_epochs\` lists to scalar values in ${key} — no epoch linkage changed.`,
      });
    }
  }

  // --- virus_injection volume shim: one spelling present → benign fill; both differ → reconcile. ---
  const injections = (model as Record<string, unknown>).virus_injection;
  if (Array.isArray(injections)) {
    injections.forEach((raw, i) => {
      if (!raw || typeof raw !== 'object') return;
      const inj = raw as VolumeShimItem;
      const hasUpper = inj.volume_in_uL !== undefined;
      const hasLower = inj.volume_in_ul !== undefined;
      if (hasUpper && hasLower && inj.volume_in_uL !== inj.volume_in_ul) {
        // Conflict: trodes_to_nwb reads the capital-L spelling, so it is authoritative.
        shimItems.push({
          path: `virus_injection[${i}].volume_in_ul`,
          label: 'Virus injection volume',
          code: 'volume_shim_conflict',
          group: 'attention',
          kind: 'suggestion',
          was: inj.volume_in_ul,
          suggested: inj.volume_in_uL,
          why: 'volume_in_uL and volume_in_ul disagree. trodes_to_nwb reads volume_in_uL, so it is authoritative — both keys are kept, reconciled to that value.',
          inputType: 'number',
        });
      } else if (hasUpper !== hasLower) {
        benign.push({
          path: `virus_injection[${i}]`,
          label: 'volume_in_uL / volume_in_ul',
          detail: 'Filled the matching volume spelling so both keys are present (the converter reads volume_in_uL; the schema requires volume_in_ul).',
        });
      }
    });
  }

  return { benign, shimItems };
}

/**
 * Apply the benign, lossless normalizations to a (mutable) model: recover known legacy space-key
 * schema spellings, rename `task_epoch` → the `task_epochs` key the app reads, and fill a missing
 * volume spelling from the present one. Shared by {@link buildImportRepairPlan} (which validates
 * the NORMALIZED model, so a benign-fixable issue never also surfaces as a repair item) and
 * {@link applyImportRepairs}.
 *
 * @param model - The model to mutate in place.
 */
function applyBenignNormalizations(model: Record<string, unknown>): void {
  applySpaceKeyAliases(model);

  for (const key of ['associated_files', 'associated_video_files'] as const) {
    const list = model[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      if ('task_epoch' in obj) {
        if ('task_epochs' in obj && !epochReferencesEqual(obj.task_epoch, obj.task_epochs)) continue;
        if (!('task_epochs' in obj)) obj.task_epochs = obj.task_epoch;
        delete obj.task_epoch;
      }
      if (isSingleEpochList(obj.task_epochs)) obj.task_epochs = obj.task_epochs[0];
    }
  }

  const injections = model.virus_injection;
  if (Array.isArray(injections)) {
    for (const raw of injections) {
      if (!raw || typeof raw !== 'object') continue;
      const inj = raw as VolumeShimItem;
      const hasUpper = inj.volume_in_uL !== undefined;
      const hasLower = inj.volume_in_ul !== undefined;
      if (hasUpper && !hasLower) inj.volume_in_ul = inj.volume_in_uL;
      else if (hasLower && !hasUpper) inj.volume_in_uL = inj.volume_in_ul;
    }
  }
}

/**
 * Build the import-repair plan for a parsed flat model.
 *
 * @param flatModel - The decoded flat NWB YAML model.
 * @param sourceName - The source filename (for date attribution + display).
 * @param workspace - The current workspace slice (`{ animals }`), read-only, for the conflict check.
 * @returns The repair plan.
 */
export function buildImportRepairPlan(
  flatModel: unknown,
  sourceName: string,
  workspace: { animals?: unknown } | null | undefined
): ImportRepairPlan {
  const model = (flatModel ?? {}) as ValidationModel;

  // Benign normalizations are detected from the RAW model but validation runs on the NORMALIZED
  // model, so e.g. a `task_epoch`-only video file lists as a benign rename (not also a
  // required-`task_epochs` repair item the rename already resolves).
  const { benign, shimItems } = buildBenignAndShim(model);
  const normalized = structuredClone(model) as Record<string, unknown>;
  applyBenignNormalizations(normalized);
  const validation = buildValidationItems(normalized as ValidationModel);
  const shimPaths = new Set(shimItems.map((item) => item.path));
  const items = validation.items.filter((item) => !shimPaths.has(item.path));
  const blockers = validation.blockers.filter((blocker) => !shimPaths.has(blocker.path));
  const importOnlyItems: RepairItem[] = [];
  if (extractRecordingDate(normalized as ValidationModel, sourceName) === null) {
    importOnlyItems.push({
      path: IMPORT_RECORDING_DATE_PATH,
      label: 'Recording date',
      code: 'missing_recording_date',
      group: 'required',
      kind: 'input',
      why:
        'Could not determine the recording date from the filename or session_id. ' +
        'Choose the recording date for this YAML before importing.',
      inputType: 'date',
    });
  }

  // Decision: match the subject id against the existing workspace (by key or subject.subject_id).
  const subjectId = (normalized.subject as { subject_id?: unknown } | undefined)?.subject_id;
  let decision: ImportDecision;
  if (typeof subjectId !== 'string' || subjectId.trim() === '') {
    decision = { kind: 'blocked', reason: 'The file has no subject_id, so it cannot be attributed to an animal.' };
  } else {
    const existingAnimalId = findExistingAnimalId(subjectId, workspace);
    decision = existingAnimalId
      ? { kind: 'existing', subjectId, existingAnimalId }
      : { kind: 'new', subjectId };
  }
  const existingAnimalCatalogItems = buildExistingAnimalCatalogItems(
    normalized as ValidationModel,
    decision,
    workspace
  );
  const allItems = [...items, ...shimItems, ...importOnlyItems, ...existingAnimalCatalogItems];

  return {
    sourceName,
    items: allItems,
    blockers,
    benign,
    decision,
    hasErrors: allItems.length > 0 || blockers.length > 0,
  };
}

/**
 * Validate custom existing-animal catalog repair rows after the user resolves them.
 *
 * @param plan - The import-repair plan.
 * @param resolutions - Accepted/edited values keyed by repair-item path.
 * @returns A blocking reason, or null when the custom catalog rows are resolved.
 */
export function existingAnimalCatalogResolutionBlocker(
  plan: ImportRepairPlan,
  resolutions: Record<string, unknown>
): string | null {
  for (const item of plan.items) {
    const action = item.action;
    if (action?.kind !== 'existing_animal_catalog_ref') continue;
    const value = resolutions[item.path];
    if (value === undefined || value === null || value === '') {
      return `Resolve ${item.label} before importing.`;
    }
    if (value === item.suggested) {
      if (action.canBring) continue;
      return `Map ${item.label} to an existing value before importing.`;
    }
    if (!action.validMapValues.some((candidate) => sameRefValue(candidate, value))) {
      const noun = action.catalog === 'cameras' ? 'camera id' : 'recording-system name';
      return `Map ${item.label} to an existing ${noun}: ${validValueList(action.validMapValues)}.`;
    }
  }
  return null;
}

/**
 * Convert accepted "bring catalog entry" repair rows into executor catalog additions.
 *
 * @param plan - The import-repair plan.
 * @param resolutions - Accepted/edited values keyed by repair-item path.
 * @returns Catalog additions keyed by existing animal id.
 */
export function collectExistingAnimalCatalogAdditions(
  plan: ImportRepairPlan,
  resolutions: Record<string, unknown>
): Record<string, ExistingAnimalCatalogAdditions> {
  const additions: Record<string, ExistingAnimalCatalogAdditions> = {};
  for (const item of plan.items) {
    const action = item.action;
    if (
      action?.kind !== 'existing_animal_catalog_ref' ||
      !action.canBring ||
      resolutions[item.path] !== item.suggested ||
      action.sourceEntry === undefined
    ) {
      continue;
    }
    const target = additions[action.targetAnimalId] ?? {};
    if (action.catalog === 'cameras') {
      target.cameras = [...(target.cameras ?? []), structuredClone(action.sourceEntry)];
    } else {
      target.data_acq_device = [
        ...(target.data_acq_device ?? []),
        structuredClone(action.sourceEntry),
      ];
    }
    additions[action.targetAnimalId] = target;
  }
  return additions;
}

/**
 * Apply the benign normalizations and the user's accepted resolutions to a model, returning a NEW
 * model (the input is never mutated, and no key is dropped). Resolutions are keyed by the same path
 * the repair items carry; benign normalizations (space-key aliases, task_epoch rename, single-spelling
 * volume fill) are applied unconditionally because the screen lists them.
 *
 * @param flatModel - The decoded flat model.
 * @param resolutions - Accepted/edited values keyed by repair-item path.
 * @returns A repaired deep clone of the model.
 */
export function applyImportRepairs(
  flatModel: unknown,
  resolutions: Record<string, unknown>
): Record<string, unknown> {
  const model = structuredClone((flatModel ?? {}) as Record<string, unknown>);

  // Benign, lossless normalizations (space-key aliases, task_epoch rename, single-spelling volume fill).
  applyBenignNormalizations(model);

  // Accepted/edited resolutions, applied at their paths. A reconciled volume sets BOTH spellings
  // to the chosen value (keeping the shim key, never dropping it).
  for (const [path, value] of Object.entries(resolutions)) {
    if (path.startsWith(EXISTING_CAMERA_REF_PREFIX)) {
      if (value !== BRING_CATALOG_ENTRY) {
        mapCameraReference(
          model,
          decodeRepairToken(path.slice(EXISTING_CAMERA_REF_PREFIX.length)),
          value
        );
      }
      continue;
    }
    if (path.startsWith(EXISTING_DATA_ACQ_REF_PREFIX)) {
      if (value !== BRING_CATALOG_ENTRY) {
        mapDataAcqDeviceReference(
          model,
          decodeRepairToken(path.slice(EXISTING_DATA_ACQ_REF_PREFIX.length)),
          value
        );
      }
      continue;
    }
    setAtPath(model, path, value);
    const volMatch = path.match(/^(virus_injection\[\d+\])\.volume_in_ul$/);
    if (volMatch) setAtPath(model, `${volMatch[1]}.volume_in_uL`, value);
    const taskEpochMatch = path.match(/^(associated_(?:video_)?files\[\d+\])\.task_epochs$/);
    if (taskEpochMatch) deleteAtPath(model, `${taskEpochMatch[1]}.task_epoch`);
  }

  return model;
}
