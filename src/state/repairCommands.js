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

/**
 * The canonical set of repair command types. Kept as an exported constant so a structural
 * test can assert every type has an executor branch (no type can be added without a
 * handler) and so issue producers reference the same vocabulary.
 *
 * @type {readonly string[]}
 */
export const REPAIR_COMMAND_TYPES = Object.freeze([
  'resetDayCollection',
  'resetAnimalCameras',
  'resetDataAcqDevice',
  'rebuildConfigurationHistory',
  'resetDeviceOverrides',
  'removeDeviceOverrideKey',
  'resetBadChannelOverrides',
  'removeBadChannelOverrideKey',
  'resetDaySession',
]);

/**
 * The OWNING SURFACE of each command type — `'day'` commands write through `updateDay(dayId,…)`,
 * `'animal'` commands through `updateAnimal(animalId,…)`/`rebuildConfigurationHistory(animalId)`.
 * The executor uses this to enforce the contract structurally: a command whose surface id is
 * absent in `ctx` is a no-op, never a write with an `undefined` id (which would THROW inside the
 * store action — `Day "undefined" not found`). This keeps "missing/malformed → no-op" true even
 * when a command is routed to a handler whose ctx lacks the matching id.
 *
 * @type {Readonly<Record<string, 'day'|'animal'>>}
 */
const COMMAND_SURFACE = Object.freeze({
  resetDayCollection: 'day',
  resetDeviceOverrides: 'day',
  removeDeviceOverrideKey: 'day',
  resetBadChannelOverrides: 'day',
  removeBadChannelOverrideKey: 'day',
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
 * @param {*} value
 * @returns {boolean}
 */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The day's current device-overrides record, guarded to a plain record. A corrupt
 * (scalar/array) container reads as `{}` so a key-removal command degrades to "clear all"
 * rather than throwing on a non-object spread.
 *
 * @param {object} day - The current day record (from ctx).
 * @returns {object} A shallow-cloneable overrides record.
 */
function currentOverrides(day) {
  const ov = day?.deviceOverrides;
  return isRecord(ov) ? ov : {};
}

/**
 * Execute a serializable repair command against the store.
 *
 * @param {{type?: string, field?: string, key?: string}} command - The repair command.
 * @param {object} ctx - Execution context.
 * @param {object} ctx.actions - Store actions (`updateDay` / `updateAnimal` /
 *   `rebuildConfigurationHistory`).
 * @param {string} ctx.animalId - The owning animal id (for animal-surface commands).
 * @param {string} ctx.dayId - The owning day id (for day-surface commands).
 * @param {object} [ctx.day] - The current day record, read by partial-removal commands so
 *   they can preserve sibling override keys.
 * @returns {void} No-op for an unknown/malformed command.
 */
export function applyRepairCommand(command, ctx) {
  if (!command || typeof command !== 'object') return;
  const { actions, animalId, dayId, day } = ctx || {};
  if (!actions) return;

  // Enforce the surface→id contract: a command can only write if the id for its owning
  // surface is present. Absent → no-op (NOT a write with `undefined`, which would throw in
  // the store action). This makes "missing id → no-op" structural, independent of which
  // handler routes the command.
  const surface = COMMAND_SURFACE[command.type];
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
