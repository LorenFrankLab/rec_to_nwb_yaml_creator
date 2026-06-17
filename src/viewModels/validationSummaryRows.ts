/**
 * @fileoverview Pure row-building + display helpers for the Validation Summary.
 *
 * Everything here is React-free and deterministic: it flattens the workspace into the
 * table-ordered row set ({@link buildRows} / {@link buildAnimalRows}), derives each day's
 * status chip from the SAME validation the Day Editor uses ({@link deriveChip} /
 * {@link dayChipDisplay}), and formats the per-row scan/label text. Extracted from
 * `pages/ValidationSummary/index.jsx` (Phase 9c) with no behavior change so the component,
 * the batch-export handlers, and the table all consume one source of these decisions.
 */

import { mergeDayMetadata } from '../state/workspaceUtils';
import { getAnimalSubject } from '../state/workspaceSelectors';
import type { Animal, Day } from '../state/workspaceTypes';
import { computeStepStatus, validateDay } from '../domain/validation';
import { getDayWorkflowStatus } from '../domain/workflowStatus';
import { allBlockingIssuesDeferred, isDayValidationDeferred } from '../domain/validationPresentation';
import { DAY_LIFECYCLE_LABEL, lifecycleForValidDay } from '../domain/dayLifecycle';
import { describeDayOptoState } from '../domain/optoStatus';
import { classifyWorkspaceDays, DAY_STATUS, describeOwner } from '../domain/dayRecovery';
import type { DayStatus } from '../domain/dayRecovery';

/** A per-day validation chip variant. */
export type ChipType = 'valid' | 'error' | 'incomplete';

/** Per-row scan summary surfaced for catch-up triage without opening each editor. */
export interface DayScan {
  version: number | null;
  historical: boolean;
  sessionDescription: string;
  cameras: number;
  cameraCalibration: string;
  opto: string;
}

/** One flattened Validation Summary row (a classified day decorated with its chip + scan). */
export interface SummaryRow {
  animal: Record<string, unknown>;
  animalKey: string;
  day: Record<string, unknown>;
  chip: ChipType;
  status: DayStatus;
  missingRecord?: boolean;
  orphaned?: boolean;
  ownerMissing?: boolean;
  wrongOwner?: boolean;
  unreadable?: boolean;
  scan?: DayScan;
}

/**
 * Derive a single per-day chip from the Day Editor step statuses.
 *
 * Single rule, no forked validation:
 * - every step `'valid'` → `'valid'`
 * - any step `'error'` → `'error'`
 * - otherwise (any `'incomplete'`/`'pending'`, no errors) → `'incomplete'`
 */
export function deriveChip(stepStatus: Record<string, string>): ChipType {
  const statuses = Object.values(stepStatus);
  if (statuses.every((s) => s === 'valid')) return 'valid';
  if (statuses.some((s) => s === 'error')) return 'error';
  return 'incomplete';
}

function deriveDisplayChip(
  stepStatus: Record<string, string>,
  day: Record<string, unknown>,
  merged: Record<string, unknown>,
  animal: Record<string, unknown>,
  animalDays: Array<Record<string, unknown>>
): ChipType {
  const chip = deriveChip(stepStatus);
  if (chip !== 'error') return chip;
  if (isDayValidationDeferred(day)) return 'incomplete';
  try {
    return allBlockingIssuesDeferred(validateDay(day, merged, animal, animalDays), day)
      ? 'incomplete'
      : chip;
  } catch {
    return chip;
  }
}

export const CHIP_LABEL: Record<ChipType, string> = { valid: 'Valid', error: 'Error', incomplete: 'Incomplete' };

/**
 * The per-day status chip's variant + label, worded from the shared {@link DAY_LIFECYCLE}
 * vocabulary so the table never contradicts Animal Days / Day Validation.
 *
 * A LIVE-valid day is refined by its persisted `state`: a saved validation reads "Validated"
 * (and an exported day "Exported") — visually distinct from a merely live-valid, unsaved day,
 * which reads "Ready to export". The error/incomplete buckets keep their live tally words
 * ("Error"/"Incomplete") so they still match the counts row. Live state always wins: an
 * error/incomplete day NEVER reads "Validated" even if a stale saved flag says so (the chip is
 * derived from the live `chip`, and only the valid bucket consults `state`). The special
 * unreadable / missing-record rows keep their explicit error labels.
 *
 * A recovered-unlinked (`orphaned`) day is valid metadata but NOT exportable until it is re-linked
 * into its animal's day list (the batch export filters it out), so a valid orphan must NOT claim
 * "Ready to export"/"Validated"/"Exported" — it reads "Re-link to export" (the actionable blocker,
 * complementing the row's "not in day list" note + "Add to day list" repair). An orphan with
 * errors/incomplete still shows those (they're the more urgent truth and don't falsely claim
 * exportability).
 *
 * @param chip - The live validation chip from {@link deriveChip}.
 * @param state - The day's persisted `state` (may be malformed).
 * @returns The chip variant (CSS modifier) and its label.
 */
