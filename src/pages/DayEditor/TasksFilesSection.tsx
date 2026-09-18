import { useCallback, useEffect, useRef, useState } from 'react';
import EpochsTab from './EpochsTab';
import AssociatedFilesEditor, {
  collectValidEpochs,
  createSupplementalFileRow,
  SUPPLEMENTAL_FILE_PRESETS,
} from './AssociatedFilesEditor';
import AssociatedVideosEditor from './AssociatedVideosEditor';
import { getAnimalCameras, getDayAssociatedFiles, getDayAssociatedVideos } from '../../state/workspaceSelectors';
import { getIndexedSupplementalFiles } from '../../domain/associatedFiles';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import type { Task } from '../../state/workspaceTypes';
import type { SupplementalFilePreset } from './AssociatedFilesEditor';
import { pluralize } from '../../utils/pluralize';
import Button from '../../components/ui/Button';

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
  const additionalFiles = getIndexedSupplementalFiles(files);
  const additionalFileCount = additionalFiles.length;
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
  }, [files.length, manageRequest, managerOpen]);
  const manageFile = useCallback((fieldPath: string) => {
    setManagerOpen(true);
    setManageRequest({ fieldPath, token: Date.now() });
  }, []);
  const addAdditionalFile = (preset: SupplementalFilePreset) => {
    const index = files.length;
    onFieldUpdate('associated_files', [...files, createSupplementalFileRow(preset, files)]);
    setManagerOpen(true);
    setManageRequest({ fieldPath: `associated_files[${index}].name`, token: Date.now() });
  };

  return (
    <div className="tasks-files-step">
      <EpochsTab {...props} focusRequest={focusRequest} onManageFile={manageFile} />

      <section className="additional-files-section" aria-labelledby="additional-files-heading">
        <div className="additional-files-header">
          <div>
            <h2 id="additional-files-heading">Additional files</h2>
            <p>
              Add files used or produced during this recording. StateScript logs and videos are
              entered with their recording epoch above.
            </p>
          </div>
          <span className="supplemental-files-badge">
            {additionalFileCount} added
          </span>
        </div>
        <div className="additional-file-actions" aria-label="Add an additional recording file">
          {SUPPLEMENTAL_FILE_PRESETS.map((preset) => (
            <Button
              key={preset.key}
              variant="secondary"
              size="small"
              disabled={validEpochs.length === 0}
              onClick={() => addAdditionalFile(preset.key)}
              aria-label={`Add ${preset.label}`}
            >
              <span aria-hidden="true">+</span> {preset.label}
            </Button>
          ))}
        </div>
        {validEpochs.length === 0 && (
          <p className="field-help-text">Add a recording epoch before linking additional files.</p>
        )}
        {additionalFiles.length > 0 && (
          <ul className="additional-file-list" aria-label="Added additional files">
            {additionalFiles.map(({ entry, index }) => {
              const label = entry.name?.trim() || `Unnamed file ${index + 1}`;
              const hasValidEpoch = validEpochs.includes(Number(entry.task_epochs));
              const needsDetails = !entry.name?.trim() || !entry.description?.trim()
                || !entry.path?.trim() || !hasValidEpoch;
              return (
                <li key={entry.recordId ?? index} className="additional-file-item">
                  <div className="additional-file-summary">
                    <div className="additional-file-name-row">
                      <strong>{label}</strong>
                      <span className={`additional-file-status ${needsDetails ? 'needs-details' : ''}`}>
                        {needsDetails ? 'Needs details' : 'Ready'}
                      </span>
                    </div>
                    <span className="additional-file-description">
                      {entry.description?.trim() || 'Description needed'}
                      {' · '}
                      {hasValidEpoch ? `Epoch ${String(entry.task_epochs)}` : 'Recording epoch needed'}
                    </span>
                    <code className="additional-file-path">
                      {entry.path?.trim() || 'Path needed'}
                    </code>
                  </div>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => manageFile(`associated_files[${index}].name`)}
                    aria-label={`Edit additional file ${label}`}
                  >
                    Edit
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <details className="supplemental-disclosure" open={managerOpen}
          onToggle={(event) => setManagerOpen(event.currentTarget.open)}>
          <summary>
            {unassignedCount > 0
              ? `Fix ${unassignedCount} ${pluralize(unassignedCount, 'file')} that ${unassignedCount === 1 ? 'needs' : 'need'} an epoch`
              : `Edit saved file details · ${fileCount} ${pluralize(fileCount, 'file')}`}
          </summary>
          <section
            ref={managerRef}
            id="other-associated-files"
            className="day-editor-section supplemental-files-section"
            aria-labelledby="supplemental-files-heading"
            tabIndex={-1}
          >
            <div className="supplemental-files-header">
              <div>
                <h2 id="supplemental-files-heading">All saved file details</h2>
                <p>
                  Correct paths, cameras or epoch links here. Routine StateScript and video entry
                  stays in each epoch.
                </p>
              </div>
              <span className="supplemental-files-badge">
                {fileCount} {pluralize(fileCount, 'file')}
              </span>
            </div>
            <AssociatedFilesEditor
              files={files}
              tasks={tasks}
              showAddActions={false}
              onChange={(nextFiles) => onFieldUpdate('associated_files', nextFiles)}
            />
            <AssociatedVideosEditor videos={videos} cameras={getAnimalCameras(animal)} tasks={tasks}
              onChange={(nextVideos) => onFieldUpdate('associated_video_files', nextVideos)} />
          </section>
        </details>
      </section>
    </div>
  );
}
