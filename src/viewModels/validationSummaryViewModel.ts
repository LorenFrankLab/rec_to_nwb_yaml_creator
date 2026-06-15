/**
 * @fileoverview ValidationSummary view-model builder.
 *
 * `buildValidationSummaryViewModel(workspace, animalId?)` turns the workspace into the data the
 * ValidationSummary page renders: the per-day rows (status, recovery, repair), the valid/error/
 * incomplete counts, the batch-action affordances (with their disabled reasons), and the empty/
 * re-link page notes. It composes the existing pure row helpers in
 * `pages/ValidationSummary/validationSummaryRows` (the React-free module that already flattens +
 * classifies the days) and the shared {@link buildDayRowViewModel}; it does not re-derive any rule.
 *
 * The runtime batch-action results — the preflight that appears once the user opens the confirm step,
 * and the per-run reports — are produced by running the actions, not derivable from the workspace, so
 * the builder leaves `batchExport.preflight` and `reports` null. Pure and React-free.
 */

import {
  buildRows,
  buildAnimalRows,
  dayChipDisplay,
  describeConfigVersionLabel,
  subjectLabel,
} from '../pages/ValidationSummary/validationSummaryRows';
import type { SummaryRow } from '../pages/ValidationSummary/validationSummaryRows';
import { buildDayRowViewModel } from './dayRowViewModel';
import type {
  BatchRunResultViewModel,
  DayPreflightViewModel,
  DayRowViewModel,
  DayStatus,
  IssueViewModel,
  WorkflowAction,
} from './types';

/** A ValidationSummary table row: the shared day-row plus the table's per-day scan cells. */
export interface DayStatusRowViewModel extends DayRowViewModel {
  /** The status-chip CSS modifier (`ready`/`validated`/`exported`/`error`/`incomplete`) from
   *  `dayChipDisplay`. Distinct from the lossy `status` ({@link WorkflowSeverity}): the chip needs the
   *  un-collapsed variant to keep `validated`/`exported`/`incomplete` visually distinct. */
  chipVariant: string;
  /** The status-chip's hover tooltip — set only for the unreadable / missing-record error rows whose
   *  chip carries repair guidance; absent (no `title`) for every other row. */
  statusTitle?: string;
  /** The animal index key the day is listed under — the repair-dispatch target (remove/unlink/relink). */
  animalKey: string;
  /** The Animal column label (subject id, coerced to a string). */
  subjectLabel: string;
  /** The day's session id (the Session column), when present. */
  sessionId?: string;
  /** Unified config-version label, e.g. 'config v1 (latest)'; absent for unreadable/missing rows. */
  configVersionLabel?: string;
  /** Day-used camera count; absent when the row has no trustworthy scan. */
  cameras?: number;
  /** Day-used camera calibration summary; absent when no scan. */
  cameraCalibration?: string;
  /** Day-protocol optogenetics state label; absent when no scan. */
  opto?: string;
}

/** The full ValidationSummary page view-model. */
export interface ValidationSummaryViewModel {
  /** Animal-scoped vs all-animals; `subhead` is the scoped header line. */
  scope: { animalId?: string; subhead?: string };
  /** The valid / error / incomplete tally over all rows. */
  counts: { valid: number; error: number; incomplete: number };
  /** The table-ordered rows. */
  days: DayStatusRowViewModel[];
  /** The two batch actions and the (runtime) confirm-step preflight. */
  batchExport: {
    validateAll: WorkflowAction;
    exportValid: WorkflowAction;
    preflight: { days: DayPreflightViewModel[]; warnings: IssueViewModel[]; confirm: WorkflowAction } | null;
  };
  /** The result of the most recent validate-all / batch-export run; null until one completes. */
  reports: BatchRunResultViewModel | null;
  /** Surfaced when a recovered day is present (re-link before it can be exported). */
  relinkNote?: { message: string };
  /** Present when there are no rows; the empty-state copy. */
  empty?: { message: string };
}

