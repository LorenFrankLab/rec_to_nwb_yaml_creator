/**
 * The save path's device normalization is a no-op for every workspace the app can hold in memory:
 * every write path normalizes on the way in (`createAnimal` / `updateAnimal` / snapshot / `updateDay`)
 * and `loadWorkspace` normalizes on the way in from storage. These tests PROVE that invariant on a
 * realistic chronic-recording workspace built through the real store, so `saveWorkspace` can
 * persist the in-memory slice as-is (load stays the single repair point) instead of deep-cloning
 * and re-walking every snapshot's channel map on every 500 ms autosave tick.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import { normalizeWorkspaceDevices } from '../../utils/deviceNormalization';
import { generateAllChannelMaps } from '../../utils/channelMapUtils';
import { loadWorkspace, WORKSPACE_STORAGE_KEY } from '../persistence';
import v3 from './fixtures/persistence/v3-workspace.json';

/**
 * The save-time normalization, applied to a workspace slice.
 * @param workspace
 */
const saveNormalize = (workspace) => normalizeWorkspaceDevices(workspace, { migrateBadChannels: false });

/**
 * A 4-shank 128-channel probe animal: the largest device shape the app carries per animal.
 * @param groupCount
 */
function bigDevices(groupCount) {
  const electrode_groups = Array.from({ length: groupCount }, (_, i) => ({
    id: i,
    location: 'CA1',
    device_type: '128c-4s6mm6cm-20um-40um-sl',
    description: `probe ${i}`,
    targeted_location: 'CA1',
    targeted_x: 0,
    targeted_y: 0,
    targeted_z: 0,
    units: 'mm',
  }));
  return {
    data_acq_device: [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }],
    device: { name: ['Trodes'] },
    electrode_groups,
    ntrode_electrode_group_channel_map: generateAllChannelMaps(electrode_groups),
  };
}

/**
 *
 * @param result
 * @param root0
 * @param root0.animals
 * @param root0.days
 * @param root0.groups
 */
function buildChronicWorkspace(result, { animals = 2, days = 60, groups = 2 } = {}) {
  for (let a = 0; a < animals; a += 1) {
    const animalId = `rat${a}`;
    act(() => {
      result.current.actions.createAnimal(animalId, { subject_id: animalId }, {
        cameras: [{ id: 0, camera_name: 'top', meters_per_pixel: 0.001, manufacturer: 'm', model: 'm', lens: 'l' }],
        devices: bigDevices(groups),
      });
    });
    const dayIds = [];
    for (let d = 0; d < days; d += 1) {
      const date = `2024-${String(1 + Math.floor(d / 28)).padStart(2, '0')}-${String(1 + (d % 28)).padStart(2, '0')}`;
      act(() => {
        result.current.actions.createDay(animalId, date, { session_id: `${animalId}_${date}`, session_description: 'run' });
      });
      dayIds.push(`${animalId}-${date}`);
    }
    // A mid-history probe reconfiguration + a day-level failed-channel override.
    act(() => {
      result.current.actions.createConfigurationSnapshotAndApplyForward(
        animalId,
        { date: '2024-02-01', description: 'reimplant', devices: bigDevices(groups) },
        dayIds.slice(Math.floor(days / 2))
      );
      result.current.actions.updateDay(dayIds[0], { deviceOverrides: { bad_channels: { 0: [1, 2] } } });
    });
  }
}

describe('saveWorkspace normalization is a no-op for any in-memory workspace', () => {
  it('holds after every store write on a realistic chronic workspace', () => {
    const { result } = renderHook(() => useStore());
    buildChronicWorkspace(result);
    const ws = result.current.model.workspace;
    expect(Object.keys(ws.days)).toHaveLength(120);
    expect(saveNormalize(ws)).toEqual(ws);
  });

  it('holds for a workspace hydrated from the newest persistence fixture', () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(v3));
    const { workspace } = loadWorkspace();
    expect(saveNormalize(workspace)).toEqual(workspace);
  });
});
