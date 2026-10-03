/**
 * @fileoverview Undo-restore for a deleted recording day.
 *
 * `restoreDay(deleted, actions)` puts a day back exactly as it was captured before the delete, through
 * the store's `restoreDeletedDay`: the WHOLE record (every field, including any added to the day
 * record later) under its own store key, back in the owning animal's index. This is the Undo half of
 * the undo-able delete.
 *
 * It used to replay `createDay` + `updateDay` with a hand-picked list of fields. Everything the list
 * missed was re-derived from the animal's CURRENT defaults — the day's own team and optogenetics, its
 * provenance (review flags, a confirmed setup choice), data folder and download receipt — so an Undo
 * could change what the day exported. Copying the record makes that structurally impossible.
 */

import type { Day } from '../../state/workspaceTypes';

/** The store write the restore uses. */
export interface RestoreDayActions {
  restoreDeletedDay: (dayId: string, record: Day, ownerAnimalId?: string) => void;
}

/** A recording day captured before it was deleted. */
export interface DeletedDay {
  /** The day's store key (the id the owner's index listed). */
  dayId: string;
  /** The animal the day was deleted from. */
  ownerAnimalId: string;
  /** The day record as it was (a deep copy taken before the delete). */
  record: Day;
}

/**
 * Put a deleted day back from its captured record.
 *
 * @param deleted - What the delete captured: store key, owning animal, record.
 * @param actions - The store's `restoreDeletedDay`.
 * @returns True when the day was restored; false when the store refused it (a day on that date was
 *   created during the undo window, or the owning animal is gone).
 */
export function restoreDay(deleted: DeletedDay, actions: RestoreDayActions): boolean {
  // TOTAL: a refusal must not strand the UndoToast or, in a bulk undo, abort restoring the remaining
  // records. The store throws before committing anything, so a refused day simply isn't restored and
  // the caller is told.
  try {
    actions.restoreDeletedDay(deleted.dayId, deleted.record, deleted.ownerAnimalId);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[restore-day] could not restore "${deleted.dayId}":`, err);
    return false;
  }
}
