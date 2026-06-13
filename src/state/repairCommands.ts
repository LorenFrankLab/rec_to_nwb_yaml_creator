/**
 * @fileoverview Executable repair commands — the "issue → fix" half of the corruption
 * contract.
 *
 * A validation issue can carry a serializable `repairCommand`. This module is the SINGLE
 * place those commands are turned into store writes: `applyRepairCommand(command, ctx)`
 * maps each command type to the action that PERFORMS the documented reset, instead of the
 * issue's repair button merely navigating to a destination that may show a blank empty
 * state. Commands are plain serializable objects so an issue can be persisted/rehydrated
 * and a button can execute it later.
 *
 * The set of command types is closed ({@link REPAIR_COMMAND_TYPES}); the repairability
 * matrix proves that executing each command CLEARS the issue that carries it. An unknown
 * or malformed command is a no-op — never a throw, never a partial write.
 */

import type { Animal, Day } from './workspaceTypes';

/** A serializable repair command (persisted/rehydrated, then executed by {@link applyRepairCommand}). */
export interface RepairCommand {
  /** The command type (one of {@link REPAIR_COMMAND_TYPES}); an unknown type is a no-op. */
  type?: string;
  /** The day-owned collection to clear (for `resetDayCollection`). */
  field?: string;
  /** The override / ntrode key to drop (for the `remove*Key` commands). */
  key?: string;
  /** The deliberate un-marks to record off-export (for `acknowledgeBadChannelRemovals`). */
  acks?: Record<string, number[]>;
}

/** The store actions the executor writes through (a subset of the workspace actions). */
export interface RepairCommandActions {
  /** Apply a partial update to a day (no-op-safe when the id is absent — see the surface guard). */
  updateDay: (dayId: string | undefined, updates: Record<string, unknown>) => void;
  /** Apply a partial update to an animal. */
  updateAnimal: (animalId: string | undefined, updates: Record<string, unknown>) => void;
  /** Rebuild an animal's configuration history. */
  rebuildConfigurationHistory: (animalId: string | undefined) => void;
}

/** Execution context for {@link applyRepairCommand}. */
export interface RepairCommandContext {
  /** Store actions to write through. */
  actions: RepairCommandActions;
  /** The owning animal id (for animal-surface commands). */
  animalId?: string;
  /** The owning day id (for day-surface commands). */
  dayId?: string;
  /** The current day record, read by partial-removal commands to preserve sibling keys. */
  day?: Day;
  /** The owning animal record (read only for its `id` as a session-id prefix fallback). */
  animal?: Animal;
}

/**
 * The canonical set of repair command types. Kept as an exported constant so a structural
 * test can assert every type has an executor branch (no type can be added without a
 * handler) and so issue producers reference the same vocabulary.
 */
export const REPAIR_COMMAND_TYPES: readonly string[] = Object.freeze([
  'resetDayCollection',
  'resetAnimalCameras',
  'resetDataAcqDevice',
  'rebuildConfigurationHistory',
  'resetDeviceOverrides',
  'removeDeviceOverrideKey',
  'resetBadChannelOverrides',
  'removeBadChannelOverrideKey',
  'acknowledgeBadChannelRemovals',
  'resetDaySession',
]);

/**
 * The OWNING SURFACE of each command type — `'day'` commands write through `updateDay(dayId,…)`,
 * `'animal'` commands through `updateAnimal(animalId,…)`/`rebuildConfigurationHistory(animalId)`.
 * The executor uses this to enforce the contract structurally: a command whose surface id is
 * absent in `ctx` is a no-op, never a write with an `undefined` id (which would THROW inside the
 * store action — `Day "undefined" not found`). This keeps "missing/malformed → no-op" true even
 * when a command is routed to a handler whose ctx lacks the matching id.
 */
