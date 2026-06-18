import EpochsTab from './EpochsTab';
import AssociatedFilesEditor from './AssociatedFilesEditor';
import { getIndexedSupplementalFiles } from '../../domain/associatedFiles';
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
  const supplementalFileCount = getIndexedSupplementalFiles(files).length;
  const scrollToSection = (id: string) => {
    const section = document.getElementById(id);
    section?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    section?.focus({ preventScroll: true });
  };

  return (
    <div className="tasks-files-step">
      <nav className="tasks-files-subnav" aria-label="Tasks and files sections">
        <button type="button" onClick={() => scrollToSection('epochs-workspace')}>
          Epochs
        </button>
        <button type="button" onClick={() => scrollToSection('other-associated-files')}>
          Supplemental files <span>{supplementalFileCount}</span>
        </button>
      </nav>

      <EpochsTab {...props} focusRequest={focusRequest} />

      <section
        id="other-associated-files"
        className="day-editor-section supplemental-files-section"
        aria-labelledby="supplemental-files-heading"
        tabIndex={-1}
      >
        <div className="supplemental-files-header">
          <div>
            <h2 id="supplemental-files-heading">Supplemental files</h2>
            <p>
              Rare day-specific extras outside generated statescripts and videos, such as realtime output or stimulus scripts.
            </p>
          </div>
          <span className="supplemental-files-badge">
            {supplementalFileCount} {supplementalFileCount === 1 ? 'file' : 'files'}
          </span>
        </div>
        <AssociatedFilesEditor
          files={files}
          tasks={tasks}
          supplementalOnly
          onChange={(nextFiles) => onFieldUpdate('associated_files', nextFiles)}
        />
      </section>
    </div>
  );
}
