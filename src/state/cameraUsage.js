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

import { getAnimalCameras } from './workspaceSelectors';

/**
 * Normalize a camera id to a comparison key so a numeric `1` and a string `"1"` match (corrupt
 * imports can carry either). Returns null for an absent id.
 *
 * @param {*} id
 * @returns {string|null}
 */
function cameraKey(id) {
  return id === null || id === undefined ? null : String(id);
}

/**
 * The set of camera-id keys a single day references, across tasks (array `camera_id`), associated
 * video files (scalar), and FsGUI protocols (scalar). Shape-tolerant: non-array collections and
 * null/undefined ids are skipped, never thrown on.
 *
 * @param {object} day - A recording-day record.
 * @returns {Set<string>} Normalized camera-id keys.
 */
export function referencedCameraKeys(day) {
  const keys = new Set();
  const add = (id) => {
    const key = cameraKey(id);
    if (key !== null) keys.add(key);
  };

  const tasks = Array.isArray(day?.tasks) ? day.tasks : [];
  for (const task of tasks) {
    // task.camera_id is normally an array, but tolerate a stray scalar.
    const ids = Array.isArray(task?.camera_id)
      ? task.camera_id
      : task?.camera_id !== undefined && task?.camera_id !== null
        ? [task.camera_id]
        : [];
    ids.forEach(add);
  }

  const videos = Array.isArray(day?.associated_video_files) ? day.associated_video_files : [];
  for (const video of videos) add(video?.camera_id);

  const fsGui = Array.isArray(day?.fs_gui_yamls) ? day.fs_gui_yamls : [];
  for (const protocol of fsGui) add(protocol?.camera_id);

  return keys;
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
 * is safe: the export-blocking `dangling_camera_ref` rule fires first (its valid-id set is this
 * same subset), so a dangling reference never reaches a real export file.
 *
 * @param {object} animal - The owning animal (read shape-safely via `getAnimalCameras`).
 * @param {object} day - The recording day.
 * @returns {Array<object>} The day-used camera objects, in catalog order.
 */
export function resolveDayCameraUsage(animal, day) {
  const refs = referencedCameraKeys(day);
  if (refs.size === 0) return [];
  return getAnimalCameras(animal).filter((camera) => refs.has(cameraKey(camera?.id)));
}

/**
 * Blast-radius helper: the ids of the given days that reference `cameraId`. Used to enumerate the
 * affected days before an "apply this camera correction to the N days using it" action (the
 * immutable-once-referenced rule), and never folded into the single-day export helper above.
 *
 * @param {Array<object>} days - Recording-day records to scan.
 * @param {*} cameraId - The camera id to look for.
 * @returns {Array<*>} The ids of days that reference the camera, in input order.
 */
export function findCameraAffectedDays(days, cameraId) {
  const key = cameraKey(cameraId);
  if (key === null) return [];
  return (Array.isArray(days) ? days : [])
    .filter((day) => referencedCameraKeys(day).has(key))
    .map((day) => day?.id)
    .filter((id) => id !== null && id !== undefined);
}
