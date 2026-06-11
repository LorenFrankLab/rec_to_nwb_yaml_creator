/**
 * @fileoverview v2→v3 task-catalog conversion (Phase 8B rehearsal — NOT registered).
 *
 * Pure, workspace→workspace transform that rewrites every animal's inline-task days into the
 * define-once catalog shape: it derives the animal's `taskTypes[]` and each day's ordered
 * `taskInstances[]` (via {@link module:state/taskCatalog}), removes the now-derived inline
 * `day.tasks`, and records any first-occurrence/later-occurrence conflict on the day as a
 * `task_definition_reconciled` entry (`day.state.taskDefinitionReconciliations`) so the original
 * values are preserved for review rather than silently normalized.
 *
 * **Named so Phase 8C can register it directly** as the persisted migrator (`MIGRATORS[2] =
 * migrateTasksToCatalogV2ToV3`) — its signature matches the registry contract `(workspace) =>
 * workspace`. Phase 8B intentionally does NOT register it and does NOT bump
 * `WORKSPACE_SCHEMA_VERSION`; inline `day.tasks` remains the runtime source of truth. (See
 * `.claude/docs/plans/design-feedback-remediation/shared-contracts.md` §C2/§C3.)
 *
 * Non-destructive (the migration framework's invariant): the input is never mutated, inline tasks
 * are removed only because they are fully reconstructable from `taskTypes` + `taskInstances` (a
 * conflicting day's original definition is preserved in its reconciliation record), and `task_epochs`
 * — the only genuinely per-day task data — always survives on the instance.
 */

import { deriveAnimalTaskCatalog } from './taskCatalog';
import type { TaskDefinitionReconciliation } from './workspaceTypes';

/** Whether `value` is a plain object record (not null, not an array). */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The ordered day ids belonging to an animal: its `days` index, else days matching its `id`. */
function collectAnimalDayIds(
  animal: Record<string, unknown>,
  days: Record<string, unknown>
): string[] {
  if (Array.isArray(animal.days)) {
    return animal.days.filter((id): id is string => typeof id === 'string');
  }
  const animalId = typeof animal.id === 'string' ? animal.id : undefined;
  if (animalId === undefined) return [];
  return Object.keys(days).filter((id) => {
    const day = days[id];
    return isPlainRecord(day) && day.animalId === animalId;
  });
}

/**
 * Convert a v2 workspace (inline `day.tasks`) to the v3 task-catalog shape.
 *
 * @param workspace - The persisted workspace blob (the migrator operates on `workspace`, not the
 *   `{ schemaVersion, workspace }` envelope). Shape-tolerant: a non-record yields an empty workspace.
 * @returns A new workspace with `animal.taskTypes` + `day.taskInstances` populated and inline
 *   `day.tasks` removed; the input is left untouched.
 */
export function migrateTasksToCatalogV2ToV3(workspace: object): object {
  if (!isPlainRecord(workspace)) return { animals: {}, days: {} };

  const next = structuredClone(workspace) as Record<string, unknown>;
  const animals = isPlainRecord(next.animals) ? next.animals : {};
  const days = isPlainRecord(next.days) ? next.days : {};

  for (const animal of Object.values(animals)) {
    if (!isPlainRecord(animal)) continue;

    const dayIds = collectAnimalDayIds(animal, days);
    const dayRecords = dayIds
      .map((id) => days[id])
      .filter(isPlainRecord);

    const { taskTypes, instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(dayRecords);
    animal.taskTypes = taskTypes;

    // Group reconciliations by their source day (dropping the redundant `dayId` — the record's
    // location on the day is the identifier the persisted shape carries). NB: this strips ONLY
    // `dayId` by name; a future derive-only field on TaskReconciliationRecord must be stripped here
    // too so it does not leak into the persisted `TaskDefinitionReconciliation` shape.
    const reconByDay = new Map<string, TaskDefinitionReconciliation[]>();
    for (const { dayId, ...record } of reconciliations) {
      const list = reconByDay.get(dayId) ?? [];
      list.push(record);
      reconByDay.set(dayId, list);
    }

    for (const day of dayRecords) {
      const dayId = typeof day.id === 'string' ? day.id : '';
      day.taskInstances = instancesByDayId[dayId] ?? [];
      delete day.tasks;

      const dayReconciliations = reconByDay.get(dayId);
      if (dayReconciliations && dayReconciliations.length > 0) {
        const state = isPlainRecord(day.state) ? day.state : {};
        state.taskDefinitionReconciliations = dayReconciliations;
        day.state = state;
      }
    }
  }

  return next;
}
