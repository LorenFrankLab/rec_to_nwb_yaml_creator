/**
 * Tests for getAnimalSetupCounts — the per-setup-section item counts shown as the section-nav's
 * right-aligned "information scent" (decision 10: name · count · ›). Counts are read through the
 * shape-safe workspace selectors, so a malformed/recovered animal yields 0 rather than crashing.
 */
import { describe, it, expect } from 'vitest';
import { getAnimalSetupCounts } from '../sectionStatus';

describe('getAnimalSetupCounts', () => {
  it('returns 0 for every setup section on a bare animal', () => {
    expect(getAnimalSetupCounts({ id: 'remy' })).toEqual({
      'electrode-groups': 0,
      'channel-maps': 0,
      'recording-system': 0,
      cameras: 0,
    });
  });

  it('counts the configured collections', () => {
    const animal = {
      devices: {
        electrode_groups: [{ id: 0 }, { id: 1 }, { id: 2 }],
        ntrode_electrode_group_channel_map: [{ ntrode_id: 1 }, { ntrode_id: 2 }],
        data_acq_device: [{ name: 'SpikeGadgets' }],
      },
      cameras: [{ id: 0 }, { id: 1 }],
      behavioral_events: [{ description: 'Din1' }],
    };
    expect(getAnimalSetupCounts(animal)).toEqual({
      'electrode-groups': 3,
      'channel-maps': 2,
      'recording-system': 1,
      cameras: 2,
    });
  });

  it('tolerates a malformed animal (non-array collections) → 0', () => {
    const animal = { devices: { electrode_groups: 'nope' }, cameras: null, behavioral_events: 42 };
    expect(getAnimalSetupCounts(animal)).toEqual({
      'electrode-groups': 0,
      'channel-maps': 0,
      'recording-system': 0,
      cameras: 0,
    });
  });
});
