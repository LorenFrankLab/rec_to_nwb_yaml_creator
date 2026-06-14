import { useId } from 'react';
import Button from '../../components/ui/Button';
import type { Task } from '../../state/workspaceTypes';
import './AssociatedFilesEditor.scss';

/** Editor row shape: `task_epochs` carries an empty-string sentinel for "unselected". */
interface FileRow {
  name?: string;
  description?: string;
  path?: string;
  task_epochs?: number | string;
}

/**
 * Collect the day's valid task-epoch numbers (sorted, de-duplicated).
 *
 * The associated-files editor offers ONLY these as epoch options so a file can
 * never reference an epoch the day's tasks do not define — the controlled-ref
 * contract that keeps the export from carrying a dangling `task_epochs` (the
 * `orphaned_file` validation error). This mirrors AssociatedVideosEditor.
 */
function collectValidEpochs(tasks: unknown): number[] {
  const seen = new Set<number>();
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    // A malformed task_epochs inside an otherwise-valid task (a string, not an
    // array) must contribute no epochs rather than crash this repair UI on `.forEach`.
    const epochs: unknown[] = Array.isArray(task?.task_epochs) ? task.task_epochs : [];
    epochs.forEach((epoch) => {
      const n = Number(epoch);
      if (Number.isInteger(n)) seen.add(n);
    });
  });
  return [...seen].sort((a, b) => a - b);
}

interface AssociatedFilesEditorProps {
  /** The day's associated_files. */
  files?: FileRow[];
  /** The day's tasks (task_epochs options). */
  tasks?: Task[];
  /** Called with the next files array. */
  onChange: (files: FileRow[]) => void;
}

/**
 * AssociatedFilesEditor - workspace editor for a day's `associated_files`.
 *
 * This is the repair surface for the `orphaned_file` validation error: that error
 * routes to the Epochs step, so the Epochs step must offer a way to edit
 * associated_files. Without it the error was a dead-end that blocked export with no
 * fixable UI.
 *
 * Controlled-reference contract (mirrors AssociatedVideosEditor): each row's
 * `task_epochs` is a SCALAR chosen from the day's task epochs (a `<select>`). There
 * is no manual numeric entry — the normal path can only ever produce an epoch that
 * exists. A row loaded with a stale epoch (no longer present in any task) renders a
 * visible "Missing epoch N" unselectable option (never a blank select) and is
 * flagged with `role="alert"`, so the user can re-point it before the day is clean.
 *
 * REPAIR-FOCUS ANCHOR: each row's epoch `<select>` carries `data-field-path` set to
 * `associated_files[<index>].task_epochs`, the exact path the `orphaned_file`
 * validation issue emits. The Day Editor stepper's focus search uses this to land a
 * repair click on the offending row's epoch control instead of the broad step.
 *
 * Persisted through `onChange(nextArray)` (the step routes that to
 * `onFieldUpdate('associated_files', nextArray)`).
 */
export default function AssociatedFilesEditor({ files = [], tasks = [], onChange }: AssociatedFilesEditorProps) {
  const baseId = useId();
  // Tolerate corrupt persisted state: a non-array `files` (`{}`) must not crash render.
  const fileList = Array.isArray(files) ? files : [];
  const validEpochs = collectValidEpochs(tasks);
  const validEpochSet = new Set(validEpochs);

  /**
   * Replace one row's field and emit the updated array.
   */
  function updateRow(index: number, field: keyof FileRow, value: string | number) {
    onChange(fileList.map((file, i) => (i === index ? { ...file, [field]: value } as FileRow : file)));
  }

  /**
   * Append an empty file row.
   */
  function addRow() {
    onChange([...fileList, { name: '', description: '', path: '', task_epochs: '' }]);
  }

  /**
   * Remove the row at `index`.
   */
  function removeRow(index: number) {
    onChange(fileList.filter((_, i) => i !== index));
  }

  return (
    <section className="associated-files-editor" aria-labelledby={`${baseId}-heading`}>
      <header className="associated-files-header">
        <h3 id={`${baseId}-heading`}>Associated files</h3>
        <p className="associated-files-hint">
          Link supplementary files (e.g., DIO event lists, state-script logs) to a
          task epoch. The epoch is chosen from this day&apos;s task epochs, so a file
          can never point at one that does not exist.
        </p>
      </header>

      {fileList.length === 0 ? (
        <p className="associated-files-empty">No associated files yet.</p>
      ) : (
        <ul className="associated-files-rows">
          {fileList.map((file, index) => {
            const epoch = file.task_epochs;
            const epochStale =
              epoch !== '' && epoch != null && !validEpochSet.has(Number(epoch));
            const staleId = `${baseId}-stale-${index}`;
            const label = file.name || `file ${index + 1}`;
            return (
              <li key={index} className="associated-file-row">
                <div className="form-group">
                  <label htmlFor={`${baseId}-name-${index}`}>File name (required)</label>
                  <input
                    id={`${baseId}-name-${index}`}
                    type="text"
                    value={file.name || ''}
                    placeholder="e.g., 20210606_J16_01_stateScriptLog"
                    required
                    aria-required="true"
                    onChange={(e) => updateRow(index, 'name', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`${baseId}-description-${index}`}>Description</label>
                  <input
                    id={`${baseId}-description-${index}`}
                    type="text"
                    value={file.description || ''}
                    placeholder="optional"
                    onChange={(e) => updateRow(index, 'description', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`${baseId}-path-${index}`}>Path</label>
                  <input
                    id={`${baseId}-path-${index}`}
                    type="text"
                    value={file.path || ''}
                    placeholder="optional"
                    onChange={(e) => updateRow(index, 'path', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`${baseId}-epoch-${index}`}>Task epoch</label>
                  <select
                    id={`${baseId}-epoch-${index}`}
                    /* Repair-focus anchor: matches the `orphaned_file` issue path so
                       a repair click lands on this row's epoch control. */
                    data-field-path={`associated_files[${index}].task_epochs`}
                    value={epoch === '' || epoch == null ? '' : String(epoch)}
                    aria-invalid={epochStale}
                    aria-describedby={epochStale ? staleId : undefined}
                    onChange={(e) =>
                      updateRow(index, 'task_epochs', e.target.value === '' ? '' : Number(e.target.value))
                    }
                  >
                    <option value="">— select epoch —</option>
                    {/* Surface a stale (orphaned) epoch as a visible, unselectable option
                        so the user sees the value they entered instead of a blank select. */}
                    {epochStale && (
                      <option value={String(epoch)} disabled>
                        Missing epoch {String(epoch)}
                      </option>
                    )}
                    {validEpochs.map((value) => (
                      <option key={value} value={String(value)}>
                        {value}
                      </option>
                    ))}
                  </select>
                  {validEpochs.length === 0 && (
                    <p className="inline-info" role="status">
                      No task epochs defined — add tasks with epochs first, then link this
                      file to one.
                    </p>
                  )}
                </div>

                <Button
                  variant="dangerSubtle"
                  size="small"
                  onClick={() => removeRow(index)}
                  aria-label={`Remove file ${label}`}
                >
                  Remove
                </Button>

                {epochStale && (
                  <div id={staleId} className="inline-error" role="alert">
                    File &quot;{label}&quot; references epoch {String(epoch)}, which is no
                    longer defined in any task on this day. Re-point it to a current epoch
                    before exporting.
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className="button-secondary add-file-button"
        onClick={addRow}
      >
        + Add file
      </button>
    </section>
  );
}

