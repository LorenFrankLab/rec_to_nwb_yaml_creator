import { useEffect, useRef } from 'react';
import {
  getDefinedCameraIds,
  removeCameraReferences,
  removeStaleCameraReferences,
} from '../utils/cameraReferences';
import type { LegacyFormLoad, UseEpochCleanupParams } from './useEpochCleanup';

/** Inputs to {@link useCameraReferenceCleanup}: the legacy form slice. */
export type UseCameraReferenceCleanupParams = UseEpochCleanupParams;

/**
 * Legacy data-integrity effect: drop `camera_id` references to cameras that no longer exist in
 * the **legacy single-session `formData`** only.
 *
 * When a camera is removed or its id changes, `camera_id` references in `tasks`,
 * `associated_video_files` and `fs_gui_yamls` become invalid. The legacy form only renders a
 * checkbox or radio for cameras that exist, so such a reference is invisible to the user and
 * would otherwise be exported silently. An edit drops the references to the camera ids it
 * removed. Replacing the whole form with `setFormData` drops every reference to a camera the new
 * state does not define. Both updates return the same object when nothing is dropped, so React
 * bails out of the update and no re-render loop occurs.
 *
 * Loading an imported file (`loadImportedFormData`) drops nothing. The import has already removed
 * references to cameras the file does not define, so a dangling reference after an import points
 * into a cameras section the import left out: it was valid in the file. It stays and validation
 * reports it (`dangling_camera_ref`) until the cameras are fixed; adding them back restores the
 * links. (A task's camera list may be empty, so dropping them was a silent loss.) Edits after the
 * import still drop only the ids they remove.
 *
 * Workspace days are not scrubbed here: as with task epochs (see {@link useEpochCleanup}), their
 * stale camera references stay visible and validation reports them (`dangling_camera_ref`).
 *
 * @param params - The legacy form slice.
 * @param params.formData - Legacy single-session form state.
 * @param params.setFormData - Legacy form state setter.
 * @param params.lastLoad - The most recent whole-form load.
 */
export function useCameraReferenceCleanup({
  formData,
  setFormData,
  lastLoad,
}: UseCameraReferenceCleanupParams): void {
  // The load and the camera ids seen by the previous run; null before the first run.
  const previous = useRef<{ load: LegacyFormLoad | null; ids: number[] } | null>(null);

  useEffect(() => {
    const load = lastLoad.current;
    const ids: number[] = getDefinedCameraIds(formData?.cameras);
    const before = previous.current;
    previous.current = { load, ids };

    if (before === null || before.load !== load) {
      // The first run, or the whole form was just replaced.
      if (!load?.keepReferences) {
        setFormData((currentFormData) => removeStaleCameraReferences(currentFormData));
      }
      return;
    }

    // An edit: drop only the ids it removed.
    const removedIds = before.ids.filter((id) => !ids.includes(id));
    if (removedIds.length > 0) {
      setFormData((currentFormData) => removeCameraReferences(currentFormData, removedIds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData?.cameras]);
}
