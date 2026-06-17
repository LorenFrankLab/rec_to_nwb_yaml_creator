import { describe, it, expect } from 'vitest';
import {
  getCopyableDioSources,
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
  isAnimalDaysIndexCorrupt,
  resolveDayOwner,
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
  getDayDeferredEpochs,
  getDayVideolessEpochs,
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

describe('getDayVideolessEpochs — the off-export absent-video set', () => {
  it('reads day.state.videolessEpochs, Number-normalized and de-duplicated', () => {
    expect(getDayVideolessEpochs({ state: { videolessEpochs: [3, '5', 3] } }).sort((a, b) => a - b)).toEqual([3, 5]);
  });
  it('returns [] for an absent/corrupt set (never throws)', () => {
    for (const bad of [undefined, null, 42, 'x', { 0: 1 }]) {
      expect(getDayVideolessEpochs({ state: { videolessEpochs: bad } })).toEqual([]);
    }
    expect(getDayVideolessEpochs({})).toEqual([]);
    expect(getDayVideolessEpochs(null)).toEqual([]);
  });
  it('drops non-integer entries', () => {
    expect(getDayVideolessEpochs({ state: { videolessEpochs: [1, 2.5, NaN, 'abc', 4] } }).sort((a, b) => a - b)).toEqual([1, 4]);
  });
});

describe('getDayDeferredEpochs — the off-export fresh-epoch presentation set', () => {
  it('reads day.state.deferredEpochs, Number-normalized and de-duplicated', () => {
    expect(getDayDeferredEpochs({ state: { deferredEpochs: [1, '2', 2] } }).sort((a, b) => a - b)).toEqual([1, 2]);
  });
  it('returns [] for an absent/corrupt set (never throws)', () => {
    for (const bad of [undefined, null, 42, 'x', { 0: 1 }]) {
      expect(getDayDeferredEpochs({ state: { deferredEpochs: bad } })).toEqual([]);
    }
    expect(getDayDeferredEpochs({})).toEqual([]);
    expect(getDayDeferredEpochs(null)).toEqual([]);
  });
  it('drops non-integer entries', () => {
    expect(getDayDeferredEpochs({ state: { deferredEpochs: [1, 2.5, NaN, 'abc', 4] } }).sort((a, b) => a - b)).toEqual([1, 4]);
  });
});

describe('isAnimalDaysIndexCorrupt — surfaces a non-list day index', () => {
  it('is false for a missing index, an empty list, and a populated list', () => {
    expect(isAnimalDaysIndexCorrupt(undefined)).toBe(false);
    expect(isAnimalDaysIndexCorrupt(null)).toBe(false);
    expect(isAnimalDaysIndexCorrupt({})).toBe(false);
    expect(isAnimalDaysIndexCorrupt({ days: [] })).toBe(false);
    expect(isAnimalDaysIndexCorrupt({ days: ['d1'] })).toBe(false);
  });

  it('is true for a present-but-corrupt index (object or string), which getAnimalDayIds launders to []', () => {
    expect(isAnimalDaysIndexCorrupt({ days: { 0: 'd1' } })).toBe(true);
    expect(isAnimalDaysIndexCorrupt({ days: 'd1' })).toBe(true);
    // The corruption the detector exists to surface: the canonical selector hides it as [].
    expect(getAnimalDayIds({ days: { 0: 'd1' } })).toEqual([]);
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

describe('getCopyableDioSources', () => {
  it('returns OTHER animals whose latest non-empty DIO day can seed a new animal', () => {
    const workspace = {
      animals: {
        remy: { id: 'remy', subject: { subject_id: 'remy' }, days: ['remy-d1', 'remy-d2'] },
        peanut: { id: 'peanut', subject: { subject_id: 'peanut' }, days: ['peanut-d1'] },
        nodio: { id: 'nodio', subject: { subject_id: 'nodio' }, days: ['nodio-d1'] },
        self: { id: 'self', subject: { subject_id: 'self' }, days: ['self-d1'] },
      },
      days: {
        'remy-d1': { id: 'remy-d1', date: '2023-06-20', behavioral_events: [{ description: 'Din1', name: 'OldPoke' }] },
        'remy-d2': { id: 'remy-d2', date: '2023-06-22', behavioral_events: [{ description: 'Din1', name: 'Poke1' }] },
        'peanut-d1': { id: 'peanut-d1', date: '2023-07-01', behavioral_events: [{ description: 'Dout7', name: 'Pump1' }] },
        'nodio-d1': { id: 'nodio-d1', date: '2023-06-01', behavioral_events: [] },
        'self-d1': { id: 'self-d1', date: '2023-06-15', behavioral_events: [{ description: 'Din2', name: 'X' }] },
      },
    };

    const sources = getCopyableDioSources(workspace, 'self');
    // self is excluded; nodio has no DIO; remy + peanut qualify.
    expect(sources.map((s) => s.id).sort()).toEqual(['peanut', 'remy']);
    // remy's MOST-RECENT day (d2, 2023-06-22) is the one copied — not the older d1.
    const remy = sources.find((s) => s.id === 'remy');
    expect(remy.events).toEqual([{ description: 'Din1', name: 'Poke1' }]);
    expect(remy.name).toBe('remy');
  });

  it('tolerates a corrupt/missing workspace', () => {
    expect(getCopyableDioSources(null, 'remy')).toEqual([]);
    expect(getCopyableDioSources({}, 'remy')).toEqual([]);
    expect(getCopyableDioSources({ animals: { a: { days: ['x'] } }, days: {} }, 'remy')).toEqual([]);
  });
});

describe('getCopyableDioSources — blank-name and corrupt-day handling', () => {
  it('copies and counts only NAMED events (blank channels are unused, not exported)', () => {
    const ws = {
      animals: { a: { id: 'a', subject: { subject_id: 'a' }, days: ['a-d1'] } },
      days: {
        'a-d1': {
          id: 'a-d1',
          date: '2023-06-22',
          behavioral_events: [
            { description: 'Din1', name: 'Poke1' },
            { description: 'Din5', name: '' }, // unused — excluded
            { description: 'Dout7', name: 'Pump1' },
          ],
        },
      },
    };
    const [src] = getCopyableDioSources(ws, 'other');
    expect(src.events).toEqual([
      { description: 'Din1', name: 'Poke1' },
      { description: 'Dout7', name: 'Pump1' },
    ]);
  });

  it('a day with only blank-named events is not a source; a corrupt non-array day is skipped', () => {
    const ws = {
      animals: {
        blankonly: { id: 'blankonly', subject: { subject_id: 'blankonly' }, days: ['b-d1'] },
        corrupt: { id: 'corrupt', subject: { subject_id: 'corrupt' }, days: ['c-d1'] },
      },
      days: {
        'b-d1': { id: 'b-d1', date: '2023-06-22', behavioral_events: [{ description: 'Din1', name: '  ' }] },
        'c-d1': { id: 'c-d1', date: '2023-06-22', behavioral_events: {} },
      },
    };
    expect(getCopyableDioSources(ws, 'other')).toEqual([]);
  });
});

describe('resolveDayOwner', () => {
  it('resolves a string day.animalId to that owner', () => {
    const ws = {
      animals: { remy: { id: 'remy', days: ['d1'] } },
      days: { d1: { id: 'd1', animalId: 'remy' } },
    };
    expect(resolveDayOwner(ws, 'd1')).toEqual({ ownerKey: 'remy', animal: ws.animals.remy });
  });

  it('falls back to the indexing animal when the day declares NO owner (recovered missing animalId)', () => {
    const ws = {
      animals: { remy: { id: 'remy', days: ['d1'] } },
      days: { d1: { id: 'd1' } }, // animalId absent
    };
    expect(resolveDayOwner(ws, 'd1')).toEqual({ ownerKey: 'remy', animal: ws.animals.remy });
  });

  it('matches by the store MAP KEY, not the record id (a corrupt record id can drift from its key)', () => {
    const ws = {
      animals: { remy: { id: 'remy', days: ['d1'] } },
      days: { d1: { id: 'drifted', animalId: null } }, // record id ≠ map key, no owner
    };
    expect(resolveDayOwner(ws, 'd1').ownerKey).toBe('remy');
  });

  it('does NOT take the indexing fallback for a present-but-unresolvable owner (wrong-owner stays unresolved)', () => {
    // The day is indexed by remy but declares a different owner that does not exist → unresolved,
    // so the editor dead-ends on "Animal not found" instead of opening under remy.
    const ws = {
      animals: { remy: { id: 'remy', days: ['d1'] } },
      days: { d1: { id: 'd1', animalId: 'ghost' } },
    };
    expect(resolveDayOwner(ws, 'd1')).toEqual({ ownerKey: 'ghost', animal: null });
  });

  it('treats a non-string animalId as no resolvable owner (never coerces it to a phantom key)', () => {
    const ws = {
      animals: { remy: { id: 'remy', days: ['d1'] } },
      days: { d1: { id: 'd1', animalId: { corrupt: true } } },
    };
    expect(resolveDayOwner(ws, 'd1')).toEqual({ ownerKey: null, animal: null });
  });

  it('returns no owner for a missing day or malformed workspace', () => {
    expect(resolveDayOwner({ animals: {}, days: {} }, 'nope')).toEqual({ ownerKey: null, animal: null });
    expect(resolveDayOwner(null, 'd1')).toEqual({ ownerKey: null, animal: null });
    expect(resolveDayOwner({ animals: {}, days: {} }, null)).toEqual({ ownerKey: null, animal: null });
  });

  it('does NOT take the indexing fallback for a non-record day record, even when indexed', () => {
    // A corrupt import can persist a truthy-but-non-record day value. It is a dangling reference, not
    // an openable record (dayRecovery classifies it DANGLING_REFERENCE), so it resolves no owner —
    // the editor then dead-ends on "Day not found" rather than opening a broken record under the
    // indexing animal. This makes the stepper agree with the view-model's day-not-found shell.
    const ws = {
      animals: { remy: { id: 'remy', days: ['d1'] } },
      days: { d1: 'corrupt-non-record' },
    };
    expect(resolveDayOwner(ws, 'd1')).toEqual({ ownerKey: null, animal: null });
  });
});
