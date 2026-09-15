/**
 * @fileoverview v3 → v4 migration: day-owned dated facts (fix plan, increment 2).
 *
 * v3 exported the team, the optogenetics setup and (as a fallback) the experiment description and
 * weight from the ANIMAL at export time. v4 copies those facts onto each day so a later edit of the
 * animal default cannot silently rewrite an earlier session, and records provenance.
 *
 * The migration is total and non-destructive, and it never manufactures history:
 *  - `day.experimenters` / `day.optogenetics` / an empty `session.experiment_description` are filled
 *    from the animal — that is EXACTLY what the v3 export emitted for the day, so every previously
 *    downloadable export is reproduced byte-for-byte (verified in the migration tests). The per-day
 *    original values (if a file ever had different ones) were discarded by the v3 importer and are
 *    not recoverable; provenance says `migration`.
 *  - weight: a day with no measured weight that was DOWNLOADED (or validated) under v3 exported the
 *    animal baseline; that baseline is copied onto the day with the review flag
 *    `weight_from_baseline` (advisory) so the scientist confirms or corrects it. A never-downloaded
 *    draft is left without a weight — it blocks export until entered, never invented.
 *  - a version-1 snapshot stamped with the animal's entry date (`Initial configuration`) gets
 *    `effectiveDateKnown: false`; a day pinned to a version effective AFTER its date becomes an
 *    unconfirmed choice (export blocker `configuration_effective_date_unconfirmed`) — the F2 bug's
 *    existing victims are flagged for review, not silently accepted or rewritten.
 *  - `state.exported: true` becomes an `unverified` receipt naming the filename v3 actually
 *    produced (`MMDDYYYY_<lowercased subject>_metadata.yml`), so the new download (a different
 *    name) honestly reads "changed since download".
 */

import { isRecord } from '../utils/records';
import type {
  Animal,
  Day,
  DayProvenance,
  DayFactSource,
  ExportReceipt,
} from './workspaceTypes';

/** The filename the v3 (pre-fix) formatter produced, so a migrated receipt names the real download. */
function legacyDownloadFilename(day: Record<string, unknown>, animal: Record<string, unknown>): string {
  const date = typeof day.date === 'string' ? day.date : '';
  const [y, m, d] = date.split('-');
  const mmddyyyy = y && m && d ? `${m}${d}${y}` : String(day.experimentDate ?? '');
  const subject = isRecord(animal.subject) ? animal.subject : {};
  const subjectId = typeof subject.subject_id === 'string' ? subject.subject_id.toLowerCase() : '';
  return `${mmddyyyy}_${subjectId}_metadata.yml`;
}

/**
 * Migrate one day record.
 *
 * @param day - The v3 day record (any shape tolerated).
 * @param animal - Its owning animal (v3 shape), or undefined when the owner is missing.
 * @returns The v4 day record.
 */
