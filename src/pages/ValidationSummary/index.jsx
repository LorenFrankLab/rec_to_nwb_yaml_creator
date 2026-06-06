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
import { getAnimalDayIds, getAnimalSubject } from '../../state/workspaceSelectors';
import { computeStepStatus } from '../../domain/validation';
import { getDayWorkflowStatus } from '../../domain/workflowStatus';
import {
  classifyWorkspaceDays,
  DAY_STATUS,
  isExportableDayStatus,
} from '../../domain/dayRecovery';
import { formatDeterministicFilename, downloadYamlFile } from '../../io/yaml';
import { checkShadowExport } from '../../domain/shadowExport';
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
 * True only for plain object records — not null, not an array, not a primitive.
 *
 * Used to distinguish a usable persisted map/day object from the corrupt shapes a
 * bad import/migration can leave behind (a `days` array instead of a map, a leftover
 * string where a day record is expected), which would otherwise throw on indexing or
 * property access and blank the whole summary.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

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
  // The day RECOVERY STATUS of every reference/record is decided ONCE in the domain
  // ({@link classifyWorkspaceDays}) so this surface doesn't re-derive "what kind of day is
  // this?". buildRows only DECORATES each classified day with its validation chip and the
  // legacy row flags the table renders. Each row also carries its `status` so the export
  // policy ({@link isExportableDayStatus}) is read, not re-decided, downstream.
  const animalsMap = isRecord(workspace?.animals) ? workspace.animals : {};
  const rows = [];

  for (const { animalKey, dayId, record, status } of classifyWorkspaceDays(workspace)) {
    const animal = isRecord(animalsMap[animalKey]) ? animalsMap[animalKey] : { id: animalKey };

    if (status === DAY_STATUS.DANGLING_REFERENCE) {
      // Indexed id with no resolvable record — visible, counted, repairable (remove reference).
      rows.push({ animal, animalKey, day: { id: dayId }, chip: 'error', status, missingRecord: true });
      // eslint-disable-next-line no-console
      console.error(
        `[validation-summary] day reference "${dayId}" does not resolve to a record — flagged as error.`
      );
      continue;
    }
    if (status === DAY_STATUS.ORPHAN_NO_OWNER) {
      // Real record whose owning animal is gone — visible but not auto-exportable; no relink target.
      rows.push({ animal, animalKey, day: record, chip: 'error', status, orphaned: true, ownerMissing: true });
      // eslint-disable-next-line no-console
      console.error(`[validation-summary] day "${dayId}" is not listed by any animal — flagged as orphaned.`);
      continue;
    }
    if (status === DAY_STATUS.WRONG_OWNER) {
      // Indexed here but the record declares a DIFFERENT owner. Do NOT merge/validate it with
      // THIS animal (that would compute a chip — and could export — with the wrong subject). Flag
      // as an error and offer the unlink repair so it resurfaces under its real owner.
      rows.push({ animal, animalKey, day: record, chip: 'error', status, wrongOwner: true });
      // eslint-disable-next-line no-console
      console.error(
        `[validation-summary] day "${dayId}" is indexed by "${animalKey}" but belongs to "${record.animalId}" — flagged as wrong owner.`
      );
      continue;
    }

    // OK or RECOVERED_UNLINKED: a real record → show its validation chip. mergeDayMetadata
    // throws BY DESIGN on a corrupt animal; one unreadable day must not blank the summary.
    const orphaned = status === DAY_STATUS.RECOVERED_UNLINKED;
    try {
      const chip = deriveChip(computeStepStatus(record, mergeDayMetadata(animal, record), animal));
      rows.push({ animal, animalKey, day: record, chip, status, orphaned });
    } catch (err) {
      rows.push({ animal, animalKey, day: record, chip: 'error', status, orphaned, unreadable: true });
      // eslint-disable-next-line no-console
      console.error(`[validation-summary] could not read day "${record?.id}" — flagged as error:`, err);
    }
  }

  return rows;
}

