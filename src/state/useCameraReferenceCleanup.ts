import { useEffect } from 'react';
import { removeStaleCameraReferences } from '../utils/cameraReferences';
import type { UseEpochCleanupParams } from './useEpochCleanup';

/** Inputs to {@link useCameraReferenceCleanup}: the legacy form slice. */
export type UseCameraReferenceCleanupParams = UseEpochCleanupParams;

/**
 * Legacy data-integrity effect: drop `camera_id` references to cameras that no longer exist in
 * the **legacy single-session `formData`** only.
 *
 * When a camera is removed or its id changes, `camera_id` references in `tasks`,
 * `associated_video_files` and `fs_gui_yamls` become invalid. The legacy form only renders a
 * checkbox or radio for cameras that exist, so such a reference is invisible to the user and
 * would otherwise be exported silently. Drop them whenever the cameras list changes (including on
 * import). `removeStaleCameraReferences` returns the same object when nothing is stale, so React
 * bails out of the update and no re-render loop occurs.
 *
 * Workspace days are not scrubbed here: as with task epochs (see {@link useEpochCleanup}), their
 * stale camera references stay visible and validation reports them (`dangling_camera_ref`).
 *
 * @param params - The legacy form slice.
 * @param params.formData - Legacy single-session form state.
 * @param params.setFormData - Legacy form state setter.
 */
export function useCameraReferenceCleanup({
  formData,
  setFormData,
}: UseCameraReferenceCleanupParams): void {
  useEffect(() => {
    setFormData((currentFormData) => removeStaleCameraReferences(currentFormData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData?.cameras]);
}
