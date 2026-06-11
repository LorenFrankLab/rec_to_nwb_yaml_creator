import { describe, it, expect } from 'vitest';
import {
  getAnimalSectionStatus,
  SECTION_STATUS,
  getAnimalOptoCompleteness,
  OPTO_COMPLETENESS,
} from '../sectionStatus';

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
  optogenetics: {
    opto_excitation_source: [{ name: 'laser' }],
    optical_fiber: [{ name: 'fiber' }],
    virus_injection: [{ name: 'virus' }],
    optogenetic_stimulation_software: 'fsgui',
  },
  days: ['remy-2023-06-22'],
};

const SETUP_SECTIONS = ['electrode-groups', 'recording-system', 'cameras', 'optogenetics'];

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

  it('treats optogenetics as configured only when the four-field opto setup is COMPLETE', () => {
    // Empty opto → never configured → TODO (the hollow-○ onboarding ring).
    expect(getAnimalSectionStatus({ ...bareAnimal, optogenetics: {} }, 'optogenetics')).toBe(SECTION_STATUS.TODO);

    // PARTIAL opto (some-but-not-all of the four export-gated fields): the section-nav count
    // reads "incomplete" via getAnimalOptoCompleteness !== COMPLETE, so the setup card must AGREE
    // and read TODO — not "Done". A single non-empty sub-list is NOT enough.
    const partialOpto = { optical_fiber: [{ name: 'f' }] };
    expect(getAnimalOptoCompleteness({ optogenetics: partialOpto })).toBe(OPTO_COMPLETENESS.PARTIAL);
    expect(getAnimalSectionStatus({ ...bareAnimal, optogenetics: partialOpto }, 'optogenetics')).toBe(
      SECTION_STATUS.TODO
    );

    // COMPLETE opto (all four fields present) → configured → NONE.
    const completeOpto = {
      opto_excitation_source: [{ name: 'laser' }],
      optical_fiber: [{ name: 'fiber' }],
      virus_injection: [{ name: 'virus' }],
      optogenetic_stimulation_software: 'fsgui',
    };
    expect(getAnimalOptoCompleteness({ optogenetics: completeOpto })).toBe(OPTO_COMPLETENESS.COMPLETE);
    expect(getAnimalSectionStatus({ ...bareAnimal, optogenetics: completeOpto }, 'optogenetics')).toBe(
      SECTION_STATUS.NONE
    );
  });

  it('is robust to corrupt collections (treats them as not configured, never throws)', () => {
    const corrupt = { ...bareAnimal, cameras: 'nope', behavioral_events: 42, optogenetics: [] };
    expect(() => getAnimalSectionStatus(corrupt, 'cameras')).not.toThrow();
    expect(getAnimalSectionStatus(corrupt, 'cameras')).toBe(SECTION_STATUS.TODO);
    expect(getAnimalSectionStatus(corrupt, 'optogenetics')).toBe(SECTION_STATUS.TODO);
  });

  it('returns NONE for an unknown section key', () => {
    expect(getAnimalSectionStatus(bareAnimal, 'banana')).toBe(SECTION_STATUS.NONE);
  });
});

describe('getAnimalOptoCompleteness', () => {
  /** All FOUR fields present — the export rule's complete-opto definition. */
  const completeOpto = {
    opto_excitation_source: [{ name: 'laser' }],
    optical_fiber: [{ name: 'fiber' }],
    virus_injection: [{ name: 'virus' }],
    optogenetic_stimulation_software: 'fsgui',
  };

  it('returns COMPLETE when all four opto fields are present', () => {
    expect(getAnimalOptoCompleteness({ optogenetics: completeOpto })).toBe(
      OPTO_COMPLETENESS.COMPLETE
    );
  });

  it('returns PARTIAL when some-but-not-all opto fields are present', () => {
    // A source list with no fiber/virus/software is the canonical partial case.
    expect(
      getAnimalOptoCompleteness({ optogenetics: { opto_excitation_source: [{ name: 'laser' }] } })
    ).toBe(OPTO_COMPLETENESS.PARTIAL);
    // Three of four present (missing software string) is still partial.
    expect(
      getAnimalOptoCompleteness({
        optogenetics: {
          opto_excitation_source: [{ name: 'laser' }],
          optical_fiber: [{ name: 'fiber' }],
          virus_injection: [{ name: 'virus' }],
          optogenetic_stimulation_software: '',
        },
      })
    ).toBe(OPTO_COMPLETENESS.PARTIAL);
    // A whitespace-only software string does not count (matches the export rule's trim()).
    expect(
      getAnimalOptoCompleteness({ optogenetics: { ...completeOpto, optogenetic_stimulation_software: '   ' } })
    ).toBe(OPTO_COMPLETENESS.PARTIAL);
  });

  it('returns NONE when no opto fields are present', () => {
    expect(getAnimalOptoCompleteness({ optogenetics: {} })).toBe(OPTO_COMPLETENESS.NONE);
    expect(getAnimalOptoCompleteness({ optogenetics: undefined })).toBe(OPTO_COMPLETENESS.NONE);
    expect(getAnimalOptoCompleteness({})).toBe(OPTO_COMPLETENESS.NONE);
  });

  it('is robust to corrupt opto shapes (treats them as NONE, never throws)', () => {
    expect(() => getAnimalOptoCompleteness({ optogenetics: [] })).not.toThrow();
    expect(getAnimalOptoCompleteness({ optogenetics: [] })).toBe(OPTO_COMPLETENESS.NONE);
    expect(getAnimalOptoCompleteness({ optogenetics: 'nope' })).toBe(OPTO_COMPLETENESS.NONE);
    expect(getAnimalOptoCompleteness(null)).toBe(OPTO_COMPLETENESS.NONE);
  });
});
