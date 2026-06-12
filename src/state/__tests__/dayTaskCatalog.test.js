/**
 * Phase 8C — day-scoped catalog resolution for the Day Editor.
 *
 * The Tasks & Epochs step edits a day in CATALOG form (`taskInstances` referencing `animal.taskTypes`).
 * A live day is normally already catalog-shaped (migrated on load), but a freshly-created, imported, or
 * legacy day can still carry inline `day.tasks`. `resolveDayCatalogView` gives the editor ONE uniform
 * working view: it passes a catalog day through untouched, and converts an inline day into the catalog
 * — reusing the animal's existing task types by name and minting new ones for unseen names — so the
 * editor never has to branch on the day's shape and the first edit commits a consistent catalog.
 */
import { describe, it, expect } from 'vitest';
import { resolveDayCatalogView } from '../dayTaskCatalog';

const T = (over) => ({ task_name: 'sleep', task_description: 'Rest', task_environment: 'home', camera_id: [0], task_epochs: [1], ...over });

describe('resolveDayCatalogView', () => {
  it('passes a catalog day through untouched (taskInstances present)', () => {
    const animal = { taskTypes: [{ id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest', task_environment: 'home', camera_id: [0] }] };
    const day = { taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1] }] };
    const view = resolveDayCatalogView(animal, day);
    expect(view.derived).toBe(false);
    expect(view.taskTypes).toBe(animal.taskTypes);
    expect(view.taskInstances).toBe(day.taskInstances);
  });

  it('derives instances from inline tasks, REUSING an existing catalog type by name', () => {
    const animal = { taskTypes: [{ id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest', task_environment: 'home', camera_id: [0] }] };
    const day = { tasks: [T({ task_epochs: [3] })] }; // 'sleep' already in the catalog
    const view = resolveDayCatalogView(animal, day);
    expect(view.derived).toBe(true);
    expect(view.taskTypes).toHaveLength(1); // reused, not duplicated
    expect(view.taskInstances).toEqual([{ taskTypeId: 'tasktype-0', task_epochs: [3] }]);
  });

  it('mints a NEW type (fresh id) for an inline task whose name is not yet in the catalog', () => {
    const animal = { taskTypes: [{ id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest', task_environment: 'home', camera_id: [0] }] };
    const day = { tasks: [T({ task_name: 'w-track', task_description: 'Alt', task_environment: 'W', camera_id: [1], task_epochs: [2] })] };
    const view = resolveDayCatalogView(animal, day);
    expect(view.taskTypes).toHaveLength(2);
    const created = view.taskTypes.find((t) => t.task_name === 'w-track');
    expect(created.id).toBe('tasktype-1'); // next free id, no collision
    expect(created).toMatchObject({ task_description: 'Alt', task_environment: 'W', camera_id: [1] });
    expect(view.taskInstances).toEqual([{ taskTypeId: 'tasktype-1', task_epochs: [2] }]);
  });

  it('derives from a fresh animal (no existing catalog) like the migrator would', () => {
    const animal = {};
    const day = { tasks: [T(), T({ task_name: 'w-track', task_epochs: [2] })] };
    const view = resolveDayCatalogView(animal, day);
    expect(view.taskTypes.map((t) => [t.id, t.task_name])).toEqual([
      ['tasktype-0', 'sleep'],
      ['tasktype-1', 'w-track'],
    ]);
    expect(view.taskInstances.map((i) => i.taskTypeId)).toEqual(['tasktype-0', 'tasktype-1']);
  });

  it('keeps two inline tasks of the SAME name as two instances of one reused type', () => {
    const animal = {};
    const day = { tasks: [T({ task_epochs: [1] }), T({ task_epochs: [3, 5] })] };
    const view = resolveDayCatalogView(animal, day);
    expect(view.taskTypes).toHaveLength(1); // one 'sleep' type
    expect(view.taskInstances).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [1] },
      { taskTypeId: 'tasktype-0', task_epochs: [3, 5] },
    ]);
  });

  it('is shape-tolerant: a day with neither taskInstances nor tasks yields empty instances', () => {
    const view = resolveDayCatalogView({}, {});
    expect(view.taskInstances).toEqual([]);
    expect(view.taskTypes).toEqual([]);
  });
});