const COMMAND_SURFACE: Readonly<Record<string, 'day' | 'animal'>> = Object.freeze({
  resetDayCollection: 'day',
  resetDeviceOverrides: 'day',
  removeDeviceOverrideKey: 'day',
  resetBadChannelOverrides: 'day',
  removeBadChannelOverrideKey: 'day',
  acknowledgeBadChannelRemovals: 'day',
  resetDaySession: 'day',
  resetAnimalCameras: 'animal',
  resetDataAcqDevice: 'animal',
  rebuildConfigurationHistory: 'animal',
});

/**
 * Whether `value` is a plain object record (not null, not an array). Mirrors the shared
 * guard used across validation/selectors — used to read the day's CURRENT `deviceOverrides`
 * tolerantly when a partial-removal command needs to preserve sibling keys.
 *
 * @param value
 * @returns True for a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The day's current device-overrides record, guarded to a plain record. A corrupt
 * (scalar/array) container reads as `{}` so a key-removal command degrades to "clear all"
 * rather than throwing on a non-object spread.
 *
 * @param day - The current day record (from ctx).
 * @returns A shallow-cloneable overrides record.
 */
function currentOverrides(day: Day | undefined): Record<string, unknown> {
  const ov = day?.deviceOverrides;
  return isRecord(ov) ? ov : {};
}

/**
 * Execute a serializable repair command against the store.
 *
 * @param command - The serializable repair command. Per `type`: `resetDayCollection` carries
 *   `field` (the collection to clear); `removeDeviceOverrideKey` / `removeBadChannelOverrideKey`
 *   carry `key` (the override/ntrode key to drop); `acknowledgeBadChannelRemovals` carries `acks`
 *   (`{ [ntrodeId: string]: number[] }`, the deliberate un-marks to record off-export).
 * @param ctx - Execution context ({@link RepairCommandContext}).
 * @returns Nothing; a no-op for an unknown/malformed command.
 */
