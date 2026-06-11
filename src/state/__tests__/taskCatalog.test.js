/**
 * Phase 8B — task-type catalog model rehearsal (pure core).
 *
 * `deriveAnimalTaskCatalog` converts date-ordered inline `day.tasks[]` into the animal-level
 * `taskTypes[]` catalog + per-day ordered `taskInstances[]`, deduping by `task_name` with
 * first-occurrence canonicalization (C3). `resolveTaskInstances` is the C1-preserving bridge that
 * turns catalog instances back into inline `tasks[]` of EXACTLY the five `TASK_ORDER` keys.
 *
 * The load-bearing guarantee these tests pin: for every NON-conflicting fixture, inline → catalog →
 * inline round-trips object- and byte-identically (so activating the catalog in Phase 8C cannot move
 * a golden baseline), while a conflicting `task_name` is deterministically normalized to the
 * first-occurrence definition with the original preserved for review.
 */
import { describe, it, expect } from 'vitest';
import { encodeYaml } from '../../io/yaml';
import { deriveAnimalTaskCatalog, resolveTaskInstances } from '../taskCatalog';
import {
  oneTask,
  multipleTasks,
  sameNameIdenticalDefs,
  sameNameDifferentEnvironment,
  sameNameDifferentCamera,
} from './fixtures/taskCatalog';

const FIVE_KEYS = ['task_name', 'task_description', 'task_environment', 'camera_id', 'task_epochs'];

/** Apply ONE identical key-canonicalization to both sides, so a byte compare proves resolve≡inline
 * @param tasks
 *  independent of either side's insertion order (the export's `reorderKeys` does the same downstream). */
const canon = (tasks) =>
  tasks.map((t) => {
    const o = {};
    for (const k of FIVE_KEYS) if (Object.hasOwn(t, k)) o[k] = t[k];
    return o;
  });

