import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  loadWorkspace,
  saveWorkspace,
  clearWorkspace,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_SCHEMA_VERSION,
  LOAD_DISCARD_REASON,
} from '../persistence';
import { makeTestWorkspace } from '../../__tests__/helpers/test-fixtures';

afterEach(() => {
  window.localStorage.clear();
});

describe('workspace persistence', () => {
  it('round-trips a saved workspace back through load', () => {
    const ws = makeTestWorkspace();

    saveWorkspace(ws);
    const result = loadWorkspace();

    expect(result).toEqual({ workspace: ws });
    expect(result.workspace.animals).toEqual(ws.animals);
    expect(result.workspace.days).toEqual(ws.days);
    expect(result.workspace.settings).toEqual(ws.settings);
  });

  it('returns null on a clean first run (no blob present)', () => {
    expect(loadWorkspace()).toBeNull();
  });

  it('discards a corrupt (non-JSON) blob with a parse-error reason', () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '{not valid json');

    expect(loadWorkspace()).toEqual({
      workspace: null,
      discarded: LOAD_DISCARD_REASON.PARSE_ERROR,
    });
  });

  it('discards a blob with a mismatched schemaVersion', () => {
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 999, workspace: makeTestWorkspace() }),
    );

    expect(loadWorkspace()).toEqual({
      workspace: null,
      discarded: LOAD_DISCARD_REASON.VERSION_MISMATCH,
    });
  });

  it('discards a structurally malformed blob (valid JSON, no workspace) as malformed', () => {
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION, notWorkspace: true }),
    );

    expect(loadWorkspace()).toEqual({
      workspace: null,
      discarded: LOAD_DISCARD_REASON.MALFORMED,
    });
  });

  it('treats unavailable storage as a clean first run (never throws)', () => {
    const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });

    expect(() => loadWorkspace()).not.toThrow();
    expect(loadWorkspace()).toBeNull();

    spy.mockRestore();
  });

  it('saveWorkspace throws on write failure (so the caller can report it)', () => {
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => saveWorkspace(makeTestWorkspace())).toThrow(/quota/i);

    spy.mockRestore();
  });

  it('accepts a blob with the current schemaVersion', () => {
    const ws = makeTestWorkspace();
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION, workspace: ws }),
    );

    expect(loadWorkspace()).toEqual({ workspace: ws });
  });

  it('persists only the workspace slice, never legacy formData keys', () => {
    saveWorkspace(makeTestWorkspace());

    const stored = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY));
    expect(stored).toHaveProperty('schemaVersion', WORKSPACE_SCHEMA_VERSION);
    expect(stored).toHaveProperty('workspace');
    // No legacy single-form fields should ever be in the persisted blob.
    expect(stored.workspace).not.toHaveProperty('session_id');
    expect(stored.workspace).not.toHaveProperty('subject');
    expect(stored.workspace).not.toHaveProperty('experimenter_name');
    expect(stored).not.toHaveProperty('session_id');
  });

  it('clearWorkspace removes the persisted blob', () => {
    saveWorkspace(makeTestWorkspace());
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).not.toBeNull();

    clearWorkspace();
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });
});
