import { useState, useRef, useEffect, useId } from 'react';
import Button from '../../components/ui/Button';
import './TaskEpochsEditor.scss';

/** Editor-local row: epoch number plus optional start/end times (times are not persisted). */
interface EpochRow {
  epochNumber: string;
  start: string;
  end: string;
}

interface TaskEpochsEditorProps {
  /** Epoch numbers to seed the rows. */
  initialEpochs?: number[];
  /** Called with `{ epochs: number[], hasError: boolean }` on every edit. */
  onChange: (payload: { epochs: number[]; hasError: boolean }) => void;
}

/**
 * TaskEpochsEditor - dynamic editor for a task's epochs.
 *
 * Each row carries an epoch number plus optional start/end times in seconds.
 * **Only the integer epoch numbers are persisted** (`task.task_epochs`); the
 * start/end times are an editor-local aid for ordering and overlap detection and
 * are intentionally NOT written to the day, because the NWB schema has no field
 * for them. A future reader should not try to persist them.
 *
 * Severity policy:
 *   - A row with both start and end set where end <= start is an ERROR — it shows
 *     an inline message and reports `hasError: true`, which blocks the modal Save.
 *   - Overlapping intervals are a WARNING — surfaced but non-blocking.
 *
 * The committed epoch list is de-duplicated to satisfy the schema's uniqueItems
 * constraint; rows without a valid integer epoch number contribute nothing.
 */
export default function TaskEpochsEditor({ initialEpochs = [], onChange }: TaskEpochsEditorProps) {
  const [rows, setRows] = useState<EpochRow[]>(() =>
    (initialEpochs || []).map((number) => ({
      epochNumber: String(number),
      start: '',
      end: '',
    }))
  );

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pendingFocusRef = useRef<number | null>(null);
  const headingId = useId();

  // Focus the first input of a freshly added row, once it has rendered.
  useEffect(() => {
    if (pendingFocusRef.current != null) {
      const el = inputRefs.current[pendingFocusRef.current];
      if (el) el.focus();
      pendingFocusRef.current = null;
    }
  });

  /**
   * Parse an input string to a valid epoch number, or null if not a valid one.
   * Epochs are 1-based positive integers, so non-positive values are rejected
   * (and never persisted) — matching the `min="1"` guard on the input.
   */
  function toEpochNumber(value: string): number | null {
    if (value === '' || value == null) return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 ? n : null;
  }

  /**
   * Whether a row's interval is fully specified (both ends are finite numbers).
   */
  function hasInterval(row: EpochRow): boolean {
    return row.start !== '' && row.end !== '' &&
      Number.isFinite(Number(row.start)) && Number.isFinite(Number(row.end));
  }

  /**
   * Whether a row's end is at or before its start (only when both are set).
   */
  function isReversed(row: EpochRow): boolean {
    return hasInterval(row) && Number(row.end) <= Number(row.start);
  }

  // Cross-row overlap detection over fully-specified, non-reversed intervals.
  const overlaps: Array<[number, number]> = [];
  const intervalRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => hasInterval(row) && !isReversed(row));
  for (let i = 0; i < intervalRows.length; i += 1) {
    for (let j = i + 1; j < intervalRows.length; j += 1) {
      const a = intervalRows[i].row;
      const b = intervalRows[j].row;
      const aStart = Number(a.start);
      const aEnd = Number(a.end);
      const bStart = Number(b.start);
      const bEnd = Number(b.end);
      if (aStart < bEnd && bStart < aEnd) {
        overlaps.push([intervalRows[i].index + 1, intervalRows[j].index + 1]);
      }
    }
  }

  /**
   * Recompute derived state and notify the parent.
   */
  function commit(nextRows: EpochRow[]) {
    setRows(nextRows);
    const hasError = nextRows.some((row) => isReversed(row));
    const epochs: number[] = [];
    const seen = new Set<number>();
    for (const row of nextRows) {
      const n = toEpochNumber(row.epochNumber);
      if (n != null && !seen.has(n)) {
        seen.add(n);
        epochs.push(n);
      }
    }
    onChange({ epochs, hasError });
  }

  /**
   * Update one field of one row.
   */
  function updateRow(index: number, field: keyof EpochRow, value: string) {
    commit(rows.map((row, i) => (i === index ? { ...row, [field]: value } as EpochRow : row)));
  }

  /**
   * Append a new empty row and queue focus to its epoch-number input.
   */
  function addRow() {
    const nextRows = [...rows, { epochNumber: '', start: '', end: '' }];
    pendingFocusRef.current = nextRows.length - 1;
    commit(nextRows);
  }

  /**
   * Remove a row by index.
   */
  function removeRow(index: number) {
    commit(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="task-epochs-editor">
      <p id={headingId} className="task-epochs-hint">
        Epoch numbers are saved with the task. Start/end times help you order and
        spot overlaps but are not part of the exported metadata.
      </p>

      {rows.length === 0 ? (
        <p className="task-epochs-empty">No epochs yet.</p>
      ) : (
        <ul className="task-epochs-rows" aria-labelledby={headingId}>
          <li className="task-epoch-headers" aria-hidden="true">
            <span className="epoch-number-input">Epoch #</span>
            <span className="epoch-time-input">Start (s)</span>
            <span className="epoch-time-input">End (s)</span>
            <span className="epoch-row-spacer" />
          </li>
          {rows.map((row, index) => {
            const reversed = isReversed(row);
            const errorId = `${headingId}-err-${index}`;
            return (
              <li key={index} className="task-epoch-row">
                <div className="task-epoch-fields">
                  <input
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="number"
                    step="1"
                    min="1"
                    className="epoch-number-input"
                    aria-label={`Epoch number, row ${index + 1}`}
                    value={row.epochNumber}
                    onChange={(e) => updateRow(index, 'epochNumber', e.target.value)}
                  />
                  <input
                    type="number"
                    step="any"
                    className="epoch-time-input"
                    aria-label={`Start time in seconds, row ${index + 1}`}
                    value={row.start}
                    onChange={(e) => updateRow(index, 'start', e.target.value)}
                  />
                  <input
                    type="number"
                    step="any"
                    className={`epoch-time-input${reversed ? ' error' : ''}`}
                    aria-label={`End time in seconds, row ${index + 1}`}
                    value={row.end}
                    onChange={(e) => updateRow(index, 'end', e.target.value)}
                    aria-invalid={reversed}
                    aria-describedby={reversed ? errorId : undefined}
                  />
                  <Button
                    variant="dangerSubtle"
                    size="small"
                    onClick={() => removeRow(index)}
                    aria-label={`Remove epoch row ${index + 1}`}
                  >
                    Remove
                  </Button>
                </div>
                {reversed && (
                  <div id={errorId} className="inline-error" role="alert">
                    End time must be after start time
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="button-secondary add-epoch-button" onClick={addRow}>
        + Add epoch
      </button>

      {overlaps.length > 0 && (
        <div className="inline-warning" role="status">
          {overlaps.map(([a, b]) => `Epochs ${a} and ${b} overlap — may be intentional`).join('; ')}
        </div>
      )}
    </div>
  );
}

