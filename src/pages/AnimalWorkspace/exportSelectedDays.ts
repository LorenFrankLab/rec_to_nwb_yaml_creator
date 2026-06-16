/**
 * @fileoverview The animal page's "Export selected" batch.
 *
 * `exportSelectedDays(workspace, animalKey, dayIds, { actions, strict })` exports a user-selected
 * subset of one animal's recording days. It REUSES the shared deciders rather than reimplementing
 * export truth: the same recovery/exportability classification (`classifyWorkspaceDays` +
 * `isExportableDayStatus`), the same per-day validity (`computeStepStatus` → `deriveChip`) over the
 * same cross-day context (`buildAnimalDaysByKey`), and the same byte-producing download core
 * (`exportDayFile`) the Validation Summary's "Export Valid Only" path uses. Valid days download
 * byte-identically; not-exportable / invalid / unstable days are skipped with a linked reason for the
 * inline "Exported N · Skipped M" result.
 */

import { mergeDayMetadata } from '../../state/workspaceUtils';
import type { Animal, Day } from '../../state/workspaceTypes';
import { computeStepStatus } from '../../domain/validation';
import { classifyWorkspaceDays, isExportableDayStatus } from '../../domain/dayRecovery';
import { exportDayFile } from '../../domain/exportDay';
import type { ExportDayActions } from '../../domain/exportDay';
import { deriveChip, buildAnimalDaysByKey, isRecord } from '../../viewModels/validationSummaryRows';

/** One skipped day in the batch result: its identity + why it was not exported + where to fix it. */
export interface SkippedDay {
  dayId: string;
  /** The day's display date (or its id when undated). */
  date: string;
  /** Plain-language reason the day was not exported. */
  reason: string;
  /** Link to where the issue is fixed (the day editor); absent for an unresolvable day. */
  href?: string;
}

/** The batch result rendered as "Exported N · Skipped M (reasons)". */
export interface BulkExportResult {
  /** Day ids whose file downloaded (a parity-overridden download counts — bytes shipped). */
  exported: string[];
  /** Days not exported, each with a reason + (where applicable) a link to fix it. */
  skipped: SkippedDay[];
}

interface ExportSelectedOptions {
  actions: ExportDayActions;
  /** Strict mode (the `shadowExportStrict` flag) — a parity mismatch blocks the day's download. */
  strict: boolean;
}

/** A stable tuple key so arbitrary imported animal/day ids cannot collide in the status map. */
const statusKey = (animalKey: unknown, dayId: unknown): string => JSON.stringify([animalKey, dayId]);

/**
 * Export the selected days of one animal, reusing the shared export deciders + download core.
 *
 * @param workspace - `model.workspace` ({ animals, days }), read live at action time.
 * @param animalKey - The owning animal whose days are being exported.
 * @param dayIds - The selected recording-day ids.
 * @param options - The store actions + the strict-mode flag.
 * @param options.actions - The store's `updateDay` (forwarded to `exportDayFile`).
 * @param options.strict - Strict mode: a parity mismatch blocks a day's download.
 * @returns The batch result: exported ids + skipped days with reasons.
 */
export function exportSelectedDays(
  workspace: unknown,
  animalKey: string,
  dayIds: string[],
  { actions, strict }: ExportSelectedOptions
): BulkExportResult {
  const animalsMap = isRecord(workspace) && isRecord(workspace.animals) ? workspace.animals : {};
  const daysMap = isRecord(workspace) && isRecord(workspace.days) ? workspace.days : {};
  const animal = animalsMap[animalKey];

  // Cross-day context + current recovery status — the SAME sources the Validation Summary gate reads.
  const animalDays = buildAnimalDaysByKey(workspace)[animalKey] || [];
  const statusByKey = new Map(
    classifyWorkspaceDays(workspace).map((d): [string, string] => [statusKey(d.animalKey, d.dayId), d.status])
  );

  const exported: string[] = [];
  const skipped: SkippedDay[] = [];

  for (const dayId of dayIds) {
    const day = daysMap[dayId];
    const date = (isRecord(day) && typeof day.date === 'string' && day.date) || dayId;
    const href = `#/day/${dayId}`;

    if (!isRecord(animal) || !isRecord(day)) {
      skipped.push({ dayId, date, reason: 'No longer present in this workspace.' });
      continue;
    }
    // Not part of the animal's recording days (recovered-unlinked / wrong-owner / dangling) — not
    // exportable from here even if its metadata is otherwise valid.
    if (!isExportableDayStatus(statusByKey.get(statusKey(animalKey, dayId)) as string)) {
      skipped.push({ dayId, date, reason: "Not in this animal's day list — re-link it first.", href });
      continue;
    }

    // Validity: the SAME live chip the rest of the view uses. A merge throw means the day is
    // unreadable (corrupt config), reported honestly rather than crashing the batch.
    let chip: string;
    try {
      const merged = mergeDayMetadata(animal as unknown as Animal, day as unknown as Day);
      chip = deriveChip(computeStepStatus(day, merged, animal, animalDays));
    } catch (err) {
      skipped.push({ dayId, date, reason: `Could not be read: ${(err as Error).message}`, href });
      continue;
    }
    if (chip === 'error') {
      skipped.push({ dayId, date, reason: 'Has blocking errors — fix them in the day editor.', href });
      continue;
    }
    if (chip !== 'valid') {
      skipped.push({ dayId, date, reason: 'Incomplete — finish the required fields.', href });
      continue;
    }

    const outcome = exportDayFile(animal as unknown as Animal, day as unknown as Day, { actions, strict });
    switch (outcome.kind) {
      case 'exported':
      case 'overridden':
        exported.push(dayId);
        break;
      case 'skipped':
        skipped.push({ dayId, date, reason: 'Export parity check failed — open the day to review.', href });
        break;
      case 'failed':
        skipped.push({ dayId, date, reason: `Export failed: ${outcome.message}`, href });
        break;
    }
  }

  return { exported, skipped };
}
