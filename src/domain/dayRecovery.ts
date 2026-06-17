/**
 * @fileoverview Day recovery-status model — the single domain classifier for abnormal
 * day-reference states.
 *
 * The app holds several parallel truths about a recording day: raw persisted state, the
 * shape-safe render layer, the merged/export model, and workflow/readiness. The recurring bug
 * was each surface deciding a little of the truth on its own — "safe to render" (coerce a
 * corrupt index to `[]`) silently becoming "safe to trust" (so the UI says "no days", or an
 * unindexed record exports as if normal). This module gives every abnormal day ONE explicit,
 * named status with ONE export policy, and the Workspace, Validation summary, and Export paths
 * all consume it instead of re-deriving it.
 *
 * Statuses (per day, within an animal):
 *  - `ok`                  — in the animal's `days` index AND a real record exists. Normal.
 *  - `dangling_reference`  — the index lists an id with no resolvable record. Not exportable;
 *                            repair = remove the reference (`removeDayReference`).
 *  - `recovered_unlinked`  — a real record that belongs to the animal but is NOT in its index
 *                            (the index is missing/corrupt or just doesn't list it). The record
 *                            is recovered so it isn't lost, but it must be re-linked
 *                            (`relinkDayReference`) before it is treated as one of the animal's
 *                            recording days — so it is NOT auto-exportable until then.
 *  - `orphan_no_owner`     — a real record whose `animalId` resolves to no animal. Not
 *                            exportable; no in-app repair (re-create/re-import the animal).
 *  - `wrong_owner`         — an index reference whose record EXPLICITLY declares a DIFFERENT
 *                            animal as its owner (`record.animalId` names another animal).
 *                            Merging/exporting it with the indexing animal's metadata would
 *                            corrupt the YAML (wrong subject/probe), so it is NOT exportable;
 *                            repair = unlink it from the wrong animal (the record then surfaces
 *                            under its real owner as `recovered_unlinked`, to re-link there).
 *
 * Export policy: ONLY `ok` days are part of the animal's recording days and eligible for batch /
 * automatic export ({@link isExportableDayStatus}). This is the single place that policy lives.
 */

import { getAnimalDayIds } from '../state/workspaceSelectors';

/**
 * A classified day, as returned by {@link classifyWorkspaceDays} (and, minus `animalKey`/
 * `ownerPresent`, by {@link classifyAnimalDays}). One documented shape so the two classifiers and
 * any shared row renderer agree.
 */
export interface DayClassificationRow {
  /** The day's id (store map key). */
  dayId: string;
  /** The resolved day record, or `null` for a dangling reference. */
  record: Record<string, unknown> | null;
  /** A {@link DAY_STATUS} value. */
  status: DayStatus;
  /**
   * The owning animal's STORE KEY. `null` ONLY for an `orphan_no_owner` row whose declared owner
   * is missing/non-string. (Workspace-wide rows only.)
   */
  animalKey?: string | null;
  /** Whether the owning animal exists. (Workspace-wide rows only.) */
  ownerPresent?: boolean;
}

/**
 * @param value
 * @returns True for a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The explicit day recovery statuses. Frozen so this closed set (which the export policy keys off —
 * `isExportableDayStatus` is `status === DAY_STATUS.OK`) cannot be mutated at runtime, matching the
 * `Object.freeze` convention the state layer uses for its closed command vocabularies.
 */
export const DAY_STATUS = Object.freeze({
  OK: 'ok',
  DANGLING_REFERENCE: 'dangling_reference',
  RECOVERED_UNLINKED: 'recovered_unlinked',
  ORPHAN_NO_OWNER: 'orphan_no_owner',
  WRONG_OWNER: 'wrong_owner',
} as const);

/** The closed set of day recovery-status values. */
export type DayStatus = typeof DAY_STATUS[keyof typeof DAY_STATUS];

/** Every valid day recovery-status value, for runtime boundary checks. */
const DAY_STATUS_VALUES: ReadonlySet<DayStatus> = new Set(Object.values(DAY_STATUS));

/**
 * Runtime guard for narrowing values from imported/persisted workspace boundaries into the closed
 * {@link DayStatus} set.
 *
 * @param value - Candidate status value.
 * @returns True when `value` is one of the {@link DAY_STATUS} values.
 */
export function isDayStatus(value: unknown): value is DayStatus {
  return typeof value === 'string' && DAY_STATUS_VALUES.has(value as DayStatus);
}

