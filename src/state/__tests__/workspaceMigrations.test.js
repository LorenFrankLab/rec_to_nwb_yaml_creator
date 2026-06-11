/**
 * Versioned forward-migration registry: applies ordered pure migrators to upgrade an older
 * persisted blob to the current schema instead of discarding it. These tests pin the registry's
 * contract (derived version sets, the version⇔migrator coupling, the discard boundary) and prove,
 * via checked-in v1/v2 blob fixtures, that an old blob hydrates losslessly through `loadWorkspace`.
 * The fixtures are the regression guard every future migrator inherits.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  migrateWorkspace,
  WORKSPACE_SCHEMA_VERSION,
  MIGRATABLE_SCHEMA_VERSIONS,
} from '../workspaceMigrations';
import { loadWorkspace, WORKSPACE_STORAGE_KEY } from '../persistence';
import v1Blob from './fixtures/persistence/v1-workspace.json';
import v2Blob from './fixtures/persistence/v2-workspace.json';

describe('workspace migration registry', () => {
  it('couples the current version to the registry: current === max(source) + 1', () => {
    // A bump cannot happen without a registered migrator from the previous version.
    expect(WORKSPACE_SCHEMA_VERSION).toBe(Math.max(...MIGRATABLE_SCHEMA_VERSIONS) + 1);
  });

  it('derives MIGRATABLE_SCHEMA_VERSIONS from the registry (currently the source set {1})', () => {
    expect([...MIGRATABLE_SCHEMA_VERSIONS].sort((a, b) => a - b)).toEqual([1]);
  });

  it('passes a current-version blob through untouched (no migrator runs)', () => {
    const result = migrateWorkspace(v2Blob);
    expect(result).toEqual({ workspace: v2Blob.workspace });
    expect(result.workspace).toBe(v2Blob.workspace); // same reference — not transformed
  });

  it('upgrades a v1 blob to the current shape without discarding or losing data', () => {
    const result = migrateWorkspace(v1Blob);
    expect(result.discarded).toBeUndefined();
    // v1 and v2 share the workspace shape (the only v1 handling was device normalization, which the
    // loader still applies to every blob), so the v1→v2 migrator preserves the workspace intact.
    expect(result.workspace).toEqual(v1Blob.workspace);
  });

  it('discards an unknown / too-old / too-new / non-integer version (caller maps to mismatch)', () => {
    expect(migrateWorkspace({ schemaVersion: 0, workspace: {} })).toEqual({ discarded: true });
    expect(migrateWorkspace({ schemaVersion: 999, workspace: {} })).toEqual({ discarded: true });
    expect(migrateWorkspace({ schemaVersion: '1', workspace: {} })).toEqual({ discarded: true });
    expect(migrateWorkspace({ schemaVersion: 1.5, workspace: {} })).toEqual({ discarded: true });
    expect(migrateWorkspace({ workspace: {} })).toEqual({ discarded: true });
  });
});

describe('loadWorkspace upgrades old blobs losslessly (fixtures)', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('a v1 fixture blob hydrates to the SAME workspace as the equivalent v2 blob (no discard)', () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(v1Blob));
    const fromV1 = loadWorkspace();

    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(v2Blob));
    const fromV2 = loadWorkspace();

    expect(fromV1.discarded).toBeUndefined();
    expect(fromV1.recovered).toBeUndefined(); // a complete blob needs no recovery
    expect(fromV1).toEqual(fromV2); // identical hydration regardless of stored version
    expect(fromV1.workspace.animals.remy).toBeTruthy();
  });
});
