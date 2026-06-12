import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveInitialWorkspace } from '../workspaceHydration';
import { loadWorkspace } from '../persistence';
import { normalizeWorkspaceDevices } from '../../utils/deviceNormalization';
import { overrideFlags, restoreFlags } from '../../featureFlags';

/**
 * `resolveInitialWorkspace` is the pure logic of `useWorkspace`'s `useState` initializer (extracted
 * in the store-hook split). These lock its load-precedence directly — the same precedence the
 * useStore hydration tests exercise end-to-end, asserted here at the function's own boundary so a
 * future edit to the precedence is caught at the unit, not only through the hook.
 *
 * `loadWorkspace` is mocked so each branch (null / hydrated / shape-recovered / unusable) is driven
 * deterministically without touching real localStorage; `localStoragePersistence` is flipped via the
 * real flag helpers. `createDefaultWorkspace` stamps a non-deterministic `lastModified`, so the
 * default branches are asserted structurally (empty animals/days) rather than by deep-equality.
 */
vi.mock('../persistence', () => ({
  loadWorkspace: vi.fn(),
  saveWorkspace: vi.fn(),
  clearWorkspace: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  restoreFlags();
});

describe('resolveInitialWorkspace — initial workspace precedence', () => {
  it('a test-provided initialState.workspace WINS (device-normalized), bypassing persistence', () => {
    const provided = {
      version: '1.0.0',
      animals: { remy: { id: 'remy', devices: {} } },
      days: {},
      settings: {},
    };

    const result = resolveInitialWorkspace({ workspace: structuredClone(provided) });

    expect(result).toEqual({
      workspace: normalizeWorkspaceDevices(structuredClone(provided)),
      discarded: null,
      recovered: null,
    });
    // The test-provided workspace short-circuits before any persistence read.
    expect(loadWorkspace).not.toHaveBeenCalled();
  });

  it('persistence OFF → empty default, no notices, never reads storage', () => {
    overrideFlags({ localStoragePersistence: false });

    const result = resolveInitialWorkspace(null);

    expect(result.workspace.animals).toEqual({});
    expect(result.workspace.days).toEqual({});
    expect(result.workspace.version).toBe('1.0.0');
    expect(result.discarded).toBeNull();
    expect(result.recovered).toBeNull();
    expect(loadWorkspace).not.toHaveBeenCalled();
  });

  it('clean first run (loadWorkspace returns null) → empty default, no notices', () => {
    loadWorkspace.mockReturnValue(null);

    const result = resolveInitialWorkspace(null);

    expect(result.workspace.animals).toEqual({});
    expect(result.workspace.days).toEqual({});
    expect(result.discarded).toBeNull();
    expect(result.recovered).toBeNull();
  });

  it('hydrates a structurally valid blob with NO recovery notice when none is reported', () => {
    const ws = { version: '1.0.0', animals: {}, days: {}, settings: {} };
    loadWorkspace.mockReturnValue({ workspace: ws });

    const result = resolveInitialWorkspace(null);

    expect(result).toEqual({ workspace: ws, discarded: null, recovered: null });
    // The hydrated path returns loaded.workspace by reference (it does NOT re-normalize).
    expect(result.workspace).toBe(ws);
  });

  it('hydrates a shape-repaired blob AND surfaces its recovery notice', () => {
    const ws = { version: '1.0.0', animals: {}, days: {}, settings: {} };
    const recovered = { missingKeys: ['settings'] };
    loadWorkspace.mockReturnValue({ workspace: ws, recovered });

    const result = resolveInitialWorkspace(null);

    expect(result).toEqual({ workspace: ws, discarded: null, recovered });
  });

  it('a hydrated blob with a falsy `recovered` carries no recovery notice', () => {
    const ws = { version: '1.0.0', animals: {}, days: {}, settings: {} };
    loadWorkspace.mockReturnValue({ workspace: ws, recovered: undefined });

    const result = resolveInitialWorkspace(null);

    expect(result.recovered).toBeNull();
  });

  it('falls back to the empty default AND surfaces the discard reason for an unusable blob', () => {
    loadWorkspace.mockReturnValue({ workspace: null, discarded: 'parse-error' });

    const result = resolveInitialWorkspace(null);

    expect(result.workspace.animals).toEqual({});
    expect(result.workspace.days).toEqual({});
    expect(result.discarded).toBe('parse-error');
    expect(result.recovered).toBeNull();
  });
});
