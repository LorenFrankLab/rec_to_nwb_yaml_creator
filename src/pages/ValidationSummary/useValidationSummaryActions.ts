/**
 * @fileoverview The Validation Summary's batch-action controller (Validate All / Export Valid Only).
 *
 * Owns the per-run feedback state (the polite status message + the five assertive per-day reports +
 * the pending-export preflight + the warning acknowledgement) and the three handlers that drive it.
 * Extracted from `pages/ValidationSummary/index.jsx` (Phase 9c) with no behavior change — the
 * component computes `rows` and renders; this hook is the stateful logic behind its two buttons.
 *
 * Both batch paths re-derive their cross-day context, recovery status, and validity from the LIVE
 * workspace at action time (not the render-time rows) so a day that changed since render is handled
 * honestly; see the inline notes preserved from the original.
 */

import { useState } from 'react';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import type { Animal, Day } from '../../state/workspaceTypes';
import { computeStepStatus, validateDay } from '../../domain/validation';
import type { RepairableIssue } from '../../domain/repairRouting';
import { getDayWorkflowStatus } from '../../domain/workflowStatus';
import { describeDayOptoState } from '../../domain/optoStatus';
import { classifyWorkspaceDays, isDayStatus, isExportableDayStatus } from '../../domain/dayRecovery';
import type { DayStatus } from '../../domain/dayRecovery';
import { exportDayFile } from '../../domain/exportDay';
import { isFeatureEnabled } from '../../featureFlags';
import {
  deriveChip,
  isRecord,
  buildAnimalDaysByKey,
  subjectLabel,
} from '../../viewModels/validationSummaryRows';
import type { SummaryRow } from '../../viewModels/validationSummaryRows';

/** A per-day line in one of the assertive batch reports / the validate-errors list. */
interface ReportItem {
  dayId: string;
  subjectId: string;
  date: string;
  detail?: string;
}

/** One day's entry in the pending-export preflight (success fields, or an `error`). */
export interface PreflightEntry {
  dayId: string;
  label: string;
  version?: number | null;
  historical?: boolean;
  groups?: number;
  failedChannels?: number;
  cameras?: number;
  opto?: string;
  warnings?: RepairableIssue[];
  error?: string;
}

/** One day with outstanding warnings the user must acknowledge before export. */
export interface WarningItem {
  key: string;
  label: string;
  warnings: RepairableIssue[];
}

/** The pending batch export awaiting preflight confirmation. */
export interface PendingExport {
  rows: SummaryRow[];
  preflight: PreflightEntry[];
  warningItems: WarningItem[];
}

interface ValidationSummaryActionsParams {
  /** The current table rows ({@link buildRows} / {@link buildAnimalRows}). */
  rows: SummaryRow[];
  /** `model.workspace` ({ animals, days }) — read live at action time. */
  workspace: unknown;
  /** The store actions (`updateDay`, …). */
  actions: { updateDay: (dayId: string, patch: { state: Record<string, unknown> }) => void };
}

/**
 * The Validation Summary's batch-action controller: the per-run feedback state + the three handlers.
 * Takes the rows, the live workspace, and the store actions.
 *
 * @returns The feedback state + the three batch handlers the component renders/wires.
 */
