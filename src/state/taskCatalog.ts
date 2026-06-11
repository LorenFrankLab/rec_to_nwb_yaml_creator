/**
 * @fileoverview Pure task-type catalog model (Phase 8B rehearsal — inert at runtime).
 *
 * Converts the date-ordered inline `day.tasks[]` model into the animal-level catalog the team chose
 * for the Tasks & Epochs redesign: a *task type* is defined ONCE on the animal (`taskTypes[]`) and
 * each day *references and orders* the types it ran (`taskInstances[]`). This mirrors the existing
 * camera pattern (`animal.cameras` catalog + per-day reference + `resolveDayCameraUsage`) — it does
 * not invent a new structure (see {@link module:state/cameraUsage}).
 *
 * The dedup key is `task_name` — the Spyglass dataset-unique identity (`common_task.py` raises on a
 * duplicate `task_name` with a different `task_description`), so one `TaskType` per name makes that
 * divergence structurally impossible. The conversion is the spec in
 * `.claude/docs/plans/design-feedback-remediation/shared-contracts.md` §C3:
 *
 *  - Scan days in DATE order. The FIRST occurrence of a name defines the canonical `TaskType` from
 *    its definition (every field except the day-varying `task_epochs`).
 *  - A later occurrence whose definition MATCHES reuses the type (round-trip is byte-identical).
 *  - A later occurrence that CONFLICTS still references the canonical type (first-occurrence wins,
 *    for determinism) and is recorded as a `task_definition_reconciled` issue preserving the
 *    original vs canonical values — never silently dropped.
 *
 * {@link resolveTaskInstances} is the C1-preserving bridge back to inline `tasks[]`: it rebuilds an
 * entry from the referenced type's definition + the instance's epochs, carrying ONLY the inline-task
 * keys (no internal `id`/`taskTypeId`), so `mergeDayMetadata`'s `reorderKeys(t, TASK_ORDER)` emits
 * byte-identical YAML for a day whose instances reproduce its old inline tasks.
 *
 * **Phase 8B: NOT wired into persistence, the export merge, or the UI.** Inline `day.tasks` remains
 * the runtime source of truth; these utilities are exercised only by tests/fixtures. Phase 8C
 * activates the persisted shape, the migrator, and the catalog UI.
 *
 * Pure and dependency-free over plain workspace shapes — no store/page coupling, exhaustively
 * unit-testable.
 */

import type {
  TaskType,
  TaskInstance,
  TaskDefinitionFields,
  TaskDefinitionReconciliation,
  Task,
} from './workspaceTypes';

/** The day-varying field; everything else on a task is part of its reusable DEFINITION. */
const EPOCHS_KEY = 'task_epochs';

/** The Spyglass-identity fields surfaced in a reconciliation record (present-keys only). */
const IDENTITY_FIELDS = ['task_description', 'task_environment', 'camera_id'] as const;

/** A reconciliation record as produced by {@link deriveAnimalTaskCatalog} (carries its source day). */
export interface TaskReconciliationRecord extends TaskDefinitionReconciliation {
  /** The day whose reused `task_name` was normalized to the canonical definition. */
  dayId: string;
}

/** The result of converting an animal's inline-task days into the catalog shape. */
export interface DerivedTaskCatalog {
  /** Animal-level task types, in first-occurrence (date) order, ids `tasktype-0..n`. */
  taskTypes: TaskType[];
  /** Ordered per-day references into `taskTypes`, keyed by day id. */
  instancesByDayId: Record<string, TaskInstance[]>;
  /** Migration conflicts (a reused name with a different definition), preserved for review. */
  reconciliations: TaskReconciliationRecord[];
}

