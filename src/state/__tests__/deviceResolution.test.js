/**
 * Device-resolution behaviors:
 * - `updateAnimal({ devices })` mirrors the edit into the latest configuration
 *   snapshot, so probes configured after animal creation actually reach export.
 * - `resolveDayConfig` fails closed when a day's pinned version is missing.
 * - `resolveDayConfig` applies day-level bad-channel overrides onto the resolved
 *   ntrode map.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import { resolveDayConfig, mergeDayMetadata } from '../workspaceUtils';
import { schemaValidation } from '../../validation/schemaValidation';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

const TS = '2023-06-22T12:00:00.000Z';

const GROUPS = [
  { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode', targeted_location: 'CA1', targeted_x: 3, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
];
const NTRODES = [
  { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
];

/**
 * An animal whose INITIAL configuration snapshot is empty (as `createAnimal`
 * seeds it) and a day pinned to that version — the configure-after-creation
 * starting state where probes were previously dropped from export.
 *
 * @returns {{ workspace: object, animalId: string, dayId: string }}
 */
function makeConfiguredAfterCreation() {
  const animalId = 'remy';
  const dayId = 'remy_20230622';
  const animal = {
    id: animalId,
    subject: { subject_id: animalId, species: 'Rattus norvegicus', sex: 'M', genotype: 'WT', date_of_birth: '2023-01-01T00:00:00', weight: 400, description: 'subj' },
    devices: { data_acq_device: [], device: { name: ['Trodes'] }, electrode_groups: [], ntrode_electrode_group_channel_map: [] },
    cameras: [],
    experimenters: { experimenter_name: ['Doe, J'], lab: 'Frank', institution: 'UCSF' },
    days: [dayId],
    created: TS,
    lastModified: TS,
    configurationHistory: [
      { version: 1, date: '2023-06-22', description: 'Initial configuration', devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] },
    ],
  };
  const day = {
    id: dayId, animalId, date: '2023-06-22', experimentDate: '06222023',
    session: { session_id: 'TEST001', session_description: 'desc', experiment_description: 'exp' },
    tasks: [], behavioral_events: [], associated_files: [], associated_video_files: [],
    technical: { times_period_multiplier: 1.5, raw_data_to_volts: 0.195, default_header_file_path: '', units: undefined },
    state: { draft: true, validated: false, exported: false },
    created: TS, lastModified: TS, configurationVersion: 1,
  };
  return {
    workspace: { version: '1.0.0', lastModified: TS, animals: { [animalId]: animal }, days: { [dayId]: day }, settings: {} },
    animalId, dayId,
  };
}

describe('updateAnimal mirrors devices into the latest configuration snapshot', () => {
  it('makes probes configured after creation reach the pinned snapshot', () => {
    const { workspace, animalId } = makeConfiguredAfterCreation();
    const { result } = renderHook(() => useStore({ workspace }));

    act(() => {
      result.current.actions.updateAnimal(animalId, {
        devices: { electrode_groups: GROUPS, ntrode_electrode_group_channel_map: NTRODES },
      });
    });

    const animal = result.current.model.workspace.animals[animalId];
    const latest = animal.configurationHistory[animal.configurationHistory.length - 1];

    // The edit reached BOTH the editor mirror and the authoritative latest snapshot.
    expect(animal.devices.electrode_groups).toHaveLength(1);
    expect(latest.devices.electrode_groups).toHaveLength(1);
    expect(latest.devices.ntrode_electrode_group_channel_map).toHaveLength(1);
  });

  it('end-to-end: a day pinned to the latest version now resolves the configured probes', () => {
    const { workspace, animalId, dayId } = makeConfiguredAfterCreation();
    const { result } = renderHook(() => useStore({ workspace }));

    act(() => {
      result.current.actions.updateAnimal(animalId, {
        devices: { electrode_groups: GROUPS, ntrode_electrode_group_channel_map: NTRODES },
      });
    });

    const animal = result.current.model.workspace.animals[animalId];
    const day = result.current.model.workspace.days[dayId];
    expect(resolveDayConfig(animal, day).electrode_groups).toHaveLength(1);
  });
});

describe('resolveDayConfig fails closed on a missing pinned version', () => {
  it('throws instead of falling back to latest/first when the pin has no snapshot', () => {
    const animal = {
      id: 'remy',
      configurationHistory: [
        { version: 1, date: '2023-06-22', description: 'v1', devices: { electrode_groups: GROUPS, ntrode_electrode_group_channel_map: NTRODES }, appliedToDays: [] },
      ],
    };
    const day = { id: 'remy_20230622', configurationVersion: 99 };

    expect(() => resolveDayConfig(animal, day)).toThrow(/configuration/i);
  });
});

