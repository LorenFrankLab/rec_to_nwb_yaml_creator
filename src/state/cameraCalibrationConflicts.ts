/**
 * @fileoverview Camera CALIBRATION conflicts across a batch import (finding F1) — the pure core.
 *
 * A camera is identified downstream by `camera_name` (Spyglass keys `CameraDevice` on it) while its
 * `meters_per_pixel` IS the position scale the converter applies
 * (`trodes_to_nwb/convert_position.py`). So two files that reuse one `camera_name` with different
 * calibrations do NOT describe one camera: the app's own rule (the camera editor's identity guard)
 * is that a different calibration is a DIFFERENT camera. Collapsing them onto the first file's row
 * would silently re-scale every later recording day.
 *
 * This module finds those disagreements across a subject's files (plus the existing animal's own
 * catalog row, when the subject is already in the workspace) and RESOLVES them into rewritten
 * camera rows, under one of two explicit resolutions:
 *
 *  - `split` (default): each distinct calibration is its own camera. The first candidate keeps the
 *    original name; every later one is committed as `${camera_name}_${YYYYMMDD}` of the date it was
 *    first seen (suffixed `_2`, `_3`… if that name is taken), so each day exports the calibration
 *    that was actually true on it.
 *  - `unify`: one chosen calibration for every day (the caller picks WHICH; the values that are not
 *    chosen are reported, never silently dropped — the source files remain the record).
 *
 * PURE: reads only its arguments, returns new rows, never mutates the input.
 *
 * @module state/cameraCalibrationConflicts
 */

import { getAnimalCameras } from './workspaceSelectors';

/**
 * The dependent fields that make a camera a DIFFERENT camera when they disagree under one
 * `camera_name` — the camera half of `CAMERA_IDENTITY_FIELDS` (identity minus the name itself).
 */
export const CAMERA_CALIBRATION_FIELDS = [
  'meters_per_pixel',
  'lens',
  'model',
  'manufacturer',
] as const;

/** A camera's dependent (calibration) fields. */
export type CameraCalibrationFields = Record<
  (typeof CAMERA_CALIBRATION_FIELDS)[number],
  unknown
>;

/** One distinct calibration recorded under a conflicted `camera_name`. */
export interface CameraCalibrationCandidate {
  /** The dependent fields exactly as recorded (never laundered). */
  fields: CameraCalibrationFields;
  /** The first file that recorded this calibration (`''` for the existing animal's own row). */
  firstSourceName: string;
  /** That file's recording date, ISO `YYYY-MM-DD` (`''` for the existing animal's own row). */
  firstDate: string;
  /** Every file that recorded this calibration, in date order. */
  sourceNames: string[];
  /** Those files' recording dates, parallel to `sourceNames`. */
  dates: string[];
  /** True when the animal ALREADY holds this calibration under this name. */
  fromExisting: boolean;
  /** The `camera_name` this calibration is committed under when the conflict is SPLIT. */
  splitName: string;
}

/** How a conflict is resolved. `split` (the default) keeps every calibration. */
export type CameraConflictResolution =
  | { kind: 'split' }
  | { kind: 'unify'; candidateIndex: number };

/** A `camera_name` recorded with more than one calibration, plus the resolution in force. */
export interface CameraCalibrationConflict {
  /** Stable across re-plans: `${subjectId}:${camera_name}`. */
  key: string;
  /** The reused `camera_name`. */
  cameraName: string;
  /** One candidate per distinct calibration, in first-seen (date) order. */
  candidates: CameraCalibrationCandidate[];
  /** The resolution this plan applied (defaults to `{ kind: 'split' }`). */
  resolution: CameraConflictResolution;
}

/** One source file's declared cameras, for conflict detection. */
export interface CameraConflictSource {
  sourceName: string;
  /** ISO `YYYY-MM-DD` recording date. */
  date: string;
  /** The cameras the file declares. */
  cameras: Array<Record<string, unknown>>;
}