/** Whether `value` is a plain object record (not null, not an array). */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** ES2020-safe own-property check (the tsconfig `lib` predates `Object.hasOwn`). */
function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/**
 * Order-insensitive deep equality for two definition values. Objects compare by key SET + recursive
 * value equality (key ORDER is irrelevant — the export's `reorderKeys` normalizes it, so an order
 * difference must NOT count as a conflict). Arrays compare ORDER-sensitively, because `camera_id`
 * `[0,1]` and `[1,0]` are genuinely different exported bytes.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const aArray = Array.isArray(a);
  const bArray = Array.isArray(b);
  if (aArray !== bArray) return false;
  if (aArray && bArray) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => hasOwn(bRecord, key) && deepEqual(aRecord[key], bRecord[key]));
}

/**
 * The reusable DEFINITION of a task: every own key except the day-varying `task_epochs`. Capturing
 * the WHOLE remainder (not an enumerated subset) makes the round-trip byte-identical for any task
 * shape — a stray legacy key is preserved exactly as the lossless export would emit it.
 */
function taskDefinition(task: Record<string, unknown>): Record<string, unknown> {
  const definition: Record<string, unknown> = {};
  for (const key of Object.keys(task)) {
    if (key !== EPOCHS_KEY) definition[key] = task[key];
  }
  return definition;
}

/** The present-only Spyglass-identity fields of a task, for a reconciliation record. */
function identityFields(task: Record<string, unknown>): TaskDefinitionFields {
  const fields: Record<string, unknown> = {};
  for (const key of IDENTITY_FIELDS) {
    if (hasOwn(task, key)) fields[key] = task[key];
  }
  return fields as TaskDefinitionFields;
}

/** A usable catalog key: a non-empty, non-whitespace string `task_name`. */
function usableTaskName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Stable comparator: date ascending, then id ascending, mirroring the sorted `animal.days` index. */
function byDate(a: { date?: unknown; id?: unknown }, b: { date?: unknown; id?: unknown }): number {
  const aDate = typeof a.date === 'string' ? a.date : '';
  const bDate = typeof b.date === 'string' ? b.date : '';
  if (aDate !== bDate) return aDate < bDate ? -1 : 1;
  const aId = typeof a.id === 'string' ? a.id : '';
  const bId = typeof b.id === 'string' ? b.id : '';
  if (aId === bId) return 0;
  return aId < bId ? -1 : 1;
}

/**
 * Derive the animal-level task-type catalog + per-day ordered instances from date-ordered inline
 * `day.tasks[]`. Pure: inputs are never mutated, and the returned `taskTypes`/`taskInstances` own
 * their data (deep-cloned), so they can be persisted without aliasing the source days.
 *
 * Determinism: days are sorted by date (then id) before scanning, so the FIRST occurrence of a name
 * — the earliest recording day — always defines the canonical definition regardless of input order.
 * Task types are numbered `tasktype-0`, `tasktype-1`, … in that first-occurrence order. A task
 * without a usable `task_name` cannot be a dedup key; it becomes its OWN type (distinct nameless
 * tasks never merge) — the catalog-level uniqueness rule then flags the empty names.
 *
 * @param days - Recording-day records (each `{ id, date, tasks }`); shape-tolerant.
 * @returns The derived catalog, per-day instances, and any reconciliation conflicts.
 */
