/**
 * @fileoverview The export-preview "Export all days" batch helper.
 *
 * `exportAllDays(workspace, animalKey, { actions, strict })` exports EVERY recording day of one animal by
 * REUSING the shared `exportSelectedDays` → `exportDayFile` core (the same byte-producing, parity-gated
 * download the Validation Summary's "Export Valid Only" path uses) — it is NOT a second export path. It
 * then enriches each SKIPPED day with a FIELD-LEVEL repair link resolved through {@link repairTargetForIssue}
 * (the same routing the single-day export gate uses): an animal-owned blocker deep-links the owning
 * animal-setup tab with a `?field=` anchor; a day-owned blocker links to the day editor. Days skipped for a
 * non-issue reason (incomplete, parity, not-in-list) fall back to the shared skip reason + day link.
 *
 * The field-level resolver {@link firstBlockingRepairLink} is pure (no side effects).
 */

import { mergeDayMetadata } from '../../state/workspaceUtils';
import { validateDay } from '../../domain/dayValidationComposer';
import { repairTargetForIssue, animalSetupTabForFieldPath } from '../../domain/repairRouting';
import type { RepairableIssue } from '../../domain/repairRouting';
import { getAnimalDayIds, getAnimalDays } from '../../state/workspaceSelectors';
import { formatDeterministicFilename } from '../../io/yaml';
import { exportSelectedDays } from '../AnimalWorkspace/exportSelectedDays';
import type { ExportDayActions } from '../../domain/exportDay';
import type { Animal, Day } from '../../state/workspaceTypes';

/** A resolved field-level repair link for one day: the blocking issue's message + its owner route. */
export interface BlockingRepairLink {
  /** The blocking issue's human-readable message (names the specific problem). */
  message: string;
  /** The "Fix in …" label from {@link repairTargetForIssue} (e.g. "Fix in Animal Setup → Cameras"). */
  label: string;
  /** The owner route: an animal-setup tab `?field=` deep-link, or the day editor. Absent for `none`. */
  href?: string;
}

/** One exported day in the batch result. */
export interface ExportedDay {
  dayId: string;
  date: string;
  filename: string;
}

/** One skipped day in the batch result, with a link to where its issue is fixed. */
export interface SkippedExportDay {
  dayId: string;
  date: string;
  /** Why the day was skipped (the blocking issue's message, or the shared skip reason). */
  message: string;
  /** The "Fix …" call-to-action label. */
  fixLabel?: string;
  /** The route to fix the issue. */
  fixHref?: string;
}

/** The "Export all days" batch result. */
export interface ExportAllResult {
  exported: ExportedDay[];
  skipped: SkippedExportDay[];
}

/** Whether a value is a non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Resolve the field-level repair link for a day's FIRST blocking (error-severity) issue, via the same
 * `repairRouting` the single-day export gate uses. Returns `null` when the day has no blocking error
 * (the caller then falls back to the shared skip reason): an animal-owned issue deep-links the owning
 * animal-setup tab with a `?field=` anchor; a day-owned issue links to the day editor (the hash router's
 * `#/day/:id` route cannot carry a query string, so the field is not appended there); a `none`-surface
 * issue carries no href.
 *
 * @param workspace - The workspace (`{ animals, days }`).
 * @param animalKey - The owning animal key.
 * @param dayId - The day to resolve.
 * @returns The blocking repair link, or `null` when nothing blocks (or the day/animal is unreadable).
 */
export function firstBlockingRepairLink(
  workspace: unknown,
  animalKey: string,
  dayId: string
): BlockingRepairLink | null {
  if (!isRecord(workspace) || !isRecord(workspace.animals) || !isRecord(workspace.days)) return null;
  const animal = workspace.animals[animalKey];
  const day = workspace.days[dayId];
  if (!isRecord(animal) || !isRecord(day)) return null;

  let merged: Record<string, unknown>;
  try {
    merged = mergeDayMetadata(animal as unknown as Animal, day as unknown as Day);
  } catch {
    // A merge throw (corrupt config) is itself a blocker, but it has no field-level anchor — let the
    // caller use the shared skip reason + day link.
    return null;
  }

  const animalDays = getAnimalDays(workspace, animalKey);
  const errors = validateDay(
    day as Record<string, unknown>,
    merged,
    animal,
    animalDays
  ).filter((issue) => issue.severity === 'error');
  if (errors.length === 0) return null;

  const issue: RepairableIssue = errors[0];
  const target = repairTargetForIssue(issue);
  const focusPath = issue.focusPath || issue.path || issue.instancePath;

  let href: string | undefined;
  if (target.surface === 'animal') {
    const { tab } = animalSetupTabForFieldPath(focusPath);
    const base = `#/animal/${encodeURIComponent(animalKey)}/${tab}`;
    href = focusPath ? `${base}?field=${encodeURIComponent(focusPath)}` : base;
  } else if (target.surface === 'day') {
    // The hash router parses `#/day/(.+)` greedily, so a `?field=` would be swallowed into the id — the
    // day route cannot carry a field anchor. Link to the day editor (the owning surface) without one.
    href = `#/day/${encodeURIComponent(dayId)}`;
  }

  return { message: issue.message || target.label, label: target.label, href };
}

/**
 * Export EVERY recording day of one animal, reusing the shared export core, and return the per-day result
 * with field-level repair links for the skipped days.
 *
 * @param workspace - The workspace (`{ animals, days }`), read live at action time.
 * @param animalKey - The owning animal whose days are exported.
 * @param options - The store actions + the strict-mode flag (forwarded to `exportSelectedDays`).
 * @param options.actions - The store's `updateDay` (marks a day exported).
 * @param options.strict - Strict mode: a parity mismatch blocks a day's download.
 * @returns The batch result: exported days (with filenames) + skipped days (with fix links).
 */
export function exportAllDays(
  workspace: unknown,
  animalKey: string,
  { actions, strict }: { actions: ExportDayActions; strict: boolean }
): ExportAllResult {
  const animal = isRecord(workspace) && isRecord(workspace.animals) ? workspace.animals[animalKey] : undefined;
  const dayIds = getAnimalDayIds(animal);
  const days = isRecord(workspace) && isRecord(workspace.days) ? workspace.days : {};

  const { exported, skipped } = exportSelectedDays(workspace, animalKey, dayIds, { actions, strict });

  const filenameFor = (dayId: string): string => {
    const day = days[dayId];
    if (!isRecord(day) || !isRecord(animal)) return dayId;
    try {
      return formatDeterministicFilename({
        ...mergeDayMetadata(animal as unknown as Animal, day as unknown as Day),
        EXPERIMENT_DATE_in_format_mmddYYYY: day.experimentDate as string,
      });
    } catch {
      return dayId;
    }
  };

  return {
    exported: exported.map((dayId) => {
      const day = days[dayId];
      const date = (isRecord(day) && typeof day.date === 'string' && day.date) || dayId;
      return { dayId, date, filename: filenameFor(dayId) };
    }),
    skipped: skipped.map((skip) => {
      // Prefer the FIELD-LEVEL repair route (named issue + owner route) when the day has a blocking
      // error; fall back to the shared skip reason + day link for non-issue skips (incomplete/parity).
      const link = firstBlockingRepairLink(workspace, animalKey, skip.dayId);
      if (link) {
        return { dayId: skip.dayId, date: skip.date, message: link.message, fixLabel: link.label, fixHref: link.href };
      }
      return {
        dayId: skip.dayId,
        date: skip.date,
        message: skip.reason,
        fixLabel: skip.href ? 'Fix & export →' : undefined,
        fixHref: skip.href,
      };
    }),
  };
}