const EXPORT_DISABLED_REASON = 'No valid days to export — fix errors first.';
const RELINK_NOTE =
  'Some recovered days are not in a day list — re-link them ("Add to day list") before they can be exported.';
const EMPTY_SCOPED =
  'This animal has no recording days yet. Add a recording day to see its readiness and export here.';
const EMPTY_GLOBAL =
  'No recording days yet. Create an animal and a recording day to see its validation status here.';

/** A day record narrowed to the fields the table cells read. */
type DayCells = {
  id?: string;
  date?: string;
  animalId?: unknown;
  state?: unknown;
  session?: { session_id?: unknown };
};

/** Translate one flattened {@link SummaryRow} into the table's {@link DayStatusRowViewModel}. */
function toDayStatusRow(row: SummaryRow): DayStatusRowViewModel {
  const day = row.day as DayCells;
  const display = dayChipDisplay(row.chip, day?.state, {
    unreadable: row.unreadable,
    missingRecord: row.missingRecord,
    orphaned: row.orphaned,
  });
  const base = buildDayRowViewModel({
    dayId: typeof day?.id === 'string' ? day.id : '',
    date: typeof day?.date === 'string' ? day.date : '',
    sessionDescription: row.scan?.sessionDescription || undefined,
    recovery: row.status as DayStatus,
    display,
    valid: row.chip === 'valid',
    state: day?.state,
    animalKey: row.animalKey,
    declaredOwner: day?.animalId,
  });

  const out: DayStatusRowViewModel = {
    ...base,
    chipVariant: display.variant,
    animalKey: row.animalKey,
    subjectLabel: subjectLabel(row.animal),
  };
  // The chip tooltip exists only for the two repair-guidance error rows; everything else has no title.
  if (row.unreadable) {
    out.statusTitle =
      'This day could not be read — its device configuration is missing or corrupt. Open the editor to repair it.';
  } else if (row.missingRecord) {
    out.statusTitle = 'This day’s saved record is missing or corrupt. Open the editor to repair or recreate it.';
  }
  const sessionId = day?.session?.session_id;
  if (typeof sessionId === 'string') out.sessionId = sessionId;
  if (row.scan) {
    out.configVersionLabel = describeConfigVersionLabel(row.scan.version, row.scan.historical);
    out.cameras = row.scan.cameras;
    out.cameraCalibration = row.scan.cameraCalibration;
    out.opto = row.scan.opto;
  }
  return out;
}

/**
 * Build the ValidationSummary view-model.
 *
 * @param workspace - `model.workspace` ({ animals, days }).
 * @param animalId - When set, scope to that animal (the per-animal Validation & Export tab).
 * @returns The page view-model — pure data, no React.
 */
export function buildValidationSummaryViewModel(
  workspace: unknown,
  animalId?: string
): ValidationSummaryViewModel {
  const scoped = animalId != null;
  const rows = scoped ? buildAnimalRows(workspace, animalId as string) : buildRows(workspace);

  const counts = { valid: 0, error: 0, incomplete: 0 };
  for (const row of rows) counts[row.chip] += 1;

  const days = rows.map(toDayStatusRow);

  const exportValidDisabled = counts.valid === 0 && counts.error > 0;
  const exportValid: WorkflowAction = {
    label: 'Export Valid Only',
    command: { id: 'exportValidOnly' },
    ...(exportValidDisabled ? { disabledReason: EXPORT_DISABLED_REASON } : {}),
  };

  const vm: ValidationSummaryViewModel = {
    scope: scoped
      ? { animalId, subhead: `Showing: ${animalId} — ${rows.length} ${rows.length === 1 ? 'day' : 'days'}` }
      : {},
    counts,
    days,
    batchExport: {
      validateAll: { label: 'Validate All', command: { id: 'validateAllDays' } },
      exportValid,
      preflight: null,
    },
    reports: null,
  };

  if (rows.length === 0) {
    vm.empty = { message: scoped ? EMPTY_SCOPED : EMPTY_GLOBAL };
  } else if (rows.some((row) => row.orphaned)) {
    vm.relinkNote = { message: RELINK_NOTE };
  }

  return vm;
}