/**
 * The status of an INDEX reference that resolves to a real record: `ok` when the record belongs
 * to the indexing animal (or carries no `animalId` — the index is then the authority), but
 * `wrong_owner` when the record EXPLICITLY names a different animal (exporting it with the
 * indexing animal would corrupt the YAML).
 *
 * @param record - The resolved day record (already confirmed to be a record).
 * @param animalKey - The animal whose index points at it.
 * @returns
 */
function indexedRecordStatus(record: Record<string, unknown>, animalKey: string): DayStatus {
  return record.animalId != null && record.animalId !== animalKey
    ? DAY_STATUS.WRONG_OWNER
    : DAY_STATUS.OK;
}

/**
 * Whether a day with this status is part of the animal's recording days and may be batch /
 * automatically exported. Only `ok` qualifies: a recovered-unlinked record must be re-linked
 * first, and dangling/no-owner have no trustworthy exportable record.
 *
 * @param status - A {@link DAY_STATUS} value.
 * @returns
 */
export function isExportableDayStatus(status: DayStatus): boolean {
  return status === DAY_STATUS.OK;
}

/**
 * Whether a day with this status counts as an EXISTING record for the animal — i.e. there is a real
 * record present (whether or not it is currently in the index). This is a DISTINCT policy from
 * {@link isExportableDayStatus}: a `recovered_unlinked` record exists (so it's counted/shown and not
 * a free calendar date) but is NOT exportable until re-linked. Centralised here so the
 * "records present" count (Workspace day count, calendar date guard, setup-checklist
 * `recordingDayCount`) can't drift from this definition or from the per-status set.
 *
 * @param status - A {@link DAY_STATUS} value.
 * @returns
 */
export function isPresentRecordStatus(status: DayStatus): boolean {
  return status === DAY_STATUS.OK || status === DAY_STATUS.RECOVERED_UNLINKED;
}

/**
 * A human-readable description of a record's DECLARED owner, for a wrong-owner / orphan repair
 * note. A real string id is returned verbatim; a corrupt non-string id (which would otherwise
 * render as "[object Object]" / "undefined") becomes an explicit phrase so the explanation stays
 * usable instead of leaking a meaningless token to the user.
 *
 * @param animalId - The record's declared `animalId` (may be corrupt/non-string/absent).
 * @returns
 */
export function describeOwner(animalId: unknown): string {
  return typeof animalId === 'string' && animalId.length > 0
    ? animalId
    : 'another animal (unreadable id)';
}

/**
 * Classify every day belonging to ONE animal: each index reference (ok / dangling) followed by
 * any record that belongs to the animal but is not in its index (recovered_unlinked). Tolerates
 * a corrupt/missing index (read through `getAnimalDayIds`) and a non-record days map.
 *
 * @param animalId - The animal's store key (the reliable owner handle).
 * @param animal - The animal record (for its `days` index).
 * @param daysMap - The workspace `days` map.
 * @returns Per-animal rows carry `{ dayId, record, status }` (the
 *   `animalKey`/`ownerPresent` of the workspace-wide shape are implicit: the owner is `animalId`).
 */
export function classifyAnimalDays(
  animalId: string,
  animal: unknown,
  daysMap: unknown
): DayClassificationRow[] {
  const days: Record<string, unknown> = isRecord(daysMap) ? daysMap : {};
  const indexIds = getAnimalDayIds(animal);
  const indexSet = new Set(indexIds);

  const result: DayClassificationRow[] = indexIds.map((dayId) => {
    const record = days[dayId];
    return isRecord(record)
      ? { dayId, record, status: indexedRecordStatus(record, animalId) }
      : { dayId, record: null, status: DAY_STATUS.DANGLING_REFERENCE };
  });

  for (const [dayId, record] of Object.entries(days)) {
    if (indexSet.has(dayId) || !isRecord(record)) continue;
    if (record.animalId === animalId) {
      result.push({ dayId, record, status: DAY_STATUS.RECOVERED_UNLINKED });
    }
  }
  return result;
}

/**
 * The number of day RECORDS present for an animal (OK + recovered-unlinked), via the recovery
 * classifier. The single source of this count so every surface that shows "N days" — the picker
 * cards, the section-nav, the animal switcher, the recording-days header — can't drift from each
 * other or from {@link isPresentRecordStatus}.
 *
 * @param animalId - The animal's store key.
 * @param animal - The animal record.
 * @param daysMap - The workspace day map.
 * @returns The count of present day records.
 */
