import { useEffect, useState } from 'react';
import EpochsTab from './EpochsTab';
import AssociatedFilesEditor from './AssociatedFilesEditor';
import { getDayAssociatedFiles } from '../../state/workspaceSelectors';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import type { Task } from '../../state/workspaceTypes';

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
 * Epochs/videos/statescripts stay in the grid. Supplemental `associated_files` are secondary and
 * collapsed by default, but they auto-open when a repair action targets one of their row controls.
 */
export default function TasksFilesSection(props: TasksFilesSectionProps) {
  const { day, mergedDay, onFieldUpdate } = useDayEditorContext(props);
  const focusRequest = props.focusRequest ?? null;
  const [filesOpen, setFilesOpen] = useState(false);
  const tasks = Array.isArray(mergedDay?.tasks) ? (mergedDay.tasks as Task[]) : [];
  const files = getDayAssociatedFiles(day);

  useEffect(() => {
    if (focusRequest?.fieldPath?.startsWith('associated_files')) {
      setFilesOpen(true);
    }
  }, [focusRequest]);

  return (
    <div className="tasks-files-step">
      <EpochsTab {...props} focusRequest={focusRequest} />

      <details
        className="day-editor-section supplemental-files-section"
        open={filesOpen}
        onToggle={(event) => setFilesOpen((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="inherited-metadata-toggle">
          <span className="toggle-icon" aria-hidden="true">▶</span>
          Supplemental files
          <span className="inherited-metadata-badge">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>
        </summary>
        <div className="inherited-metadata-content">
          <AssociatedFilesEditor
            files={files}
            tasks={tasks}
            onChange={(nextFiles) => onFieldUpdate('associated_files', nextFiles)}
          />
        </div>
      </details>
    </div>
  );
}
