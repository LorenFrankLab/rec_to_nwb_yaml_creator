/**
 * Timelines saved by the old import code. That import seeded an animal's editable setup
 * (`animal.devices`) from its EARLIEST file and appended later configurations without mirroring
 * them, so the editor showed one configuration while an edit overwrote another (the last one).
 * On load, a setup that copies an earlier configuration is re-mirrored from the last one, and the
 * load notice says so. A setup that matches no configuration may hold edits saved before setup
 * edits were mirrored, and is left alone. The export reads configurations, never the editable
 * setup, so no day's export changes.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';
import {
  hydrateRaw,
  resetPersistenceForTests,
  WORKSPACE_SCHEMA_VERSION,
  WORKSPACE_STORAGE_KEY,
} from '../persistence';
import { resetWriterLockForTests } from '../writerLock';
import { getAnimalElectrodeGroups, getConfigHistory } from '../workspaceSelectors';

afterEach(() => {
  window.localStorage.clear();
  resetPersistenceForTests();
  resetWriterLockForTests();
});

/**
 * A file of the realistic session on `date`, keeping its first `tetrodes` tetrodes.
 *
 * @param {string} date - ISO recording date.
 * @param {number} [tetrodes] - Tetrodes to keep.
 * @returns {{ sourceName: string, flatModel: object }} The decoded file.
 */
function makeFile(date, tetrodes = 8) {
  const { animal, day } = buildRealisticWorkspace();
  day.date = date;
  day.session = { ...day.session, session_id: `remy_${date.replace(/-/g, '')}` };
  const config = animal.configurationHistory[0].devices;
  config.electrode_groups = config.electrode_groups.slice(0, tetrodes);
  config.ntrode_electrode_group_channel_map = config.ntrode_electrode_group_channel_map.slice(0, tetrodes);
  const [y, m, d] = date.split('-');
  return { sourceName: `${y}${m}${d}_remy_metadata.yml`, flatModel: decodeYaml(encodeYaml(mergeDayMetadata(animal, day))) };
}

/** A workspace as the old import left it: 8 tetrodes on 06-22, 7 on 06-23, setup = the earliest. */
function oldImportWorkspace() {
  const { result } = renderHook(() => useStore());
  const plan = planImport([makeFile('2023-06-22', 8), makeFile('2023-06-23', 7)], result.current.model.workspace);
  act(() => { applyImportPlan(plan, result.current.actions, { workspace: result.current.model.workspace }); });
  const workspace = structuredClone(result.current.model.workspace);
  const first = getConfigHistory(workspace.animals.remy)[0].devices;
  workspace.animals.remy.devices = {
    ...workspace.animals.remy.devices,
    electrode_groups: first.electrode_groups,
    ntrode_electrode_group_channel_map: first.ntrode_electrode_group_channel_map,
  };
  return workspace;
}

const exportsOf = (workspace) =>
  Object.fromEntries(
    workspace.animals.remy.days.map((id) => [id, encodeYaml(mergeDayMetadata(workspace.animals.remy, workspace.days[id]))])
  );

const envelope = (workspace) => JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION, workspace });

describe('loading a timeline saved by the old import', () => {
  it('re-mirrors the last configuration into the editable setup, changing no export', () => {
    const workspace = oldImportWorkspace();
    expect(getAnimalElectrodeGroups(workspace.animals.remy)).toHaveLength(8);
    const before = exportsOf(workspace);

    const loaded = hydrateRaw(envelope(workspace), { preserve: false });

    expect(loaded.resyncedSetups).toEqual(['remy']);
    expect(getAnimalElectrodeGroups(loaded.workspace.animals.remy)).toHaveLength(7);
    expect(loaded.workspace.animals.remy.devices.ntrode_electrode_group_channel_map).toHaveLength(7);
    expect(exportsOf(loaded.workspace)).toEqual(before);
    expect(loaded).not.toHaveProperty('recovered');
  });

  it('says so in the load notice', () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, envelope(oldImportWorkspace()));
    const { result } = renderHook(() => useStore());

    expect(getAnimalElectrodeGroups(result.current.model.workspace.animals.remy)).toHaveLength(7);
    expect(result.current.persistence.loadNotice).toMatch(/remy/);
    expect(result.current.persistence.loadNotice).toMatch(/electrode/i);
    expect(result.current.persistence.loadOutcome).toBeNull();
  });

  it('leaves a setup that matches no configuration alone (edits saved before setup edits were mirrored)', () => {
    const workspace = oldImportWorkspace();
    const edited = structuredClone(workspace.animals.remy.devices);
    edited.electrode_groups[0].location = 'CA3';
    workspace.animals.remy.devices = edited;

    const loaded = hydrateRaw(envelope(workspace), { preserve: false });

    expect(loaded).not.toHaveProperty('resyncedSetups');
    expect(loaded.workspace.animals.remy.devices.electrode_groups[0].location).toBe('CA3');
    expect(getAnimalElectrodeGroups(loaded.workspace.animals.remy)).toHaveLength(8);
  });

  it('leaves a consistent workspace untouched, and a repaired one stays repaired', () => {
    const once = hydrateRaw(envelope(oldImportWorkspace()), { preserve: false });
    const twice = hydrateRaw(envelope(once.workspace), { preserve: false });
    expect(twice).not.toHaveProperty('resyncedSetups');
    expect(twice.workspace).toEqual(once.workspace);
  });
});
