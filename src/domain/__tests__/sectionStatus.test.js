import { describe, it, expect } from 'vitest';
import { getAnimalSectionStatus, SECTION_STATUS } from '../sectionStatus';

/** A fully-bare animal: nothing configured. */
const bareAnimal = {
  id: 'newbie',
  subject: { subject_id: 'newbie' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  behavioral_events: [],
  days: [],
};

/** A configured animal: electrodes, channel maps, recording system, cameras, DIO, opto. */
const configuredAnimal = {
  id: 'remy',
  subject: { subject_id: 'remy' },
  devices: {
    electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1' }],
    ntrode_electrode_group_channel_map: [{ ntrode_id: 0, electrode_group_id: 0, map: { 0: 0 } }],
    data_acq_device: [{ name: 'SpikeGadgets' }],
  },
  cameras: [{ id: 0, camera_name: 'overhead' }],
  behavioral_events: [{ name: 'Din1' }],
  optogenetics: { opto_excitation_source: [{ name: 'laser' }], optical_fiber: [], virus_injection: [] },
  days: ['remy-2023-06-22'],
};

const SETUP_SECTIONS = ['electrode-groups', 'channel-maps', 'recording-system', 'cameras', 'dio', 'optogenetics'];

describe('getAnimalSectionStatus', () => {
  it('marks every setup section TODO for a bare (never-configured) animal', () => {
    for (const section of SETUP_SECTIONS) {
      expect(getAnimalSectionStatus(bareAnimal, section)).toBe(SECTION_STATUS.TODO);
    }
  });

  it('marks every setup section NONE once configured', () => {
    for (const section of SETUP_SECTIONS) {
      expect(getAnimalSectionStatus(configuredAnimal, section)).toBe(SECTION_STATUS.NONE);
    }
  });

  it('never marks the day-work sections (days, export) as todo', () => {
    expect(getAnimalSectionStatus(bareAnimal, 'days')).toBe(SECTION_STATUS.NONE);
    expect(getAnimalSectionStatus(bareAnimal, 'export')).toBe(SECTION_STATUS.NONE);
  });

  it('treats optogenetics as configured only when a sub-list is non-empty', () => {
    expect(getAnimalSectionStatus({ ...bareAnimal, optogenetics: {} }, 'optogenetics')).toBe(SECTION_STATUS.TODO);
    expect(
      getAnimalSectionStatus({ ...bareAnimal, optogenetics: { optical_fiber: [{ name: 'f' }] } }, 'optogenetics')
    ).toBe(SECTION_STATUS.NONE);
  });

  it('is robust to corrupt collections (treats them as not configured, never throws)', () => {
    const corrupt = { ...bareAnimal, cameras: 'nope', behavioral_events: 42, optogenetics: [] };
    expect(() => getAnimalSectionStatus(corrupt, 'cameras')).not.toThrow();
    expect(getAnimalSectionStatus(corrupt, 'cameras')).toBe(SECTION_STATUS.TODO);
    expect(getAnimalSectionStatus(corrupt, 'dio')).toBe(SECTION_STATUS.TODO);
    expect(getAnimalSectionStatus(corrupt, 'optogenetics')).toBe(SECTION_STATUS.TODO);
  });

  it('returns NONE for an unknown section key', () => {
    expect(getAnimalSectionStatus(bareAnimal, 'banana')).toBe(SECTION_STATUS.NONE);
  });
});