/** A camera row plus the ids whose row this resolution RE-IDENTIFIED (renamed onto another camera). */
export interface ResolvedCameraRows {
  cameras: Array<Record<string, unknown>>;
  /** The FILE-space ids of rows this resolution renamed (a split, or a reroute onto an existing row). */
  reidentifiedCameraIds: Set<unknown>;
  /** The rows' names BEFORE the rewrite, in row order (a renamed row must not read as a new camera set). */
  originalNames: string[];
}

/**
 * The whole calibration analysis of one subject's batch: the questions to answer, plus the rows
 * whose answer is already in the animal's catalog (see {@link analyzeCameraCalibrations}).
 */
export interface CameraCalibrationAnalysis {
  conflicts: CameraCalibrationConflict[];
  /**
   * `rerouteKey(name, calibration)` → the EXISTING `camera_name` that row already is. Populated
   * when a file re-records a calibration the animal already holds under a split name.
   */
  reroutes: Map<string, string>;
}

/**
 * Normalize one dependent value to a comparison token, matching `valuesEqual`'s semantics
 * (numbers compare numerically, everything else as a trimmed string).
 *
 * @param value - The raw value.
 * @returns The comparison token.
 */
function token(value: unknown): string {
  return typeof value === 'number' ? String(value) : String(value ?? '').trim();
}

/**
 * A camera's `camera_name` as a trimmed string (imported YAML carries it loosely typed).
 *
 * @param camera - A camera row.
 * @returns The trimmed name (`''` when absent).
 */
function cameraNameOf(camera: Record<string, unknown> | null | undefined): string {
  return String(camera?.camera_name ?? '').trim();
}

/**
 * The dependent fields of a camera row.
 *
 * @param camera - A camera row.
 * @returns Its calibration fields.
 */
function calibrationFieldsOf(camera: Record<string, unknown>): CameraCalibrationFields {
  return Object.fromEntries(
    CAMERA_CALIBRATION_FIELDS.map((field) => [field, camera[field]])
  ) as CameraCalibrationFields;
}

/**
 * The identity key of a calibration: two rows with the same key are the SAME camera.
 *
 * @param fields - Calibration fields.
 * @returns The comparison key.
 */
function calibrationKey(fields: CameraCalibrationFields): string {
  // JSON, not a joined string: it is unambiguous whatever characters a value contains.
  return JSON.stringify(CAMERA_CALIBRATION_FIELDS.map((field) => token(fields[field])));
}

/**
 * The name a later calibration is committed under: `${cameraName}_${YYYYMMDD}` of the date it was
 * first recorded, suffixed `_2`, `_3`… when that name is already taken by another camera.
 *
 * @param cameraName - The reused name.
 * @param date - The candidate's first date (ISO `YYYY-MM-DD`).
 * @param taken - Names already in use (mutated: the chosen name is reserved).
 * @returns The split name.
 */
function allocateSplitName(cameraName: string, date: string, taken: Set<string>): string {
  const digits = date.replace(/\D/g, '');
  const base = digits === '' ? cameraName : `${cameraName}_${digits}`;
  let name = base;
  let suffix = 2;
  while (taken.has(name)) {
    name = `${base}_${suffix}`;
    suffix += 1;
  }
  taken.add(name);
  return name;
}

/**
 * Whether `candidateName` is a name {@link allocateSplitName} would have produced for `baseName` —
 * `overhead_camera_20230623`, or `…_20230623_2` after a collision.
 *
 * Deliberately narrow: it recognizes a camera THIS app split out of `baseName`, not any camera that
 * happens to share a calibration. Two genuinely different cameras can carry identical dependent
 * fields (same model and lens at the same height), and routing one onto the other by calibration
 * alone would attach a day's video to the wrong camera.
 *
 * @param candidateName - An existing camera's name.
 * @param baseName - The name a file recorded.
 * @returns True when `candidateName` is a split of `baseName`.
 */
