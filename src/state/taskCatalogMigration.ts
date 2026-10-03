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
 * — the only genuinely per-day task data — always survives on the instance. A day is converted ONCE,
 * under the animal that owns it ({@link daysByOwner}); when corrupted day lists leave it without a
 * single owner, it keeps its inline `tasks` instead.
 */

import { deriveAnimalTaskCatalog } from './taskCatalog';
import type { TaskDefinitionReconciliation } from './workspaceTypes';
import { isRecord as isPlainRecord } from '../utils/records';

/**
 * The store keys of the days whose tasks each animal catalogues, by animal store key. A day goes to
 * the animal its record names (`animalId`) when that animal's `days` index lists it (or that index is
 * corrupt, not a list); a record naming no animal goes to the ONE animal that lists it, the index
 * being the authority as at runtime. Any other day (listed only by an animal it does not name, naming
 * an animal that does not exist, or naming none while several list it) goes to no animal and keeps
 * its inline `tasks`: they export unchanged under whichever animal it ends up with, and the Day
 * Editor catalogues them once its ownership is repaired. Each day goes to at most one animal, so no
 * later pass can find its inline tasks already moved and overwrite its instances with nothing.
 */
function daysByOwner(
  animals: Record<string, unknown>,
  days: Record<string, unknown>
): Map<string, string[]> {
  const listedBy = new Map<string, string[]>();
  for (const [animalKey, animal] of Object.entries(animals)) {
    if (!isPlainRecord(animal) || !Array.isArray(animal.days)) continue;
    for (const dayId of new Set(animal.days)) {
      if (typeof dayId === 'string') listedBy.set(dayId, [...(listedBy.get(dayId) ?? []), animalKey]);
    }
  }

  const owned = new Map<string, string[]>();
  for (const [dayId, day] of Object.entries(days)) {
    if (!isPlainRecord(day)) continue;
    const listers = listedBy.get(dayId) ?? [];
    const declared = day.animalId;
    let owner: string | undefined;
    if (declared == null) {
      owner = listers.length === 1 ? listers[0] : undefined;
    } else if (typeof declared === 'string') {
      const named = animals[declared];
      if (isPlainRecord(named) && (!Array.isArray(named.days) || listers.includes(declared))) owner = declared;
    }
    if (owner !== undefined) owned.set(owner, [...(owned.get(owner) ?? []), dayId]);
  }
  return owned;
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
  const owned = daysByOwner(animals, days);

  for (const [animalKey, animal] of Object.entries(animals)) {
    if (!isPlainRecord(animal)) continue;

    // Derived under each day's STORE key (what the index holds), not its own `id` field, so records
    // with a missing or repeated `id` cannot receive one another's tasks.
    const dayIds = owned.get(animalKey) ?? [];
    const { taskTypes, instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(
      dayIds.map((dayId) => ({ ...(days[dayId] as Record<string, unknown>), id: dayId }))
    );
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

    for (const dayId of dayIds) {
      const day = days[dayId] as Record<string, unknown>;
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
