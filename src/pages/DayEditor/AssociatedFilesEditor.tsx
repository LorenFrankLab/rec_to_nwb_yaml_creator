import { useId } from 'react';
import Button from '../../components/ui/Button';
import type { Task } from '../../state/workspaceTypes';
import './AssociatedFilesEditor.scss';

/** Editor row shape: `task_epochs` carries an empty-string sentinel for "unselected". */
interface FileRow {
  recordId?: string;
  kind?: 'statescript' | 'supplemental';
  name?: string;
  description?: string;
  path?: string;
  task_epochs?: number | string;
}

type SupplementalFilePreset = 'custom' | 'psychopy' | 'realtime' | 'behaviorTimeline' | 'fsgui';

const SUPPLEMENTAL_FILE_PRESETS: Array<{ key: SupplementalFilePreset; label: string }> = [
  { key: 'psychopy', label: 'Psychopy stim script' },
  { key: 'realtime', label: 'Realtime output' },
  { key: 'behaviorTimeline', label: 'Behavior timeline' },
  { key: 'fsgui', label: 'FSGUI log' },
  { key: 'custom', label: 'Custom file' },
];

/**
 * Collect the day's valid task-epoch numbers (sorted, de-duplicated).
 *
 * The associated-files editor offers ONLY these as epoch options so a file can
 * never reference an epoch the day's tasks do not define — the controlled-ref
 * contract that keeps the export from carrying a dangling `task_epochs` (the
 * `orphaned_file` validation error).
 */
