import EpochsTab from './EpochsTab';
import AssociatedFilesEditor from './AssociatedFilesEditor';
import { getIndexedSupplementalFiles } from '../../domain/associatedFiles';
import { getDayAssociatedFiles } from '../../state/workspaceSelectors';
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
 * Epochs/videos/statescripts stay in the grid. Supplemental files sit in a labelled disclosure
 * below it, open when files are present or a repair targets them.
 */
export default function TasksFilesSection(props: TasksFilesSectionProps) {
  const { day, mergedDay, onFieldUpdate } = useDayEditorContext(props);
  const focusRequest = props.focusRequest ?? null;
  const tasks = Array.isArray(mergedDay?.tasks) ? (mergedDay.tasks as Task[]) : [];
  const files = getDayAssociatedFiles(day);
  const supplementalFileCount = getIndexedSupplementalFiles(files).length;

  return (
    <div className="tasks-files-step">
      <EpochsTab {...props} focusRequest={focusRequest} />

      <details className="supplemental-disclosure" open={supplementalFileCount > 0 || focusRequest?.fieldPath.startsWith('associated_files') || undefined}>
        <summary>Supplemental files (optional) · {supplementalFileCount} {pluralize(supplementalFileCount, 'file')}</summary>
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
            {supplementalFileCount} {pluralize(supplementalFileCount, 'file')}
          </span>
        </div>
        <AssociatedFilesEditor
          files={files}
          tasks={tasks}
          supplementalOnly
          onChange={(nextFiles) => onFieldUpdate('associated_files', nextFiles)}
        />
      </section>
      </details>
    </div>
  );
}
