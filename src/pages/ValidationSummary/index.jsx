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
import PropTypes from 'prop-types';
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
    // A non-array `days` is corrupt persisted state (e.g. `{}` from a bad import).
    // Treat it as "no days" rather than letting `.map` throw and blank the whole
    // multi-day summary — the rest of the workspace must still render.
    const dayIds = Array.isArray(animal.days) ? animal.days : [];
    const days = dayIds
      .map((dayId) => workspace.days[dayId])
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const day of days) {
      // mergeDayMetadata throws BY DESIGN on a corrupt animal (missing/empty
      // configurationHistory, an unresolvable pin, etc.). One unreadable day must
      // not take down the entire summary and hide every other day — report it as a
      // distinct error row so it is visibly flagged for repair, never silently
      // dropped or shown as valid.
      try {
        const mergedDay = mergeDayMetadata(animal, day);
        const chip = deriveChip(computeStepStatus(day, mergedDay, animal));
        rows.push({ animal, day, chip });
      } catch (err) {
        rows.push({ animal, day, chip: 'error', unreadable: true });
        // eslint-disable-next-line no-console
        console.error(
          `[validation-summary] could not read day "${day?.id}" — flagged as error:`,
          err
        );
      }
    }
  }
  return rows;
}

const subjectLabel = (animal) => animal.subject?.subject_id ?? animal.id;

/**
 * An assertive (`role="alert"`) report of days that were NOT exported normally, with
 * a per-day detail block (the parity diff, or the error that aborted the export).
 *
 * @param {object} props
 * @param {string} props.message - Lead sentence describing what happened.
 * @param {Array<{ dayId: string, subjectId: string, date: string, detail?: string }>} props.items
 *   - The affected days; `detail` is rendered in a labelled `<pre>` when present.
 * @param {string} props.detailLabel - Accessible name prefix for each `<pre>` block.
 * @param {string} props.className - Region styling hook.
 * @returns {JSX.Element|null}
 */
