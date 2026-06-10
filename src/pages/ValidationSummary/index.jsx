/**
 * Validation Summary — cross-day overview of every recording day in the workspace.
 *
 * Lists every day across all animals with a per-day status chip derived from the
 * SAME validation the Day Editor uses ({@link mergeDayMetadata} + {@link computeStepStatus}),
 * surfaces valid / error / incomplete counts, and offers two batch actions:
 *
 * - **Validate All** recomputes status for every animal's RECORDING day (recovery status `ok`)
 *   and persists the outcome onto `day.state.validated` (via `actions.updateDay`) so reload and
 *   other views agree. Recovered/wrong-owner/dangling rows are intentionally skipped (they aren't
 *   the animal's recording days) and the result message names how many were skipped.
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
import { getAnimalSubject } from '../../state/workspaceSelectors';
import EffectiveDayReview from './EffectiveDayReview';
import { computeStepStatus, validateDay } from '../../domain/validation';
import { getDayWorkflowStatus } from '../../domain/workflowStatus';
import WarningAcknowledgement from '../../components/WarningAcknowledgement';
import { describeDayOptoState } from '../../domain/optoStatus';
import {
  classifyWorkspaceDays,
  DAY_STATUS,
  isExportableDayStatus,
  describeOwner,
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

// How many cameras to spell out by name + calibration before collapsing the rest into "+K more".
// Keeps the scan cell readable on a many-camera day without hiding that recalibration happened.
const CAMERA_CALIBRATION_LIMIT = 3;

/**
 * A concise "name meters_per_pixel m/px" summary of the day-used cameras, so a re-calibrated camera
 * (changed `meters_per_pixel`) is visible during catch-up triage instead of being hidden behind a
 * bare camera count. Truncates gracefully after a few cameras (`+K more`). Returns '' when the day
 * uses no cameras (the count text already conveys "0 cameras").
 *
 * @param {Array<object>} cameras - The day-used cameras (the SAME set the scan count is derived
 *   from — `merged.cameras`).
 * @returns {string}
 */
function describeCameraCalibration(cameras) {
  const list = Array.isArray(cameras) ? cameras : [];
  if (list.length === 0) return '';
  const shown = list.slice(0, CAMERA_CALIBRATION_LIMIT).map((cam) => {
    const name = cam?.camera_name || `camera ${cam?.id ?? '?'}`;
    const mpp = cam?.meters_per_pixel;
    return mpp == null ? `${name} (no calibration)` : `${name} ${mpp} m/px`;
  });
  const remaining = list.length - shown.length;
  if (remaining > 0) shown.push(`+${remaining} more`);
  return shown.join(', ');
}

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
 * Per-animal cross-day context for the bad-channel monotonicity export-block: a map from
 * `animalKey` to that animal's OK-status recording-day RECORDS, date-sorted — the SAME OK-only,
 * date-ordered view `getAnimalDays` returns and the Day Editor threads into its export gate.
 * Without this context the monotonicity rule is a no-op, so a day that silently un-fails an
 * earlier same-config bad channel reads "valid" here while the row badge says "Needs fixing".
 *
 * @param {object} workspace - `model.workspace` ({ animals, days }).
 * @returns {Record<string, object[]>} `{ [animalKey]: dateSortedOkDayRecords }`.
 */
function buildAnimalDaysByKey(workspace) {
  const byKey = {};
  for (const { animalKey, record, status } of classifyWorkspaceDays(workspace)) {
    if (status !== DAY_STATUS.OK || !isRecord(record)) continue;
    (byKey[animalKey] ||= []).push(record);
  }
  for (const key of Object.keys(byKey)) {
    byKey[key].sort((a, b) => String(a?.date ?? '').localeCompare(String(b?.date ?? '')));
  }
  return byKey;
}

/**
 * Flatten every day across all animals into a deterministic, table-ordered list.
 *
 * Order: animals by id, then each animal's days by date — the same order the table
 * renders and the batch export downloads in, so behavior is reproducible.
 *
 * @param {object} workspace - `model.workspace` ({ animals, days }).
 * @returns {Array<{ animal: object, day: object, chip: 'valid'|'error'|'incomplete' }>}
 */