function isSplitNameOf(candidateName: string, baseName: string): boolean {
  if (candidateName === baseName || !candidateName.startsWith(`${baseName}_`)) return false;
  return /^\d{8}(_\d+)?$/.test(candidateName.slice(baseName.length + 1));
}

/**
 * The lookup key for a reroute: a file row's recorded name plus its calibration.
 *
 * @param cameraName - The name the file recorded.
 * @param calibration - That row's calibration key.
 * @returns The map key.
 */
function rerouteKey(cameraName: string, calibration: string): string {
  return JSON.stringify([cameraName, calibration]);
}

/** A candidate under construction (its `splitName` is allocated once the conflict is confirmed). */
type DraftCandidate = Omit<CameraCalibrationCandidate, 'splitName'>;

/**
 * Coerce a caller-supplied resolution to one this plan can actually APPLY, falling back to the
 * default `split` (which never discards a calibration) when it cannot:
 *  - a `candidateIndex` that addresses no candidate (e.g. a choice kept across a re-plan of a
 *    different file set);
 *  - a `unify` onto a calibration the EXISTING animal does not hold, when it holds one of its own:
 *    an import ADDS a camera, it never re-calibrates a row the animal's earlier days already
 *    export (that is a correction, made in the animal's camera editor). Honoring it would leave
 *    the days on the animal's value while claiming the chosen one.
 *
 * @param resolution - The caller's choice, if any.
 * @param candidates - This conflict's candidates.
 * @returns The resolution in force.
 */
function effectiveResolution(
  resolution: CameraConflictResolution | undefined,
  candidates: DraftCandidate[]
): CameraConflictResolution {
  if (
    resolution?.kind === 'unify' &&
    Number.isInteger(resolution.candidateIndex) &&
    resolution.candidateIndex >= 0 &&
    resolution.candidateIndex < candidates.length &&
    (!candidates.some((candidate) => candidate.fromExisting) ||
      candidates[resolution.candidateIndex].fromExisting)
  ) {
    return { kind: 'unify', candidateIndex: resolution.candidateIndex };
  }
  return { kind: 'split' };
}

/**
 * Analyze one subject's batch: find every `camera_name` its files (and, when it already exists, the
 * animal's own catalog) record with MORE THAN ONE calibration, and the file rows whose calibration
 * the animal ALREADY holds under a split name.
 *
 * Candidates are one per distinct calibration in first-seen order; the existing animal's row is
 * candidate 0 (`fromExisting`), since it is what the animal's earlier days already reference and
 * the import never rewrites it.
 *
 * A REROUTE is what keeps an incremental import idempotent: once days 1–2 were imported and split,
 * the animal holds `overhead_camera` AND `overhead_camera_20230623`. A later file recording the
 * second calibration under the bare name IS that split camera — routing it there (rather than
 * splitting a second time) is why a day-by-day import does not accumulate one redundant
 * `CameraDevice` per batch, and why the preview does not re-ask a question already answered.
 *
 * @param subjectId - The planned animal id (namespaces the conflict key).
 * @param sources - The subject's files, DATE-SORTED, with the cameras each declares.
 * @param existing - The existing workspace animal, or null when the subject is new.
 * @param resolutions - Caller-chosen resolutions keyed by conflict key.
 * @returns The conflicts to answer plus the rows already answered by the animal's catalog.
 */
