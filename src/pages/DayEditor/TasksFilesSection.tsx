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
 * Epochs/videos/statescripts stay in the grid. Supplemental `associated_files` stay visible below
 * the epoch workspace so day-specific extras are discoverable without crowding each epoch row.
 */
export default function TasksFilesSection(props: TasksFilesSectionProps) {
  const { day, mergedDay, onFieldUpdate } = useDayEditorContext(props);
  const focusRequest = props.focusRequest ?? null;
  const tasks = Array.isArray(mergedDay?.tasks) ? (mergedDay.tasks as Task[]) : [];
  const files = getDayAssociatedFiles(day);

  return (
    <div className="tasks-files-step">
      <nav className="tasks-files-subnav" aria-label="Tasks and files sections">
        <a href="#epochs-workspace">Epochs</a>
        <a href="#other-associated-files">
          Other files <span>{files.length}</span>
        </a>
      </nav>

      <EpochsTab {...props} focusRequest={focusRequest} />

      <section
        id="other-associated-files"
        className="day-editor-section supplemental-files-section"
        aria-labelledby="supplemental-files-heading"
      >
        <div className="supplemental-files-header">
          <div>
            <h2 id="supplemental-files-heading">Other associated files</h2>
            <p>
              Files outside the epoch statescript and video rows, such as realtime output or stimulus scripts.
            </p>
          </div>
          <span className="supplemental-files-badge">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>
        </div>
        <AssociatedFilesEditor
          files={files}
          tasks={tasks}
          onChange={(nextFiles) => onFieldUpdate('associated_files', nextFiles)}
        />
      </section>
    </div>
  );
}