const subjectLabel = (animal) => getAnimalSubject(animal).subject_id ?? animal.id;

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
  // Days dropped at confirm because they changed since the preflight (gone / no longer valid) —
  // reported separately from parity skips so they aren't mislabeled "parity check failed".
  const [staleReport, setStaleReport] = useState([]);
  // Pending batch export awaiting preflight confirmation: { rows, preflight }.
  const [pendingExport, setPendingExport] = useState(null);

  const clearReports = () => {
    setSkippedReport([]);
    setOverriddenReport([]);
    setFailedReport([]);
    setStaleReport([]);
  };

  const handleValidateAll = () => {
    // Guard each write: a day removed between render and click must not abort the
    // loop and leave the rest unvalidated with no feedback.
    let failures = 0;
    rows.forEach(({ day, chip }) => {
      try {
        // Guard a malformed `day.state` (a corrupt import can persist it as a scalar/array):
        // spreading a string scatters char-indexed keys. `updateDay`/`applyDayUpdates` guards
        // the current state too; this keeps the payload itself a clean record.
        const currentState = isRecord(day.state) ? day.state : {};
        actions.updateDay(day.id, {
          state: { ...currentState, validated: chip === 'valid' },
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

  // Step 1 of batch export: gather the valid days and build a per-day preflight so the batch
  // path gets the SAME "what will be encoded?" confidence check as the single-day Export step,
  // instead of one click straight to download. The actual download runs only on confirm.
  const handleExportValidOnly = () => {
    // Export only days that are BOTH validation-valid AND part of the animal's recording days
    // by recovery policy (isExportableDayStatus → only `ok`). A recovered-unlinked record is
    // valid metadata but must be re-linked ("Add to day list") before it is exported, so it is
    // deliberately excluded here rather than silently shipped from a broken index.
    const validRows = rows.filter(
      (row) => row.chip === 'valid' && isExportableDayStatus(row.status)
    );

    if (validRows.length === 0) {
      clearReports();
      setPendingExport(null);
      setActionMessage(
        'No valid days to export. Fix errors, complete the required fields, or re-link recovered ' +
          'days (Add to day list) to enable export.'
      );
      return;
    }

    const preflight = validRows.map(({ animal, day }) => {
      try {
        const merged = mergeDayMetadata(animal, day);
        const status = getDayWorkflowStatus(animal, day, merged);
        const ntrodeMap = merged.ntrode_electrode_group_channel_map || [];
        const failedChannels = ntrodeMap.reduce((t, n) => t + (n.bad_channels?.length || 0), 0);
        const optoOn =
          (merged.opto_excitation_source?.length || 0) > 0 ||
          (merged.optical_fiber?.length || 0) > 0 ||
          (merged.virus_injection?.length || 0) > 0;
        return {
          dayId: day.id,
          label: `${subjectLabel(animal)} — ${day.session?.session_id || day.id}`,
          version: status.configurationVersion,
          historical: status.isHistoricalConfiguration,
          groups: (merged.electrode_groups || []).length,
          failedChannels,
          cameras: (merged.cameras || []).length,
          opto: optoOn,
        };
      } catch (err) {
        return { dayId: day.id, label: `${subjectLabel(animal)} — ${day.id}`, error: err.message };
      }
    });

    clearReports();
    setActionMessage('');
    setPendingExport({ rows: validRows, preflight });
  };

  const cancelExport = () => setPendingExport(null);

  // Step 2 of batch export: run the actual downloads after the user confirms the preflight.
  const runExport = () => {
    if (!pendingExport) return;
    const { rows: validRows } = pendingExport;
    setPendingExport(null);

    const strict = isFeatureEnabled('shadowExportStrict');
    const skipped = [];
    const overridden = [];
    const failed = [];
    const stale = [];
    let exported = 0;

    // Re-derive the CURRENT recovery status of every day from the live workspace, so a day that
    // became recovered_unlinked / wrong_owner / dangling while the preflight was open is dropped
    // here — not just one that changed content. Export policy is read from the same domain source.
    const currentStatusById = new Map(
      classifyWorkspaceDays(workspace).map((d) => [d.dayId, d.status])
    );

    validRows.forEach(({ animalKey, day: rowDay }) => {
      // Re-resolve the CURRENT records and RE-VALIDATE before downloading: state may have
      // changed while the preflight was open, so a day that was valid at preflight time must
      // not be exported now if it is no longer present or no longer valid.
      const animal = workspace?.animals?.[animalKey];
      const day = isRecord(workspace?.days) ? workspace.days[rowDay.id] : undefined;
      const identity = {
        dayId: rowDay.id,
        subjectId: animal ? subjectLabel(animal) : rowDay.id,
        date: isRecord(day) ? day.date : rowDay.date,
      };

      if (!animal || !isRecord(day)) {
        stale.push({ ...identity, detail: 'No longer present since the preflight.' });
        return;
      }
      if (!isExportableDayStatus(currentStatusById.get(rowDay.id))) {
        // Became recovered-unlinked / wrong-owner / dangling since the preflight — not part of
        // the animal's recording days anymore, so it must not export from a stale preflight.
        stale.push({ ...identity, detail: "No longer part of the animal's day list since the preflight." });
        return;
      }
      let stillValid = false;
      try {
        stillValid = deriveChip(computeStepStatus(day, mergeDayMetadata(animal, day), animal)) === 'valid';
      } catch {
        stillValid = false;
      }
      if (!stillValid) {
        stale.push({ ...identity, detail: 'No longer valid since the preflight.' });
        return;
      }

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
    setStaleReport(stale);

    const notExported = rows.length - validRows.length;
    let message = `Exported ${exported} ${exported === 1 ? 'file' : 'files'}.`;
    if (notExported > 0) {
      message += ` ${notExported} ${notExported === 1 ? 'day' : 'days'} not exported (not valid, or not in an animal's day list).`;
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
              title="Download YAML for every valid day that is part of an animal's day list. Days with errors or incomplete fields are not exported; recovered days not in the list must be re-linked first."
            >
              Export Valid Only
            </button>
          </div>

          <p className="validation-summary-hint">
            <strong>Export Valid Only</strong> downloads one YAML file per day that is both{' '}
            <em>Valid</em> and part of an animal&apos;s day list. Days with errors or incomplete
            fields are not exported; a recovered day marked <em>not in day list</em> must be
            re-linked (&quot;Add to day list&quot;) before it can be exported.
          </p>

          {pendingExport && (
            <section className="batch-export-preflight" aria-label="Batch export preflight">
              <h2>Confirm batch export</h2>
              <p>
                {pendingExport.rows.length} {pendingExport.rows.length === 1 ? 'day' : 'days'} will
                be encoded and downloaded. Review what each file will contain before exporting:
              </p>
              <ul className="batch-export-preflight-list">
                {pendingExport.preflight.map((entry) => (
                  <li key={entry.dayId} className="batch-export-preflight-item">
                    <span className="batch-export-preflight-label">{entry.label}</span>
                    {entry.error ? (
                      <span className="batch-export-preflight-error">
                        Could not assemble metadata: {entry.error}
                      </span>
                    ) : (
                      <span className="batch-export-preflight-detail">
                        config v{entry.version ?? '—'}
                        {entry.historical ? ' (historical)' : ''}; {entry.groups}{' '}
                        electrode {entry.groups === 1 ? 'group' : 'groups'}, {entry.failedChannels}{' '}
                        failed {entry.failedChannels === 1 ? 'channel' : 'channels'}; {entry.cameras}{' '}
                        {entry.cameras === 1 ? 'camera' : 'cameras'}; optogenetics{' '}
                        {entry.opto ? 'on' : 'off'}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="batch-export-preflight-actions">
                <button type="button" className="btn-primary" onClick={runExport}>
                  Confirm export ({pendingExport.rows.length})
                </button>
                <button type="button" onClick={cancelExport}>
                  Cancel
                </button>
              </div>
            </section>
          )}

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

          <ExportReport
            className="validation-summary-stale"
            detailLabel="Reason"
            message={
              staleReport.length === 1
                ? '1 day changed after the preflight and was not exported:'
                : `${staleReport.length} days changed after the preflight and were not exported:`
            }
            items={staleReport}
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
              {rows.map(({ animal, animalKey, day, chip, unreadable, missingRecord, orphaned, ownerMissing, wrongOwner }, index) => (
                <tr key={`${day.id ?? 'unknown'}-${index}`} data-testid={`day-row-${day.id}`}>
                  <td>
                    {subjectLabel(animal)}
                    {orphaned && (
                      <span
                        className="validation-summary-orphan-note"
                        title="This day record is not listed in its animal's recording-day index (the index is corrupt, missing, or doesn't reference it). It is shown here so it isn't lost; open it to review or re-link it."
                      >
                        {' '}⚠ not in day list
                      </span>
                    )}
                    {wrongOwner && (
                      <span
                        className="validation-summary-orphan-note"
                        title={`This day is listed under ${subjectLabel(animal)} but its record belongs to "${day.animalId}". It is NOT exported with this animal's metadata; remove it from this animal so it returns to its real owner.`}
                      >
                        {' '}⚠ belongs to {day.animalId}
                      </span>
                    )}
                  </td>
                  <td>{day.date || '—'}</td>
                  <td>{day.session?.session_id || '—'}</td>
                  <td>
                    {/* An unreadable day (its config could not be resolved) OR a reference
                        that resolves to no day record is shown as an error chip with an
                        honest label, so it is flagged for repair and counted — never
                        silently dropped or mistaken for a normal validation error. */}
                    <span
                      className={`status-chip status-chip--${chip}`}
                      title={
                        unreadable
                          ? 'This day could not be read — its device configuration is missing or corrupt. Open the editor to repair it.'
                          : missingRecord
                            ? 'This day’s saved record is missing or corrupt. Open the editor to repair or recreate it.'
                            : undefined
                      }
                    >
                      {unreadable
                        ? 'Error — cannot read'
                        : missingRecord
                          ? 'Error — missing day record'
                          : CHIP_LABEL[chip]}
                    </span>
                  </td>
                  <td>
                    {missingRecord ? (
                      // A missing/non-record day has nothing to open (the Day Editor would
                      // dead-end on "Day not found"). Offer an executable repair that drops
                      // the dangling reference from the owning animal instead.
                      <button
                        type="button"
                        className="validation-summary-repair"
                        onClick={() => actions.removeDayReference(animalKey, day.id)}
                        aria-label={`Remove dangling day reference ${day.id} from ${subjectLabel(animal)}`}
                      >
                        Remove day reference
                      </button>
                    ) : wrongOwner ? (
                      // Listed under the wrong animal. The repair unlinks it from THIS animal
                      // (keeping the record), so it returns to its real owner to be re-linked.
                      <button
                        type="button"
                        className="validation-summary-repair"
                        onClick={() => actions.unlinkDayReference(animalKey, day.id)}
                        aria-label={`Remove ${day.date || day.id} from ${subjectLabel(animal)} (it belongs to ${day.animalId})`}
                      >
                        Remove from this animal
                      </button>
                    ) : orphaned && ownerMissing ? (
                      // The record exists but its owning animal is gone — "Open editor" would
                      // dead-end (the Day Editor needs the animal). There is no in-app relink
                      // target; state the recovery path instead of a dead control.
                      <span className="validation-summary-orphan-detail">
                        No owning animal — re-create the animal or re-import its data.
                      </span>
                    ) : (
                      <>
                        <a
                          href={`#/day/${day.id}`}
                          aria-label={`Open editor for ${subjectLabel(animal)} ${day.date || day.id}`}
                        >
                          Open editor
                        </a>
                        {orphaned && (
                          // The record exists and its owner is present — re-link it into the
                          // animal's day index so it rejoins the normal workflow.
                          <button
                            type="button"
                            className="validation-summary-repair"
                            onClick={() => actions.relinkDayReference(animalKey, day.id)}
                            aria-label={`Add ${day.date || day.id} back to ${subjectLabel(animal)}'s day list`}
                          >
                            Add to day list
                          </button>
                        )}
                      </>
                    )}
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
