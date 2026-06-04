/**
 * Validation Summary — cross-day overview of every recording day in the workspace.
 *
 * Lists every day across all animals with a per-day status chip derived from the
 * SAME validation the Day Editor uses ({@link mergeDayMetadata} + {@link computeStepStatus}),
 * surfaces valid / error / incomplete counts, and offers two batch actions:
 *
 * - **Validate All** recomputes status for every day and persists the outcome onto
 *   `day.state.validated` (via `actions.updateDay`) so reload and other views agree.
 * - **Export Valid Only** downloads each fully-valid day's YAML, routing EVERY file
 *   through the same byte-for-byte shadow-export parity gate the single-day Export
 *   step uses ({@link checkShadowExport}); a day that fails parity in strict mode is
 *   skipped and reported with its diff, never downloaded.
 *
 * @module pages/ValidationSummary
 */

import { useMemo, useState } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { computeStepStatus } from '../DayEditor/validation';
import { formatDeterministicFilename, downloadYamlFile } from '../../io/yaml';
import { checkShadowExport } from '../DayEditor/shadowExport';
import { isFeatureEnabled } from '../../featureFlags';
import './ValidationSummary.css';

/**
 * Derive a single per-day chip from the Day Editor step statuses.
 *
 * Single rule, no forked validation:
 * - every step `'valid'` → `'valid'`
 * - any step `'error'` → `'error'`
 * - otherwise (any `'incomplete'`/`'pending'`, no errors) → `'incomplete'`
 *
 * @param {object} stepStatus - Map from {@link computeStepStatus}.
 * @returns {'valid'|'error'|'incomplete'}
 */
function deriveChip(stepStatus) {
  const statuses = Object.values(stepStatus);
  if (statuses.every((s) => s === 'valid')) return 'valid';
  if (statuses.some((s) => s === 'error')) return 'error';
  return 'incomplete';
}

const CHIP_LABEL = { valid: 'Valid', error: 'Error', incomplete: 'Incomplete' };

/**
 * Flatten every day across all animals into a deterministic, table-ordered list.
 *
 * Order: animals by id, then each animal's days by date — the same order the table
 * renders and the batch export downloads in, so behavior is reproducible.
 *
 * @param {object} workspace - `model.workspace` ({ animals, days }).
 * @returns {Array<{ animal: object, day: object, chip: 'valid'|'error'|'incomplete' }>}
 */
function buildRows(workspace) {
  const animals = Object.values(workspace?.animals || {}).sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  const rows = [];
  for (const animal of animals) {
    const days = (animal.days || [])
      .map((dayId) => workspace.days[dayId])
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const day of days) {
      const mergedDay = mergeDayMetadata(animal, day);
      const chip = deriveChip(computeStepStatus(day, mergedDay));
      rows.push({ animal, day, chip });
    }
  }
  return rows;
}

/**
 * @returns {JSX.Element}
 */
export function ValidationSummary() {
  const { model, actions } = useStoreContext();
  const workspace = model.workspace;

  // Recomputed from the workspace on every render — chips/counts are always current.
  const rows = useMemo(() => buildRows(workspace), [workspace]);

  const counts = useMemo(() => {
    const acc = { valid: 0, error: 0, incomplete: 0 };
    rows.forEach(({ chip }) => {
      acc[chip] += 1;
    });
    return acc;
  }, [rows]);

  // Action feedback: a polite status message + a per-day skipped-parity report.
  const [actionMessage, setActionMessage] = useState('');
  const [skippedReport, setSkippedReport] = useState([]);

  const handleValidateAll = () => {
    rows.forEach(({ day, chip }) => {
      actions.updateDay(day.id, {
        state: { ...day.state, validated: chip === 'valid' },
      });
    });
    setSkippedReport([]);
    setActionMessage(`Validated ${rows.length} ${rows.length === 1 ? 'day' : 'days'}.`);
  };

  const handleExportValidOnly = () => {
    const strict = isFeatureEnabled('shadowExportStrict');
    const skipped = [];
    let exported = 0;

    rows
      .filter((row) => row.chip === 'valid')
      .forEach(({ animal, day }) => {
        const { ok, yaml, diff } = checkShadowExport(animal, day);

        // Parity mismatch in strict mode: skip and report, never download.
        if (!ok && strict) {
          skipped.push({
            dayId: day.id,
            subjectId: animal.subject?.subject_id ?? animal.id,
            date: day.date,
            diff,
          });
          return;
        }

        // ok, or the debug override (strict off): mirror ExportStep — inject the
        // filename-only EXPERIMENT_DATE key the merge does not carry, then download.
        const fileName = formatDeterministicFilename({
          ...mergeDayMetadata(animal, day),
          EXPERIMENT_DATE_in_format_mmddYYYY: day.experimentDate,
        });
        downloadYamlFile(fileName, yaml);
        exported += 1;
      });

    setSkippedReport(skipped);
    setActionMessage(`Exported ${exported} ${exported === 1 ? 'file' : 'files'}.`);
  };

  const hasDays = rows.length > 0;

  return (
    <main id="main-content" tabIndex="-1" role="main" aria-labelledby="validation-heading">
      <h1 id="validation-heading">Validation Summary</h1>

      {!hasDays ? (
        <p className="validation-summary-empty">
          No recording days yet. Create an animal and a recording day to see its
          validation status here.
        </p>
      ) : (
        <>
          <p data-testid="summary-counts" className="validation-summary-counts">
            <span className="count count--valid">{counts.valid} valid</span>
            {' / '}
            <span className="count count--error">{counts.error} with errors</span>
            {' / '}
            <span className="count count--incomplete">{counts.incomplete} incomplete</span>
          </p>

          <div className="validation-summary-actions">
            <button type="button" onClick={handleValidateAll}>
              Validate All
            </button>
            <button type="button" onClick={handleExportValidOnly}>
              Export Valid Only
            </button>
          </div>

          {/* Polite live region for batch-action completion announcements. */}
          <div role="status" aria-live="polite" className="validation-summary-status">
            {actionMessage}
          </div>

          {skippedReport.length > 0 && (
            <div role="alert" className="validation-summary-skipped">
              <p>
                {skippedReport.length}{' '}
                {skippedReport.length === 1 ? 'day was' : 'days were'} skipped — the
                export parity check failed, so {skippedReport.length === 1 ? 'it was' : 'they were'}{' '}
                not downloaded:
              </p>
              <ul>
                {skippedReport.map((s) => (
                  <li key={s.dayId}>
                    <strong>
                      {s.subjectId} — {s.date}
                    </strong>{' '}
                    ({s.dayId})
                    {s.diff && <pre className="validation-summary-diff">{s.diff}</pre>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <table className="validation-summary-table">
            <thead>
              <tr>
                <th scope="col">Animal</th>
                <th scope="col">Date</th>
                <th scope="col">Session</th>
                <th scope="col">Status</th>
                <th scope="col">Editor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ animal, day, chip }) => (
                <tr key={day.id} data-testid={`day-row-${day.id}`}>
                  <td>{animal.subject?.subject_id ?? animal.id}</td>
                  <td>{day.date}</td>
                  <td>{day.session?.session_id || '—'}</td>
                  <td>
                    <span className={`status-chip status-chip--${chip}`}>
                      {CHIP_LABEL[chip]}
                    </span>
                  </td>
                  <td>
                    <a href={`#/day/${day.id}`}>Open editor</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

export default ValidationSummary;