export function buildRows(workspace) {
  // The day RECOVERY STATUS of every reference/record is decided ONCE in the domain
  // ({@link classifyWorkspaceDays}) so this surface doesn't re-derive "what kind of day is
  // this?". buildRows only DECORATES each classified day with its validation chip and the
  // legacy row flags the table renders. Each row also carries its `status` so the export
  // policy ({@link isExportableDayStatus}) is read, not re-decided, downstream.
  const animalsMap = isRecord(workspace?.animals) ? workspace.animals : {};
  const rows = [];

  // Cross-day context for the bad-channel monotonicity export-block, built ONCE per render (not
  // per row) so the chip, the workflow status, and the batch re-validation all feed the rule its
  // required context and therefore agree with the per-day "Needs fixing" row badge.
  const animalDaysByKey = buildAnimalDaysByKey(workspace);

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
        `[validation-summary] day "${dayId}" is indexed by "${animalKey}" but belongs to ${describeOwner(record.animalId)} — flagged as wrong owner.`
      );
      continue;
    }

    // OK or RECOVERED_UNLINKED: a real record → show its validation chip. mergeDayMetadata
    // throws BY DESIGN on a corrupt animal; one unreadable day must not blank the summary.
    const orphaned = status === DAY_STATUS.RECOVERED_UNLINKED;
    // The animal's OK-status day records (date-sorted) — the cross-day context the bad-channel
    // monotonicity block needs so the chip agrees with the row badge.
    const animalDays = animalDaysByKey[animalKey] || [];
    try {
      const merged = mergeDayMetadata(animal, record);
      const chip = deriveChip(computeStepStatus(record, merged, animal, animalDays));
      // Batch-row scan fields (Task 10): the configuration version pinned, the camera count, and
      // the day-protocol opto state — so days can be compared before opening each editor. Computed
      // here (where the merge already succeeded) so the table reads, never re-derives.
      const workflow = getDayWorkflowStatus(animal, record, merged, animalDays);
      const sessionDescriptionRaw = record.session?.session_description;
      const sessionDescription =
        typeof sessionDescriptionRaw === 'string' && sessionDescriptionRaw.trim()
          ? sessionDescriptionRaw.trim()
          : '';
      const scan = {
        version: workflow.configurationVersion,
        historical: workflow.isHistoricalConfiguration,
        // The day's session description (trimmed, empty when blank/whitespace-only) — surfaced in the
        // row so it isn't hidden behind the session id alone.
        sessionDescription,
        cameras: (merged.cameras || []).length,
        // Day-used camera calibration (name + meters_per_pixel) from the SAME camera set the count
        // is derived from, so a re-calibrated camera is visible without opening the editor.
        cameraCalibration: describeCameraCalibration(merged.cameras),
        opto: describeDayOptoState(merged).label,
      };
      rows.push({ animal, animalKey, day: record, chip, status, orphaned, scan });
    } catch (err) {
      rows.push({ animal, animalKey, day: record, chip: 'error', status, orphaned, unreadable: true });
      // eslint-disable-next-line no-console
      console.error(`[validation-summary] could not read day "${record?.id}" — flagged as error:`, err);
    }
  }

  return rows;
}

/**
 * Animal-scoped slice of {@link buildRows}: the per-animal Validation & Export tab's row set.
 *
 * A FILTER over the workspace-global rows, NOT a parallel validation path — the readiness chips are
 * exactly what the unscoped summary computes for those days, so the two can never drift. Keyed on
 * `animalKey` (the index key a day is listed under), so a wrong-owner / duplicate-index row scopes
 * to the animal it's LISTED under, matching how the global table groups it.
 *
 * @param {object} workspace - `model.workspace` ({ animals, days }).
 * @param {string} animalKey - The animal whose rows to keep.
 * @returns {Array<{ animal: object, animalKey: string, day: object, chip: 'valid'|'error'|'incomplete' }>}
 */
