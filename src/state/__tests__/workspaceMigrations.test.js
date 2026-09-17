/**
 * Versioned forward-migration registry: applies ordered pure migrators to upgrade an older
 * persisted blob to the current schema instead of discarding it. These tests pin the registry's
 * contract (derived version sets, the version⇔migrator coupling, the discard boundary) and prove,
 * via checked-in v1/v2/v3 blob fixtures, that an old blob hydrates losslessly through `loadWorkspace`.
 * The fixtures are the regression guard every future migrator inherits.
 *
 * Phase 8C activates the task-type catalog: `WORKSPACE_SCHEMA_VERSION` is 3 and the registered v2→v3
 * migrator promotes inline `day.tasks` into animal `taskTypes[]` + day `taskInstances[]`. The v1→v2
 * step remains the identity (v1/v2 share the pre-catalog shape), so a v1 blob migrates v1→v2→v3 and
 * lands on the same v3 catalog shape as a v2 blob.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  migrateWorkspace,
  WORKSPACE_SCHEMA_VERSION,
  MIGRATABLE_SCHEMA_VERSIONS,
} from '../workspaceMigrations';
import { loadWorkspace, WORKSPACE_STORAGE_KEY } from '../persistence';
import { mergeDayMetadata } from '../workspaceUtils';
import { validateDay } from '../../domain/validation';
import v1Blob from './fixtures/persistence/v1-workspace.json';
import v2Blob from './fixtures/persistence/v2-workspace.json';
import v3Blob from './fixtures/persistence/v3-workspace.json';
import v4Blob from './fixtures/persistence/v4-workspace.json';
import v5Blob from './fixtures/persistence/v5-workspace.json';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/persistence');

describe('workspace migration registry', () => {
  it('couples the current version to the registry: current === max(source) + 1', () => {
    // A bump cannot happen without a registered migrator from the previous version.
    expect(WORKSPACE_SCHEMA_VERSION).toBe(Math.max(...MIGRATABLE_SCHEMA_VERSIONS) + 1);
  });

  it('derives MIGRATABLE_SCHEMA_VERSIONS from the registry (currently the source set {1, 2, 3, 4})', () => {
    expect([...MIGRATABLE_SCHEMA_VERSIONS].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('has a CONTIGUOUS source chain 1..(current-1) — a registry gap would silently discard old blobs', () => {
    // A non-contiguous registry (e.g. {1,3} with current 4) would pass the version⇔registry check
    // above yet strand a v1 blob at the missing step. Require the source versions to be exactly
    // 1..current-1 so a gap fails CI rather than discarding a real user's saved work.
    const expected = Array.from({ length: WORKSPACE_SCHEMA_VERSION - 1 }, (_, i) => i + 1);
    expect([...MIGRATABLE_SCHEMA_VERSIONS].sort((a, b) => a - b)).toEqual(expected);
  });

  it('passes a current-version (v5) blob through untouched (no migrator runs)', () => {
    const result = migrateWorkspace(v5Blob);
    expect(result).toEqual({ workspace: v5Blob.workspace });
    expect(result.workspace).toBe(v5Blob.workspace); // same reference — not transformed
  });

  it('upgrades a v4 blob to stable associated-record identity', () => {
    const source = structuredClone(v4Blob);
    source.workspace.days['remy-2023-06-22'].associated_files = [
      { name: 'statescript', description: 'statescript log', path: 'x', task_epochs: 1 },
      { name: 'statescript', description: 'statescript log', path: 'y', task_epochs: 1 },
    ];
    const result = migrateWorkspace(source);
    expect(result.workspace.days['remy-2023-06-22'].associated_files).toEqual([
      expect.objectContaining({ recordId: 'remy-2023-06-22-file-1', kind: 'statescript' }),
      expect.objectContaining({ recordId: 'remy-2023-06-22-file-2', kind: 'statescript' }),
    ]);
    expect(source.workspace.days['remy-2023-06-22'].associated_files[0]).not.toHaveProperty('recordId');
  });

  it('upgrades a v3 blob through the current dated-facts and identity shape', () => {
    const result = migrateWorkspace(v3Blob);
    expect(result.discarded).toBeUndefined();
    expect(result.workspace).toEqual(v5Blob.workspace);
    expect(result.workspace).not.toBe(v3Blob.workspace);
  });

  it('upgrades a v2 blob through the current shape (inline tasks → catalog → dated facts)', () => {
    const result = migrateWorkspace(v2Blob);
    expect(result.discarded).toBeUndefined();
    // The v2→v3 migrator promotes inline day.tasks into the animal catalog + per-day instances,
    // then v3→v4 copies the dated facts onto the day.
    expect(result.workspace).toEqual(v5Blob.workspace);
    // Non-destructive but TRANSFORMING — must be a fresh object, never the stored reference.
    expect(result.workspace).not.toBe(v2Blob.workspace);
    // Spot-check the catalog promotion explicitly.
    expect(result.workspace.animals.remy.taskTypes).toEqual([
      { id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest in home cage', task_environment: 'home cage', camera_id: [0] },
    ]);
    expect(result.workspace.days['remy-2023-06-22'].taskInstances).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [1] },
    ]);
    expect(result.workspace.days['remy-2023-06-22']).not.toHaveProperty('tasks');
  });

  it('upgrades a v1 blob through the full chain onto the same current shape', () => {
    const result = migrateWorkspace(v1Blob);
    expect(result.discarded).toBeUndefined();
    // v1→v2 is the identity (shared pre-catalog shape); v2→v3 applies the catalog; v3→v4 the dated
    // facts. End state equals the v2 blob's migration result and the checked-in v4 fixture.
    expect(result.workspace).toEqual(v5Blob.workspace);
  });

  it('discards an unknown / too-old / too-new / non-integer version (caller maps to mismatch)', () => {
    expect(migrateWorkspace({ schemaVersion: 0, workspace: {} })).toEqual({ discarded: true });
    expect(migrateWorkspace({ schemaVersion: 999, workspace: {} })).toEqual({ discarded: true });
    expect(migrateWorkspace({ schemaVersion: '1', workspace: {} })).toEqual({ discarded: true });
    expect(migrateWorkspace({ schemaVersion: 1.5, workspace: {} })).toEqual({ discarded: true });
    expect(migrateWorkspace({ workspace: {} })).toEqual({ discarded: true });
  });

  it('discards (never throws / never yields an undefined workspace) on a non-record blob or workspace', () => {
    // Defense-in-depth for direct callers: the function must not throw on null nor return an
    // undefined workspace a caller could hydrate as empty.
    expect(migrateWorkspace(null)).toEqual({ discarded: true });
    expect(migrateWorkspace({ schemaVersion: 3 })).toEqual({ discarded: true }); // no workspace
    expect(migrateWorkspace({ schemaVersion: 3, workspace: [] })).toEqual({ discarded: true });
    expect(migrateWorkspace({ schemaVersion: 1, workspace: 'corrupt' })).toEqual({ discarded: true });
  });
});

describe('loadWorkspace upgrades old blobs losslessly (fixtures)', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('has a checked-in vN fixture for every migratable and current schema version', () => {
    const requiredVersions = [...MIGRATABLE_SCHEMA_VERSIONS, WORKSPACE_SCHEMA_VERSION].sort((a, b) => a - b);
    const fixtureVersions = new Set(
      readdirSync(fixtureDir)
        .map((name) => name.match(/^v(\d+)-workspace\.json$/)?.[1])
        .filter(Boolean)
        .map(Number)
    );

    requiredVersions.forEach((version) => {
      expect(
        fixtureVersions.has(version),
        `missing persistence fixture src/state/__tests__/fixtures/persistence/v${version}-workspace.json`
      ).toBe(true);
    });
  });

  it('every required vN fixture hydrates through loadWorkspace without discard', () => {
    const requiredVersions = [...MIGRATABLE_SCHEMA_VERSIONS, WORKSPACE_SCHEMA_VERSION].sort((a, b) => a - b);

    requiredVersions.forEach((version) => {
      const fixturePath = path.join(fixtureDir, `v${version}-workspace.json`);
      const blob = JSON.parse(readFileSync(fixturePath, 'utf8'));
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(blob));

      const loaded = loadWorkspace();
      expect(loaded, `v${version} fixture should load`).toBeTruthy();
      expect(loaded?.discarded, `v${version} fixture must not be discarded`).toBeUndefined();
      expect(loaded?.workspace, `v${version} fixture should hydrate a workspace`).toBeTruthy();
    });
  });

  it('v1 through v5 fixture blobs all hydrate to the SAME workspace (no discard)', () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(v1Blob));
    const fromV1 = loadWorkspace();

    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(v2Blob));
    const fromV2 = loadWorkspace();

    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(v3Blob));
    const fromV3 = loadWorkspace();

    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(v4Blob));
    const fromV4 = loadWorkspace();

    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(v5Blob));
    const fromV5 = loadWorkspace();

    expect(fromV1.discarded).toBeUndefined();
    expect(fromV1.recovered).toBeUndefined(); // a complete blob needs no recovery
    expect(fromV1).toEqual(fromV2); // identical hydration regardless of stored version
    expect(fromV2).toEqual(fromV3);
    expect(fromV3).toEqual(fromV4);
    expect(fromV4).toEqual(fromV5); // a current-shape blob hydrates the same as a migrated one
    // The catalog is live after hydration.
    expect(fromV1.workspace.animals.remy.taskTypes).toHaveLength(1);
    expect(fromV1.workspace.days['remy-2023-06-22'].taskInstances).toHaveLength(1);
  });

  /**
   * A v2 blob whose animal has two days reusing task_name 'sleep', with `day2Task` overriding the
   * second day's task fields.
   * @param {object} day2Task - Task field overrides for the second day's 'sleep' task.
   * @returns {object} The v2 blob.
   */
  const twoDayTaskBlob = (day2Task) => {
    const blob = structuredClone(v2Blob);
    const day1 = blob.workspace.days['remy-2023-06-22'];
    day1.tasks = [{ task_name: 'sleep', task_description: 'Rest', task_environment: 'home cage', camera_id: [0], task_epochs: [1] }];
    const day2 = structuredClone(day1);
    day2.id = 'remy-2023-06-23';
    day2.date = '2023-06-23';
    day2.experimentDate = '06232023';
    day2.session = { ...day1.session, session_id: 'remy_20230623' };
    day2.tasks = [{ ...day1.tasks[0], task_epochs: [2], ...day2Task }];
    blob.workspace.days['remy-2023-06-23'] = day2;
    blob.workspace.animals.remy.days = ['remy-2023-06-22', 'remy-2023-06-23'];
    return blob;
  };

  it('migrates a v2 CONFLICT blob end-to-end: the reconciliation survives load and validateDay surfaces it', () => {
    // Two days reuse task_name 'sleep' with a DIVERGENT task_description — the Spyglass identity
    // conflict the migrator normalizes to the first occurrence and records on the later day. This
    // pins the migrator → normalizeWorkspaceDevices → ensureWorkspaceShape → validator linkage: a
    // future day-object rebuild in normalization that dropped state.* would fail HERE.
    const blob = twoDayTaskBlob({ task_description: 'Rest, but differently' });

    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(blob));
    const loaded = loadWorkspace();
    expect(loaded.discarded).toBeUndefined();

    const animal = loaded.workspace.animals.remy;
    expect(animal.taskTypes).toHaveLength(1); // 'sleep' deduped to one canonical type
    const migratedDay2 = loaded.workspace.days['remy-2023-06-23'];
    // The reconciliation record survived migration + device-normalize + shape-ensure.
    expect(migratedDay2.state.taskDefinitionReconciliations).toHaveLength(1);
    expect(migratedDay2.state.taskDefinitionReconciliations[0]).toMatchObject({
      task_name: 'sleep',
      original: { task_description: 'Rest, but differently' },
      canonical: { task_description: 'Rest' },
    });
    // And the LIVE validator surfaces it on the day.
    const codes = validateDay(migratedDay2, mergeDayMetadata(animal, migratedDay2), animal).map((i) => i.code);
    expect(codes).toContain('task_definition_reconciled');
  });

  it('migrates a v2 blob whose days ran one task in DIFFERENT rooms: each day still exports its own', () => {
    // The F3 case (SC38): same task, different environment per recording date. The upgrade must
    // preserve each day's room as an instance override — through migration, device-normalize and
    // shape-ensure — and must NOT raise a reconciliation (nothing was lost).
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(twoDayTaskBlob({ task_environment: 'QUIET ROOM' }))
    );
    const loaded = loadWorkspace();
    expect(loaded.discarded).toBeUndefined();

    const animal = loaded.workspace.animals.remy;
    expect(animal.taskTypes).toHaveLength(1);
    const day1 = loaded.workspace.days['remy-2023-06-22'];
    const day2 = loaded.workspace.days['remy-2023-06-23'];
    expect(day2.state?.taskDefinitionReconciliations).toBeUndefined();
    expect(mergeDayMetadata(animal, day1).tasks[0].task_environment).toBe('home cage');
    expect(mergeDayMetadata(animal, day2).tasks[0].task_environment).toBe('QUIET ROOM');
  });
});