export function getPresentDayCount(animalId: string, animal: unknown, daysMap: unknown): number {
  return classifyAnimalDays(animalId, animal, daysMap).filter((d) =>
    isPresentRecordStatus(d.status)
  ).length;
}

/**
 * Whether a day record has been validated or exported — i.e. it may have produced a downloaded
 * YAML / downstream NWB. Drives whether a delete confirmation shows the "downloaded artifacts are
 * not deleted" caveat. Tolerates a malformed (non-object) `state` on a recovered record. The single
 * home for this predicate so the animal-delete cascade and the per-day delete confirm can't disagree
 * about whether the caveat applies.
 *
 * @param record - A day record.
 * @returns True if the day is validated or exported.
 */
export function dayHasArtifacts(record: unknown): boolean {
  // `isRecord(record) ? record.state : undefined` is the typed equivalent of the prior
  // `record?.state` (`record` is `unknown` here, so it can't be optional-chained directly).
  const state = isRecord(record) ? record.state : undefined;
  if (!isRecord(state)) return false;
  return !!state.validated || !!state.exported;
}

/**
 * Classify every day across the whole workspace into a flat, table-ordered list: animals by
 * store key, each animal's index references by record date (corrupt refs — no date — first),
 * then a final orphan sweep over every record not reached by an index (recovered_unlinked when
 * its owning animal exists, orphan_no_owner when it does not). Every sort key is string-coerced
 * so a corrupt id/date can't throw. The order matches what the Validation summary renders.
 *
 * @param workspace - `{ animals, days }`.
 * @returns Workspace-wide rows carry the full shape, including
 *   `animalKey` (the owner store key — `null` ONLY for an `orphan_no_owner` row) and `ownerPresent`.
 */
export function classifyWorkspaceDays(workspace: unknown): DayClassificationRow[] {
  const orderKey = (value: unknown): string =>
    typeof value === 'string' ? value : String(value ?? '');
  // `isRecord(workspace) && isRecord(workspace.x)` is the typed equivalent of the prior
  // `isRecord(workspace?.x)` (`workspace` is `unknown` and so can't be optional-chained): a null /
  // non-record workspace short-circuits to `{}` either way, and the guard narrows the reads.
  const animalsMap: Record<string, unknown> =
    isRecord(workspace) && isRecord(workspace.animals) ? workspace.animals : {};
  const days: Record<string, unknown> =
    isRecord(workspace) && isRecord(workspace.days) ? workspace.days : {};

  const animals = Object.entries(animalsMap)
    .map(([animalKey, animal]) => ({ animalKey, animal }))
    .sort((a, b) => orderKey(a.animalKey).localeCompare(orderKey(b.animalKey)));

  const out: DayClassificationRow[] = [];
  const indexed = new Set<string>();
  for (const { animalKey, animal } of animals) {
    const refs = getAnimalDayIds(animal)
      .map((dayId) => ({ dayId, record: days[dayId] }))
      .sort((a, b) =>
        orderKey(isRecord(a.record) ? a.record.date : '').localeCompare(
          orderKey(isRecord(b.record) ? b.record.date : '')
        )
      );
    for (const { dayId, record } of refs) {
      indexed.add(dayId);
      out.push(
        isRecord(record)
          ? { animalKey, dayId, record, status: indexedRecordStatus(record, animalKey), ownerPresent: true }
          : { animalKey, dayId, record: null, status: DAY_STATUS.DANGLING_REFERENCE, ownerPresent: true }
      );
    }
  }

  for (const [dayId, record] of Object.entries(days)) {
    if (indexed.has(dayId) || !isRecord(record)) continue;
    // The declared owner is only a usable key (and only resolvable) when it is a string. A corrupt
    // non-string `animalId` is an unknown owner → `animalKey: null`, so a consuming surface never
    // receives an object as a React key/child or looks up `animalsMap[{}]`.
    const ownerKey = typeof record.animalId === 'string' ? record.animalId : null;
    const ownerPresent = ownerKey != null && isRecord(animalsMap[ownerKey]);
    out.push({
      animalKey: ownerKey,
      dayId,
      record,
      status: ownerPresent ? DAY_STATUS.RECOVERED_UNLINKED : DAY_STATUS.ORPHAN_NO_OWNER,
      ownerPresent,
    });
  }
  return out;
}
