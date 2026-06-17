import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKFLOW_COMMAND_CATALOG } from '../commandCatalog';
import { commandHandlers, REPAIR_COMMAND_IDS } from '../commandHandlers';
import { REPAIR_COMMAND_TYPES } from '../../../state/repairCommands';
import type { CommandActions } from '../commandHandlers';

/**
 * The closed-set ratchet for the descriptor command layer: every command id a builder EMITS must be
 * classified in the catalog, and every store/repair id must resolve to a handler. This is what keeps
 * "add a new VM command → it has a handler (or an explicit page classification)" structurally true —
 * a new emitted id with no catalog entry fails here, not silently at runtime.
 */

const VIEW_MODEL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** List every builder source file (the `src/viewModels/**.ts` modules, not commands/ or tests). */
const builderSourceFiles = (dir = VIEW_MODEL_DIR): string[] => {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'commands' || entry.name === '__tests__') return [];
      return builderSourceFiles(fullPath);
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts')) return [];
    return [fullPath];
  });
};

/** Read every builder source file. */
const builderSources = (): string => {
  const files = builderSourceFiles().map((file) => readFileSync(file, 'utf8'));
  return files.join('\n');
};

/**
 * Literal command ids a builder emits: `id: '<x>'` inside a `command`/`repair` descriptor. The `\b`
 * before `id` excludes substrings like `valid: 'Complete'` (which contains "id: 'Complete'"); the
 * capture is the FULL single-quoted literal (`[^']+`, not `[A-Za-z]+`) so a future id with a digit
 * or hyphen — e.g. `export-day` — can't slip past the catalog unclassified. The dynamic repair ids
 * (`id: String(cmd.type)`) are covered separately via REPAIR_COMMAND_TYPES.
 */
const emittedLiteralIds = (): Set<string> => {
  const ids = new Set<string>();
  const source = builderSources();
  for (const match of source.matchAll(/\bid: '([^']+)'/g)) ids.add(match[1]);
  return ids;
};

const spyActions = (): CommandActions => ({
  deleteDay: vi.fn(),
  duplicateDay: vi.fn(),
  removeDayReference: vi.fn(),
  relinkDayReference: vi.fn(),
  unlinkDayReference: vi.fn(),
  createAnimal: vi.fn(),
  updateDay: vi.fn(),
  updateAnimal: vi.fn(),
  rebuildConfigurationHistory: vi.fn(),
});

describe('command catalog ratchet', () => {
  it('scans the view-model builder tree non-vacuously', () => {
    const files = builderSourceFiles().map((file) => relative(VIEW_MODEL_DIR, file)).sort();

    expect(files.length).toBeGreaterThan(5);
    expect(files).toContain('animalWorkspaceViewModel.ts');
    expect(files).toContain('dayEditorViewModel.ts');
    expect(files.some((file) => file.startsWith('commands/'))).toBe(false);
  });

  it('classifies every command id a builder emits as a literal', () => {
    for (const id of emittedLiteralIds()) {
      expect(WORKFLOW_COMMAND_CATALOG, `emitted command id "${id}" is not in the catalog`).toHaveProperty(id);
    }
  });

  it('classifies every executor repair type (the dynamic `cmd.type` ids) as a repair command', () => {
    // The catalog now has literal keys (no string index signature, so WorkflowCommandId can derive
    // from it); read it as a plain record for the arbitrary-string `type` lookup.
    const catalog: Record<string, string | undefined> = WORKFLOW_COMMAND_CATALOG;
    for (const type of REPAIR_COMMAND_TYPES) {
      expect(catalog[type], `repair type "${type}" must be catalogued as repair`).toBe('repair');
    }
  });

  it('resolves a handler for every store and repair catalog id', () => {
    const handlers = commandHandlers({ actions: spyActions() });
    for (const [id, category] of Object.entries(WORKFLOW_COMMAND_CATALOG)) {
      if (category === 'store' || category === 'repair') {
        expect(typeof handlers[id], `catalog id "${id}" (${category}) has no handler`).toBe('function');
      }
    }
  });

  it('leaves page-orchestrated ids without a resolver handler (they are page-owned effects)', () => {
    const handlers = commandHandlers({ actions: spyActions() });
    for (const [id, category] of Object.entries(WORKFLOW_COMMAND_CATALOG)) {
      if (category === 'page') {
        expect(handlers[id], `page id "${id}" must not have a store-write handler`).toBeUndefined();
      }
    }
  });

  it('has no handler whose id is missing from the catalog (no orphan handlers)', () => {
    const handlers = commandHandlers({ actions: spyActions() });
    for (const id of Object.keys(handlers)) {
      expect(WORKFLOW_COMMAND_CATALOG, `handler "${id}" is not catalogued`).toHaveProperty(id);
    }
  });

  it('keeps the resolver repair-id set aligned with the catalog repair entries', () => {
    const catalogRepairIds = Object.entries(WORKFLOW_COMMAND_CATALOG)
      .filter(([, category]) => category === 'repair')
      .map(([id]) => id)
      .sort();
    expect([...REPAIR_COMMAND_IDS].sort()).toEqual(catalogRepairIds);
  });
});