export function collectValidEpochs(tasks: unknown): number[] {
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

function getNextPresetNumber(files: FileRow[], pattern: RegExp): number {
  const used = files
    .map((file) => file.name || '')
    .map((name) => name.match(pattern)?.[1])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

function createPresetRow(preset: SupplementalFilePreset, files: FileRow[]): FileRow {
  switch (preset) {
    case 'psychopy': {
      const stimNumber = getNextPresetNumber(files, /^stim(\d+)$/i);
      return {
        name: `stim${stimNumber}`,
        description: `Psychopy stim generation script for stim ${stimNumber}`,
        path: '',
        task_epochs: '',
      };
    }
    case 'realtime': {
      const runNumber = getNextPresetNumber(files, /^realtime_output_r(\d+)$/i);
      return {
        name: `realtime_output_r${runNumber}`,
        description: 'realtime_decoding_outputfile',
        path: '',
        task_epochs: '',
      };
    }
    case 'behaviorTimeline':
      return {
        name: 'Behavior timeline',
        description: 'Behavior timeline',
        path: '',
        task_epochs: '',
      };
    case 'fsgui':
      return {
        name: 'fsgui_log',
        description: 'FSGUI log',
        path: '',
        task_epochs: '',
      };
    case 'custom':
    default:
      return { name: '', description: '', path: '', task_epochs: '' };
  }
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
 * Controlled-reference contract: each row's
 * `task_epochs` is a SCALAR chosen from the day's task epochs (a `<select>`). There
 * is no manual numeric entry — the normal path can only ever produce an epoch that
 * exists. A row loaded with a stale epoch (no longer present in any task) renders a
 * visible "Missing epoch N" unselectable option (never a blank select) and is
 * flagged with `role="alert"`, so the user can re-point it before the day is clean.
 *
   * REPAIR-FOCUS ANCHOR: each row control carries `data-field-path` set to the exact
   * validation path (`associated_files[<index>].name` / `description` / `path` /
   * `task_epochs`). The Day Editor stepper's focus search uses this to land a repair
   * click on the offending row control instead of the broad step.
 *
 * Persisted through `onChange(nextArray)` (the step routes that to
 * `onFieldUpdate('associated_files', nextArray)`).
 */
export default function AssociatedFilesEditor({
  files = [],
  tasks = [],
  onChange,
}: AssociatedFilesEditorProps) {
  const baseId = useId();
  // Tolerate corrupt persisted state: a non-array `files` (`{}`) must not crash render.
  const fileList = Array.isArray(files) ? files : [];
  // Never filter editable rows by their text: classification can change while typing.
  const visibleFiles = fileList.map((file, index) => ({ file, index }));
  const validEpochs = collectValidEpochs(tasks);
  const validEpochSet = new Set(validEpochs);

  /**
   * Replace one row's field and emit the updated array.
   */
  function updateRow(originalIndex: number, field: keyof FileRow, value: string | number) {
    onChange(fileList.map((file, i) => (i === originalIndex ? { ...file, [field]: value } as FileRow : file)));
  }

  /**
   * Append a supplemental file row, optionally seeded from corpus-backed presets.
   */
  function addRow(preset: SupplementalFilePreset) {
    onChange([...fileList, createPresetRow(preset, visibleFiles.map(({ file }) => file))]);
  }

  /**
   * Remove the row at `index`.
   */
  function removeRow(originalIndex: number) {
    onChange(fileList.filter((_, i) => i !== originalIndex));
  }

  return (
    <section className="associated-files-editor" aria-labelledby={`${baseId}-heading`}>
      <div className="associated-files-header">
        <h3 id={`${baseId}-heading`}>Statescripts & other files</h3>
        <p className="associated-files-hint">
          Files are optional. Each added file needs a name, description, path and recording epoch.
        </p>
      </div>

      {visibleFiles.length === 0 ? (
        <p className="associated-files-empty">No associated files yet.</p>
      ) : (
        <ul className="associated-files-rows">
          {visibleFiles.map(({ file, index }, displayIndex) => {
            const epoch = file.task_epochs;
            const epochStale =
              epoch !== '' && epoch != null && !validEpochSet.has(Number(epoch));
            const unassigned = epoch === '' || epoch == null;
            const incomplete = !file.name?.trim() || !file.description?.trim() || !file.path?.trim();
            const staleId = `${baseId}-stale-${index}`;
            const label = file.name || `file ${displayIndex + 1}`;
            return (
              <li key={file.recordId ?? index} data-record-id={file.recordId} className="associated-file-row">
                <div className="form-group">
                  <label htmlFor={`${baseId}-name-${index}`}>File name (required)</label>
                  <input
                    id={`${baseId}-name-${index}`}
                    type="text"
                    data-field-path={`associated_files[${index}].name`}
                    value={file.name || ''}
                    placeholder="e.g., stim1 or realtime_output_r1"
                    required
                    aria-required="true"
                    onChange={(e) => updateRow(index, 'name', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`${baseId}-kind-${index}`}>File use</label>
                  <select
                    id={`${baseId}-kind-${index}`}
                    value={file.kind ?? 'supplemental'}
                    onChange={(e) => updateRow(
                      index,
                      'kind',
                      e.target.value as NonNullable<FileRow['kind']>
                    )}
                  >
                    <option value="statescript">Statescript log</option>
                    <option value="supplemental">Other associated file</option>
                  </select>
                  <small className="field-help-text">
                    This controls where the app manages the file. It does not change the file on disk.
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor={`${baseId}-description-${index}`}>Description (required)</label>
                  <input
                    id={`${baseId}-description-${index}`}
                    type="text"
                    data-field-path={`associated_files[${index}].description`}
                    value={file.description || ''}
                    placeholder="What does this file contain?"
                    required
                    aria-invalid={!file.description?.trim()}
                    onChange={(e) => updateRow(index, 'description', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`${baseId}-path-${index}`}>Path (required)</label>
                  <input
                    id={`${baseId}-path-${index}`}
                    type="text"
                    data-field-path={`associated_files[${index}].path`}
                    value={file.path || ''}
                    placeholder="/path/on/conversion/computer/file"
                    required
                    aria-invalid={!file.path?.trim()}
                    onChange={(e) => updateRow(index, 'path', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`${baseId}-epoch-${index}`}>Task epoch (required)</label>
                  <select
                    id={`${baseId}-epoch-${index}`}
                    /* Repair-focus anchor: matches the `orphaned_file` issue path so
                       a repair click lands on this row's epoch control. */
                    data-field-path={`associated_files[${index}].task_epochs`}
                    value={epoch === '' || epoch == null ? '' : String(epoch)}
                    required
                    aria-invalid={epochStale || unassigned}
                    aria-describedby={epochStale || unassigned ? staleId : undefined}
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

                {incomplete && <p className="inline-error">Complete the name, description and path for this file before export. The path must be readable on the computer running conversion.</p>}
                {unassigned && <p id={staleId} className="inline-error">
                  File “{label}” is unassigned. Select a recording epoch or remove this file before export.
                </p>}
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

      <div className="associated-file-presets" aria-label="Add supplemental file">
        {SUPPLEMENTAL_FILE_PRESETS.map((preset) => (
          <Button
            key={preset.key}
            variant="secondary"
            size="small"
            onClick={() => addRow(preset.key)}
            aria-label={`Add ${preset.label}`}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
