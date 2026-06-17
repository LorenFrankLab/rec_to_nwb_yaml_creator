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
import { preserveInlineTaskDefinitions, resolveDayCatalogView } from '../dayTaskCatalog';

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

  it('exports a ZERO-task catalog day BYTE-identically to a zero-task inline day', () => {
    const inline = buildRealisticWorkspace();
    inline.day.tasks = [];
    const catalogAnimal = { ...inline.animal, taskTypes: [] };
    const catalogDay = { ...inline.day, tasks: undefined, taskInstances: [] };
    expect(encodeYaml(mergeDayMetadata(catalogAnimal, catalogDay))).toBe(
      encodeYaml(mergeDayMetadata(inline.animal, inline.day))
    );
  });

  it('preserves a stray legacy task key through the catalog merge (byte-identical, lossless)', () => {
    // reorderKeys is lossless (appends non-template keys), so the catalog must carry a stray key
    // through derive→resolve too — exercised end-to-end through the real merge, not just resolve.
    const inline = buildRealisticWorkspace();
    inline.day.tasks = inline.day.tasks.map((t) => ({ ...t, legacy_extra: 'KEEP' }));
    const catalog = toCatalog({ animal: inline.animal, day: inline.day });
    const out = encodeYaml(mergeDayMetadata(catalog.animal, catalog.day));
    expect(out).toBe(encodeYaml(mergeDayMetadata(inline.animal, inline.day)));
    expect(out).toContain('legacy_extra: KEEP'); // the stray key really survived (not silently dropped)
  });

  it('exports an OPTO catalog day BYTE-identically to the equivalent inline opto day', () => {
    // Opto populates the always-on opto key set; prove the tasks section resolves byte-identically
    // when it sits among populated opto keys.
    const inline = buildRealisticWorkspace();
    inline.animal.optogenetics = {
      opto_excitation_source: [],
      optical_fiber: [],
      virus_injection: [],
      optogenetic_stimulation_software: 'FSGui',
    };
    const catalog = toCatalog({ animal: inline.animal, day: inline.day });
    expect(encodeYaml(mergeDayMetadata(catalog.animal, catalog.day))).toBe(
      encodeYaml(mergeDayMetadata(inline.animal, inline.day))
    );
  });

  it('after explicit Keep day values, export preserves the inline description/camera via a distinct task type', () => {
    const { animal, day } = buildRealisticWorkspace();
    const catalogAnimal = {
      ...animal,
      taskTypes: [
        {
          id: 'tasktype-0',
          task_name: 'Run',
          task_description: 'Catalog run definition',
          task_environment: 'W-track A',
          camera_id: [0],
        },
      ],
    };
    const inlineDay = {
      ...day,
      tasks: [
        {
          task_name: 'Run',
          task_description: 'Day-specific run definition',
          task_environment: 'W-track B',
          camera_id: [1],
          task_epochs: [2],
        },
      ],
    };

    const preserved = preserveInlineTaskDefinitions(catalogAnimal, inlineDay);
    const merged = mergeDayMetadata(
      { ...catalogAnimal, taskTypes: preserved.taskTypes },
      { ...inlineDay, tasks: [], taskInstances: preserved.taskInstances }
    );

    expect(merged.tasks).toEqual([
      expect.objectContaining({
        task_name: 'Run (remy-2023-06-22)',
        task_description: 'Day-specific run definition',
        task_environment: 'W-track B',
        camera_id: [1],
        task_epochs: [2],
      }),
    ]);
    expect(encodeYaml(merged)).toContain('task_description: Day-specific run definition');
  });

  it('after explicit Keep catalog definition, export uses the catalog definition', () => {
    const { animal, day } = buildRealisticWorkspace();
    const catalogAnimal = {
      ...animal,
      taskTypes: [
        {
          id: 'tasktype-0',
          task_name: 'Run',
          task_description: 'Catalog run definition',
          task_environment: 'W-track A',
          camera_id: [0],
        },
      ],
    };
    const inlineDay = {
      ...day,
      tasks: [
        {
          task_name: 'Run',
          task_description: 'Day-specific run definition',
          task_environment: 'W-track B',
          camera_id: [1],
          task_epochs: [2],
        },
      ],
    };
    const view = resolveDayCatalogView(catalogAnimal, inlineDay);
    const merged = mergeDayMetadata(catalogAnimal, {
      ...inlineDay,
      tasks: [],
      taskInstances: view.taskInstances,
    });

    expect(view.divergences).toHaveLength(1);
    expect(merged.tasks).toEqual([
      expect.objectContaining({
        task_name: 'Run',
        task_description: 'Catalog run definition',
        task_environment: 'W-track A',
        camera_id: [0],
        task_epochs: [2],
      }),
    ]);
  });
});
