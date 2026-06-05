import { useEffect, useRef } from 'react';

/**
 * Legacy data-integrity effect: clear orphaned task-epoch references in the
 * **legacy single-session `formData`** only.
 *
 * When a task is removed in the legacy form, any `task_epochs` reference in
 * `associated_files` / `associated_video_files` pointing at one of its epochs
 * becomes invalid; this hook scrubs those to `''`. A ref-based change-guard keyed
 * on the valid-epoch set runs cleanup only when that set actually changes.
 *
 * Workspace days are NOT scrubbed here (Load-Time Orphan Visibility Contract):
 * silently erasing a loaded stale reference hides corruption from the user. The
 * workspace instead **preserves** stale references so they stay visible, lets
 * validation own them (`orphaned_file` / `orphaned_video` → export blocked), and
 * clears them only through the explicit, user-confirmed destructive-edit flow in
 * the Day Editor (TasksEpochsStep). `workspace` / `updateDay` are still accepted
 * for call-site compatibility but no longer drive an automatic scrub.
 *
 * @param {object} params
 * @param {object} params.formData - Legacy single-session form state.
 * @param {Function} params.setFormData - Legacy form state setter.
 * @param {object} params.workspace - Workspace state (animals, days, settings).
 * @param {Function} params.updateDay - Workspace day updater `(dayId, updates) => void`.
 * @returns {void}
 */
export function useEpochCleanup({ formData, setFormData, workspace, updateDay }) {
  // ----- Legacy formData cleanup (unchanged behavior) -----
  // Uses a ref to track the last set of valid epochs to avoid infinite loops; only
  // runs cleanup when the valid epochs actually change (when tasks change).
  const lastValidEpochsRef = useRef('[]');

  useEffect(() => {
    // Get currently valid task epochs from all tasks
    const validTaskEpochs = (formData.tasks || [])
      .flatMap((task) => task.task_epochs || [])
      .filter(Boolean); // Remove empty/null values

    // Serialize for comparison
    const validEpochsStr = JSON.stringify([...validTaskEpochs].sort());

    // Only proceed if the set of valid epochs has changed
    if (validEpochsStr === lastValidEpochsRef.current) {
      return;
    }

    // Update ref to mark this epoch set as processed
    // Do this BEFORE the setFormData callback to prevent duplicate cleanup attempts
    lastValidEpochsRef.current = validEpochsStr;

    // Use callback form to get latest state at update time
    setFormData((currentFormData) => {
      // Check if any cleanup is needed
      const hasOrphanedEpochsInFiles = (currentFormData.associated_files || []).some(
        (file) => file.task_epochs && !validTaskEpochs.includes(file.task_epochs)
      );
      const hasOrphanedEpochsInVideos = (currentFormData.associated_video_files || []).some(
        (file) => file.task_epochs && !validTaskEpochs.includes(file.task_epochs)
      );

      if (!hasOrphanedEpochsInFiles && !hasOrphanedEpochsInVideos) {
        return currentFormData; // No changes needed
      }

      // Clone and clean up
      const updated = structuredClone(currentFormData);

      // Clean up associated_files
      if (updated.associated_files) {
        updated.associated_files.forEach((file) => {
          if (file.task_epochs && !validTaskEpochs.includes(file.task_epochs)) {
            file.task_epochs = '';
          }
        });
      }

      // Clean up associated_video_files
      if (updated.associated_video_files) {
        updated.associated_video_files.forEach((file) => {
          if (file.task_epochs && !validTaskEpochs.includes(file.task_epochs)) {
            file.task_epochs = '';
          }
        });
      }

      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData?.tasks]); // Cleanup only needed when tasks change; callback form guarantees latest state access.
  // Optional chaining matches normal operation (formData is always defined) but lets the
  // clear `useStore` formData invariant surface instead of a cryptic render-time TypeError.

  // Workspace days are intentionally NOT auto-scrubbed (see the hook doc): stale
  // references are preserved for the user, surfaced by validation, and cleared
  // only via the explicit destructive-edit flow. `workspace` / `updateDay` remain
  // in the signature for call-site stability and future use.
  void workspace;
  void updateDay;
}
