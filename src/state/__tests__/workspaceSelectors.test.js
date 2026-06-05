import { describe, it, expect } from 'vitest';
import {
  getAnimalCameras,
  getConfigHistory,
  getDataAcqDevices,
  getAnimalSubject,
  getAnimalExperimenters,
  getExperimenterNames,
  getAnimalDayIds,
  getDaySession,
  getDayTasks,
  getDayAssociatedVideos,
  getDayAssociatedFiles,
  getDayBehavioralEvents,
  getDayKeywords,
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
    ['getConfigHistory', getConfigHistory, (v) => ({ configurationHistory: v })],
    ['getDataAcqDevices', getDataAcqDevices, (v) => ({ devices: { data_acq_device: v } })],
    ['getAnimalDayIds', getAnimalDayIds, (v) => ({ days: v })],
    ['getDayTasks', getDayTasks, (v) => ({ tasks: v })],
    ['getDayAssociatedVideos', getDayAssociatedVideos, (v) => ({ associated_video_files: v })],
    ['getDayAssociatedFiles', getDayAssociatedFiles, (v) => ({ associated_files: v })],
    ['getDayBehavioralEvents', getDayBehavioralEvents, (v) => ({ behavioral_events: v })],
    ['getDayKeywords', getDayKeywords, (v) => ({ keywords: v })],
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
});
