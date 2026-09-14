/**
 * @fileoverview Day-used camera export binding + camera blast-radius (Phase 8.7 Task 5).
 *
 * Cameras are an ANIMAL-level catalog (`animal.cameras`) referenced per day by `tasks[].camera_id`
 * (an array), `associated_video_files[].camera_id` (a scalar), and `fs_gui_yamls[].camera_id` (a
 * scalar). The export must emit only the cameras a day actually USED — otherwise adding a camera
 * for a future recording would change a re-export of an old day by adding an unused camera device,
 * breaking the "past days keep what they used" promise.
 *
 * Verified safe downstream (trodes_to_nwb `main`, 2026-06-06): cameras resolve by their `id` field,
 * never by list position (`convert_yaml.py` names devices `"camera_device " + str(camera["id"])`;
 * `convert_position.py` looks up `devices['camera_device ' + str(video["camera_id"])]`), so dropping
 * an UNreferenced camera cannot shift or corrupt the mapping. A DANGLING reference (id with no
 * camera) would `KeyError` downstream, but the app's `dangling_camera_ref` rule blocks export first;
 * this helper simply omits the missing id (it can only emit cameras that exist).
 *
 * Pure functions over the workspace shape — no store/page coupling. Consumed by `mergeDayMetadata`
 * (the export bridge) and by the camera edit/correction blast-radius UI.
 */

import {
  getAnimalCameras,
  getDayCamerasUsed,
  getDayTasks,
  getDayAssociatedVideos,
  getDayFsGuiYamls,
} from './workspaceSelectors';
import type { Camera } from './workspaceTypes';

/**
 * Normalize a camera id to a comparison key so a numeric `1` and a string `"1"` match (corrupt
 * imports can carry either). Returns null for an absent id.
 *
 * @param id
 */
function cameraKey(id: unknown): string | null {
  return id === null || id === undefined ? null : String(id);
}

/**
 * The RAW camera-id values a day's task / video / FsGUI rows reference, in first-seen order, exact
 * duplicates removed (`Object.is` — no string-laundering of numeric ids). THE one enumeration of
 * "which fields carry a camera reference": the export merge, the cameras-used checklist, the
 * import pre-flight and the import repair planner all read it, so a fifth camera-bearing field is
 * added here once. Shape-tolerant: a non-array collection is skipped; a task's `camera_id` is
 * normally an array but a legacy/corrupt scalar is read as a one-element reference — it is just as
 * much a reference, and just as dangling when the camera does not exist.
 *
 * @param day - A recording-day record or a decoded flat model (both carry these collections).
 * @returns Raw referenced camera ids (`null`/`undefined` skipped).
 */
export function inferredCameraRefs(day: unknown): unknown[] {
  const refs: unknown[] = [];
  const add = (id: unknown): void => {
    if (id === null || id === undefined) return;
    if (!refs.some((existing) => Object.is(existing, id))) refs.push(id);
  };

  for (const task of getDayTasks(day)) {
    const cameraId: unknown = task?.camera_id;
    (Array.isArray(cameraId) ? cameraId : [cameraId]).forEach(add);
  }
  for (const video of getDayAssociatedVideos(day)) add(video?.camera_id);
  // FsGuiYaml's type omits `camera_id` (the interface predates the FsGUI camera field that
  // trodes_to_nwb + the `dangling_camera_ref` rule read), so read it tolerantly.
  for (const protocol of getDayFsGuiYamls(day)) add((protocol as { camera_id?: unknown })?.camera_id);

  return refs;
}

/**
 * {@link inferredCameraRefs} UNIONed with the explicit `day.cameras_used` set (listed FIRST, so a
 * consumer that reports the first unresolvable reference names the user's own checklist entry
 * before an inferred one). The export / pre-flight reference set.
 *
 * @param day - A recording-day record.
 * @returns Raw referenced camera ids, first-seen order.
 */
