import { useEffect } from 'react';

/** Inputs to {@link useEpochCleanup}. */
export interface UseEpochCleanupParams {
  /** Legacy single-session form state (loose). */
  formData: Record<string, any>;
  /** Legacy form state setter (callback form). */
  setFormData: (updater: (prev: any) => any) => void;
}

/**
 * Legacy data-integrity effect: clear orphaned task-epoch references in the
 * **legacy single-session `formData`** only.
 *
 * When a task is removed in the legacy form, any `task_epochs` reference in
 * `associated_files` / `associated_video_files`, and any `fs_gui_yamls[].epochs` entry, pointing
 * at one of its epochs becomes invalid. This hook clears the single-valued references to `''` and
 * drops the stale entries from the multi-valued FsGUI `epochs`. An epoch of `0` counts as set.
 *
 * It runs whenever the tasks change, including a load whose tasks define the same epochs as the
 * file before it. No loop guard is needed: the update returns the current state object when there
 * is nothing to clean, so React bails out of the render. (An earlier version skipped the check
 * whenever the set of valid epochs was unchanged, which let an orphan survive in a file loaded on
 * top of one that defined the same epochs.) A section with the wrong shape is left untouched for
 * schema validation to report.
 *
 * Workspace days are NOT scrubbed here (Load-Time Orphan Visibility Contract):
 * silently erasing a loaded stale reference hides corruption from the user. The
 * workspace instead **preserves** stale references so they stay visible, lets
 * validation own them (`orphaned_file` / `orphaned_video` → export blocked), and
 * clears them only through the explicit, user-confirmed destructive-edit flow in
 * the Day Editor (EpochsTab).
 *
 * @param params - The legacy form slice.
 * @param params.formData - Legacy single-session form state.
 * @param params.setFormData - Legacy form state setter.
 */
export function useEpochCleanup({ formData, setFormData }: UseEpochCleanupParams): void {
  useEffect(() => {
    const isSet = (epoch: unknown) => epoch !== '' && epoch !== undefined && epoch !== null;
    const section = (form: Record<string, any>, key: string): any[] =>
      Array.isArray(form[key]) ? form[key] : [];

    // Get currently valid task epochs from all tasks
    const validTaskEpochs = section(formData, 'tasks')
      .flatMap((task: any) => task?.task_epochs || [])
      .filter(isSet);
    const isStale = (epoch: unknown) => isSet(epoch) && !validTaskEpochs.includes(epoch);

    // Use callback form to get latest state at update time
    setFormData((currentFormData) => {
      // Check if any cleanup is needed
      const hasOrphanedEpochsInFiles = section(currentFormData, 'associated_files').some(
        (file: any) => isStale(file?.task_epochs)
      );
      const hasOrphanedEpochsInVideos = section(currentFormData, 'associated_video_files').some(
        (file: any) => isStale(file?.task_epochs)
      );
      const hasOrphanedEpochsInFsGui = section(currentFormData, 'fs_gui_yamls').some(
        (item: any) => Array.isArray(item?.epochs) && item.epochs.some(isStale)
      );

      if (!hasOrphanedEpochsInFiles && !hasOrphanedEpochsInVideos && !hasOrphanedEpochsInFsGui) {
        return currentFormData; // No changes needed
      }

      // Clone and clean up
      const updated = structuredClone(currentFormData);

      // Clean up associated_files and associated_video_files (single-valued task_epochs)
      [...section(updated, 'associated_files'), ...section(updated, 'associated_video_files')].forEach(
        (file: any) => {
          if (isStale(file?.task_epochs)) {
            file.task_epochs = '';
          }
        }
      );

      // Clean up fs_gui_yamls, whose epochs field is multi-valued
      section(updated, 'fs_gui_yamls').forEach((item: any) => {
        if (Array.isArray(item?.epochs)) {
          item.epochs = item.epochs.filter((epoch: unknown) => !isStale(epoch));
        }
      });

      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData?.tasks]); // Cleanup only needed when tasks change; callback form guarantees latest state access.
  // Optional chaining matches normal operation (formData is always defined) but lets the
  // clear `useStore` formData invariant surface instead of a cryptic render-time TypeError.

  // Workspace days are intentionally NOT auto-scrubbed (see the hook doc): stale
  // references are preserved for the user, surfaced by validation, and cleared
  // only via the explicit destructive-edit flow.
}
