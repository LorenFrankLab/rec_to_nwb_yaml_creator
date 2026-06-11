/**
 * Phase 8C — `mergeDayMetadata` resolves the task-type catalog.
 *
 * After activation a day's tasks live in the animal `taskTypes[]` catalog + the day's ordered
 * `taskInstances[]`. The export merge must resolve those back to the legacy inline `tasks[]` shape so
 * the YAML is byte-identical (C1): a migrated day and the equivalent legacy inline day export the
 * exact same bytes. Old/unmigrated fixtures with inline `day.tasks` (and no `taskInstances`) keep
 * working via the compatibility fallback.
 */
import { describe, it, expect } from 'vitest';
import { mergeDayMetadata } from '../workspaceUtils';
import { encodeYaml } from '../../io/yaml';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { migrateTasksToCatalogV2ToV3 } from '../taskCatalogMigration';

/**
 * Convert a single `{ animal, day }` (inline tasks) into the catalog shape via the real migrator.
 * @param root0
 * @param root0.animal
 * @param root0.day
 */
function toCatalog({ animal, day }) {
  const ws = migrateTasksToCatalogV2ToV3({
    animals: { [animal.id]: { ...animal, days: [day.id] } },
    days: { [day.id]: { ...day, animalId: animal.id } },
  });
  return { animal: ws.animals[animal.id], day: ws.days[day.id] };
}

describe('mergeDayMetadata resolves taskInstances when present (catalog is the source of truth)', () => {
  it('a catalog day exports the SAME tasks as the equivalent inline day (object-identical)', () => {
    const inline = buildRealisticWorkspace();
    const inlineMerged = mergeDayMetadata(inline.animal, inline.day);

    const catalog = toCatalog(buildRealisticWorkspace());
    const catalogMerged = mergeDayMetadata(catalog.animal, catalog.day);

    expect(catalogMerged.tasks).toEqual(inlineMerged.tasks);
    // The realistic fixture repeats an identical 'sleep' definition — the catalog dedups it to one
    // type but the day still resolves three ordered task rows.
    expect(catalogMerged.tasks.map((t) => t.task_name)).toEqual(['sleep', 'w_alternation', 'sleep']);
  });

  it('exports byte-identically whether the day is inline or catalog-shaped (C1)', () => {
    const inline = buildRealisticWorkspace();
    const catalog = toCatalog(buildRealisticWorkspace());
    expect(encodeYaml(mergeDayMetadata(catalog.animal, catalog.day))).toBe(
      encodeYaml(mergeDayMetadata(inline.animal, inline.day))
    );
  });

  it('falls back to inline day.tasks when the day has no taskInstances (legacy/test fixtures)', () => {
    const { animal, day } = buildRealisticWorkspace();
    expect(day).not.toHaveProperty('taskInstances'); // the builder is still inline
    const merged = mergeDayMetadata(animal, day);
    expect(merged.tasks.map((t) => t.task_name)).toEqual(['sleep', 'w_alternation', 'sleep']);
  });

  it('prefers taskInstances over any stale inline day.tasks left on the record', () => {
    const { animal, day } = buildRealisticWorkspace();
    const catalogAnimal = {
      ...animal,
      taskTypes: [{ id: 'tasktype-0', task_name: 'sleep', task_description: 'd', task_environment: 'e', camera_id: [0] }],
    };
    const catalogDay = {
      ...day,
      taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [9] }],
      tasks: [{ task_name: 'STALE', task_description: 'x', task_environment: 'y', camera_id: [], task_epochs: [99] }],
    };
    const merged = mergeDayMetadata(catalogAnimal, catalogDay);
    expect(merged.tasks).toEqual([
      { task_name: 'sleep', task_description: 'd', task_environment: 'e', camera_id: [0], task_epochs: [9] },
    ]);
  });

  it('a catalog day with an empty taskInstances array exports tasks: []', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata({ ...animal, taskTypes: [] }, { ...day, tasks: undefined, taskInstances: [] });
    expect(merged.tasks).toEqual([]);
  });
});