export function useValidationSummaryActions({ rows, workspace, actions }: ValidationSummaryActionsParams) {
  // Action feedback: a polite status message plus three assertive per-day reports —
  // parity skips (strict), debug-override downloads (strict off), and hard failures.
  const [actionMessage, setActionMessage] = useState('');
  const [skippedReport, setSkippedReport] = useState<ReportItem[]>([]);
  const [overriddenReport, setOverriddenReport] = useState<ReportItem[]>([]);
  const [failedReport, setFailedReport] = useState<ReportItem[]>([]);
  // Days dropped at confirm because they changed since the preflight (gone / no longer valid) —
  // reported separately from parity skips so they aren't mislabeled "parity check failed".
  const [staleReport, setStaleReport] = useState<ReportItem[]>([]);
  // Days Validate All could not persist (corrupt `day.state` shape, or a write that threw) — named
  // in the UI with their repair path so imported/recovered corruption isn't console-only.
  const [validateErrorReport, setValidateErrorReport] = useState<ReportItem[]>([]);
  // Pending batch export awaiting preflight confirmation: { rows, preflight, warningItems }.
  const [pendingExport, setPendingExport] = useState<PendingExport | null>(null);
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
    const validateErrors: ReportItem[] = [];
    validatable.forEach(({ animal, day, chip }) => {
      // A TRUTHY non-record `day.state` (a corrupt import persisting it as a scalar/array) is
      // itself corruption. Do NOT LAUNDER it by coercing to `{}` and stamping `validated` on top —
      // that would hide the corrupt state behind a bulk action. Skip the write and report it; the
      // corruption is repairable in the Day Editor's raw-shape UI. An ABSENT state (null/undefined)
      // is not corruption — it initializes cleanly to `{}`.
      if (day.state != null && !isRecord(day.state)) {
        validateErrors.push({
          dayId: day.id as string,
          subjectId: animal ? subjectLabel(animal) : (day.id as string),
          date: (day.date || day.id) as string,
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
        actions.updateDay(day.id as string, {
          state: {
            ...currentState,
            validationDeferred: false,
            deferredEpochs: [],
            validated: chip === 'valid',
          },
        });
      } catch (err) {
        validateErrors.push({
          dayId: day.id as string,
          subjectId: animal ? subjectLabel(animal) : (day.id as string),
          date: (day.date || day.id) as string,
          detail: `Could not save: ${(err as Error).message}`,
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
    const preflight: PreflightEntry[] = validRows.map(({ animal, animalKey: rowAnimalKey, day }) => {
      const animalDays = animalDaysByKey[rowAnimalKey] || [];
      try {
        const merged = mergeDayMetadata(animal as unknown as Animal, day as unknown as Day);
        const status = getDayWorkflowStatus(animal, day, merged, animalDays);
        const ntrodeMap = (merged.ntrode_electrode_group_channel_map as Array<{ bad_channels?: unknown[] }>) || [];
        const failedChannels = ntrodeMap.reduce((t, n) => t + (n.bad_channels?.length || 0), 0);
        // Day-protocol opto state (Task 10), shared with the single-day Export preflight so the two
        // agree: an opto-implanted animal with an opto-free day reads "implanted, no stimulation",
        // not "on".
        const opto = describeDayOptoState(merged).label;
        // Phase 3-6: the day's outstanding non-blocking warnings (same predicate the single-day
        // Export step uses). These don't block the gate; they require explicit acknowledgement.
        const warnings = validateDay(day, merged, animal, animalDays).filter((i) => i.severity === 'warning');
        return {
          dayId: day.id as string,
          label: `${subjectLabel(animal)} — ${(day.session as Record<string, unknown> | undefined)?.session_id || day.id}`,
          version: status.configurationVersion,
          historical: status.isHistoricalConfiguration,
          groups: ((merged.electrode_groups as unknown[]) || []).length,
          failedChannels,
          cameras: ((merged.cameras as unknown[]) || []).length,
          opto,
          warnings,
        };
      } catch (err) {
        return { dayId: day.id as string, label: `${subjectLabel(animal)} — ${day.id}`, error: (err as Error).message };
      }
    });

    // The acknowledgement set: one entry per day that carries outstanding warnings.
    const warningItems = preflight
      .filter((entry) => entry.warnings && entry.warnings.length > 0)
      .map((entry) => ({ key: entry.dayId, label: entry.label, warnings: entry.warnings! }));

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
    const skipped: ReportItem[] = [];
    const overridden: ReportItem[] = [];
    const failed: ReportItem[] = [];
    const stale: ReportItem[] = [];
    let exported = 0;

    // Re-derive the CURRENT recovery status of every day from the live workspace, so a day that
    // became recovered_unlinked / wrong_owner / dangling while the preflight was open is dropped
    // here — not just one that changed content. Keyed by (animalKey, dayId): under duplicate-index
    // corruption the same day id can appear under two animals with different statuses, so a
    // dayId-only key could let one animal's status mask another's.
    // Tuple key (JSON) so arbitrary imported animal/day ids can't collide — a plain separator
    // can't distinguish ('a|b','c') from ('a','b|c').
    const statusKey = (animalKeyArg: unknown, dayId: unknown): string => JSON.stringify([animalKeyArg, dayId]);
    const currentStatusByKey = new Map(
      classifyWorkspaceDays(workspace).map((d): [string, DayStatus] => [statusKey(d.animalKey, d.dayId), d.status])
    );
    // Re-derive the per-animal cross-day context from the LIVE workspace so the final
    // re-validation enforces the bad-channel monotonicity block (a regressing day must not slip
    // through the batch gate even if it was 'valid' at preflight time).
    const animalDaysByKey = buildAnimalDaysByKey(workspace);

    validRows.forEach(({ animalKey: rowAnimalKey, day: rowDay }) => {
      // Re-resolve the CURRENT records and RE-VALIDATE before downloading: state may have
      // changed while the preflight was open, so a day that was valid at preflight time must
      // not be exported now if it is no longer present or no longer valid.
      const animal = isRecord(workspace) && isRecord(workspace.animals) ? workspace.animals[rowAnimalKey] : undefined;
      const day = isRecord(workspace) && isRecord(workspace.days) ? workspace.days[rowDay.id as string] : undefined;
      const identity: ReportItem = {
        dayId: rowDay.id as string,
        subjectId: animal ? subjectLabel(animal) : (rowDay.id as string),
        date: (isRecord(day) ? day.date : rowDay.date) as string,
      };

      if (!animal || !isRecord(day)) {
        stale.push({ ...identity, detail: 'No longer present since the preflight.' });
        return;
      }
      const currentStatus = currentStatusByKey.get(statusKey(rowAnimalKey, rowDay.id));
      if (!isDayStatus(currentStatus) || !isExportableDayStatus(currentStatus)) {
        // Became recovered-unlinked / wrong-owner / dangling since the preflight — not part of
        // the animal's recording days anymore, so it must not export from a stale preflight.
        stale.push({ ...identity, detail: "No longer part of the animal's day list since the preflight." });
        return;
      }
      let stillValid = false;
      let revalidationError: unknown = null;
      try {
        const animalDays = animalDaysByKey[rowAnimalKey] || [];
        stillValid =
          deriveChip(computeStepStatus(day, mergeDayMetadata(animal as unknown as Animal, day as unknown as Day), animal, animalDays)) === 'valid';
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
            ? `Could not be re-validated since the preflight: ${(revalidationError as Error).message}`
            : 'No longer valid since the preflight.',
        });
        return;
      }

      // The actual download + parity gate + mark-exported is the SHARED single-day export core, so
      // this batch and the animal page's "Export selected" can never fork on export bytes/parity.
      const outcome = exportDayFile(animal as unknown as Animal, day as unknown as Day, { actions, strict });
      switch (outcome.kind) {
        case 'exported':
          exported += 1;
          break;
        case 'overridden':
          // strict === false: downloaded DESPITE a parity mismatch. Surface it loudly so the
          // override is never silent.
          exported += 1;
          overridden.push({ ...identity, detail: outcome.diff });
          break;
        case 'skipped':
          // Parity mismatch in strict mode: not downloaded.
          skipped.push({ ...identity, detail: outcome.diff });
          break;
        case 'failed':
          // A throw (e.g. encoder failure) must not silently truncate the batch.
          failed.push({ ...identity, detail: outcome.message });
          break;
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

  return {
    actionMessage,
    skippedReport,
    overriddenReport,
    failedReport,
    staleReport,
    validateErrorReport,
    pendingExport,
    warningsAcknowledged,
    setWarningsAcknowledged,
    handleValidateAll,
    handleExportValidOnly,
    cancelExport,
    runExport,
  };
}
