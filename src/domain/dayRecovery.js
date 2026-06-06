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
 * @param {*} value
 * @returns {boolean} True for a non-null, non-array object.
 */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The explicit day recovery statuses. @type {Record<string,string>} */
export const DAY_STATUS = {
  OK: 'ok',
  DANGLING_REFERENCE: 'dangling_reference',
  RECOVERED_UNLINKED: 'recovered_unlinked',
  ORPHAN_NO_OWNER: 'orphan_no_owner',
  WRONG_OWNER: 'wrong_owner',
};

/**
 * The status of an INDEX reference that resolves to a real record: `ok` when the record belongs
 * to the indexing animal (or carries no `animalId` — the index is then the authority), but
 * `wrong_owner` when the record EXPLICITLY names a different animal (exporting it with the
 * indexing animal would corrupt the YAML).
 *
 * @param {object} record - The resolved day record (already confirmed to be a record).
 * @param {string} animalKey - The animal whose index points at it.
 * @returns {string}
 */
function indexedRecordStatus(record, animalKey) {
  return record.animalId != null && record.animalId !== animalKey
    ? DAY_STATUS.WRONG_OWNER
    : DAY_STATUS.OK;
}

/**
 * Whether a day with this status is part of the animal's recording days and may be batch /
 * automatically exported. Only `ok` qualifies: a recovered-unlinked record must be re-linked
 * first, and dangling/no-owner have no trustworthy exportable record.
 *
 * @param {string} status - A {@link DAY_STATUS} value.
 * @returns {boolean}
 */
export function isExportableDayStatus(status) {
  return status === DAY_STATUS.OK;
}

/**
 * Classify every day belonging to ONE animal: each index reference (ok / dangling) followed by
 * any record that belongs to the animal but is not in its index (recovered_unlinked). Tolerates
 * a corrupt/missing index (read through `getAnimalDayIds`) and a non-record days map.
 *
 * @param {string} animalId - The animal's store key (the reliable owner handle).
 * @param {object} animal - The animal record (for its `days` index).
 * @param {object} daysMap - The workspace `days` map.
 * @returns {Array<{ dayId: string, record: (object|null), status: string }>}
 */
export function classifyAnimalDays(animalId, animal, daysMap) {
  const days = isRecord(daysMap) ? daysMap : {};
  const indexIds = getAnimalDayIds(animal);
  const indexSet = new Set(indexIds);

  const result = indexIds.map((dayId) => {
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
 * Classify every day across the whole workspace into a flat, table-ordered list: animals by
 * store key, each animal's index references by record date (corrupt refs — no date — first),
 * then a final orphan sweep over every record not reached by an index (recovered_unlinked when
 * its owning animal exists, orphan_no_owner when it does not). Every sort key is string-coerced
 * so a corrupt id/date can't throw. The order matches what the Validation summary renders.
 *
 * @param {object} workspace - `{ animals, days }`.
 * @returns {Array<{ animalKey: string, dayId: string, record: (object|null), status: string, ownerPresent: boolean }>}
 */
export function classifyWorkspaceDays(workspace) {
  const orderKey = (value) => (typeof value === 'string' ? value : String(value ?? ''));
  const animalsMap = isRecord(workspace?.animals) ? workspace.animals : {};
  const days = isRecord(workspace?.days) ? workspace.days : {};

  const animals = Object.entries(animalsMap)
    .map(([animalKey, animal]) => ({ animalKey, animal }))
    .sort((a, b) => orderKey(a.animalKey).localeCompare(orderKey(b.animalKey)));

  const out = [];
  const indexed = new Set();
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
