import { useCallback, useEffect, useRef, useState } from 'react';
import EpochsTab from './EpochsTab';
import AssociatedFilesEditor, { collectValidEpochs } from './AssociatedFilesEditor';
import AssociatedVideosEditor from './AssociatedVideosEditor';
import { getAnimalCameras, getDayAssociatedFiles, getDayAssociatedVideos } from '../../state/workspaceSelectors';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import type { Task } from '../../state/workspaceTypes';
import { pluralize } from '../../utils/pluralize';

interface FocusRequest {
  fieldPath: string;
  token: number;
}

interface TasksFilesSectionProps extends DayEditorBundle {
  /** Repair request threaded from the frame. */
  focusRequest?: FocusRequest | null;
}

/**
 * Tasks & Files — the day editor's main recording-day work surface.
 *
 * Routine file entry stays in the epoch grid. A complete manager below it keeps every
 * saved file reachable, including duplicates and files left unassigned after epoch deletion.
 */
export default function TasksFilesSection(props: TasksFilesSectionProps) {
  const { animal, day, mergedDay, onFieldUpdate } = useDayEditorContext(props);
  const focusRequest = props.focusRequest ?? null;
  const tasks = Array.isArray(mergedDay?.tasks) ? (mergedDay.tasks as Task[]) : [];
  const files = getDayAssociatedFiles(day);
  const videos = getDayAssociatedVideos(day);
  const fileCount = files.length + videos.length;
  const validEpochs = collectValidEpochs(tasks);
  const unassignedCount = [...files, ...videos].filter((file) =>
    file.task_epochs === '' || file.task_epochs == null || !validEpochs.includes(Number(file.task_epochs))
  ).length;
  // The complete manager duplicates the routine per-epoch file controls and can become several
  // screens tall. Keep it closed for ordinary saved files; open it automatically only when a file
  // cannot be reached from an epoch or a repair link targets it.
  const [managerOpen, setManagerOpen] = useState(unassignedCount > 0);
  const [manageRequest, setManageRequest] = useState<FocusRequest | null>(null);
  const managerRef = useRef<HTMLElement>(null);
  const fileRepair = /^associated_(?:video_)?files(?:\[|$)/.test(focusRequest?.fieldPath ?? '');
  useEffect(() => {
    if (unassignedCount > 0 || fileRepair) setManagerOpen(true);
  }, [unassignedCount, fileRepair, focusRequest]);
  useEffect(() => {
    if (!manageRequest || !managerOpen) return;
    const frame = requestAnimationFrame(() => {
      const target = [...(managerRef.current?.querySelectorAll<HTMLElement>('[data-field-path]') ?? [])]
        .find((node) => node.dataset.fieldPath === manageRequest.fieldPath);
      (target ?? managerRef.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [manageRequest, managerOpen]);
  const manageFile = useCallback((fieldPath: string) => {
    setManagerOpen(true);
    setManageRequest({ fieldPath, token: Date.now() });
  }, []);

  return (
    <div className="tasks-files-step">
      <EpochsTab {...props} focusRequest={focusRequest} onManageFile={manageFile} />

      <details className="supplemental-disclosure" open={managerOpen}
        onToggle={(event) => setManagerOpen(event.currentTarget.open)}>
        <summary>Other files &amp; advanced file editing · {fileCount} saved{unassignedCount > 0 ? ` · ${unassignedCount} need an epoch` : ''}</summary>
        <section
          ref={managerRef}
          id="other-associated-files"
          className="day-editor-section supplemental-files-section"
          aria-labelledby="supplemental-files-heading"
          tabIndex={-1}
        >
          <div className="supplemental-files-header">
            <div>
              <h2 id="supplemental-files-heading">Other files and advanced editing</h2>
              <p>
                Add supplemental files, or edit any saved file directly. Routine video and statescript entry stays in each epoch.
              </p>
            </div>
            <span className="supplemental-files-badge">
              {fileCount} {pluralize(fileCount, 'file')}
            </span>
          </div>
          <AssociatedFilesEditor
            files={files}
            tasks={tasks}
            onChange={(nextFiles) => onFieldUpdate('associated_files', nextFiles)}
          />
          <AssociatedVideosEditor videos={videos} cameras={getAnimalCameras(animal)} tasks={tasks}
            onChange={(nextVideos) => onFieldUpdate('associated_video_files', nextVideos)} />
        </section>
      </details>
    </div>
  );
}