export function applyRepairCommand(command: RepairCommand, ctx: RepairCommandContext): void {
  if (!command || typeof command !== 'object') return;
  const { actions, animalId, dayId, day } = ctx || {};
  if (!actions) return;

  // Enforce the surface→id contract: a command can only write if the id for its owning
  // surface is present. Absent → no-op (NOT a write with `undefined`, which would throw in
  // the store action). This makes "missing id → no-op" structural, independent of which
  // handler routes the command.
  const surface = command.type ? COMMAND_SURFACE[command.type] : undefined;
  if (surface === 'day' && !dayId) return;
  if (surface === 'animal' && !animalId) return;

  switch (command.type) {
    case 'resetDayCollection': {
      // Reset one raw day-owned collection (tasks / associated_* / behavioral_events /
      // fs_gui_yamls / keywords) to an empty list, clearing the laundering-class corruption.
      if (typeof command.field !== 'string') return;
      actions.updateDay(dayId, { [command.field]: [] });
      return;
    }
    case 'resetAnimalCameras': {
      actions.updateAnimal(animalId, { cameras: [] });
      return;
    }
    case 'resetDataAcqDevice': {
      actions.updateAnimal(animalId, { data_acq_device: [] });
      return;
    }
    case 'rebuildConfigurationHistory': {
      actions.rebuildConfigurationHistory(animalId);
      return;
    }
    case 'resetDeviceOverrides': {
      // Drop ALL day device overrides; the merge falls back to the saved configuration.
      actions.updateDay(dayId, { deviceOverrides: {} });
      return;
    }
    case 'removeDeviceOverrideKey': {
      // Drop a single corrupt geometry override key, preserving the other overrides.
      if (typeof command.key !== 'string') return;
      const next = { ...currentOverrides(day) };
      delete next[command.key];
      actions.updateDay(dayId, { deviceOverrides: next });
      return;
    }
    case 'resetBadChannelOverrides': {
      // Drop the whole bad_channels container, preserving geometry overrides.
      const next = { ...currentOverrides(day) };
      delete next.bad_channels;
      actions.updateDay(dayId, { deviceOverrides: next });
      return;
    }
    case 'removeBadChannelOverrideKey': {
      // Drop one stale/corrupt bad_channels entry (keyed by ntrode id), preserving the rest.
      if (typeof command.key !== 'string') return;
      const overrides = currentOverrides(day);
      const bad = isRecord(overrides.bad_channels) ? { ...overrides.bad_channels } : {};
      delete bad[command.key];
      actions.updateDay(dayId, { deviceOverrides: { ...overrides, bad_channels: bad } });
      return;
    }
    case 'acknowledgeBadChannelRemovals': {
      // Record an OFF-EXPORT acknowledgment that the day deliberately un-marks channels that
      // were bad on an earlier same-config day, clearing the `bad_channel_unfailed_without_ack`
      // export block WITHOUT restoring the channels (an override, not a repair-by-restore). The
      // ack lives only in `day.state.badChannelRemovalAcks` — never read by the export merge —
      // so the exported YAML is byte-identical. `command.acks` is a `{ [ntrodeId]: number[] }`
      // record; merge it (per-ntrode UNION) onto any existing acks so a partial prior ack is
      // preserved. A malformed/absent payload is a no-op.
      if (!isRecord(command.acks)) return;
      const current = day?.state;
      const existing =
        isRecord(current) && isRecord(current.badChannelRemovalAcks)
          ? current.badChannelRemovalAcks
          : {};
      const merged: Record<string, unknown> = { ...existing };
      for (const ntrodeId of Object.keys(command.acks)) {
        const add = Array.isArray(command.acks[ntrodeId]) ? command.acks[ntrodeId] : [];
        const prior = Array.isArray(merged[ntrodeId]) ? merged[ntrodeId] : [];
        merged[ntrodeId] = Array.from(new Set([...prior, ...add])).sort((a, b) => a - b);
      }
      actions.updateDay(dayId, { state: { badChannelRemovalAcks: merged } });
      return;
    }
    case 'resetDaySession': {
      // Replace a malformed (non-record) `session` with a fresh record carrying the
      // canonical read-only session_id (`<animalId>_<YYYYMMDD>`), which the corruption lost
      // and the user cannot re-enter (the field is read-only). The editable description
      // fields reset to blank for the user to refill. updateDay guards the malformed current
      // session before merging, so this writes cleanly.
      // The session_id prefix is the day's OWNING animal id. Prefer the day's own `animalId`
      // (the reliable owner — it travels with the record) so a corrupt `animal.id` can't poison
      // the prefix (e.g. `WRONG_YYYYMMDD`). When the day carries no owner, fall back to the
      // resolved store key `ctx.animalId` (the authoritative owner the caller resolved) BEFORE the
      // convenience `ctx.animal.id` record field, which can be stale for a recovered record. Only
      // string ids are eligible — a corrupt non-string owner is skipped, never coerced to
      // `[object Object]`.
      const sessionAnimalId =
        [ctx.day?.animalId, animalId, ctx.animal?.id].find(
          (candidate) => typeof candidate === 'string' && candidate.length > 0
        ) ?? '';
      // The date is the day's own `date` when present; otherwise parse the trailing `YYYY-MM-DD`
      // off the `dayId` BY REGEX, not by slicing at the resolved prefix's LENGTH — the dayId's
      // embedded prefix is the day's ORIGINAL owner id, which can differ in length from the
      // resolved `sessionAnimalId` (recovered/wrong-owner record), and a length-based slice would
      // then yield a wrong date.
      const dayIdDate = String(dayId ?? '').match(/(\d{4}-\d{2}-\d{2})$/)?.[1] ?? '';
      const sessionDate = ctx.day?.date ?? dayIdDate;
      const sessionId = `${sessionAnimalId}_${String(sessionDate).replace(/-/g, '')}`;
      actions.updateDay(dayId, { session: { session_id: sessionId } });
      return;
    }
    default:
      // Unknown command type: no-op (forward-compatible with persisted commands).
  }
}
