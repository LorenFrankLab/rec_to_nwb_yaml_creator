/**
 * Phase 8B — v2→v3 task-catalog conversion REHEARSAL.
 *
 * `migrateTasksToCatalogV2ToV3` is the pure, workspace→workspace utility Phase 8C will register
 * directly as the persisted v2→v3 migrator (`MIGRATORS[2]`). This phase builds and tests it WITHOUT
 * registering it or bumping `WORKSPACE_SCHEMA_VERSION`, so the running app stays on inline tasks.
 *
 * The load-bearing guarantees pinned here:
 *  - the conversion is non-destructive (input untouched) and reproduces the v3 catalog shape;
 *  - a migrated, non-conflicting day round-trips back to its ORIGINAL inline tasks (the C1 gate);
 *  - a conflicting `task_name` is normalized to the first-occurrence definition with the original
 *    preserved on the day for review (`task_definition_reconciled`);
 *  - the persisted-migration registry is UNCHANGED — 8B activates nothing.
 */
import { describe, it, expect } from 'vitest';
import { migrateTasksToCatalogV2ToV3 } from '../taskCatalogMigration';
import { resolveTaskInstances } from '../taskCatalog';
import {
  WORKSPACE_SCHEMA_VERSION,
  MIGRATABLE_SCHEMA_VERSIONS,
} from '../workspaceMigrations';
import {
  oneTask,
  multipleTasks,
  sameNameIdenticalDefs,
  sameNameDifferentEnvironment,
  workspaceFromDays,
} from './fixtures/taskCatalog';

describe('migrateTasksToCatalogV2ToV3 — non-destructive workspace→workspace transform', () => {
  it('moves inline day.tasks into animal.taskTypes + day.taskInstances (tasks removed)', () => {
    const out = migrateTasksToCatalogV2ToV3(workspaceFromDays(sameNameIdenticalDefs.days));

    expect(out.animals.remy.taskTypes).toHaveLength(1);
    for (const dayId of ['remy-2023-06-01', 'remy-2023-06-02']) {
      expect(out.days[dayId]).not.toHaveProperty('tasks');
      expect(Array.isArray(out.days[dayId].taskInstances)).toBe(true);
      expect(out.days[dayId].taskInstances[0].taskTypeId).toBe('tasktype-0');
    }
  });

  it('does NOT mutate the input workspace (inline tasks remain on the original)', () => {
    const input = workspaceFromDays(sameNameIdenticalDefs.days);
    const snapshot = structuredClone(input);
    migrateTasksToCatalogV2ToV3(input);
    expect(input).toEqual(snapshot); // input untouched — a pure transform
  });

  it.each([
    ['one task', oneTask],
    ['multiple tasks', multipleTasks],
    ['same name / identical defs', sameNameIdenticalDefs],
  ])('round-trips a migrated %s day back to its original inline tasks (C1 gate)', (_label, fixture) => {
    const out = migrateTasksToCatalogV2ToV3(workspaceFromDays(fixture.days));
    const taskTypes = out.animals.remy.taskTypes;
    for (const day of fixture.days) {
      const resolved = resolveTaskInstances(taskTypes, out.days[day.id].taskInstances);
      expect(resolved).toEqual(day.tasks);
    }
  });

  it('records a task_definition conflict on the day and normalizes export to the canonical', () => {
    const out = migrateTasksToCatalogV2ToV3(workspaceFromDays(sameNameDifferentEnvironment.days));

    // Day 1 (first occurrence) has no reconciliation.
    expect(out.days['remy-2023-06-01'].state?.taskDefinitionReconciliations).toBeUndefined();

    // Day 2 carries the reconciliation record (no leaked `dayId` — that's implicit in its location).
    const recon = out.days['remy-2023-06-02'].state.taskDefinitionReconciliations;
    expect(recon).toHaveLength(1);
    expect(recon[0]).not.toHaveProperty('dayId');
    expect(recon[0]).toMatchObject({
      task_name: 'sleep',
      taskTypeId: 'tasktype-0',
      original: { task_environment: 'QuietRoom' },
      canonical: { task_environment: 'SleepBox' },
    });

    // Export normalizes to the canonical definition (the one legitimately-changed migrated case).
    const resolved = resolveTaskInstances(
      out.animals.remy.taskTypes,
      out.days['remy-2023-06-02'].taskInstances
    );
    expect(resolved[0].task_environment).toBe('SleepBox');
    expect(resolved[0].task_epochs).toEqual([3]);
  });

  it('preserves an existing day.state while adding reconciliations', () => {
    const days = structuredClone(sameNameDifferentEnvironment.days);
    days[1].state = { draft: true, validated: false, exported: false };
    const out = migrateTasksToCatalogV2ToV3(workspaceFromDays(days));
    expect(out.days['remy-2023-06-02'].state).toMatchObject({ draft: true, validated: false });
    expect(out.days['remy-2023-06-02'].state.taskDefinitionReconciliations).toHaveLength(1);
  });

  it('is shape-tolerant: empty workspace, animal with no days, day with no tasks', () => {
    expect(migrateTasksToCatalogV2ToV3({ animals: {}, days: {} })).toEqual({ animals: {}, days: {} });

    const emptyAnimal = migrateTasksToCatalogV2ToV3({
      animals: { remy: { id: 'remy', days: [] } },
      days: {},
    });
    expect(emptyAnimal.animals.remy.taskTypes).toEqual([]);

    const noTasks = migrateTasksToCatalogV2ToV3(
      workspaceFromDays([{ id: 'remy-2023-06-01', date: '2023-06-01', tasks: [] }])
    );
    expect(noTasks.days['remy-2023-06-01'].taskInstances).toEqual([]);
    expect(noTasks.days['remy-2023-06-01']).not.toHaveProperty('tasks');
  });

  it('tolerates a malformed workspace without throwing', () => {
    expect(() => migrateTasksToCatalogV2ToV3(null)).not.toThrow();
    expect(() => migrateTasksToCatalogV2ToV3({})).not.toThrow();
    expect(() => migrateTasksToCatalogV2ToV3({ animals: 'nope', days: 5 })).not.toThrow();
  });
});

describe('Phase 8B activates NOTHING in the persisted-migration registry', () => {
  it('does not bump WORKSPACE_SCHEMA_VERSION (still 2) or register a v2 migrator', () => {
    // Guard the merge-neutral invariant: 8B is a rehearsal — the schema/migrator only move in 8C.
    expect(WORKSPACE_SCHEMA_VERSION).toBe(2);
    expect([...MIGRATABLE_SCHEMA_VERSIONS].sort((a, b) => a - b)).toEqual([1]);
  });
});
