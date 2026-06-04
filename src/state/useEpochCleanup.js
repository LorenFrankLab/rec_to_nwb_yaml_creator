import { useEffect, useRef } from 'react';

/**
 * Critical data-integrity effect: clear orphaned task-epoch references.
 *
 * When a task is removed, any `task_epochs` reference in `associated_files` or
 * `associated_video_files` that pointed at one of its epochs becomes invalid and
 * would corrupt the exported YAML. This hook scrubs those orphaned references to
 * `''` — for BOTH the legacy single-session `formData` AND every workspace day —
 * so the invariant holds regardless of which editing surface produced the data.
 *
 * Each slice uses a ref-based change-guard keyed on its valid-epoch set so cleanup
 * runs only when the set of valid epochs actually changes, never looping on the
 * write it just made.
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
  }, [formData.tasks]); // Cleanup only needed when tasks change; callback form guarantees latest state access

  // ----- Workspace day cleanup (same invariant, per day) -----
  // Guard keyed by dayId so cleanup runs only when a day's valid-epoch set changes.
  const lastWorkspaceEpochsRef = useRef({});

  useEffect(() => {
    const days = workspace?.days || {};

    for (const dayId of Object.keys(days)) {
      const day = days[dayId];
      const validEpochs = (day.tasks || [])
        .flatMap((task) => task.task_epochs || [])
        .filter(Boolean);
      const validEpochsStr = JSON.stringify([...validEpochs].sort());

      // Skip days whose valid-epoch set has not changed since we last processed them.
      if (lastWorkspaceEpochsRef.current[dayId] === validEpochsStr) {
        continue;
      }
      lastWorkspaceEpochsRef.current[dayId] = validEpochsStr;

      const hasOrphanedFiles = (day.associated_files || []).some(
        (file) => file.task_epochs && !validEpochs.includes(file.task_epochs)
      );
      const hasOrphanedVideos = (day.associated_video_files || []).some(
        (file) => file.task_epochs && !validEpochs.includes(file.task_epochs)
      );

      if (!hasOrphanedFiles && !hasOrphanedVideos) {
        continue;
      }

      const associatedFiles = (day.associated_files || []).map((file) =>
        file.task_epochs && !validEpochs.includes(file.task_epochs)
          ? { ...file, task_epochs: '' }
          : file
      );
      const associatedVideoFiles = (day.associated_video_files || []).map((file) =>
        file.task_epochs && !validEpochs.includes(file.task_epochs)
          ? { ...file, task_epochs: '' }
          : file
      );

      // Dispatch through the workspace update path so immutability + lastModified
      // semantics match every other day mutation.
      updateDay(dayId, {
        associated_files: associatedFiles,
        associated_video_files: associatedVideoFiles,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.days]); // Per-day guard prevents looping on the write we just made
}
