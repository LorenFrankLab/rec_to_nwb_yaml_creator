/**
 * @fileoverview The write-side counterpart to the read-side view-model builders: thin handlers that
 * resolve the plain-data {@link WorkflowCommand} descriptors the builders already emit into the
 * EXISTING store actions / repair executor. They add naming + a stable call surface, NOT new write
 * logic — diff each handler against the action it calls.
 *
 * Scope is **descriptor-complete, not write-surface-complete**: this resolves the command ids a
 * view-model emits today (day CRUD references, animal creation, executable repairs). Editable field
 * writes (overview blur, bad-channel checkbox value computation, camera/task edits) keep their local
 * write handlers until a UI experiment promotes one to a command. See the command catalog for the
 * closed id set and {@link ../commandCatalog}.
 *
 * Repairs reuse {@link applyRepairCommand} (the single serializable-repair executor) via
 * {@link toRepairCommand} — this module never reimplements a repair, so the off-export bad-channel
 * ack merge stays one implementation.
 */

import { applyRepairCommand, REPAIR_COMMAND_TYPES } from '../../state/repairCommands';
import type { RepairCommand, RepairCommandActions } from '../../state/repairCommands';
import type { Animal, Day } from '../../state/workspaceTypes';
import type { WorkflowCommand } from '../types';

/**
 * The store-write actions a descriptor command wraps — a subset of the workspace actions, extended
 * with the repair executor's actions ({@link RepairCommandContext} `actions`: updateDay / updateAnimal
 * / rebuildConfigurationHistory).
 */
export interface CommandActions extends RepairCommandActions {
  /** Delete a recording day (and drop it from the owning animal's index). */
  deleteDay: (dayId: string, ownerAnimalId?: string) => void;
  /** Duplicate a day to a new date ("same protocol, next session"). */
  duplicateDay: (sourceDayId: string, newDate: string) => void;
  /** Drop a dangling day reference from an animal's index. */
  removeDayReference: (animalId: string, dayId: string) => void;
  /** Re-link an orphaned day record back into its owning animal's index. */
  relinkDayReference: (animalId: string, dayId: string) => void;
  /** Unlink a wrong-owner day reference (the record survives under its real owner). */
  unlinkDayReference: (animalId: string, dayId: string) => void;
  /** Create a new animal from collected form data. */
  createAnimal: (
    animalId: string,
    subject: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ) => void;
}

/**
 * Resolution context: the store actions, plus the repair executor's surface ids/records. Store-write
 * commands read their target from the DESCRIPTOR; repair commands read the owning animal/day records
 * from HERE (the executor needs the current day/animal to preserve sibling override keys).
 */
export interface CommandContext {
  /** The store actions bag. */
  actions: CommandActions;
  /** The owning animal id (for animal-surface repairs). */
  animalId?: string | null;
  /** The owning day id (for day-surface repairs). */
  dayId?: string | null;
  /** The current day record (read by partial-removal / ack repairs to preserve siblings). */
  day?: Day;
  /** The owning animal record (read by `resetDaySession`'s id-prefix fallback). */
  animal?: Animal;
}

/** Transient, user-entered values a builder can't know at render time (a typed date, create-animal form). */
export type CommandInput = Record<string, unknown> | undefined;

/** A resolved handler: runs one descriptor (+ any transient input) against the store. */
export type CommandHandler = (command: WorkflowCommand, input?: CommandInput) => void;

/** A present, non-empty string — the bar a store-write id/target must clear before a write runs. */
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * VM descriptor ids that are NOT a 1:1 repair-executor type but adapt onto one. The validation-list
 * "Acknowledge un-marking" / blocked-removal descriptors use the singular id; the executor type is
 * the plural {@link applyRepairCommand} command — the same one the in-grid ack flow records — so the
 * off-export ack merge stays one implementation.
 */
const REPAIR_TYPE_ALIAS: Readonly<Record<string, string>> = Object.freeze({
  acknowledgeBadChannelRemoval: 'acknowledgeBadChannelRemovals',
});

/**
 * The repair descriptor ids this resolver handles — the executor's closed type set
 * ({@link REPAIR_COMMAND_TYPES}) plus the VM-only ids that adapt onto it (the singular ack alias and
 * the `repairAnimalCollection` no-op fallback a raw-animal notice emits when it carries no executable
 * command). Kept here so the catalog ratchet can prove this set matches the executor's.
 */
export const REPAIR_COMMAND_IDS: readonly string[] = Object.freeze([
  ...REPAIR_COMMAND_TYPES,
  ...Object.keys(REPAIR_TYPE_ALIAS),
  'repairAnimalCollection',
]);

