/**
 * Reconcile camera_id references with the cameras list.
 *
 * Three sections reference cameras by id:
 * - tasks[].camera_id                  (integer array, multi-select)
 * - associated_video_files[].camera_id (single integer, '' when unset)
 * - fs_gui_yamls[].camera_id           (single integer, '' when unset)
 *
 * The form only renders a checkbox/radio per camera that currently exists, so
 * a reference to a removed or renumbered camera is invisible in the UI and
 * would otherwise be exported silently.
 */

/**
 * Integer ids of the cameras currently defined.
 *
 * The camera id input holds a string while it is being typed and NaN/'' while
 * empty; only values that parse to an integer count as defined.
 *
 * @param {Array<{id: number|string}>|undefined} cameras
 * @returns {number[]}
 */
export const getDefinedCameraIds = (cameras) =>
  (cameras || [])
    .map((camera) => parseInt(camera?.id, 10))
    .filter((id) => !Number.isNaN(id));

const toInt = (value) => parseInt(value, 10);

/** Sections whose camera_id is a single integer ('' when unset). */
const SINGLE_CAMERA_SECTIONS = ['associated_video_files', 'fs_gui_yamls'];

/**
 * Return a copy of `form` with camera_id references to undefined cameras
 * removed. Returns `form` itself (same reference) when nothing is stale, so
 * callers can bail out of a state update.
 *
 * @param {object} form - Form data
 * @returns {object} The same object, or a cleaned structuredClone
 */
export const removeStaleCameraReferences = (form) => {
  const valid = new Set(getDefinedCameraIds(form?.cameras));
  const isStale = (value) => !valid.has(toInt(value));

  const isSet = (value) => value !== '' && value !== undefined && value !== null;

  const staleInArrays = (form?.tasks || []).some(
    (task) => Array.isArray(task?.camera_id) && task.camera_id.some(isStale)
  );
  const staleInScalars = SINGLE_CAMERA_SECTIONS.some((key) =>
    (form?.[key] || []).some(
      (item) => isSet(item?.camera_id) && isStale(item.camera_id)
    )
  );

  if (!staleInArrays && !staleInScalars) {
    return form;
  }

  const updated = structuredClone(form);
  (updated.tasks || []).forEach((task) => {
    if (Array.isArray(task?.camera_id)) {
      task.camera_id = task.camera_id.filter((id) => !isStale(id));
    }
  });
  SINGLE_CAMERA_SECTIONS.forEach((key) => {
    (updated[key] || []).forEach((item) => {
      if (isSet(item?.camera_id) && isStale(item.camera_id)) {
        item.camera_id = '';
      }
    });
  });
  return updated;
};