export function dayChipDisplay(
  chip: ChipType,
  state: unknown,
  { unreadable = false, missingRecord = false, orphaned = false }: { unreadable?: boolean; missingRecord?: boolean; orphaned?: boolean } = {}
): { variant: string; label: string } {
  if (unreadable) return { variant: 'error', label: 'Error — cannot read' };
  if (missingRecord) return { variant: 'error', label: 'Error — missing day record' };
  if (chip === 'valid') {
    // Not exportable until re-linked — don't claim export-readiness (incomplete styling reads as
    // "not ready", which is honest; the linkage is the blocker). "Re-link to export" is the action,
    // distinct from the row's "not in day list" state note.
    if (orphaned) return { variant: 'incomplete', label: 'Re-link to export' };
    const variant = lifecycleForValidDay(state); // 'ready' | 'validated' | 'exported'
    return { variant, label: DAY_LIFECYCLE_LABEL[variant] };
  }
  return { variant: chip, label: CHIP_LABEL[chip] };
}

// How many cameras to spell out by name + calibration before collapsing the rest into "+K more".
// Keeps the scan cell readable on a many-camera day without hiding that recalibration happened.
export const CAMERA_CALIBRATION_LIMIT = 3;

/**
 * A concise "name meters_per_pixel m/px" summary of the day-used cameras, so a re-calibrated camera
 * (changed `meters_per_pixel`) is visible during catch-up triage instead of being hidden behind a
 * bare camera count. Truncates gracefully after a few cameras (`+K more`). Returns '' when the day
 * uses no cameras (the count text already conveys "0 cameras").
 *
 * @param cameras - The day-used cameras (the SAME set the scan count is derived from — `merged.cameras`).
 * @returns A concise camera-calibration summary, or '' for no cameras.
 */
