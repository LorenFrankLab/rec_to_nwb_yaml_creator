/**
 * Phase 8B — task-type catalog model rehearsal (pure core).
 *
 * `deriveAnimalTaskCatalog` converts date-ordered inline `day.tasks[]` into the animal-level
 * `taskTypes[]` catalog + per-day ordered `taskInstances[]`, deduping by `task_name` with
 * first-occurrence canonicalization (C3). `resolveTaskInstances` is the C1-preserving bridge that
 * turns catalog instances back into inline `tasks[]` of EXACTLY the five `TASK_ORDER` keys.
 *
 * The load-bearing guarantee these tests pin: for every fixture, inline → catalog → inline
 * round-trips object- and byte-identically (so activating the catalog cannot move a golden
 * baseline). A later day that reused a `task_name` with a different ROOM or CAMERAS keeps what it
 * recorded, as an instance override on that day (F3); only a divergent `task_description` — the
 * Spyglass task identity — is normalized to the first occurrence with the original preserved for
 * review.
 */
import { describe, it, expect } from 'vitest';
import { encodeYaml } from '../../io/yaml';
import {
  deriveAnimalTaskCatalog,
  resolveTaskInstances,
  pinTaskContextOnDays,
  stripTaskContext,
} from '../taskCatalog';
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

  it('keeps a different-environment reuse as a DAY override, with no reconciliation (F3)', () => {
    // SC38 ran the same task in HaightRight on one day and HaightLeft on another: the task identity
    // is shared, the room is the day's own fact. Nothing is lost, so nothing to reconcile.
    const { taskTypes, instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(
      sameNameDifferentEnvironment.days
    );
    expect(taskTypes).toHaveLength(1);
    // First occurrence still defines the reusable DEFAULT.
    expect(taskTypes[0].task_environment).toBe('SleepBox');
    expect(reconciliations).toEqual([]);
    // Day 1 matches the default → no override; day 2 carries its own environment.
    expect(instancesByDayId['remy-2023-06-01']).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [1] },
    ]);
    expect(instancesByDayId['remy-2023-06-02']).toEqual([
      { taskTypeId: 'tasktype-0', task_environment: 'QuietRoom', task_epochs: [3] },
    ]);
  });

  it('keeps a different-camera reuse as a DAY override, with no reconciliation (F3)', () => {
    const { taskTypes, instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(
      sameNameDifferentCamera.days
    );
    expect(taskTypes).toHaveLength(1);
    expect(taskTypes[0].camera_id).toEqual([0]);
    expect(reconciliations).toEqual([]);
    expect(instancesByDayId['remy-2023-06-02']).toEqual([
      { taskTypeId: 'tasktype-0', camera_id: [1], task_epochs: [3] },
    ]);
  });

  it('STILL reconciles a divergent task_description (the Spyglass task identity)', () => {
    const days = [
      { id: 'd1', date: '2023-06-01', tasks: [{ task_name: 'sleep', task_description: 'Rest A', task_environment: 'e', camera_id: [0], task_epochs: [1] }] },
      { id: 'd2', date: '2023-06-02', tasks: [{ task_name: 'sleep', task_description: 'Rest B', task_environment: 'e', camera_id: [0], task_epochs: [2] }] },
    ];
    const { taskTypes, instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(days);
    expect(taskTypes).toHaveLength(1);
    expect(taskTypes[0].task_description).toBe('Rest A');
    expect(reconciliations).toHaveLength(1);
    expect(reconciliations[0]).toMatchObject({
      dayId: 'd2',
      original: { task_description: 'Rest B' },
      canonical: { task_description: 'Rest A' },
    });
    // No override is invented for an identity conflict — the canonical definition is exported.
    expect(instancesByDayId.d2).toEqual([{ taskTypeId: 'tasktype-0', task_epochs: [2] }]);
  });

  it('reconciles (never half-overrides) when identity AND context both differ', () => {
    const days = [
      { id: 'd1', date: '2023-06-01', tasks: [{ task_name: 'sleep', task_description: 'Rest A', task_environment: 'home', camera_id: [0], task_epochs: [1] }] },
      { id: 'd2', date: '2023-06-02', tasks: [{ task_name: 'sleep', task_description: 'Rest B', task_environment: 'quiet', camera_id: [0], task_epochs: [2] }] },
    ];
    const { instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(days);
    expect(reconciliations).toHaveLength(1);
    expect(instancesByDayId.d2).toEqual([{ taskTypeId: 'tasktype-0', task_epochs: [2] }]);
  });

  it('reconciles when the later occurrence LACKS a context key the canonical has', () => {
    // An ABSENT key is not expressible as an override (absent ⇒ "use the default"), so this is the
    // one context difference that must fall back to the reconciliation path rather than be dropped.
    const days = [
      { id: 'd1', date: '2023-06-01', tasks: [{ task_name: 'sleep', task_description: 'd', task_environment: 'home', task_epochs: [1] }] },
      { id: 'd2', date: '2023-06-02', tasks: [{ task_name: 'sleep', task_description: 'd', task_epochs: [2] }] },
    ];
    const { instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(days);
    expect(reconciliations).toHaveLength(1);
    expect(instancesByDayId.d2).toEqual([{ taskTypeId: 'tasktype-0', task_epochs: [2] }]);
  });

  it('overrides when the later occurrence ADDS a context key the canonical lacks', () => {
    const days = [
      { id: 'd1', date: '2023-06-01', tasks: [{ task_name: 'sleep', task_description: 'd', task_epochs: [1] }] },
      { id: 'd2', date: '2023-06-02', tasks: [{ task_name: 'sleep', task_description: 'd', task_environment: 'quiet', task_epochs: [2] }] },
    ];
    const { instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(days);
    expect(reconciliations).toEqual([]);
    expect(instancesByDayId.d2).toEqual([
      { taskTypeId: 'tasktype-0', task_environment: 'quiet', task_epochs: [2] },
    ]);
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
    // Feed the divergent fixture days REVERSED; the earliest date must still define the default.
    const reversed = [...sameNameDifferentEnvironment.days].reverse();
    const { taskTypes, instancesByDayId } = deriveAnimalTaskCatalog(reversed);
    expect(taskTypes[0].task_environment).toBe('SleepBox'); // 2023-06-01 wins
    // …and the LATER day is the one carrying an override, not the earlier one.
    expect(instancesByDayId['remy-2023-06-01'][0]).not.toHaveProperty('task_environment');
    expect(instancesByDayId['remy-2023-06-02'][0].task_environment).toBe('QuietRoom');
  });
});

describe('pinTaskContextOnDays (keep earlier days as recorded)', () => {
  /** Two days referencing one task type; the second already pinned its own environment. */
  const days = () => [
    {
      id: 'd1',
      date: '2023-06-01',
      taskInstances: [
        { taskTypeId: 'tasktype-0', task_epochs: [1] },
        { taskTypeId: 'tasktype-1', task_epochs: [2] },
      ],
    },
    {
      id: 'd2',
      date: '2023-06-02',
      taskInstances: [{ taskTypeId: 'tasktype-0', task_environment: 'QuietRoom', task_epochs: [1] }],
    },
  ];

  it('pins the OLD values onto referencing instances that lack an override', () => {
    const pinned = pinTaskContextOnDays(days(), 'tasktype-0', {
      task_environment: 'SleepBox',
      camera_id: [0],
    });
    expect(pinned[0].taskInstances[0]).toEqual({
      taskTypeId: 'tasktype-0',
      task_environment: 'SleepBox',
      camera_id: [0],
      task_epochs: [1],
    });
    // A different task type is untouched.
    expect(pinned[0].taskInstances[1]).toEqual({ taskTypeId: 'tasktype-1', task_epochs: [2] });
  });

  it('never overwrites an override the day already recorded', () => {
    const pinned = pinTaskContextOnDays(days(), 'tasktype-0', {
      task_environment: 'SleepBox',
      camera_id: [0],
    });
    expect(pinned[1].taskInstances[0]).toEqual({
      taskTypeId: 'tasktype-0',
      task_environment: 'QuietRoom', // kept
      camera_id: [0], // the field that had no override IS pinned
      task_epochs: [1],
    });
  });

  it('returns unchanged days by identity (so a caller can skip a no-op write)', () => {
    const input = days();
    const pinned = pinTaskContextOnDays(input, 'tasktype-404', { task_environment: 'x' });
    expect(pinned[0]).toBe(input[0]);
    expect(pinned[1]).toBe(input[1]);
  });

  it('never mutates its input and skips fields with no old value to pin', () => {
    const input = days();
    const snapshot = structuredClone(input);
    const pinned = pinTaskContextOnDays(input, 'tasktype-0', { task_environment: undefined });
    expect(input).toEqual(snapshot);
    expect(pinned[0]).toBe(input[0]); // nothing pinnable ⇒ nothing changed
  });

  it('is shape-tolerant: non-array days / instances never throw', () => {
    expect(pinTaskContextOnDays(null, 'tasktype-0', { task_environment: 'x' })).toEqual([]);
    expect(
      pinTaskContextOnDays([{ id: 'd', taskInstances: 'nope' }], 'tasktype-0', { task_environment: 'x' })
    ).toEqual([{ id: 'd', taskInstances: 'nope' }]);
  });
});

describe('resolveTaskInstances (the C1-preserving inline bridge)', () => {
  const roundTripCases = [
    ['one task', oneTask],
    ['multiple tasks', multipleTasks],
    ['same name / identical defs', sameNameIdenticalDefs],
    // F3: a per-day room / camera difference is now preserved, so these round-trip too.
    ['same name / different environment', sameNameDifferentEnvironment],
    ['same name / different camera', sameNameDifferentCamera],
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

  it('applies an instance environment/camera override over the type definition', () => {
    const taskTypes = [
      { id: 'tasktype-0', task_name: 'sleep', task_description: 'd', task_environment: 'SleepBox', camera_id: [0] },
    ];
    const resolved = resolveTaskInstances(taskTypes, [
      { taskTypeId: 'tasktype-0', task_environment: 'QuietRoom', camera_id: [1, 2], task_epochs: [3] },
    ]);
    expect(resolved).toEqual([
      { task_name: 'sleep', task_description: 'd', task_environment: 'QuietRoom', camera_id: [1, 2], task_epochs: [3] },
    ]);
    // The override never mutates the shared catalog definition.
    expect(taskTypes[0]).toMatchObject({ task_environment: 'SleepBox', camera_id: [0] });
  });

  it('resolves an instance WITHOUT overrides to the type definition unchanged', () => {
    const taskTypes = [
      { id: 'tasktype-0', task_name: 'sleep', task_description: 'd', task_environment: 'SleepBox', camera_id: [0] },
    ];
    const resolved = resolveTaskInstances(taskTypes, [{ taskTypeId: 'tasktype-0', task_epochs: [3] }]);
    expect(resolved).toEqual([
      { task_name: 'sleep', task_description: 'd', task_environment: 'SleepBox', camera_id: [0], task_epochs: [3] },
    ]);
  });

  it('resolves a day that recorded its OWN environment back to what that day recorded', () => {
    const { taskTypes, instancesByDayId } = deriveAnimalTaskCatalog(sameNameDifferentEnvironment.days);
    const resolved = resolveTaskInstances(taskTypes, instancesByDayId['remy-2023-06-02']);
    // Day 2 recorded environment 'QuietRoom' — it must still export 'QuietRoom' (F3).
    expect(resolved[0].task_environment).toBe('QuietRoom');
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

  it('does not emit a spurious task_epochs key when the instance has none (presence-preserving)', () => {
    // A malformed instance lacking epochs must NOT resolve to `{ …, task_epochs: undefined }` — a
    // spurious key would mislead any 8C consumer that inspects keys (AJV / JSON.stringify) rather
    // than re-encoding (encodeYaml happens to drop `undefined`, which masks the bug today).
    const { taskTypes } = deriveAnimalTaskCatalog(multipleTasks.days);
    const resolved = resolveTaskInstances(taskTypes, [{ taskTypeId: 'tasktype-0' }]);
    expect(resolved[0]).not.toHaveProperty('task_epochs');
  });
});

describe('round-trip robustness (8C-activation regression guards)', () => {
  it('preserves a non-template (legacy) task key through derive→resolve, losslessly', () => {
    // `reorderKeys` is lossless — it appends keys outside TASK_ORDER — so the catalog must NOT drop
    // a stray legacy key either, or activating it in 8C would change exported bytes for such data.
    const original = {
      task_name: 'sleep',
      task_description: 'd',
      task_environment: 'e',
      camera_id: [0],
      task_epochs: [1],
      legacy_extra: 'KEEP',
    };
    const days = [{ id: 'd1', date: '2023-06-01', tasks: [original] }];
    const { taskTypes, instancesByDayId } = deriveAnimalTaskCatalog(days);
    const [resolved] = resolveTaskInstances(taskTypes, instancesByDayId.d1);
    expect(resolved.legacy_extra).toBe('KEEP');
    expect(resolved).toEqual(original); // exact key set, NOT pre-stripped through canon()
  });

  it('does not inject a spurious task_epochs key when the source task has none (derive)', () => {
    const days = [
      { id: 'd1', date: '2023-06-01', tasks: [{ task_name: 'sleep', task_description: 'd', task_environment: 'e', camera_id: [] }] },
    ];
    const { instancesByDayId } = deriveAnimalTaskCatalog(days);
    expect(instancesByDayId.d1[0]).toEqual({ taskTypeId: 'tasktype-0' });
    expect(instancesByDayId.d1[0]).not.toHaveProperty('task_epochs');
  });

  it('gives each blank-task_name task its OWN type (distinct nameless tasks never merge)', () => {
    const days = [
      {
        id: 'd1',
        date: '2023-06-01',
        tasks: [
          { task_name: '', task_description: 'a', task_environment: 'x', camera_id: [0], task_epochs: [1] },
          { task_name: '   ', task_description: 'b', task_environment: 'y', camera_id: [1], task_epochs: [2] },
        ],
      },
    ];
    const { taskTypes, reconciliations } = deriveAnimalTaskCatalog(days);
    expect(taskTypes).toHaveLength(2); // never merged on the empty/whitespace key
    expect(reconciliations).toEqual([]);
  });

  it('excludes task_epochs from the dedup definition — mixed-type epochs are NOT a conflict', () => {
    const days = [
      { id: 'd1', date: '2023-06-01', tasks: [{ task_name: 'sleep', task_description: 'd', task_environment: 'e', camera_id: [0], task_epochs: [1] }] },
      { id: 'd2', date: '2023-06-02', tasks: [{ task_name: 'sleep', task_description: 'd', task_environment: 'e', camera_id: [0], task_epochs: ['1'] }] },
    ];
    const { taskTypes, instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(days);
    expect(taskTypes).toHaveLength(1);
    expect(reconciliations).toEqual([]); // epochs differ in TYPE but that is not an identity conflict
    expect(instancesByDayId.d2[0].task_epochs).toEqual(['1']); // the string epoch is preserved verbatim
  });

  it('treats camera_id array ORDER as a day difference (different exported bytes)', () => {
    const days = [
      { id: 'd1', date: '2023-06-01', tasks: [{ task_name: 'sleep', task_description: 'd', task_environment: 'e', camera_id: [0, 1], task_epochs: [1] }] },
      { id: 'd2', date: '2023-06-02', tasks: [{ task_name: 'sleep', task_description: 'd', task_environment: 'e', camera_id: [1, 0], task_epochs: [2] }] },
    ];
    const { taskTypes, instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(days);
    expect(reconciliations).toEqual([]);
    expect(instancesByDayId.d2[0].camera_id).toEqual([1, 0]);
    // Exported bytes still differ per day — the order is preserved, not normalized away.
    expect(resolveTaskInstances(taskTypes, instancesByDayId.d2)[0].camera_id).toEqual([1, 0]);
  });

  it('resolves a camera-differing day to ITS OWN camera_id with its own epochs', () => {
    const { taskTypes, instancesByDayId } = deriveAnimalTaskCatalog(sameNameDifferentCamera.days);
    const resolved = resolveTaskInstances(taskTypes, instancesByDayId['remy-2023-06-02']);
    expect(resolved[0].camera_id).toEqual([1]); // the cameras THAT day used
    expect(resolved[0].task_epochs).toEqual([3]); // its own epochs preserved
  });
});

describe('stripTaskContext (what a NEW day inherits from an earlier one)', () => {
  it('keeps the task reference and epochs, drops the earlier day\'s own room/cameras', () => {
    expect(
      stripTaskContext([
        { taskTypeId: 'tasktype-0', task_environment: 'HaightRight', camera_id: [1], task_epochs: [1, 3] },
        { taskTypeId: 'tasktype-1', task_epochs: [2] },
      ])
    ).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [1, 3] },
      { taskTypeId: 'tasktype-1', task_epochs: [2] },
    ]);
  });

  it('never mutates the source day (it still records what IT ran)', () => {
    const source = [{ taskTypeId: 'tasktype-0', task_environment: 'HaightRight', task_epochs: [1] }];
    const snapshot = structuredClone(source);
    const stripped = stripTaskContext(source);
    expect(source).toEqual(snapshot);
    expect(stripped[0]).not.toBe(source[0]);
  });

  it('is shape-tolerant: a non-array yields []', () => {
    expect(stripTaskContext(null)).toEqual([]);
    expect(stripTaskContext('nope')).toEqual([]);
  });
});