export function referencedCameraRefs(day: unknown): unknown[] {
  const refs: unknown[] = [];
  const add = (id: unknown): void => {
    if (id === null || id === undefined) return;
    if (!refs.some((existing) => Object.is(existing, id))) refs.push(id);
  };
  getDayCamerasUsed(day).forEach(add);
  inferredCameraRefs(day).forEach(add);
  return refs;
}

/**
 * The set of camera-id keys a single day INFERS from its task/video/fs-gui rows — the "the day
 * demonstrably used this camera" set; it does NOT include the explicit `day.cameras_used`
 * checklist set. Use this (not `referencedCameraKeys`) to decide which cameras-used checkboxes are
 * non-negotiable (rendered checked + disabled): a user must be able to uncheck a camera they only
 * explicitly added, so the disabled decision must ignore `cameras_used`.
 *
 * @param day - A recording-day record.
 * @returns Normalized camera-id keys inferred from task/video/fs-gui references.
 */
export function inferredCameraKeys(day: unknown): Set<string> {
  return new Set(inferredCameraRefs(day).map(cameraKey).filter((key): key is string => key !== null));
}

/**
 * The set of camera-id keys a single day references for EXPORT: the inferred references
 * (`inferredCameraKeys`) UNIONed with the explicit `day.cameras_used` set (an additive, glanceable
 * day-level checklist). Shape-tolerant. With `cameras_used` absent (all existing data) the union
 * adds nothing, so the exported camera set is unchanged. This is the export/blast-radius set — for
 * the cameras-used CHECKBOX disabled/hint decision use `inferredCameraKeys` instead, so an
 * explicitly-added camera stays uncheckable.
 *
 * @param day - A recording-day record.
 * @returns Normalized camera-id keys.
 */
export function referencedCameraKeys(day: unknown): Set<string> {
  return new Set(
    referencedCameraRefs(day).map(cameraKey).filter((key): key is string => key !== null)
  );
}

/**
 * The day-USED camera objects: the animal catalog cameras whose `id` this day references, in
 * catalog order. FILTERS the full camera objects (never reconstructs partials), so each emitted
 * camera keeps every schema-required field (including `lens`). A day with no references → `[]`
 * (the export keeps `cameras: []`, never deletes the key). Shape-safe: a corrupt non-array
 * `animal.cameras` degrades to `[]`.
 *
 * NB: this FILTERS, so it emits exactly the referenced ids that RESOLVE to a catalog camera — a
 * DANGLING id (referenced but absent from the catalog) is necessarily OMITTED, not included. That
 * is safe: the export-blocking `dangling_camera_ref` rule gates export at least as strictly (it
 * matches ids by exact type, so it can only be MORE eager to block than this String-normalized
 * resolver), so a dangling reference never reaches a real export file.
 *
 * @param animal - The owning animal (read shape-safely via `getAnimalCameras`).
 * @param day - The recording day.
 * @returns The day-used camera objects, in catalog order.
 */
export function resolveDayCameraUsage(animal: unknown, day: unknown): Camera[] {
  const refs = referencedCameraKeys(day);
  if (refs.size === 0) return [];
  // `cameraKey` is `string | null`, but a null key is never present in `refs` (it is skipped when
  // building the set), so `has(null)` is always false at runtime — the `as string` keeps that exact
  // behavior without a redundant null branch.
  return getAnimalCameras(animal).filter((camera) => refs.has(cameraKey(camera?.id) as string));
}

/**
 * Blast-radius helper: the ids of the given days that reference `cameraId`. Used to enumerate the
 * affected days before an "apply this camera correction to the N days using it" action (the
 * immutable-once-referenced rule), and never folded into the single-day export helper above.
 *
 * @param days - Recording-day records to scan.
 * @param cameraId - The camera id to look for.
 * @returns The ids of days that reference the camera, in input order.
 */
export function findCameraAffectedDays(days: unknown, cameraId: unknown): unknown[] {
  const key = cameraKey(cameraId);
  if (key === null) return [];
  return (Array.isArray(days) ? days : [])
    .filter((day) => referencedCameraKeys(day).has(key))
    .map((day) => day?.id)
    .filter((id) => id !== null && id !== undefined);
}