export function analyzeCameraCalibrations(
  subjectId: string,
  sources: CameraConflictSource[],
  existing: unknown = null,
  resolutions: Record<string, CameraConflictResolution> = {}
): CameraCalibrationAnalysis {
  /** camera_name → calibration key → candidate (insertion order = first-seen order). */
  const byName = new Map<string, Map<string, DraftCandidate>>();
  const takenNames = new Set<string>();
  const existingRows = getAnimalCameras(existing).map((camera) => ({
    name: cameraNameOf(camera as unknown as Record<string, unknown>),
    calibration: calibrationKey(
      calibrationFieldsOf(camera as unknown as Record<string, unknown>)
    ),
  }));
  const reroutes = new Map<string, string>();

  const record = (
    camera: Record<string, unknown>,
    source: { sourceName: string; date: string } | null
  ): void => {
    const name = cameraNameOf(camera);
    if (name === '') return;
    takenNames.add(name);
    const fields = calibrationFieldsOf(camera);
    const key = calibrationKey(fields);
    if (source !== null) {
      // Already answered: the animal holds this very calibration as a split of this name. The row
      // IS that camera, so it declares nothing new — no candidate, no second split.
      const held = existingRows.find(
        (row) => row.calibration === key && isSplitNameOf(row.name, name)
      );
      if (held !== undefined) {
        reroutes.set(rerouteKey(name, key), held.name);
        return;
      }
    }
    if (!byName.has(name)) byName.set(name, new Map());
    const candidates = byName.get(name)!;
    const candidate = candidates.get(key);
    if (candidate === undefined) {
      candidates.set(key, {
        fields,
        firstSourceName: source?.sourceName ?? '',
        firstDate: source?.date ?? '',
        sourceNames: source ? [source.sourceName] : [],
        dates: source ? [source.date] : [],
        fromExisting: source === null,
      });
      return;
    }
    if (source) {
      candidate.sourceNames.push(source.sourceName);
      candidate.dates.push(source.date);
      if (candidate.firstSourceName === '') {
        // The animal already held this calibration; the files confirm it.
        candidate.firstSourceName = source.sourceName;
        candidate.firstDate = source.date;
      }
    }
  };

  for (const camera of getAnimalCameras(existing)) {
    record(camera as unknown as Record<string, unknown>, null);
  }
  for (const source of sources) {
    for (const camera of source.cameras) {
      if (camera === null || typeof camera !== 'object') continue;
      record(camera, { sourceName: source.sourceName, date: source.date });
    }
  }

  const conflicts: CameraCalibrationConflict[] = [];
  for (const [cameraName, candidates] of byName) {
    if (candidates.size < 2) continue;
    const drafts = [...candidates.values()];
    const key = `${subjectId}:${cameraName}`;
    conflicts.push({
      key,
      cameraName,
      candidates: drafts.map((draft, index) => ({
        ...draft,
        // Candidate 0 — the first-seen calibration, or the animal's own row — keeps the name it
        // already exports under; only LATER calibrations are given a dated name of their own.
        splitName:
          index === 0 ? cameraName : allocateSplitName(cameraName, draft.firstDate, takenNames),
      })),
      resolution: effectiveResolution(resolutions[key], drafts),
    });
  }
  return { conflicts, reroutes };
}

/**
 * Rewrite ONE file's camera rows so the batch's analysis is applied:
 *  - a REROUTE renames the row to the existing camera it already is (see
 *    {@link analyzeCameraCalibrations});
 *  - `split` renames a row carrying a later calibration to that candidate's `splitName`, which
 *    makes it a camera of its own downstream (the union identifies cameras by name);
 *  - `unify` gives every row under the conflicted name the chosen candidate's fields, so all of
 *    them collapse onto one catalog row with the chosen calibration.
 *
 * Every renamed row's id is reported in `reidentifiedCameraIds`, so the caller can tell a row that
 * means a DIFFERENT camera from one that merely reuses an existing animal's id numbering.
 *
 * @param cameras - The file's declared cameras.
 * @param analysis - The subject's analysis (from {@link analyzeCameraCalibrations}).
 * @returns The rewritten rows, the re-identified ids, and the names before the rewrite. Input is
 *   never mutated.
 */
