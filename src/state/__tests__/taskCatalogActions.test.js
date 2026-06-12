/**
 * Phase 8C — pure task-catalog mutation helpers.
 *
 * The catalog is written through the SAME store path as the camera catalog (`updateAnimal(id, {
 * taskTypes })` / `updateDay(id, { taskInstances })`) — no dedicated store actions, so the pinned
 * `store-public-api` contract is unchanged. Unlike cameras (whose container does the array math
 * inline), the task catalog has real invariants — unique `TaskType.id`, immutable updates, and
 * type↔instance ordering — so the mutation logic lives in these pure, unit-tested helpers that the
 * Animal Task-Types and Day pick/order UIs compose.
 */
import { describe, it, expect } from 'vitest';
import {
  nextTaskTypeId,
  addTaskType,
  updateTaskType,
  deleteTaskType,
  addTaskInstance,
  removeTaskInstance,
  setTaskInstanceEpochs,
  reorderTaskInstances,
} from '../taskCatalogActions';

const DEF = { task_name: 'sleep', task_description: 'd', task_environment: 'e', camera_id: [0] };

describe('nextTaskTypeId', () => {
  it('starts at tasktype-0 for an empty/invalid catalog', () => {
    expect(nextTaskTypeId([])).toBe('tasktype-0');
    expect(nextTaskTypeId(null)).toBe('tasktype-0');
  });

  it('is max(existing tasktype-N) + 1 (no collision, no reuse of a deleted index)', () => {
    expect(nextTaskTypeId([{ id: 'tasktype-0' }, { id: 'tasktype-2' }])).toBe('tasktype-3');
  });

  it('ignores ids that do not match the tasktype-N pattern', () => {
    expect(nextTaskTypeId([{ id: 'custom' }, { id: 'tasktype-1' }])).toBe('tasktype-2');
  });
});

describe('addTaskType', () => {
  it('appends a new type with a fresh unique id, preserving the definition', () => {
    const next = addTaskType([], DEF);
    expect(next).toEqual([{ id: 'tasktype-0', ...DEF }]);
  });

  it('does not mutate the input array', () => {
    const types = [{ id: 'tasktype-0', ...DEF }];
    const next = addTaskType(types, { task_name: 'w', task_description: 'x', task_environment: 'y', camera_id: [1] });
    expect(types).toHaveLength(1); // unchanged
    expect(next).toHaveLength(2);
    expect(next[1].id).toBe('tasktype-1');
  });

  it('strips any caller-supplied id from the definition (id is owned by the helper)', () => {
    const next = addTaskType([], { id: 'HACK', ...DEF });
    expect(next[0].id).toBe('tasktype-0');
  });
});

describe('updateTaskType', () => {
  it('replaces the matching type definition but preserves its id', () => {
    const types = [{ id: 'tasktype-0', ...DEF }];
    const next = updateTaskType(types, 'tasktype-0', { task_name: 'sleep', task_description: 'NEW', task_environment: 'e', camera_id: [0] });
    expect(next).toEqual([{ id: 'tasktype-0', task_name: 'sleep', task_description: 'NEW', task_environment: 'e', camera_id: [0] }]);
  });

  it('is a no-op for an unknown id and never mutates the input', () => {
    const types = [{ id: 'tasktype-0', ...DEF }];
    const next = updateTaskType(types, 'ghost', { task_name: 'x', task_description: 'x' });
    expect(next).toEqual(types);
  });
});

describe('deleteTaskType', () => {
  it('removes the matching type, leaving the rest in order', () => {
    const types = [{ id: 'tasktype-0', ...DEF }, { id: 'tasktype-1', task_name: 'w' }];
    expect(deleteTaskType(types, 'tasktype-0')).toEqual([{ id: 'tasktype-1', task_name: 'w' }]);
  });
});

describe('day task-instance helpers', () => {
  const inst = [
    { taskTypeId: 'tasktype-0', task_epochs: [1] },
    { taskTypeId: 'tasktype-1', task_epochs: [2] },
  ];

  it('addTaskInstance appends a reference (epochs default to [])', () => {
    expect(addTaskInstance([], 'tasktype-0')).toEqual([{ taskTypeId: 'tasktype-0', task_epochs: [] }]);
    expect(addTaskInstance(inst, 'tasktype-2', [3])).toEqual([...inst, { taskTypeId: 'tasktype-2', task_epochs: [3] }]);
  });

  it('removeTaskInstance drops the instance at an index without mutating the input', () => {
    const next = removeTaskInstance(inst, 0);
    expect(next).toEqual([{ taskTypeId: 'tasktype-1', task_epochs: [2] }]);
    expect(inst).toHaveLength(2);
  });

  it('setTaskInstanceEpochs replaces the epochs at an index', () => {
    expect(setTaskInstanceEpochs(inst, 1, [4, 5])).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [1] },
      { taskTypeId: 'tasktype-1', task_epochs: [4, 5] },
    ]);
  });

  it('reorderTaskInstances moves an instance from one index to another (order is the day model)', () => {
    expect(reorderTaskInstances(inst, 1, 0)).toEqual([
      { taskTypeId: 'tasktype-1', task_epochs: [2] },
      { taskTypeId: 'tasktype-0', task_epochs: [1] },
    ]);
  });

  it('is shape-tolerant: non-array / out-of-range indices degrade safely', () => {
    expect(addTaskInstance(null, 'tasktype-0')).toEqual([{ taskTypeId: 'tasktype-0', task_epochs: [] }]);
    expect(removeTaskInstance(null, 0)).toEqual([]);
    expect(reorderTaskInstances(inst, 5, 0)).toEqual(inst); // out-of-range → unchanged
    expect(setTaskInstanceEpochs(inst, 9, [1])).toEqual(inst); // out-of-range → unchanged
  });

  it('reorderTaskInstances is a no-op for equal indices', () => {
    expect(reorderTaskInstances(inst, 0, 0)).toEqual(inst);
  });

  it('addTaskInstance does not alias the caller epochs array (a later mutation cannot leak in)', () => {
    const epochs = [1];
    const next = addTaskInstance([], 'tasktype-0', epochs);
    epochs.push(2); // mutate the caller's array AFTER adding
    expect(next[0].task_epochs).toEqual([1]); // the stored instance is unaffected
  });
});

describe('updateTaskType preserves the id across an identity (task_name) change', () => {
  it('renaming a type keeps its id so day taskInstances stay resolvable', () => {
    const types = [{ id: 'tasktype-0', ...DEF }];
    const next = updateTaskType(types, 'tasktype-0', { task_name: 'RENAMED', task_description: 'd', task_environment: 'e', camera_id: [0] });
    expect(next[0].id).toBe('tasktype-0');
    expect(next[0].task_name).toBe('RENAMED');
  });
});