/**
 * Translate a VM repair {@link WorkflowCommand} descriptor into the serializable {@link RepairCommand}
 * the executor expects: the descriptor `id` becomes the executor `type` (aliased where the VM uses a
 * singular id), and the plain-data payload (`key` / `field` / `acks`) is carried through verbatim. No
 * write logic — this is a shape adapter the executor's repairability matrix already covers.
 *
 * @param command - The VM repair descriptor.
 * @returns The executor RepairCommand.
 */
export function toRepairCommand(command: WorkflowCommand): RepairCommand {
  const payload = (command.payload ?? {}) as { key?: unknown; field?: unknown; acks?: unknown };
  const repair: RepairCommand = { type: REPAIR_TYPE_ALIAS[command.id] ?? command.id };
  if (typeof payload.key === 'string') repair.key = payload.key;
  if (typeof payload.field === 'string') repair.field = payload.field;
  if (payload.acks != null) repair.acks = payload.acks as Record<string, number[]>;
  return repair;
}

/**
 * Run an executable repair descriptor through the single repair executor. Reuses
 * {@link applyRepairCommand} (never a parallel dispatcher); the ctx supplies the owning animal/day
 * records the executor reads to preserve sibling override keys.
 *
 * @param ctx - The resolution context.
 * @param command - The VM repair descriptor.
 */
export function applyRepair(ctx: CommandContext, command: WorkflowCommand): void {
  applyRepairCommand(toRepairCommand(command), {
    actions: ctx.actions,
    animalId: ctx.animalId ?? undefined,
    dayId: ctx.dayId ?? undefined,
    day: ctx.day,
    animal: ctx.animal,
  });
}

/** The store-write descriptor ids and the action call each one is a thin wrapper over. */
const STORE_WRITE_IDS = [
  'deleteDay',
  'duplicateDay',
  'removeDayReference',
  'relinkDayReference',
  'unlinkDayReference',
  'createAnimal',
] as const;

/**
 * Build the descriptor → handler resolution map for a page. A page resolves a VM action with
 * `run[action.command.id](action.command, transientInput)`; the descriptor's `target`/`payload` come
 * from the builder, the optional `transientInput` only for values the user just typed/selected.
 *
 * Store-write ids wrap their workspace action 1:1 (target read from the descriptor). Every repair id
 * in the command catalog routes through {@link applyRepair}. Navigation / export / batch ids are NOT
 * here — they are page-orchestrated effects, not store writes (see {@link ../commandCatalog}).
 *
 * @param ctx - The resolution context (store actions + repair surface records).
 * @returns A map of command id → handler.
 */
export function commandHandlers(ctx: CommandContext): Record<string, CommandHandler> {
  const { actions } = ctx;
  const storeWrite: Record<(typeof STORE_WRITE_IDS)[number], CommandHandler> = {
    deleteDay: (command) => {
      // Same safe boundary the repair executor enforces (missing required id → no-op, never a write
      // with a coerced "undefined" that would throw `Day "undefined" not found` downstream). The VM
      // always supplies the target; this only guards a malformed/partial descriptor.
      const dayId = command.target?.dayId;
      if (!isNonEmptyString(dayId)) return;
      const animalId = command.target?.animalId;
      actions.deleteDay(dayId, isNonEmptyString(animalId) ? animalId : undefined);
    },
    duplicateDay: (command, input) => {
      const dayId = command.target?.dayId;
      const date = input?.date;
      if (!isNonEmptyString(dayId) || !isNonEmptyString(date)) return;
      actions.duplicateDay(dayId, date);
    },
    removeDayReference: (command) => {
      const { animalId, dayId } = command.target ?? {};
      if (!isNonEmptyString(animalId) || !isNonEmptyString(dayId)) return;
      actions.removeDayReference(animalId, dayId);
    },
    relinkDayReference: (command) => {
      const { animalId, dayId } = command.target ?? {};
      if (!isNonEmptyString(animalId) || !isNonEmptyString(dayId)) return;
      actions.relinkDayReference(animalId, dayId);
    },
    unlinkDayReference: (command) => {
      const { animalId, dayId } = command.target ?? {};
      if (!isNonEmptyString(animalId) || !isNonEmptyString(dayId)) return;
      actions.unlinkDayReference(animalId, dayId);
    },
    createAnimal: (_command, input) => {
      const animalId = input?.animalId;
      if (!isNonEmptyString(animalId)) return;
      actions.createAnimal(
        animalId,
        (input?.subject ?? {}) as Record<string, unknown>,
        (input?.metadata ?? undefined) as Record<string, unknown> | undefined
      );
    },
  };

  // Repair ids share one handler that delegates to the single executor.
  const repair: CommandHandler = (command) => applyRepair(ctx, command);
  const repairMap: Record<string, CommandHandler> = {};
  for (const id of REPAIR_COMMAND_IDS) repairMap[id] = repair;

  return { ...storeWrite, ...repairMap };
}