export function describeCameraCalibration(cameras: unknown): string {
  const list: Array<Record<string, unknown>> = Array.isArray(cameras) ? cameras : [];
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
 * @param value - The candidate value.
 * @returns True for a non-null, non-array object.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Per-animal cross-day context for the bad-channel monotonicity export-block: a map from
 * `animalKey` to that animal's OK-status recording-day RECORDS, date-sorted — the SAME OK-only,
 * date-ordered view `getAnimalDays` returns and the Day Editor threads into its export gate.
 * Without this context the monotonicity rule is a no-op, so a day that silently un-fails an
 * earlier same-config bad channel reads "valid" here while the row badge says "Needs fixing".
 *
 * @param workspace - `model.workspace` ({ animals, days }).
 * @returns `{ [animalKey]: dateSortedOkDayRecords }`.
 */
export function buildAnimalDaysByKey(workspace: unknown): Record<string, Array<Record<string, unknown>>> {
  const byKey: Record<string, Array<Record<string, unknown>>> = {};
  for (const { animalKey, record, status } of classifyWorkspaceDays(workspace)) {
    if (status !== DAY_STATUS.OK || !isRecord(record)) continue;
    (byKey[animalKey as string] ||= []).push(record);
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
 * @param workspace - `model.workspace` ({ animals, days }).
 * @returns The flattened, table-ordered rows.
 */
export function buildRows(workspace: unknown): SummaryRow[] {
  // The day RECOVERY STATUS of every reference/record is decided ONCE in the domain
  // ({@link classifyWorkspaceDays}) so this surface doesn't re-derive "what kind of day is
  // this?". buildRows only DECORATES each classified day with its validation chip and the
  // legacy row flags the table renders. Each row also carries its `status` so the export
  // policy ({@link isExportableDayStatus}) is read, not re-decided, downstream.
  const animalsMap: Record<string, unknown> = isRecord(workspace) && isRecord(workspace.animals) ? workspace.animals : {};
  const rows: SummaryRow[] = [];

  // Cross-day context for the bad-channel monotonicity export-block, built ONCE per render (not
  // per row) so the chip, the workflow status, and the batch re-validation all feed the rule its
  // required context and therefore agree with the per-day "Needs fixing" row badge.
  const animalDaysByKey = buildAnimalDaysByKey(workspace);

  for (const { animalKey, dayId, record, status } of classifyWorkspaceDays(workspace)) {
    const key = animalKey as string;
    const animal: Record<string, unknown> = isRecord(animalsMap[key]) ? animalsMap[key] : { id: animalKey };

    if (status === DAY_STATUS.DANGLING_REFERENCE) {
      // Indexed id with no resolvable record — visible, counted, repairable (remove reference).
      rows.push({ animal, animalKey: key, day: { id: dayId }, chip: 'error', status, missingRecord: true });
      // eslint-disable-next-line no-console
      console.error(
        `[validation-summary] day reference "${dayId}" does not resolve to a record — flagged as error.`
      );
      continue;
    }
    if (status === DAY_STATUS.ORPHAN_NO_OWNER) {
      // Real record whose owning animal is gone — visible but not auto-exportable; no relink target.
      rows.push({ animal, animalKey: key, day: record as Record<string, unknown>, chip: 'error', status, orphaned: true, ownerMissing: true });
      // eslint-disable-next-line no-console
      console.error(`[validation-summary] day "${dayId}" is not listed by any animal — flagged as orphaned.`);
      continue;
    }
    if (status === DAY_STATUS.WRONG_OWNER) {
      // Indexed here but the record declares a DIFFERENT owner. Do NOT merge/validate it with
      // THIS animal (that would compute a chip — and could export — with the wrong subject). Flag
      // as an error and offer the unlink repair so it resurfaces under its real owner.
      rows.push({ animal, animalKey: key, day: record as Record<string, unknown>, chip: 'error', status, wrongOwner: true });
      // eslint-disable-next-line no-console
      console.error(
        `[validation-summary] day "${dayId}" is indexed by "${animalKey}" but belongs to ${describeOwner((record as Record<string, unknown>).animalId)} — flagged as wrong owner.`
      );
      continue;
    }

    // OK or RECOVERED_UNLINKED: a real record → show its validation chip. mergeDayMetadata
    // throws BY DESIGN on a corrupt animal; one unreadable day must not blank the summary.
    const orphaned = status === DAY_STATUS.RECOVERED_UNLINKED;
    const dayRecord = record as Record<string, unknown>;
    // The animal's OK-status day records (date-sorted) — the cross-day context the bad-channel
    // monotonicity block needs so the chip agrees with the row badge.
    const animalDays = animalDaysByKey[key] || [];
    try {
      const merged = mergeDayMetadata(animal as unknown as Animal, dayRecord as unknown as Day);
      const stepStatus = computeStepStatus(dayRecord, merged, animal, animalDays);
      const chip = deriveDisplayChip(stepStatus, dayRecord, merged, animal, animalDays);
      // Batch-row scan fields (Task 10): the configuration version pinned, the camera count, and
      // the day-protocol opto state — so days can be compared before opening each editor. Computed
      // here (where the merge already succeeded) so the table reads, never re-derives.
      const workflow = getDayWorkflowStatus(animal, dayRecord, merged, animalDays);
      const session = dayRecord.session as Record<string, unknown> | undefined;
      const sessionDescriptionRaw = session?.session_description;
      const sessionDescription =
        typeof sessionDescriptionRaw === 'string' && sessionDescriptionRaw.trim()
          ? sessionDescriptionRaw.trim()
          : '';
      const scan: DayScan = {
        version: workflow.configurationVersion,
        historical: workflow.isHistoricalConfiguration,
        // The day's session description (trimmed, empty when blank/whitespace-only) — surfaced in the
        // row so it isn't hidden behind the session id alone.
        sessionDescription,
        cameras: ((merged.cameras as unknown[]) || []).length,
        // Day-used camera calibration (name + meters_per_pixel) from the SAME camera set the count
        // is derived from, so a re-calibrated camera is visible without opening the editor.
        cameraCalibration: describeCameraCalibration(merged.cameras),
        opto: describeDayOptoState(merged).label,
      };
      rows.push({ animal, animalKey: key, day: dayRecord, chip, status, orphaned, scan });
    } catch (err) {
      rows.push({ animal, animalKey: key, day: dayRecord, chip: 'error', status, orphaned, unreadable: true });
      // eslint-disable-next-line no-console
      console.error(`[validation-summary] could not read day "${dayRecord?.id}" — flagged as error:`, err);
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
 * @param workspace - `model.workspace` ({ animals, days }).
 * @param animalKey - The animal whose rows to keep.
 * @returns The rows scoped to that animal.
 */
export function buildAnimalRows(workspace: unknown, animalKey: string): SummaryRow[] {
  return buildRows(workspace).filter((row) => row.animalKey === animalKey);
}

// Coerced to a string so a corrupt (object/number) subject_id or animal id can never be returned
// as a React child (which throws "objects are not valid as a React child").
export const subjectLabel = (animal: unknown): string => {
  const id = getAnimalSubject(animal).subject_id ?? (animal as Record<string, unknown> | null | undefined)?.id;
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
 * @param version - The pinned configuration version.
 * @param historical - Whether that version is NOT the animal's latest.
 * @returns The unified config-version label.
 */
export function describeConfigVersionLabel(version: number | null, historical: boolean): string {
  return `config v${version ?? '—'} (${historical ? 'historical' : 'latest'})`;
}