export function buildAnimalRows(workspace, animalKey) {
  return buildRows(workspace).filter((row) => row.animalKey === animalKey);
}

// Coerced to a string so a corrupt (object/number) subject_id or animal id can never be returned
// as a React child (which throws "objects are not valid as a React child").
const subjectLabel = (animal) => {
  const id = getAnimalSubject(animal).subject_id ?? animal?.id;
  return typeof id === 'string' ? id : String(id ?? '');
};

/**
 * The single, unified config-version label used EVERYWHERE this surface names a day's pinned
 * configuration version — the cross-animal batch table, the per-animal Validation & Export scan,
 * and the batch-export preflight — so they can never drift (they previously read "config v1" vs
 * "config from <date>", and neither said whether the version was the latest or a historical pin).
 *
 * Always states the version AND a latest/historical marker, e.g. `config v1 (latest)` /
 * `config v2 (historical)`.
 *
 * @param {number|null} version - The pinned configuration version.
 * @param {boolean} historical - Whether that version is NOT the animal's latest.
 * @returns {string}
 */
function describeConfigVersionLabel(version, historical) {
  return `config v${version ?? '—'} (${historical ? 'historical' : 'latest'})`;
}

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
 * Validation Summary — workspace-global by default, or scoped to one animal when `animalKey` is
 * given (the per-animal "Validation & Export" tab, Phase 3-5). The scoped mode is a FILTER over the
 * same rows + the same batch actions (validate / export-valid / preflight) — never a forked
 * validation path. When scoped it renders WITHOUT its own `<main id="main-content">` (the embedding
 * AnimalView already owns the page landmark) and swaps the page heading for a scoped header.
 *
 * @param {object} props
 * @param {string} [props.animalKey] - When set, show only this animal's rows in an embeddable
 *   section; when omitted, the standalone workspace-global page.
 * @returns {JSX.Element}
 */