describe('resolveDayConfig applies day bad-channel overrides', () => {
  const animal = {
    id: 'remy',
    configurationHistory: [
      {
        version: 1, date: '2023-06-22', description: 'v1',
        devices: {
          electrode_groups: GROUPS,
          ntrode_electrode_group_channel_map: [
            { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            { ntrode_id: 2, electrode_group_id: 0, bad_channels: [], map: { 0: 4, 1: 5, 2: 6, 3: 7 } },
          ],
        },
        appliedToDays: [],
      },
    ],
  };

  it('replaces the targeted ntrode bad_channels and leaves others unchanged', () => {
    const day = { id: 'd', configurationVersion: 1, deviceOverrides: { bad_channels: { 1: [2] } } };
    const { ntrode_electrode_group_channel_map: ntrodes } = resolveDayConfig(animal, day);

    expect(ntrodes.find((n) => n.ntrode_id === 1).bad_channels).toEqual([2]);
    expect(ntrodes.find((n) => n.ntrode_id === 2).bad_channels).toEqual([]);
  });

  it('does not mutate the snapshot it resolved from', () => {
    const day = { id: 'd', configurationVersion: 1, deviceOverrides: { bad_channels: { 1: [2] } } };
    resolveDayConfig(animal, day);
    const snapshotNtrode1 = animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map[0];
    expect(snapshotNtrode1.bad_channels).toEqual([]);
  });

  it('ignores an override keyed to an ntrode_id absent from the resolved map (stale/dangling)', () => {
    // A bad-channel override that does not match any resolved ntrode (e.g. left over
    // from a different configuration version) cannot be attached and is left out of
    // the export rather than corrupting another ntrode. Surfacing it to the user is a
    // validation concern handled separately, not silent here.
    const day = { id: 'd', configurationVersion: 1, deviceOverrides: { bad_channels: { 99: [0] } } };
    const { ntrode_electrode_group_channel_map: ntrodes } = resolveDayConfig(animal, day);
    expect(ntrodes.find((n) => n.ntrode_id === 1).bad_channels).toEqual([]);
    expect(ntrodes.find((n) => n.ntrode_id === 2).bad_channels).toEqual([]);
    expect(ntrodes.some((n) => n.ntrode_id === 99)).toBe(false);
  });

  it('merges a string-keyed override against an integer ntrode_id (survives an integer ntrode_id)', () => {
    const intAnimal = structuredClone(animal);
    intAnimal.configurationHistory[0].devices.ntrode_electrode_group_channel_map.forEach((n) => {
      n.ntrode_id = Number(n.ntrode_id);
    });
    const day = { id: 'd', configurationVersion: 1, deviceOverrides: { bad_channels: { 1: [3] } } };
    const { ntrode_electrode_group_channel_map: ntrodes } = resolveDayConfig(intAnimal, day);
    expect(ntrodes.find((n) => n.ntrode_id === 1).bad_channels).toEqual([3]);
  });
});

describe('mergeDayMetadata exports the configured probes and merged bad channels', () => {
  it('includes the configured electrode groups and ntrode map (semantic completeness)', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    const configured = animal.configurationHistory[0].devices;

    expect(merged.electrode_groups.map((g) => g.id)).toEqual(
      configured.electrode_groups.map((g) => g.id)
    );
    expect(merged.ntrode_electrode_group_channel_map.map((n) => n.ntrode_id)).toEqual(
      configured.ntrode_electrode_group_channel_map.map((n) => n.ntrode_id)
    );
  });

  it('applies day bad-channel overrides into the exported ntrode map', () => {
    const { animal, day } = buildRealisticWorkspace();
    day.deviceOverrides = { bad_channels: { 1: [1, 2] } };
    const merged = mergeDayMetadata(animal, day);

    expect(merged.ntrode_electrode_group_channel_map.find((n) => n.ntrode_id === 1).bad_channels).toEqual([1, 2]);
    // A different ntrode keeps its snapshot bad_channels (ntrode 3 has [2]).
    expect(merged.ntrode_electrode_group_channel_map.find((n) => n.ntrode_id === 3).bad_channels).toEqual([2]);
  });

  it('produces schema-valid output for an already-valid-shaped configured session', () => {
    const { animal, day } = buildRealisticWorkspace();
    day.deviceOverrides = { bad_channels: { 1: [1] } };
    expect(schemaValidation(mergeDayMetadata(animal, day))).toHaveLength(0);
  });
});
