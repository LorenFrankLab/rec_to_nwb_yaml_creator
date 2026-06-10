/**
 * DRIFT-GUARD: the e2e workspace harness (e2e/helpers/workspace.js) hard-codes the persistence
 * STORAGE_KEY / SCHEMA_VERSION literals and re-declares the default workspace `settings` shape so it
 * can stay free of production's transitive module graph (and non-deterministic timestamp). Those
 * "remember to mirror this" / "if production adds a settings field, mirror it here" comments are
 * only enforceable by a test — this is it. It imports BOTH the harness AND the production source of
 * truth and asserts they agree, so a production rename / schema bump / new settings field fails CI
 * here instead of silently breaking every seeded e2e spec.
 *
 * Feasibility note: the harness imports `@playwright/test`, but only its `expect` (a plain module
 * export), which loads fine under Vitest — verified — so importing the harness directly is safe and
 * gives the strongest guard (it asserts the harness's REAL exported literals, not a copy).
 */
import { describe, it, expect } from 'vitest';
import {
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_SCHEMA_VERSION,
} from '../state/persistence';
import { createDefaultWorkspace } from '../state/workspaceUtils';
import {
  STORAGE_KEY as HARNESS_STORAGE_KEY,
  SCHEMA_VERSION as HARNESS_SCHEMA_VERSION,
  buildConfiguredWorkspaceBlob,
} from '../../e2e/helpers/workspace';

describe('e2e harness ⇄ production persistence drift guard', () => {
  it('harness STORAGE_KEY matches production WORKSPACE_STORAGE_KEY', () => {
    expect(HARNESS_STORAGE_KEY).toBe(WORKSPACE_STORAGE_KEY);
  });

  it('harness SCHEMA_VERSION matches production WORKSPACE_SCHEMA_VERSION', () => {
    expect(HARNESS_SCHEMA_VERSION).toBe(WORKSPACE_SCHEMA_VERSION);
  });

  it('harness-seeded blob settings have the SAME keys as createDefaultWorkspace().settings', () => {
    const productionKeys = Object.keys(createDefaultWorkspace().settings).sort();
    const harnessKeys = Object.keys(
      buildConfiguredWorkspaceBlob().workspace.settings
    ).sort();
    expect(harnessKeys).toEqual(productionKeys);
  });
});
