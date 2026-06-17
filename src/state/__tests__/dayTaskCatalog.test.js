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
import { preserveInlineTaskDefinitions, resolveDayCatalogView } from '../dayTaskCatalog';

const T = (over) => ({ task_name: 'sleep', task_description: 'Rest', task_environment: 'home', camera_id: [0], task_epochs: [1], ...over });

describe('resolveDayCatalogView', () => {
  it('passes a catalog day through untouched (taskInstances present)', () => {
    const animal = { taskTypes: [{ id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest', task_environment: 'home', camera_id: [0] }] };
    const day = { taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1] }] };
    const view = resolveDayCatalogView(animal, day);
    expect(view.derived).toBe(false);
    expect(view.divergences).toEqual([]);
    expect(view.taskTypes).toBe(animal.taskTypes);
    expect(view.taskInstances).toBe(day.taskInstances);
  });

  it('derives instances from inline tasks, REUSING an existing catalog type by name', () => {
    const animal = { taskTypes: [{ id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest', task_environment: 'home', camera_id: [0] }] };
    const day = { tasks: [T({ task_epochs: [3] })] }; // 'sleep' already in the catalog
    const view = resolveDayCatalogView(animal, day);
    expect(view.derived).toBe(true);
    expect(view.divergences).toEqual([]);
    expect(view.taskTypes).toHaveLength(1); // reused, not duplicated
    expect(view.taskInstances).toEqual([{ taskTypeId: 'tasktype-0', task_epochs: [3] }]);
  });

  it('detects an inline task whose name matches the catalog but definition differs', () => {
    const animal = { taskTypes: [{ id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest A', task_environment: 'home', camera_id: [0] }] };
    const day = { tasks: [T({ task_description: 'Rest B', camera_id: [1], task_epochs: [3] })] };
    const view = resolveDayCatalogView(animal, day);

    // The working conversion still points at the existing type until the user makes an explicit
    // choice; the divergence report is what blocks silent commit.
    expect(view.taskInstances).toEqual([{ taskTypeId: 'tasktype-0', task_epochs: [3] }]);
    expect(view.divergences).toEqual([
      expect.objectContaining({
        taskName: 'sleep',
        inlineTaskIndex: 0,
        catalogTaskTypeId: 'tasktype-0',
        inline: expect.objectContaining({ task_description: 'Rest B', camera_id: [1] }),
        catalog: expect.objectContaining({ task_description: 'Rest A', camera_id: [0] }),
      }),
    ]);
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
    expect(view.divergences).toEqual([]);
  });

  it('can preserve the inline day definition by minting a valid day-specific task type', () => {
    const animal = { taskTypes: [{ id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest A', task_environment: 'home', camera_id: [0] }] };
    const day = { id: 'remy-2023-06-22', tasks: [T({ task_description: 'Rest B', camera_id: [1], task_epochs: [3] })] };
    const resolved = preserveInlineTaskDefinitions(animal, day);

    expect(resolved.taskTypes).toHaveLength(2);
    expect(resolved.taskTypes[1]).toMatchObject({
      id: 'tasktype-1',
      task_name: 'sleep (remy-2023-06-22)',
      task_description: 'Rest B',
      task_environment: 'home',
      camera_id: [1],
    });
    expect(resolved.taskInstances).toEqual([{ taskTypeId: 'tasktype-1', task_epochs: [3] }]);
  });
});