function migrateDay(day: unknown, animal: Record<string, unknown> | undefined): unknown {
  if (!isRecord(day)) return day;
  const next: Record<string, unknown> = { ...day };
  const fields: Record<string, DayFactSource> = {};
  const review: string[] = [];
  const state = isRecord(day.state) ? day.state : {};

  if (animal) {
    if (!isRecord(next.experimenters) && isRecord(animal.experimenters)) {
      next.experimenters = structuredClone(animal.experimenters);
      fields.experimenters = 'migration';
    }
    if (!('optogenetics' in next)) {
      next.optogenetics = isRecord(animal.optogenetics) ? structuredClone(animal.optogenetics) : null;
      fields.optogenetics = 'migration';
    }
    const session = isRecord(next.session) ? { ...next.session } : null;
    if (session) {
      const dayDesc = session.experiment_description;
      const animalDesc = animal.experiment_description;
      if ((dayDesc === undefined || dayDesc === '') && typeof animalDesc === 'string' && animalDesc !== '') {
        session.experiment_description = animalDesc;
        fields['session.experiment_description'] = 'migration';
      }
      const subject = isRecord(animal.subject) ? animal.subject : {};
      const wasDownloadedOrValidated = Boolean(state.exported) || Boolean(state.validated);
      if (session.weight === undefined && typeof subject.weight === 'number' && wasDownloadedOrValidated) {
        session.weight = subject.weight;
        fields['session.weight'] = 'migration';
        review.push('weight_from_baseline');
      }
      next.session = session;
    }
  }

  // Configuration choice: covered by the pinned version's effective date, else unconfirmed.
  const history = animal && Array.isArray(animal.configurationHistory) ? animal.configurationHistory : [];
  const pinned = history.find(
    (s) => isRecord(s) && s.version === day.configurationVersion
  ) as Record<string, unknown> | undefined;
  const covered =
    pinned && typeof pinned.date === 'string' && typeof day.date === 'string' ? pinned.date <= day.date : true;

  const existing = isRecord(day.provenance) ? (day.provenance as Partial<DayProvenance>) : {};
  const provenance: DayProvenance = {
    enteredAt: existing.enteredAt ?? (typeof day.created === 'string' ? day.created : ''),
    copiedFromDayId: existing.copiedFromDayId ?? null,
    copiedFromDate: existing.copiedFromDate ?? null,
    configuration: existing.configuration ?? { source: 'migration', confirmed: covered },
    fields: { ...(existing.fields ?? {}), ...fields },
    ...(review.length > 0 || (existing.review?.length ?? 0) > 0
      ? { review: [...(existing.review ?? []), ...review] }
      : {}),
  };
  next.provenance = provenance;

  // Download history → an unverified receipt (the v3 download's name; content not comparable).
  if (state.exported && !isRecord(day.exportReceipt) && animal) {
    const receipt: ExportReceipt = {
      filename: legacyDownloadFilename(day, animal),
      exportedAt:
        typeof state.exportedAt === 'string'
          ? state.exportedAt
          : typeof day.lastModified === 'string'
            ? day.lastModified
            : '',
      contentHash: '',
      appVersion: 'pre-receipt',
      schemaVersion: 3,
      yamlStored: false,
      unverified: true,
    };
    next.exportReceipt = receipt;
  }
  return next;
}

/**
 * v3 → v4: copy the animal-level team / opto / experiment-description defaults onto every day,
 * reproduce downloaded baseline weights with a review flag, stamp provenance and unverified
 * receipts, and mark entry-stamped version-1 snapshots as effective-date-unknown.
 *
 * @param workspace - The v3 workspace.
 * @returns A new v4 workspace (the input is not mutated).
 */
export function migrateDatedFactsV3ToV4(workspace: object): object {
  if (!isRecord(workspace)) return workspace;
  const animalsIn = isRecord(workspace.animals) ? workspace.animals : {};
  const daysIn = isRecord(workspace.days) ? workspace.days : {};

  const animals: Record<string, unknown> = {};
  for (const [id, animal] of Object.entries(animalsIn)) {
    if (!isRecord(animal)) {
      animals[id] = animal;
      continue;
    }
    const created = typeof animal.created === 'string' ? animal.created.slice(0, 10) : '';
    const history = Array.isArray(animal.configurationHistory)
      ? animal.configurationHistory.map((snapshot) => {
          if (!isRecord(snapshot)) return snapshot;
          // The entry-stamped initial snapshot: its date is when the animal was ENTERED, not when the
          // implant became effective.
          const entryStamped =
            snapshot.version === 1 &&
            snapshot.description === 'Initial configuration' &&
            typeof snapshot.date === 'string' &&
            snapshot.date === created &&
            !('effectiveDateKnown' in snapshot);
          return entryStamped ? { ...snapshot, effectiveDateKnown: false } : snapshot;
        })
      : animal.configurationHistory;
    animals[id] = { ...animal, configurationHistory: history };
  }

  const days: Record<string, unknown> = {};
  for (const [dayId, day] of Object.entries(daysIn)) {
    const ownerId = isRecord(day) && typeof day.animalId === 'string' ? day.animalId : undefined;
    const owner =
      (ownerId && isRecord(animals[ownerId]) ? (animals[ownerId] as Record<string, unknown>) : undefined) ??
      // A day with no `animalId` is owned by whichever animal indexes it.
      (Object.values(animals).find(
        (a) => isRecord(a) && Array.isArray(a.days) && a.days.includes(dayId)
      ) as Record<string, unknown> | undefined);
    days[dayId] = migrateDay(day, owner);
  }

  return { ...workspace, animals, days };
}

// Re-exported for the migration tests' type assertions.
export type { Animal, Day };