export function deriveAnimalTaskCatalog(days: unknown): DerivedTaskCatalog {
  const dayList = (Array.isArray(days) ? days : []).filter(isPlainRecord);
  const ordered = [...dayList].sort(byDate);

  const taskTypes: TaskType[] = [];
  const instancesByDayId: Record<string, TaskInstance[]> = {};
  const reconciliations: TaskReconciliationRecord[] = [];
  // task_name -> { type, definition } for the canonical (first-occurrence) entry.
  const canonicalByName = new Map<string, { type: TaskType; definition: Record<string, unknown> }>();
  let nextTypeIndex = 0;

  const createType = (definition: Record<string, unknown>): TaskType => {
    const id = `tasktype-${nextTypeIndex}`;
    nextTypeIndex += 1;
    // TODO(8C): replace this `as unknown as TaskType` (the de-facto constructor — `definition` is a
    // `Record<string, unknown>` captured from arbitrary task shapes) with a validated smart
    // constructor that guarantees `task_name` presence when the catalog becomes a live data source.
    const type = { id, ...structuredClone(definition) } as unknown as TaskType;
    taskTypes.push(type);
    return type;
  };

  for (const day of ordered) {
    const dayId = typeof day.id === 'string' ? day.id : '';
    const tasks = (Array.isArray(day.tasks) ? day.tasks : []).filter(isPlainRecord);
    const instances: TaskInstance[] = [];

    for (const task of tasks) {
      const name = task.task_name;
      const definition = taskDefinition(task);
      let type: TaskType;

      if (usableTaskName(name) && canonicalByName.has(name)) {
        const canonical = canonicalByName.get(name)!;
        type = canonical.type;
        if (!deepEqual(definition, canonical.definition)) {
          // First occurrence wins; record the divergence so the user can review the original.
          reconciliations.push({
            dayId,
            taskTypeId: type.id,
            task_name: name,
            original: identityFields(task),
            canonical: identityFields(canonical.definition),
          });
        }
      } else {
        type = createType(definition);
        if (usableTaskName(name)) canonicalByName.set(name, { type, definition });
      }

      // Preserve `task_epochs` by PRESENCE: a (malformed) task with no epochs must not gain a
      // spurious `task_epochs: undefined` on its instance — mirror how the definition copies keys.
      const instance: Record<string, unknown> = { taskTypeId: type.id };
      if (hasOwn(task, EPOCHS_KEY)) instance[EPOCHS_KEY] = structuredClone(task[EPOCHS_KEY]);
      instances.push(instance as unknown as TaskInstance);
    }

    instancesByDayId[dayId] = instances;
  }

  return { taskTypes, instancesByDayId, reconciliations };
}

/**
 * Resolve a day's ordered `taskInstances` back to inline `tasks[]` — the C1-preserving export bridge.
 *
 * Each entry is rebuilt from its referenced `TaskType`'s definition (every field except the internal
 * `id`) plus the instance's own `task_epochs`, carrying ONLY inline-task keys. A leaked `id`/
 * `taskTypeId` would survive `reorderKeys` (which is lossless) and break byte-identity, so neither is
 * ever emitted. A dangling instance (a `taskTypeId` with no matching type) is DROPPED rather than
 * crashing the merge — the catalog `dangling_task_type_ref` rule surfaces it for repair.
 *
 * @param taskTypes - The animal's task-type catalog.
 * @param taskInstances - A day's ordered instances.
 * @returns Inline `tasks[]` entries, in instance order, owning their data.
 */
export function resolveTaskInstances(taskTypes: unknown, taskInstances: unknown): Task[] {
  const types = (Array.isArray(taskTypes) ? taskTypes : []).filter(isPlainRecord);
  const instances = (Array.isArray(taskInstances) ? taskInstances : []).filter(isPlainRecord);
  const typeById = new Map<string, Record<string, unknown>>();
  for (const type of types) {
    if (typeof type.id === 'string') typeById.set(type.id, type);
  }

  const resolved: Task[] = [];
  for (const instance of instances) {
    const taskTypeId = instance.taskTypeId;
    if (typeof taskTypeId !== 'string') continue;
    const type = typeById.get(taskTypeId);
    if (!type) continue; // dangling reference — surfaced by validation, never crashes the merge
    const { id: _id, ...definition } = type;
    // Carry `task_epochs` by PRESENCE (mirrors derive): never emit a spurious `undefined` key.
    const entry: Record<string, unknown> = { ...structuredClone(definition) };
    if (hasOwn(instance, EPOCHS_KEY)) entry[EPOCHS_KEY] = structuredClone(instance[EPOCHS_KEY]);
    resolved.push(entry as unknown as Task);
  }
  return resolved;
}
