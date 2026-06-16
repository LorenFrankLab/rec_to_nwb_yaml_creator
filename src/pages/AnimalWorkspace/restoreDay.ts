/**
 * @fileoverview Undo-restore for a deleted recording day.
 *
 * `restoreDay(record, actions)` re-creates a day from a captured pre-delete record by replaying the
 * existing store actions: `createDay` rebuilds the day shell (same id, since the id is derived from
 * animalId + date) and re-adds it to the owning animal's index, then `updateDay` restores every
 * day-owned field captured from the deleted record. This is the Undo half of the undo-able delete —
 * reusing the normal create/update write paths rather than a bespoke "reinsert" action.
 */

import { generateDayId } from '../../state/workspaceUtils';
import type { SessionMetadata } from '../../state/workspaceTypes';

/** Whether a value is a non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The store writes the restore replays. */
export interface RestoreDayActions {
  createDay: (animalId: string, date: string, session: SessionMetadata, options?: Record<string, unknown>) => void;
  updateDay: (dayId: string, updates: Record<string, unknown>) => void;
}

/** A captured day record (the structure `model.workspace.days[id]` holds). */
export interface CapturedDay {
  animalId?: string;
  date?: string;
  session?: unknown;
  [key: string]: unknown;
}

/**
 * Re-create a deleted day from its captured record.
 *
 * @param record - The day record captured BEFORE deletion (deep copy recommended by the caller).
 * @param actions - The store's `createDay` / `updateDay`.
 * @returns True when the day could be restored; false for a record too malformed to recreate
 *   (no resolvable animal id or date).
 */
export function restoreDay(record: CapturedDay, actions: RestoreDayActions): boolean {
  const animalId = record.animalId;
  const date = record.date;
  if (typeof animalId !== 'string' || typeof date !== 'string') return false;

  const session = (isRecord(record.session) ? record.session : {}) as unknown as SessionMetadata;
  // createDay rebuilds the shell pinned to the LATEST config + animal-default technical; updateDay then
  // overwrites with the captured day-owned content (including the captured configuration version pin).
  // createDay THROWS on a date collision (a new day created on this date during the undo window) or a
  // missing animal — catch so the restore is TOTAL: a throw here must not strand the toast or, in a
  // bulk undo, abort restoring the remaining records. A failure leaves nothing created (createDay
  // throws before any state change), so the day simply isn't restored and the caller is told.
  try {
    actions.createDay(animalId, date, session, {});

    // Re-derive the day id the SAME way `createDay` (and the YAML import path) mint it — both assign
    // `generateDayId(animalId, date)`, so a day's id is ALWAYS `animalId-date` (no non-canonical /
    // foreign ids exist in this store). The recreated id therefore matches the deleted one exactly;
    // `updateDay` targets the day `createDay` just made. (Using the captured `record.id` instead
    // would be WRONG: createDay always mints the canonical id, so a divergent captured id would make
    // `updateDay` miss.)
    const dayId = generateDayId(animalId, date);
    // Replay only the day-owned fields applyDayUpdates recognizes; absent fields are left as the
    // freshly-created defaults. session is restored too (createDay seeds a date-derived default).
    const updates: Record<string, unknown> = { session };
    for (const key of [
      'tasks',
      'taskInstances',
      'behavioral_events',
      'associated_files',
      'associated_video_files',
      'fs_gui_yamls',
      'technical',
      'deviceOverrides',
      'state',
      'configurationVersion',
      'keywords',
      'data_acq_device_name',
      'cameras_used',
    ] as const) {
      if (record[key] !== undefined) updates[key] = record[key];
    }
    actions.updateDay(dayId, updates);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[restore-day] could not restore "${animalId}-${date}":`, err);
    return false;
  }
}
