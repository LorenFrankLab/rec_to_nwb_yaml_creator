import { describe, it, expect } from 'vitest';
import {
  getAnimalBehavioralEvents,
  getAnimalCameras,
  getConfigHistory,
  getAnimalDevices,
  getDataAcqDevices,
  getAnimalElectrodeGroups,
  getAnimalNtrodeMaps,
  getProbeElectrodeGroups,
  getProbeNtrodeMaps,
  getAnimalSubject,
  getAnimalExperimenters,
  getExperimenterNames,
  getAnimalDayIds,
  getMostRecentDayId,
  getDaySession,
  getDayTasks,
  getDayAssociatedVideos,
  getDayAssociatedFiles,
  getDayBehavioralEvents,
  getDayKeywords,
  getDayFsGuiYamls,
  getDayCamerasUsed,
  getDayBadChannelOverrides,
  getDayDataAcqDeviceName,
} from '../workspaceSelectors';

/**
 * The shape-safe canonical read layer is the SINGLE place raw persisted state is
 * guarded. Every selector returns a SAFE value (an array or a record) regardless of how
 * corrupt the raw field is — so no component has to remember to guard, and a corrupt
 * import can never make a `.map`/`.reduce`/`.entries` throw at a call site.
 */
describe('workspaceSelectors — array fields are always safe arrays', () => {
  const arraySelectors = [
    ['getAnimalCameras', getAnimalCameras, (v) => ({ cameras: v })],
    ['getAnimalBehavioralEvents', getAnimalBehavioralEvents, (v) => ({ behavioral_events: v })],
    ['getConfigHistory', getConfigHistory, (v) => ({ configurationHistory: v })],
    ['getDataAcqDevices', getDataAcqDevices, (v) => ({ devices: { data_acq_device: v } })],
    ['getAnimalElectrodeGroups', getAnimalElectrodeGroups, (v) => ({ devices: { electrode_groups: v } })],
    [
      'getAnimalNtrodeMaps',
      getAnimalNtrodeMaps,
      (v) => ({ devices: { ntrode_electrode_group_channel_map: v } }),
    ],
    ['getProbeElectrodeGroups', getProbeElectrodeGroups, (v) => ({ electrode_groups: v })],
    [
      'getProbeNtrodeMaps',
      getProbeNtrodeMaps,
      (v) => ({ ntrode_electrode_group_channel_map: v }),
    ],
    ['getAnimalDayIds', getAnimalDayIds, (v) => ({ days: v })],
    ['getDayTasks', getDayTasks, (v) => ({ tasks: v })],
    ['getDayAssociatedVideos', getDayAssociatedVideos, (v) => ({ associated_video_files: v })],
    ['getDayAssociatedFiles', getDayAssociatedFiles, (v) => ({ associated_files: v })],
    ['getDayBehavioralEvents', getDayBehavioralEvents, (v) => ({ behavioral_events: v })],
    ['getDayKeywords', getDayKeywords, (v) => ({ keywords: v })],
    ['getDayFsGuiYamls', getDayFsGuiYamls, (v) => ({ fs_gui_yamls: v })],
    ['getDayCamerasUsed', getDayCamerasUsed, (v) => ({ cameras_used: v })],
  ];

  it.each(arraySelectors)('%s returns [] for every corrupt shape', (_name, selector, wrap) => {
    expect(selector(wrap('nope'))).toEqual([]);
    expect(selector(wrap({}))).toEqual([]);
    expect(selector(wrap(42))).toEqual([]);
    expect(selector(wrap(null))).toEqual([]);
    expect(selector(undefined)).toEqual([]);
    expect(selector(null)).toEqual([]);
  });

  it.each(arraySelectors)('%s returns the array unchanged when well-formed', (_name, selector, wrap) => {
    const arr = [{ id: 1 }];
    expect(selector(wrap(arr))).toBe(arr);
  });

  it('getDataAcqDevices tolerates a non-record devices', () => {
    expect(getDataAcqDevices({ devices: 'corrupt' })).toEqual([]);
    expect(getDataAcqDevices({ devices: [1, 2] })).toEqual([]);
  });
});

