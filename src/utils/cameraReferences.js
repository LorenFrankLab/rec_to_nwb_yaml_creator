/**
 * Reconcile camera_id references with the cameras list.
 *
 * Three sections reference cameras by id:
 * - tasks[].camera_id            (integer array, multi-select)
 * - fs_gui_yamls[].camera_id     (integer array, multi-select)
 * - associated_video_files[].camera_id (single integer, '' when unset)
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

  const staleInArray = (items) =>
    (items || []).some(
      (item) => Array.isArray(item?.camera_id) && item.camera_id.some(isStale)
    );
  const staleInVideos = (form?.associated_video_files || []).some(
    (video) =>
      video?.camera_id !== '' &&
      video?.camera_id !== undefined &&
      video?.camera_id !== null &&
      isStale(video.camera_id)
  );

  if (
    !staleInArray(form?.tasks) &&
    !staleInArray(form?.fs_gui_yamls) &&
    !staleInVideos
  ) {
    return form;
  }

  const updated = structuredClone(form);
  ['tasks', 'fs_gui_yamls'].forEach((key) => {
    (updated[key] || []).forEach((item) => {
      if (Array.isArray(item?.camera_id)) {
        item.camera_id = item.camera_id.filter((id) => !isStale(id));
      }
    });
  });
  (updated.associated_video_files || []).forEach((video) => {
    if (
      video?.camera_id !== '' &&
      video?.camera_id !== undefined &&
      video?.camera_id !== null &&
      isStale(video.camera_id)
    ) {
      video.camera_id = '';
    }
  });
  return updated;
};