export function ValidationSummary({ animalKey } = {}) {
  const { model, actions } = useStoreContext();
  const workspace = model.workspace;
  const scoped = animalKey != null;

  // Recomputed from the workspace on every render — chips/counts are always current. Scoped mode is
  // a pure filter (buildAnimalRows) so its chips are identical to the global summary's.
  const rows = useMemo(
    () => (scoped ? buildAnimalRows(workspace, animalKey) : buildRows(workspace)),
    [workspace, scoped, animalKey]
  );

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
  // Days Validate All could not persist (corrupt `day.state` shape, or a write that threw) — named
  // in the UI with their repair path so imported/recovered corruption isn't console-only.
  const [validateErrorReport, setValidateErrorReport] = useState([]);
  // Pending batch export awaiting preflight confirmation: { rows, preflight, warningItems }.
  const [pendingExport, setPendingExport] = useState(null);
  // Phase 3-6: explicit acknowledgement of outstanding non-blocking warnings before the download
  // proceeds. Reset whenever a new preflight opens / closes so it can't carry across exports.
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);

  const clearReports = () => {
    setSkippedReport([]);
    setOverriddenReport([]);
    setFailedReport([]);
    setStaleReport([]);
    setValidateErrorReport([]);
  };

  const handleValidateAll = () => {
    // Only persist the validated flag for days that are part of an animal's recording days
    // (recovery status `ok`). A wrong-owner row carries ANOTHER animal's record — writing its
    // validated flag from this animal's row would corrupt that animal's day (and duplicate-index
    // row order could clear the real owner's flag); dangling/recovered/orphan rows aren't
    // exportable recording days either. So they are skipped here.
    const validatable = rows.filter((row) => isExportableDayStatus(row.status));
    // Guard each write: a day removed between render and click must not abort the
    // loop and leave the rest unvalidated with no feedback.
    // Days that couldn't be persisted, each with the reason — surfaced in the UI (not just the
    // console) so the repair path for imported/recovered corruption is visible, not murky.
    const validateErrors = [];
    validatable.forEach(({ animal, day, chip }) => {
      // A TRUTHY non-record `day.state` (a corrupt import persisting it as a scalar/array) is
      // itself corruption. Do NOT LAUNDER it by coercing to `{}` and stamping `validated` on top —
      // that would hide the corrupt state behind a bulk action. Skip the write and report it; the
      // corruption is repairable in the Day Editor's raw-shape UI. An ABSENT state (null/undefined)
      // is not corruption — it initializes cleanly to `{}`.
      if (day.state != null && !isRecord(day.state)) {
        validateErrors.push({
          dayId: day.id,
          subjectId: animal ? subjectLabel(animal) : day.id,
          date: day.date || day.id,
          detail: 'Its saved state is corrupt. Open this day in the Day Editor and use the in-place reset to repair it.',
        });
        // eslint-disable-next-line no-console
        console.error(
          `[validation-summary] day "${day.id}" has a corrupt state shape; skipped Validate All (repair it in the Day Editor).`
        );
        return;
      }
      try {
        const currentState = isRecord(day.state) ? day.state : {};
        actions.updateDay(day.id, {
          state: { ...currentState, validated: chip === 'valid' },
        });
      } catch (err) {
        validateErrors.push({
          dayId: day.id,
          subjectId: animal ? subjectLabel(animal) : day.id,
          date: day.date || day.id,
          detail: `Could not save: ${err.message}`,
        });
        // eslint-disable-next-line no-console
        console.error(`[validation-summary] could not validate day "${day.id}":`, err);
      }
    });
    clearReports();
    setValidateErrorReport(validateErrors);
    const total = validatable.length;
    const failures = validateErrors.length;
    const skipped = rows.length - total;
    // Name the skipped rows so a run over a list that's all recovered/wrong-owner days doesn't
    // read as a bare "Validated 0 days" — that implies "nothing to do" when the truth is
    // "these days were deliberately not validatable from here."
    const skippedNote =
      skipped > 0 ? ` (${skipped} ${skipped === 1 ? 'day' : 'days'} skipped — not a recording day on this list)` : '';
    let body;
    if (failures === 0) {
      body = `Validated ${total} ${total === 1 ? 'day' : 'days'}`;
    } else {
      body = `Validated ${total - failures} of ${total} ${total === 1 ? 'day' : 'days'} (${failures} failed)`;
    }
    setActionMessage(`${body}${skippedNote}.`);
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
      setWarningsAcknowledged(false);
      setActionMessage(
        'No days are ready to export. Fix errors, complete the required fields, or re-link ' +
          'recovered days (Add to day list) to make a day exportable.'
      );
      return;
    }

    // Same per-animal cross-day context the chips use, so the preflight's workflow status and
    // warning set fold in the bad-channel monotonicity block consistently with the gate.
    const animalDaysByKey = buildAnimalDaysByKey(workspace);
    const preflight = validRows.map(({ animal, animalKey: rowAnimalKey, day }) => {
      const animalDays = animalDaysByKey[rowAnimalKey] || [];
      try {
        const merged = mergeDayMetadata(animal, day);
        const status = getDayWorkflowStatus(animal, day, merged, animalDays);
        const ntrodeMap = merged.ntrode_electrode_group_channel_map || [];
        const failedChannels = ntrodeMap.reduce((t, n) => t + (n.bad_channels?.length || 0), 0);
        // Day-protocol opto state (Task 10), shared with the single-day Export preflight so the two
        // agree: an opto-implanted animal with an opto-free day reads "implanted, no stimulation",
        // not "on".
        const opto = describeDayOptoState(merged).label;
        // Phase 3-6: the day's outstanding non-blocking warnings (same predicate the single-day
        // Export step uses). These don't block the gate; they require explicit acknowledgement.
        const warnings = validateDay(day, merged, animal, animalDays).filter((i) => i.severity === 'warning');
        return {
          dayId: day.id,
          label: `${subjectLabel(animal)} — ${day.session?.session_id || day.id}`,
          version: status.configurationVersion,
          historical: status.isHistoricalConfiguration,
          groups: (merged.electrode_groups || []).length,
          failedChannels,
          cameras: (merged.cameras || []).length,
          opto,
          warnings,
        };
      } catch (err) {
        return { dayId: day.id, label: `${subjectLabel(animal)} — ${day.id}`, error: err.message };
      }
    });

    // The acknowledgement set: one entry per day that carries outstanding warnings.
    const warningItems = preflight
      .filter((entry) => entry.warnings && entry.warnings.length > 0)
      .map((entry) => ({ key: entry.dayId, label: entry.label, warnings: entry.warnings }));

    clearReports();
    setActionMessage('');
    setWarningsAcknowledged(false);
    setPendingExport({ rows: validRows, preflight, warningItems });
  };

  const cancelExport = () => {
    setPendingExport(null);
    setWarningsAcknowledged(false);
  };

  // Step 2 of batch export: run the actual downloads after the user confirms the preflight.
  const runExport = () => {
    if (!pendingExport) return;
    // Defense-in-depth: outstanding warnings must be explicitly acknowledged before any download.
    // The Confirm button is also disabled until then; this guards a programmatic/edge call too.
    if (pendingExport.warningItems.length > 0 && !warningsAcknowledged) return;
    const { rows: validRows } = pendingExport;
    setPendingExport(null);
    setWarningsAcknowledged(false);

    const strict = isFeatureEnabled('shadowExportStrict');
    const skipped = [];
    const overridden = [];
    const failed = [];
    const stale = [];
    let exported = 0;

    // Re-derive the CURRENT recovery status of every day from the live workspace, so a day that
    // became recovered_unlinked / wrong_owner / dangling while the preflight was open is dropped
    // here — not just one that changed content. Keyed by (animalKey, dayId): under duplicate-index
    // corruption the same day id can appear under two animals with different statuses, so a
    // dayId-only key could let one animal's status mask another's.
    // Tuple key (JSON) so arbitrary imported animal/day ids can't collide — a plain separator
    // can't distinguish ('a|b','c') from ('a','b|c').
    const statusKey = (animalKey, dayId) => JSON.stringify([animalKey, dayId]);
    const currentStatusByKey = new Map(
      classifyWorkspaceDays(workspace).map((d) => [statusKey(d.animalKey, d.dayId), d.status])
    );
    // Re-derive the per-animal cross-day context from the LIVE workspace so the final
    // re-validation enforces the bad-channel monotonicity block (a regressing day must not slip
    // through the batch gate even if it was 'valid' at preflight time).
    const animalDaysByKey = buildAnimalDaysByKey(workspace);

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
      if (!isExportableDayStatus(currentStatusByKey.get(statusKey(animalKey, rowDay.id)))) {
        // Became recovered-unlinked / wrong-owner / dangling since the preflight — not part of
        // the animal's recording days anymore, so it must not export from a stale preflight.
        stale.push({ ...identity, detail: "No longer part of the animal's day list since the preflight." });
        return;
      }
      let stillValid = false;
      let revalidationError = null;
      try {
        const animalDays = animalDaysByKey[animalKey] || [];
        stillValid =
          deriveChip(computeStepStatus(day, mergeDayMetadata(animal, day), animal, animalDays)) === 'valid';
      } catch (err) {
        // A throw here is NOT "no longer valid" — the day became UNREADABLE (corrupt config). Label
        // it honestly and log the reason, mirroring the download `failed` branch, rather than
        // silently mislabeling a crash as a validity change.
        stillValid = false;
        revalidationError = err;
        // eslint-disable-next-line no-console
        console.error(`[validation-summary] could not re-validate day "${day.id}" at export confirm:`, err);
      }
      if (!stillValid) {
        stale.push({
          ...identity,
          detail: revalidationError
            ? `Could not be re-validated since the preflight: ${revalidationError.message}`
            : 'No longer valid since the preflight.',
        });
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

  // When nothing is exportable (no valid days) BUT there are days with errors, "Export Valid
  // Only" would be inert — one click reports "Exported 0 files" with no fix path. Disable it with an
  // accessible reason instead, so the affordance doesn't mislead. (With 0 valid and only INCOMPLETE
  // days — no errors — the button stays enabled: clicking gives the "complete the required fields"
  // guidance, which is the right next step there.)
  const exportValidDisabled = counts.valid === 0 && counts.error > 0;
  const exportValidDisabledReason = 'No valid days to export — fix errors first.';

  // Scoped (embedded in AnimalView) renders a section + a scoped header — NOT a second
  // `<main id="main-content">` (AnimalView owns the page landmark) and NOT the page-level h1.
  const Wrapper = scoped ? 'section' : 'main';
  const wrapperProps = scoped
    ? { className: 'validation-summary validation-summary--scoped', 'aria-label': 'Validation and export for this animal' }
    : { id: 'main-content', tabIndex: '-1', role: 'main', 'aria-labelledby': 'validation-heading' };

  return (
    <Wrapper {...wrapperProps}>
      {scoped ? (
        <header className="validation-summary-scoped-header">
          <h2>This animal — readiness &amp; export</h2>
          <p className="validation-summary-scoped-subhead" data-testid="validation-scope">
            Showing: {animalKey} — {rows.length} {rows.length === 1 ? 'day' : 'days'}
          </p>
          {/* This tab handles ONE animal; the cross-animal batch preflight + export lives at the
              chrome-level Validation & Export screen (Task 4.4) — link up to it so the relationship
              is explicit, not hidden. */}
          <p className="validation-summary-scoped-uplink">
            <a href="#/validation">Validate &amp; export all animals →</a>
          </p>
        </header>
      ) : (
        <h1 id="validation-heading">Validation Summary</h1>
      )}

      {!hasDays ? (
        scoped ? (
          <p className="validation-summary-empty">
            This animal has no recording days yet. Add a recording day to see its readiness and
            export here.
          </p>
        ) : (
          <p className="validation-summary-empty">
            No recording days yet. Create an animal and a recording day to see its
            validation status here. <a href="#/workspace">Go to Workspace</a>.
          </p>
        )
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
              title="Save the current validation status for each recording day so it persists across reloads and other views. Recovered and wrong-owner days are skipped (they aren't this animal's recording days)."
            >
              Validate All
            </button>
            <button
              type="button"
              onClick={handleExportValidOnly}
              disabled={exportValidDisabled}
              aria-describedby={exportValidDisabled ? 'export-valid-disabled-reason' : undefined}
              title={
                exportValidDisabled
                  ? exportValidDisabledReason
                  : "Download YAML for every valid day that is part of an animal's day list. Days with errors or incomplete fields are not exported; recovered days not in the list must be re-linked first."
              }
            >
              Export Valid Only
            </button>
            {exportValidDisabled && (
              // Accessible disabled reason: a disabled control is not announced on hover by SRs, so
              // pair it with a visible, programmatically-associated explanation (aria-describedby).
              <p
                id="export-valid-disabled-reason"
                className="validation-summary-hint validation-summary-disabled-reason"
              >
                {exportValidDisabledReason}
              </p>
            )}
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
                        {describeConfigVersionLabel(entry.version, entry.historical)}; {entry.groups}{' '}
                        electrode {entry.groups === 1 ? 'group' : 'groups'}, {entry.failedChannels}{' '}
                        failed {entry.failedChannels === 1 ? 'channel' : 'channels'}; {entry.cameras}{' '}
                        {entry.cameras === 1 ? 'camera' : 'cameras'}; {entry.opto}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {/* Phase 3-6: outstanding non-blocking warnings must be explicitly acknowledged before
                  the download proceeds — a silent warning can otherwise ride the export across days. */}
              <WarningAcknowledgement
                items={pendingExport.warningItems}
                acknowledged={warningsAcknowledged}
                onChange={setWarningsAcknowledged}
              />
              <div className="batch-export-preflight-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={runExport}
                  disabled={pendingExport.warningItems.length > 0 && !warningsAcknowledged}
                >
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
            className="validation-summary-validate-errors"
            detailLabel="Validation error"
            message={
              validateErrorReport.length === 1
                ? '1 day could not be validated and was left unchanged — repair it, then run Validate All again:'
                : `${validateErrorReport.length} days could not be validated and were left unchanged — repair them, then run Validate All again:`
            }
            items={validateErrorReport}
          />

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

          {/* The table can be wider than a phone viewport (6 columns of dense scan/session text), so
              it scrolls horizontally WITHIN this container instead of forcing the whole page to
              overflow — the page stays at the viewport width at ~390px and no cell is clipped off. */}
          <div className="validation-summary-table-scroll">
          <table className="validation-summary-table">
            <caption className="visually-hidden">
              Recording days across all animals with validation status
            </caption>
            <thead>
              <tr>
                <th scope="col">Animal</th>
                <th scope="col">Date</th>
                <th scope="col">Session</th>
                <th scope="col">Setup</th>
                <th scope="col">Status</th>
                <th scope="col">Editor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ animal, animalKey, day, chip, scan, unreadable, missingRecord, orphaned, ownerMissing, wrongOwner }, index) => (
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
                        title={`This day is listed under ${subjectLabel(animal)} but its record belongs to ${describeOwner(day.animalId)}. It is NOT exported with this animal's metadata; remove it from this animal so it returns to its real owner.`}
                      >
                        {' '}⚠ belongs to {describeOwner(day.animalId)}
                      </span>
                    )}
                  </td>
                  <td>{day.date || '—'}</td>
                  <td>
                    {day.session?.session_id || '—'}
                    {scan?.sessionDescription && (
                      <span
                        className="validation-summary-session-description"
                        data-testid={`session-description-${day.id}`}
                      >
                        {scan.sessionDescription}
                      </span>
                    )}
                  </td>
                  <td>
                    {/* Scan fields: pinned configuration version (via describeConfigVersionLabel),
                        camera count + calibration, and the day-protocol opto state — so days can be
                        compared at a glance. Absent for unreadable/missing/wrong-owner rows (no
                        trustworthy merge), shown as "—". In the SCOPED per-animal tab, the cell
                        becomes an expander whose summary reads the same unified config-version label
                        and whose body is the read-only effective-setup-for-this-day review. */}
                    {scan ? (
                      scoped ? (
                        <details className="validation-summary-effective" data-testid={`effective-${day.id}`}>
                          <summary className="validation-summary-scan">
                            {describeConfigVersionLabel(scan.version, scan.historical)}
                            {' · '}
                            {scan.cameras} {scan.cameras === 1 ? 'camera' : 'cameras'}
                            {scan.cameraCalibration && (
                              <span className="validation-summary-scan-cameras">
                                {' ('}
                                {scan.cameraCalibration}
                                {')'}
                              </span>
                            )}
                            {' · '}
                            {scan.opto}
                          </summary>
                          <EffectiveDayReview animal={animal} day={day} />
                        </details>
                      ) : (
                        <span className="validation-summary-scan">
                          {describeConfigVersionLabel(scan.version, scan.historical)}
                          {' · '}
                          {scan.cameras} {scan.cameras === 1 ? 'camera' : 'cameras'}
                          {scan.cameraCalibration && (
                            <span className="validation-summary-scan-cameras">
                              {' ('}
                              {scan.cameraCalibration}
                              {')'}
                            </span>
                          )}
                          {' · '}
                          {scan.opto}
                        </span>
                      )
                    ) : (
                      '—'
                    )}
                  </td>
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
                        aria-label={`Remove ${day.date || day.id} from ${subjectLabel(animal)} (it belongs to ${describeOwner(day.animalId)})`}
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
          </div>
        </>
      )}
    </Wrapper>
  );
}

ValidationSummary.propTypes = {
  animalKey: PropTypes.string,
};

ValidationSummary.defaultProps = {
  animalKey: undefined,
};

export default ValidationSummary;