describe('deriveAnimalTaskCatalog', () => {
  it('derives one task type + one instance from a single-task day', () => {
    const { taskTypes, instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(oneTask.days);
    expect(taskTypes).toHaveLength(1);
    expect(taskTypes[0]).toMatchObject({ id: 'tasktype-0', task_name: 'sleep' });
    expect(instancesByDayId['remy-2023-06-01']).toEqual([{ taskTypeId: 'tasktype-0', task_epochs: [1] }]);
    expect(reconciliations).toEqual([]);
  });

  it('derives a distinct task type per name, ordered by first occurrence', () => {
    const { taskTypes, instancesByDayId } = deriveAnimalTaskCatalog(multipleTasks.days);
    expect(taskTypes.map((t) => [t.id, t.task_name])).toEqual([
      ['tasktype-0', 'sleep'],
      ['tasktype-1', 'w-track'],
    ]);
    // Instance order mirrors the day's task order.
    expect(instancesByDayId['remy-2023-06-01'].map((i) => i.taskTypeId)).toEqual([
      'tasktype-0',
      'tasktype-1',
    ]);
  });

  it('reuses one task type for an identical definition across days (no reconciliation)', () => {
    const { taskTypes, instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(
      sameNameIdenticalDefs.days
    );
    expect(taskTypes).toHaveLength(1);
    // Both days reference the same canonical type, each keeping its OWN epochs.
    expect(instancesByDayId['remy-2023-06-01']).toEqual([{ taskTypeId: 'tasktype-0', task_epochs: [1] }]);
    expect(instancesByDayId['remy-2023-06-02']).toEqual([{ taskTypeId: 'tasktype-0', task_epochs: [3] }]);
    expect(reconciliations).toEqual([]);
  });

  it('canonicalizes a different-environment reuse to the first occurrence and records the conflict', () => {
    const { taskTypes, reconciliations } = deriveAnimalTaskCatalog(sameNameDifferentEnvironment.days);
    expect(taskTypes).toHaveLength(1);
    // First occurrence wins: canonical environment is day 1's.
    expect(taskTypes[0].task_environment).toBe('SleepBox');
    expect(reconciliations).toEqual([
      {
        dayId: 'remy-2023-06-02',
        taskTypeId: 'tasktype-0',
        task_name: 'sleep',
        original: { task_description: 'Rests in a box', task_environment: 'QuietRoom', camera_id: [0] },
        canonical: { task_description: 'Rests in a box', task_environment: 'SleepBox', camera_id: [0] },
      },
    ]);
  });

  it('canonicalizes a different-camera reuse to the first occurrence and records the conflict', () => {
    const { taskTypes, reconciliations } = deriveAnimalTaskCatalog(sameNameDifferentCamera.days);
    expect(taskTypes).toHaveLength(1);
    expect(taskTypes[0].camera_id).toEqual([0]);
    expect(reconciliations).toHaveLength(1);
    expect(reconciliations[0]).toMatchObject({
      dayId: 'remy-2023-06-02',
      task_name: 'sleep',
      original: { camera_id: [1] },
      canonical: { camera_id: [0] },
    });
  });

  it('is shape-tolerant: empty / missing / non-array task lists yield an empty catalog', () => {
    expect(deriveAnimalTaskCatalog([])).toEqual({ taskTypes: [], instancesByDayId: {}, reconciliations: [] });
    const { taskTypes, instancesByDayId } = deriveAnimalTaskCatalog([
      { id: 'remy-2023-06-01', date: '2023-06-01', tasks: [] },
      { id: 'remy-2023-06-02', date: '2023-06-02', tasks: 'nope' },
      { id: 'remy-2023-06-03', date: '2023-06-03' },
    ]);
    expect(taskTypes).toEqual([]);
    expect(instancesByDayId['remy-2023-06-01']).toEqual([]);
    expect(instancesByDayId['remy-2023-06-02']).toEqual([]);
    expect(instancesByDayId['remy-2023-06-03']).toEqual([]);
  });

  it('scans days in DATE order regardless of input order (first occurrence = earliest day)', () => {
    // Feed the conflict fixture days REVERSED; the earliest date must still define the canonical.
    const reversed = [...sameNameDifferentEnvironment.days].reverse();
    const { taskTypes, reconciliations } = deriveAnimalTaskCatalog(reversed);
    expect(taskTypes[0].task_environment).toBe('SleepBox'); // 2023-06-01 wins
    expect(reconciliations[0].dayId).toBe('remy-2023-06-02'); // the later day is reconciled
  });
});

describe('resolveTaskInstances (the C1-preserving inline bridge)', () => {
  const roundTripCases = [
    ['one task', oneTask],
    ['multiple tasks', multipleTasks],
    ['same name / identical defs', sameNameIdenticalDefs],
  ];

  it.each(roundTripCases)('round-trips %s back to inline tasks object-identically', (_label, fixture) => {
    const { taskTypes, instancesByDayId } = deriveAnimalTaskCatalog(fixture.days);
    for (const day of fixture.days) {
      const resolved = resolveTaskInstances(taskTypes, instancesByDayId[day.id]);
      expect(resolved).toEqual(day.tasks); // order-insensitive deep equality
    }
  });

  it.each(roundTripCases)('round-trips %s back to inline tasks BYTE-identically', (_label, fixture) => {
    const { taskTypes, instancesByDayId } = deriveAnimalTaskCatalog(fixture.days);
    for (const day of fixture.days) {
      const resolved = resolveTaskInstances(taskTypes, instancesByDayId[day.id]);
      expect(encodeYaml({ tasks: canon(resolved) })).toBe(encodeYaml({ tasks: canon(day.tasks) }));
    }
  });

  it('emits ONLY the five TASK_ORDER keys — never leaks taskTypeId/id (would break C1)', () => {
    const { taskTypes, instancesByDayId } = deriveAnimalTaskCatalog(multipleTasks.days);
    const resolved = resolveTaskInstances(taskTypes, instancesByDayId['remy-2023-06-01']);
    for (const entry of resolved) {
      expect(Object.keys(entry).every((k) => FIVE_KEYS.includes(k))).toBe(true);
      expect(entry).not.toHaveProperty('taskTypeId');
      expect(entry).not.toHaveProperty('id');
    }
  });

  it('resolves a conflicting day to the CANONICAL (normalized) definition, not its original', () => {
    const { taskTypes, instancesByDayId } = deriveAnimalTaskCatalog(sameNameDifferentEnvironment.days);
    const resolved = resolveTaskInstances(taskTypes, instancesByDayId['remy-2023-06-02']);
    // Day 2 originally had environment 'QuietRoom'; it now exports the canonical 'SleepBox'.
    expect(resolved[0].task_environment).toBe('SleepBox');
    expect(resolved[0].task_epochs).toEqual([3]); // its OWN epochs are preserved
  });

  it('drops a dangling instance (taskTypeId with no matching type) rather than crashing the merge', () => {
    const { taskTypes } = deriveAnimalTaskCatalog(oneTask.days);
    const resolved = resolveTaskInstances(taskTypes, [
      { taskTypeId: 'tasktype-0', task_epochs: [1] },
      { taskTypeId: 'tasktype-404', task_epochs: [2] },
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].task_name).toBe('sleep');
  });

  it('is shape-tolerant: empty / non-array instances resolve to []', () => {
    expect(resolveTaskInstances([], [])).toEqual([]);
    expect(resolveTaskInstances([], null)).toEqual([]);
    expect(resolveTaskInstances(null, [{ taskTypeId: 'x', task_epochs: [1] }])).toEqual([]);
  });
});
