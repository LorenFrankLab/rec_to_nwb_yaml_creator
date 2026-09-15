/**
 * @fileoverview Which probe configuration applies to a recording DATE (finding F2).
 *
 * `createDayRecord` used to pin every new day to the newest snapshot regardless of the day's date,
 * so a backfilled June 25 acquired a July 1 reconfiguration. The rule here is the one a scientist
 * would state: **the version whose effective date most recently precedes (or equals) the recording
 * date.** A recording before every known effective date has no applicable version on record —
 * the earliest version is pinned as the best candidate but the choice is UNCONFIRMED (an export
 * blocker) until the user confirms it or extends the version's effective date to cover the day.
 *
 * The three dates are kept distinct throughout: the recording date (`day.date`), the setup
 * effective date (`snapshot.date`), and the entry timestamp (`provenance.enteredAt`), which is
 * never evidence of when a setup became effective.
 *
 * Pure; tolerant of a malformed history.
 */

import { getConfigHistory } from '../state/workspaceSelectors';
import type { ConfigurationSnapshot, Day } from '../state/workspaceTypes';

/** The outcome of choosing a configuration version for a recording date. */
export interface ConfigurationChoice {
  /** The chosen version, or null when the animal has no configuration history. */
  version: number | null;
  /**
   * Whether the chosen version's effective date covers the recording date. False means the day
   * predates every known effective date (the earliest version is a candidate, not a fact).
   */
  covered: boolean;
  /** The chosen snapshot's effective date, for display. */
  effectiveDate: string | null;
}

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * A snapshot whose `date` is only its ENTRY stamp (`effectiveDateKnown === false`): the setup was
 * in place when it was entered, but nobody recorded when it became effective. Only an animal's
 * initial setup is created this way, so such a snapshot is the EARLIEST setup by construction —
 * it sorts first regardless of its stamp, and its stamp covers no earlier day with certainty.
 */
const dateUnknown = (s: ConfigurationSnapshot): boolean => s.effectiveDateKnown === false;

/**
 * Snapshots with a usable integer version and ISO date, sorted by effective date then version
 * (ties broken by version so a same-day reconfiguration resolves to the later version); entry-
 * stamped snapshots (unknown effective date) come first, in version order.
 *
 * @param animalOrHistory - The animal record or a bare history array (any shape).
 * @returns Sorted usable snapshots.
 */
function usableSnapshots(animalOrHistory: unknown): ConfigurationSnapshot[] {
  const history = Array.isArray(animalOrHistory)
    ? (animalOrHistory as ConfigurationSnapshot[])
    : getConfigHistory(animalOrHistory);
  const sortKey = (s: ConfigurationSnapshot) => (dateUnknown(s) ? '' : s.date);
  return history
    .filter((s) => s && Number.isInteger(s.version) && isIsoDate(s.date))
    .sort((a, b) => {
      const [ka, kb] = [sortKey(a), sortKey(b)];
      return ka === kb ? a.version - b.version : ka.localeCompare(kb);
    });
}

/**
 * Choose the configuration version effective on `date`.
 *
 * @param animalOrHistory - The animal record (or a bare history array).
 * @param date - The recording date, `YYYY-MM-DD`.
 * @returns The choice.
 */
export function selectConfigurationForDate(animalOrHistory: unknown, date: string): ConfigurationChoice {
  const snapshots = usableSnapshots(animalOrHistory);
  if (snapshots.length === 0) return { version: null, covered: false, effectiveDate: null };
  // A snapshot covers the date when its KNOWN effective date is on/before it, or — for an entry-
  // stamped snapshot — when the day is on/after the entry (the setup was in place by then).
  const covering = snapshots.filter((s) => s.date <= date);
  if (covering.length > 0) {
    const chosen = covering[covering.length - 1];
    return { version: chosen.version, covered: true, effectiveDate: chosen.date };
  }
  // Before every known effective date: the earliest setup is the candidate, unconfirmed.
  const earliest = snapshots[0];
  return { version: earliest.version, covered: false, effectiveDate: earliest.date };
}

/** Whether a day's pinned configuration choice is settled for export. */
export type ConfigurationChoiceStatus =
  | { status: 'confirmed'; version: number; effectiveDate: string | null }
  | { status: 'unconfirmed'; version: number; effectiveDate: string | null; reason: 'before-effective-date' | 'unknown-period' }
  | { status: 'unpinned' };

/**
 * Whether a day's pinned version is settled: its snapshot's effective date covers the recording
 * date, OR the user EXPLICITLY confirmed the choice (`provenance.configuration.source ===
 * 'explicit'`). Every other confirmation (date-selected, copied, migrated) was derived from the
 * effective dates and is only as good as they are, so it is re-evaluated here every time — correcting a
 * setup's effective date to after a day it covered un-confirms that day (its geometry is never
 * silently re-pinned; the scientist confirms or re-pins).
 *
 * @param animal - The owning animal.
 * @param day - The recording day.
 * @returns The status.
 */
export function configurationChoiceStatus(animal: unknown, day: Day): ConfigurationChoiceStatus {
  if (day?.configurationVersion == null) return { status: 'unpinned' };
  const version = day.configurationVersion;
  const snapshot = usableSnapshots(animal).find((s) => s.version === version);
  const effectiveDate = snapshot?.date ?? null;
  const choice = day.provenance?.configuration;
  // Only a scientist's own assertion is conclusive; `copied` / `migration` / `effective-date`
  // confirmations were all derived from effective dates and are re-derived below.
  const explicitlyConfirmed = Boolean(choice?.confirmed) && choice?.source === 'explicit';
  if (explicitlyConfirmed) return { status: 'confirmed', version, effectiveDate };
  if (!snapshot) return { status: 'confirmed', version, effectiveDate };
  if (isIsoDate(day.date) && snapshot.date <= day.date) return { status: 'confirmed', version, effectiveDate };
  return {
    status: 'unconfirmed',
    version,
    effectiveDate,
    reason: snapshot.effectiveDateKnown === false ? 'unknown-period' : 'before-effective-date',
  };
}

/**
 * Preview which version each date of a batch would receive — shown before committing a date range
 * that spans a reconfiguration.
 *
 * @param animal - The owning animal.
 * @param dates - Recording dates.
 * @returns One entry per date.
 */
export function previewConfigurationForDates(
  animal: unknown,
  dates: string[]
): Array<{ date: string } & ConfigurationChoice> {
  return dates.map((date) => ({ date, ...selectConfigurationForDate(animal, date) }));
}