export function applyCameraConflictResolutions(
  cameras: Array<Record<string, unknown>>,
  analysis: CameraCalibrationAnalysis
): ResolvedCameraRows {
  const reidentifiedCameraIds = new Set<unknown>();
  const originalNames = cameras.map((camera) =>
    camera !== null && typeof camera === 'object' ? cameraNameOf(camera) : ''
  );
  const { conflicts, reroutes } = analysis;
  if (conflicts.length === 0 && reroutes.size === 0) {
    return { cameras, reidentifiedCameraIds, originalNames };
  }
  const byName = new Map(conflicts.map((conflict) => [conflict.cameraName, conflict]));

  const resolved = cameras.map((camera) => {
    if (camera === null || typeof camera !== 'object') return camera;
    const name = cameraNameOf(camera);
    const key = calibrationKey(calibrationFieldsOf(camera));
    const rerouted = reroutes.get(rerouteKey(name, key));
    if (rerouted !== undefined) {
      reidentifiedCameraIds.add(camera.id);
      return { ...camera, camera_name: rerouted };
    }
    const conflict = byName.get(name);
    if (conflict === undefined) return camera;
    const index = conflict.candidates.findIndex(
      (candidate) => calibrationKey(candidate.fields) === key
    );
    if (index < 0) return camera;
    if (conflict.resolution.kind === 'unify') {
      return { ...camera, ...conflict.candidates[conflict.resolution.candidateIndex].fields };
    }
    if (index === 0) return camera;
    reidentifiedCameraIds.add(camera.id);
    return { ...camera, camera_name: conflict.candidates[index].splitName };
  });

  return { cameras: resolved, reidentifiedCameraIds, originalNames };
}

/**
 * The calibration fields that actually DIFFER across a conflict's candidates — what a reader needs
 * to see (a 4-column table of identical lenses hides the one number that changed).
 *
 * @param conflict - The conflict.
 * @returns The differing field names, in declaration order (never empty for a real conflict).
 */
export function differingCalibrationFields(
  conflict: CameraCalibrationConflict
): Array<(typeof CAMERA_CALIBRATION_FIELDS)[number]> {
  return CAMERA_CALIBRATION_FIELDS.filter(
    (field) =>
      new Set(conflict.candidates.map((candidate) => token(candidate.fields[field]))).size > 1
  );
}

/**
 * A candidate's differing values as display text, e.g. `meters_per_pixel 0.001073`.
 *
 * @param candidate - The candidate.
 * @param fields - The fields to describe (see {@link differingCalibrationFields}).
 * @returns The display text.
 */
export function describeCalibration(
  candidate: CameraCalibrationCandidate,
  fields: ReadonlyArray<(typeof CAMERA_CALIBRATION_FIELDS)[number]>
): string {
  return fields.map((field) => `${field} ${String(candidate.fields[field] ?? '—')}`).join(', ');
}

/**
 * One human-readable sentence describing a conflict AND how this plan resolves it — the text the
 * batch preview's divergence list shows alongside the interactive control.
 *
 * @param conflict - The conflict.
 * @returns The description.
 */
export function describeCameraConflict(conflict: CameraCalibrationConflict): string {
  const fields = differingCalibrationFields(conflict);
  const lead =
    `Camera "${conflict.cameraName}" has ${conflict.candidates.length} calibrations ` +
    `across the files`;
  if (conflict.resolution.kind === 'unify') {
    const chosen = conflict.candidates[conflict.resolution.candidateIndex];
    const discarded = conflict.candidates
      .filter((candidate) => candidate !== chosen)
      .map(
        (candidate) =>
          `${describeCalibration(candidate, fields)} (${
            candidate.sourceNames.join(', ') || 'already on this animal'
          })`
      );
    return (
      `${lead}; every day will use ${describeCalibration(chosen, fields)}. ` +
      `NOT imported: ${discarded.join('; ')}.`
    );
  }
  const kept = conflict.candidates.map(
    (candidate) =>
      `${candidate.splitName} = ${describeCalibration(candidate, fields)} (${
        candidate.fromExisting && candidate.sourceNames.length === 0
          ? 'already on this animal'
          : candidate.sourceNames.join(', ')
      })`
  );
  return `${lead}; each is kept as its own camera: ${kept.join('; ')}.`;
}
