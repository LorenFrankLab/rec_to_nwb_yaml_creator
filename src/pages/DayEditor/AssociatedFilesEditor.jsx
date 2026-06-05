import { useId } from 'react';
import PropTypes from 'prop-types';
import './AssociatedFilesEditor.scss';

/**
 * Collect the day's valid task-epoch numbers (sorted, de-duplicated).
 *
 * The associated-files editor offers ONLY these as epoch options so a file can
 * never reference an epoch the day's tasks do not define — the controlled-ref
 * contract that keeps the export from carrying a dangling `task_epochs` (the
 * `orphaned_file` validation error). This mirrors AssociatedVideosEditor.
 *
 * @param {Array} tasks Day tasks.
 * @returns {number[]} Sorted unique valid epoch numbers.
 */
function collectValidEpochs(tasks) {
  const seen = new Set();
  (tasks || []).forEach((task) => {
    (task.task_epochs || []).forEach((epoch) => {
      const n = Number(epoch);
      if (Number.isInteger(n)) seen.add(n);
    });
  });
  return [...seen].sort((a, b) => a - b);
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
 * Persisted through `onChange(nextArray)` (the step routes that to
 * `onFieldUpdate('associated_files', nextArray)`).
 *
 * @param {object} props
 * @param {Array} props.files The day's associated_files.
 * @param {Array} props.tasks The day's tasks (task_epochs options).
 * @param {Function} props.onChange Called with the next files array.
 * @returns {JSX.Element}
 */
export default function AssociatedFilesEditor({ files, tasks, onChange }) {
  const baseId = useId();
  const validEpochs = collectValidEpochs(tasks);
  const validEpochSet = new Set(validEpochs);

  /**
   * Replace one row's field and emit the updated array.
   * @param {number} index Row index.
   * @param {string} field 'name' | 'description' | 'path' | 'task_epochs'.
   * @param {*} value New value (already coerced).
   */
  function updateRow(index, field, value) {
    onChange(files.map((file, i) => (i === index ? { ...file, [field]: value } : file)));
  }

  /**
   * Append an empty file row.
   */
  function addRow() {
    onChange([...(files || []), { name: '', description: '', path: '', task_epochs: '' }]);
  }

  /**
   * Remove the row at `index`.
   * @param {number} index Row index.
   */
  function removeRow(index) {
    onChange(files.filter((_, i) => i !== index));
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

      {(files || []).length === 0 ? (
        <p className="associated-files-empty">No associated files yet.</p>
      ) : (
        <ul className="associated-files-rows">
          {files.map((file, index) => {
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

                <button
                  type="button"
                  className="button-small button-danger"
                  onClick={() => removeRow(index)}
                  aria-label={`Remove file ${label}`}
                >
                  Remove
                </button>

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

AssociatedFilesEditor.propTypes = {
  files: PropTypes.arrayOf(PropTypes.object),
  tasks: PropTypes.arrayOf(PropTypes.object),
  onChange: PropTypes.func.isRequired,
};

AssociatedFilesEditor.defaultProps = {
  files: [],
  tasks: [],
};