function ExportReport({ message, items, detailLabel, className }) {
  if (items.length === 0) return null;
  return (
    <div role="alert" className={className}>
      <p>{message}</p>
      <ul>
        {items.map((item) => (
          <li key={item.dayId}>
            <strong>
              {item.subjectId} — {item.date}
            </strong>{' '}
            ({item.dayId})
            {item.detail && (
              <pre
                className="validation-summary-diff"
                aria-label={`${detailLabel} for ${item.subjectId} ${item.date}`}
              >
                {item.detail}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

ExportReport.propTypes = {
  message: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  detailLabel: PropTypes.string.isRequired,
  className: PropTypes.string.isRequired,
};

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

  // Action feedback: a polite status message plus three assertive per-day reports —
  // parity skips (strict), debug-override downloads (strict off), and hard failures.
  const [actionMessage, setActionMessage] = useState('');
  const [skippedReport, setSkippedReport] = useState([]);
  const [overriddenReport, setOverriddenReport] = useState([]);
  const [failedReport, setFailedReport] = useState([]);

  const clearReports = () => {
    setSkippedReport([]);
    setOverriddenReport([]);
    setFailedReport([]);
  };

  const handleValidateAll = () => {
    // Guard each write: a day removed between render and click must not abort the
    // loop and leave the rest unvalidated with no feedback.
    let failures = 0;
    rows.forEach(({ day, chip }) => {
      try {
        actions.updateDay(day.id, {
          state: { ...day.state, validated: chip === 'valid' },
        });
      } catch (err) {
        failures += 1;
        // eslint-disable-next-line no-console
        console.error(`[validation-summary] could not validate day "${day.id}":`, err);
      }
    });
    clearReports();
    const total = rows.length;
    setActionMessage(
      failures === 0
        ? `Validated ${total} ${total === 1 ? 'day' : 'days'}.`
        : `Validated ${total - failures} of ${total} ${total === 1 ? 'day' : 'days'} (${failures} failed).`
    );
  };

  const handleExportValidOnly = () => {
    const validRows = rows.filter((row) => row.chip === 'valid');

    if (validRows.length === 0) {
      clearReports();
      setActionMessage(
        'No valid days to export. Fix errors or complete the required fields to enable export.'
      );
      return;
    }

    const strict = isFeatureEnabled('shadowExportStrict');
    const skipped = [];
    const overridden = [];
    const failed = [];
    let exported = 0;

    validRows.forEach(({ animal, day }) => {
      const identity = { dayId: day.id, subjectId: subjectLabel(animal), date: day.date };
      try {
        const { ok, yaml, diff } = checkShadowExport(animal, day);

        // Parity mismatch in strict mode: skip and report, never download.
        if (!ok && strict) {
          skipped.push({ ...identity, detail: diff });
          // eslint-disable-next-line no-console
          console.error(
            `[validation-summary] export parity check failed for "${day.id}" — skipped (strict mode).`
          );
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

        if (!ok) {
          // strict === false: downloaded DESPITE a parity mismatch. Surface it loudly,
          // mirroring ExportStep's override warning, so the override is never silent.
          overridden.push({ ...identity, detail: diff });
        }
      } catch (err) {
        // A throw (e.g. encoder failure) must not silently truncate the batch.
        failed.push({ ...identity, detail: err.message });
        // eslint-disable-next-line no-console
        console.error(`[validation-summary] export failed for "${day.id}":`, err);
      }
    });

    setSkippedReport(skipped);
    setOverriddenReport(overridden);
    setFailedReport(failed);

    const notValid = rows.length - validRows.length;
    let message = `Exported ${exported} ${exported === 1 ? 'file' : 'files'}.`;
    if (notValid > 0) {
      message += ` ${notValid} ${notValid === 1 ? 'day' : 'days'} not exported (not marked valid).`;
    }
    setActionMessage(message);
  };

  const hasDays = rows.length > 0;

  return (
    <main id="main-content" tabIndex="-1" role="main" aria-labelledby="validation-heading">
      <h1 id="validation-heading">Validation Summary</h1>

      {!hasDays ? (
        <p className="validation-summary-empty">
          No recording days yet. Create an animal and a recording day to see its
          validation status here. <a href="#/workspace">Go to Workspace</a>.
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
            <button
              type="button"
              onClick={handleValidateAll}
              title="Save each day's current validation status so it persists across reloads and other views."
            >
              Validate All
            </button>
            <button
              type="button"
              onClick={handleExportValidOnly}
              title="Download YAML for every day with Valid status. Days with errors or incomplete fields are not exported."
            >
              Export Valid Only
            </button>
          </div>

          <p className="validation-summary-hint">
            <strong>Export Valid Only</strong> downloads one YAML file per day with{' '}
            <em>Valid</em> status ({counts.valid} {counts.valid === 1 ? 'day' : 'days'}). Days
            with errors or incomplete fields are not exported.
          </p>

          {/* Polite live region for batch-action completion announcements. */}
          <div
            role="status"
            aria-atomic="true"
            className="validation-summary-status"
          >
            {actionMessage}
          </div>

          <ExportReport
            className="validation-summary-skipped"
            detailLabel="Export parity diff"
            message={
              skippedReport.length === 1
                ? '1 day was skipped — its export parity check failed, so it was not downloaded:'
                : `${skippedReport.length} days were skipped — their export parity checks failed, so they were not downloaded:`
            }
            items={skippedReport}
          />

          <ExportReport
            className="validation-summary-overridden"
            detailLabel="Export parity diff"
            message={
              overriddenReport.length === 1
                ? '1 file was downloaded despite a parity mismatch (strict mode off):'
                : `${overriddenReport.length} files were downloaded despite parity mismatches (strict mode off):`
            }
            items={overriddenReport}
          />

          <ExportReport
            className="validation-summary-failed"
            detailLabel="Export error"
            message={
              failedReport.length === 1
                ? '1 day could not be exported (an error occurred) and was not downloaded:'
                : `${failedReport.length} days could not be exported (errors occurred) and were not downloaded:`
            }
            items={failedReport}
          />

          <table className="validation-summary-table">
            <caption className="visually-hidden">
              Recording days across all animals with validation status
            </caption>
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
              {rows.map(({ animal, day, chip, unreadable }) => (
                <tr key={day.id} data-testid={`day-row-${day.id}`}>
                  <td>{subjectLabel(animal)}</td>
                  <td>{day.date}</td>
                  <td>{day.session?.session_id || '—'}</td>
                  <td>
                    {/* An unreadable day (its config could not be resolved) is shown
                        as an error chip with an honest label so it is flagged for
                        repair, not mistaken for a normal validation error. */}
                    <span
                      className={`status-chip status-chip--${chip}`}
                      title={
                        unreadable
                          ? 'This day could not be read — its device configuration is missing or corrupt. Open the editor to repair it.'
                          : undefined
                      }
                    >
                      {unreadable ? 'Error — cannot read' : CHIP_LABEL[chip]}
                    </span>
                  </td>
                  <td>
                    <a
                      href={`#/day/${day.id}`}
                      aria-label={`Open editor for ${subjectLabel(animal)} ${day.date}`}
                    >
                      Open editor
                    </a>
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
