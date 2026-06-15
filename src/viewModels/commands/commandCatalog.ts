/**
 * @fileoverview The closed classification of every command id a view-model builder emits. Each id is
 * one of:
 *
 *   - `store`  — a thin wrapper over a workspace action ({@link commandHandlers} resolves it).
 *   - `repair` — delegates to the single serializable repair executor (`applyRepairCommand`).
 *   - `page`   — a page-orchestrated effect, NOT a store write, so it has no resolver handler:
 *                navigation (`navigateDaySection`), encode/download/batch export+validate
 *                (`exportDay` / `exportValidOnly` / `validateAllDays`), or device-override cleanup
 *                (`removeDeviceOverride`) whose fieldPath→executor mapping lives in the page.
 *
 * The catalog is the ratchet's source of truth: a newly emitted command id with no entry here fails
 * the descriptor-coverage test, forcing an explicit decision rather than a silent runtime miss. See
 * `__tests__/commandCatalog.ratchet.test.ts`.
 */

/** How a command id is resolved. See the file overview for what each category means. */
export type CommandCategory = 'store' | 'repair' | 'page';

/** Every command id a builder emits, classified. */
export const WORKFLOW_COMMAND_CATALOG: Readonly<Record<string, CommandCategory>> = Object.freeze({
  // Store-write: a thin 1:1 wrapper over a workspace action.
  deleteDay: 'store',
  duplicateDay: 'store',
  removeDayReference: 'store',
  relinkDayReference: 'store',
  unlinkDayReference: 'store',
  createAnimal: 'store',

  // Repair: delegates to the single `applyRepairCommand` executor (no parallel dispatcher). The first
  // ten mirror the executor's REPAIR_COMMAND_TYPES; `acknowledgeBadChannelRemoval` is the VM's
  // singular id adapting onto the plural executor type; `repairAnimalCollection` is the no-op fallback
  // a raw-animal notice emits when it carries no executable command.
  resetDayCollection: 'repair',
  resetAnimalCameras: 'repair',
  resetDataAcqDevice: 'repair',
  rebuildConfigurationHistory: 'repair',
  resetDeviceOverrides: 'repair',
  removeDeviceOverrideKey: 'repair',
  resetBadChannelOverrides: 'repair',
  removeBadChannelOverrideKey: 'repair',
  acknowledgeBadChannelRemovals: 'repair',
  resetDaySession: 'repair',
  acknowledgeBadChannelRemoval: 'repair',
  repairAnimalCollection: 'repair',

  // Page-orchestrated: NOT store writes — no resolver handler by design.
  navigateDaySection: 'page',
  exportDay: 'page',
  exportValidOnly: 'page',
  validateAllDays: 'page',
  removeDeviceOverride: 'page',
});