describe('workspaceSelectors — record fields are always safe records', () => {
  it('getAnimalDevices returns {} for scalar/array/null', () => {
    for (const bad of ['corrupt', 42, null, [1], undefined]) {
      expect(getAnimalDevices({ devices: bad })).toEqual({});
    }
    expect(getAnimalDevices({ devices: { device: { name: ['Trodes'] } } })).toEqual({
      device: { name: ['Trodes'] },
    });
  });

  it('getAnimalSubject / getAnimalExperimenters return {} for scalar/array/null', () => {
    for (const bad of ['corrupt', 42, null, [1], undefined]) {
      expect(getAnimalSubject({ subject: bad })).toEqual({});
      expect(getAnimalExperimenters({ experimenters: bad })).toEqual({});
    }
    expect(getAnimalSubject({ subject: { subject_id: 'r' } })).toEqual({ subject_id: 'r' });
  });

  it('getDaySession returns {} for a malformed session', () => {
    expect(getDaySession({ session: 'nope' })).toEqual({});
    expect(getDaySession({ session: { session_id: 's' } })).toEqual({ session_id: 's' });
  });

  it('getExperimenterNames returns [] when experimenter_name is corrupt', () => {
    expect(getExperimenterNames({ experimenters: { experimenter_name: 'x' } })).toEqual([]);
    expect(getExperimenterNames({ experimenters: { experimenter_name: ['A'] } })).toEqual(['A']);
    expect(getExperimenterNames({ experimenters: 'corrupt' })).toEqual([]);
  });

  it('getDayBadChannelOverrides returns {} for scalar/array/null deviceOverrides or bad_channels', () => {
    for (const bad of ['corrupt', 42, null, [1], undefined]) {
      expect(getDayBadChannelOverrides({ deviceOverrides: bad })).toEqual({});
      expect(getDayBadChannelOverrides({ deviceOverrides: { bad_channels: bad } })).toEqual({});
    }
    expect(getDayBadChannelOverrides(undefined)).toEqual({});
    expect(getDayBadChannelOverrides(null)).toEqual({});
    expect(
      getDayBadChannelOverrides({ deviceOverrides: { bad_channels: { 0: [2, 3] } } })
    ).toEqual({ 0: [2, 3] });
  });
});

describe('workspaceSelectors — string-or-undefined day fields', () => {
  it('getDayDataAcqDeviceName returns the string only when it is a string, else undefined', () => {
    expect(getDayDataAcqDeviceName({ data_acq_device_name: 'SpikeGadgets' })).toBe('SpikeGadgets');
    for (const bad of [42, null, [1], {}, undefined]) {
      expect(getDayDataAcqDeviceName({ data_acq_device_name: bad })).toBeUndefined();
    }
    expect(getDayDataAcqDeviceName(undefined)).toBeUndefined();
    expect(getDayDataAcqDeviceName(null)).toBeUndefined();
  });
});

describe('getMostRecentDayId — latest-dated present day', () => {
  const animal = { days: ['remy-2023-06-20', 'remy-2023-06-21', 'remy-2023-06-22'] };
  const days = {
    'remy-2023-06-20': { id: 'remy-2023-06-20', date: '2023-06-20' },
    'remy-2023-06-21': { id: 'remy-2023-06-21', date: '2023-06-21' },
    'remy-2023-06-22': { id: 'remy-2023-06-22', date: '2023-06-22' },
  };

  it('returns the id of the latest-dated day regardless of index order', () => {
    expect(getMostRecentDayId(animal, days)).toBe('remy-2023-06-22');
    // Index order does not matter — chronology is decided by `date`.
    const shuffled = { days: ['remy-2023-06-22', 'remy-2023-06-20', 'remy-2023-06-21'] };
    expect(getMostRecentDayId(shuffled, days)).toBe('remy-2023-06-22');
  });

  it('returns null for an animal with no days', () => {
    expect(getMostRecentDayId({ days: [] }, days)).toBe(null);
  });

  it('returns null when the indexed id is dangling (no record present)', () => {
    expect(getMostRecentDayId({ days: ['remy-2023-06-22'] }, {})).toBe(null);
  });

  it('returns null (no throw) for a null animal', () => {
    expect(getMostRecentDayId(null, days)).toBe(null);
  });

  it('tolerates a missing days map and records without a string date', () => {
    expect(getMostRecentDayId(animal, undefined)).toBe(null);
    const partial = {
      'remy-2023-06-20': { id: 'remy-2023-06-20', date: '2023-06-20' },
      'remy-2023-06-21': { id: 'remy-2023-06-21', date: 42 }, // corrupt date, skipped
      'remy-2023-06-22': { id: 'remy-2023-06-22' }, // no date, skipped
    };
    expect(getMostRecentDayId(animal, partial)).toBe('remy-2023-06-20');
  });
});
