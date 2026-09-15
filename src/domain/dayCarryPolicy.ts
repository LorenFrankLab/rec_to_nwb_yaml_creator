/**
 * @fileoverview Field-specific carry-forward policy for a new recording day (finding F7).
 *
 * "Start the day from the last one" must not silently turn last week's measurement into today's,
 * or last week's dated folder into today's path. The policy is per KIND of value:
 *
 *  - **stable definitions & references** (tasks, DIO events, keywords, technical parameters, the
 *    chosen recording system, the team, the experiment description, the optogenetics setup) —
 *    COPIED from the nearest eligible earlier day, with the source date recorded in provenance;
 *  - **measurements** (weight) — NEVER copied; the previous value and its date are shown as a
 *    suggestion the scientist must accept deliberately ({@link previousWeightSuggestion});
 *  - **date-dependent paths** (the data folder) — DERIVED from the source's folder pattern when it
 *    contains the source date, copied only when it is undated, and left blank when it contains some
 *    other date ({@link deriveDataFolderForDate});
 *  - **session-specific selections** (files, videos, FsGUI protocols, review/export status) — CLEARED;
 *  - **bad-channel marks** — carried only within the same probe configuration version
 *    (`createDayRecord`).
 *
 * The default source is the nearest EARLIER day ({@link nearestEarlierDayId}); the UI may offer a
 * different explicit source (including a later day for backfilling), which never overrides the
 * date-selected probe configuration.
 *
 * Pure; tolerant of malformed records.
 */

import { getAnimalDayIds } from '../state/workspaceSelectors';
import { recordingDateToken } from './recordingFilename';

interface DayLike {
  id?: unknown;
  date?: unknown;
  session?: { weight?: unknown } | unknown;
  dataFolder?: unknown;
}

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * The animal's present days. `days` is either the workspace days MAP (scoped through the animal's
 * `days` index) or an ARRAY of the animal's own day records (already scoped — the Day Editor bundle
 * passes this).
 */
function presentDays(animal: unknown, days: unknown): Array<{ id: string; date: string; record: DayLike }> {
  const entries: Array<{ id: string; record: DayLike }> = Array.isArray(days)
    ? (days as DayLike[]).map((record) => ({ id: String(record?.id ?? ''), record }))
    : getAnimalDayIds(animal).map((id) => ({
        id,
        record: (days && typeof days === 'object' ? (days as Record<string, unknown>)[id] : undefined) as DayLike,
      }));
  return entries
    .filter(({ record }) => record && typeof record === 'object' && isIsoDate(record.date))
    .map(({ id, record }) => ({ id, date: record.date as string, record }));
}

/**
 * The nearest earlier day (latest `date < target`), the default carry-forward source.
 *
 * @param animal - The owning animal.
 * @param days - The workspace days map.
 * @param date - The new day's recording date.
 * @returns The source day id, or null when no earlier day exists.
 */
export function nearestEarlierDayId(animal: unknown, days: unknown, date: string): string | null {
  const earlier = presentDays(animal, days)
    .filter((d) => d.date < date)
    .sort((a, b) => b.date.localeCompare(a.date));
  return earlier[0]?.id ?? null;
}

/**
 * The nearest LATER day (earliest `date > target`) — offered as an explicit alternative source when
 * backfilling before the first existing day.
 *
 * @param animal - The owning animal.
 * @param days - The workspace days map.
 * @param date - The new day's recording date.
 * @returns The day id, or null.
 */
export function nearestLaterDayId(animal: unknown, days: unknown, date: string): string | null {
  const later = presentDays(animal, days)
    .filter((d) => d.date > date)
    .sort((a, b) => a.date.localeCompare(b.date));
  return later[0]?.id ?? null;
}

/** A previous weight measurement offered as a suggestion (never auto-applied). */
export interface WeightSuggestion {
  /** Grams. */
  weight: number;
  /** The recording date it was measured on (or null for the animal baseline). */
  date: string | null;
  /** Where it came from. */
  source: 'previous-day' | 'animal-baseline';
}

/**
 * The most recent measured weight before `date` (or, failing that, the animal's baseline), as a
 * dated suggestion.
 *
 * @param animal - The owning animal (its `subject.weight` baseline).
 * @param days - The workspace days map.
 * @param date - The recording date being entered.
 * @returns The suggestion, or null when nothing is known.
 */
export function previousWeightSuggestion(animal: unknown, days: unknown, date: string): WeightSuggestion | null {
  const earlier = presentDays(animal, days)
    .filter((d) => d.date < date)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const { date: measuredOn, record } of earlier) {
    const session = record.session;
    const weight =
      session && typeof session === 'object' ? (session as { weight?: unknown }).weight : undefined;
    if (typeof weight === 'number' && Number.isFinite(weight)) {
      return { weight, date: measuredOn, source: 'previous-day' };
    }
  }
  const subject = animal && typeof animal === 'object' ? (animal as { subject?: { weight?: unknown } }).subject : undefined;
  const baseline = subject && typeof subject === 'object' ? subject.weight : undefined;
  if (typeof baseline === 'number' && Number.isFinite(baseline)) {
    return { weight: baseline, date: null, source: 'animal-baseline' };
  }
  return null;
}

/** How the data folder for a new day was derived from the source day's folder. */
export type DataFolderDerivation =
  | { kind: 'derived'; dataFolder: string }
  | { kind: 'copied'; dataFolder: string }
  | { kind: 'stale-date'; dataFolder: undefined }
  | { kind: 'none'; dataFolder: undefined };

/**
 * Derive a new day's data folder from the source day's folder.
 *
 *  - Source folder contains the source date as an 8-digit `YYYYMMDD` token (e.g.
 *    `/stelmo/remy/20230622/`) → the token is replaced with the new date (`derived`).
 *  - Source folder contains NO 8-digit date token (e.g. `/stelmo/remy/`) → copied as is.
 *  - Source folder contains an 8-digit date token that is NOT the source date → it is some other
 *    day's folder; NOT copied (`stale-date`) — the scientist enters the actual folder.
 *
 * @param sourceFolder - The source day's `dataFolder`.
 * @param sourceDate - The source day's recording date (ISO).
 * @param newDate - The new day's recording date (ISO).
 * @returns The derivation.
 */
export function deriveDataFolderForDate(
  sourceFolder: unknown,
  sourceDate: string,
  newDate: string
): DataFolderDerivation {
  if (typeof sourceFolder !== 'string' || sourceFolder.trim() === '') return { kind: 'none', dataFolder: undefined };
  const dateTokens: string[] = sourceFolder.match(/(?<!\d)\d{8}(?!\d)/g) ?? [];
  // An undated folder is stable across a block of days: copied as is (even when the source date
  // is unknown).
  if (dateTokens.length === 0) return { kind: 'copied', dataFolder: sourceFolder };
  if (!isIsoDate(sourceDate) || !isIsoDate(newDate)) return { kind: 'stale-date', dataFolder: undefined };
  const sourceToken = recordingDateToken(sourceDate);
  const newToken = recordingDateToken(newDate);
  if (dateTokens.includes(sourceToken)) {
    return { kind: 'derived', dataFolder: sourceFolder.split(sourceToken).join(newToken) };
  }
  return { kind: 'stale-date', dataFolder: undefined };
}
