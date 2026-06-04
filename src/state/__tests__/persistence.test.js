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

  it('migrates v1 workspace device data instead of discarding user work', () => {
    const ws = makeTestWorkspace();
    ws.animals.remy.devices = {
      device: { name: [] },
      electrode_groups: [
        { id: '0', location: 'CA1', device_type: 'tetrode_12.5', bad_channels: '' },
      ],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: '1', electrode_group_id: '0', electrode_id: 12, bad_channels: [], map: { 0: 0 } },
      ],
    };

    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, workspace: ws }),
    );

    const result = loadWorkspace();
    expect(result.workspace.animals.remy.devices.device.name).toEqual(['Trodes']);
    expect(result.workspace.animals.remy.devices.electrode_groups[0]).toMatchObject({
      id: 0,
      description: 'CA1',
      targeted_location: 'CA1',
    });
    expect(result.workspace.animals.remy.devices.electrode_groups[0]).not.toHaveProperty('bad_channels');
    expect(result.workspace.animals.remy.devices.ntrode_electrode_group_channel_map[0]).toMatchObject({
      ntrode_id: 1,
      electrode_group_id: 0,
    });
    expect(result.workspace.animals.remy.devices.ntrode_electrode_group_channel_map[0]).not.toHaveProperty('electrode_id');
  });

  it('normalizes device data before persisting', () => {
    const ws = makeTestWorkspace();
    ws.animals.remy.devices.device = { name: [] };

    saveWorkspace(ws);

    const stored = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY));
    expect(stored.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(stored.workspace.animals.remy.devices.device.name).toEqual(['Trodes']);
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
