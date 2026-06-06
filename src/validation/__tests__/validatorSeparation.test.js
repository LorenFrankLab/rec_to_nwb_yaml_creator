import { describe, it, expect } from 'vitest';
import { rulesValidation } from '../rulesValidation';
import { computeDevicesStatus } from '../../domain/validation';

/**
 * Boundary 4 — converter-truth validation is SEPARATE from UI-convenience status.
 *
 * `rulesValidation` encodes trodes_to_nwb converter truths and is the export GATE: a
 * violation is an error that blocks export. UI-convenience signals (e.g. "every channel
 * in a group is marked bad" → the group is inactive) are a workflow nicety surfaced by
 * `computeDevicesStatus`, NOT a converter truth — the converter happily encodes such a
 * group. Mixing them would either block a valid export or hide a real one. This test pins
 * the separation so neither side drifts into the other.
 */

const tetrodeGroup = { id: 0, location: 'CA1', device_type: 'tetrode_12.5', targeted_location: 'CA1' };

describe('converter-truth (rulesValidation) vs UI-convenience (computeDevicesStatus)', () => {
  it('a converter-truth violation (out-of-range bad channel) is a blocking rules error', () => {
    const model = {
      electrode_groups: [tetrodeGroup],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [99] },
      ],
    };
    const errors = rulesValidation(model).filter((i) => i.severity === 'error');
    expect(errors.some((i) => i.code === 'bad_channel_out_of_range')).toBe(true);
  });

  it('all-channels-bad is NOT a converter-truth error — it is only a UI-convenience status', () => {
    const model = {
      electrode_groups: [tetrodeGroup],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [0, 1, 2, 3] },
      ],
    };
    // The converter encodes this group fine, so rulesValidation must NOT raise an error...
    expect(rulesValidation(model).filter((i) => i.severity === 'error')).toHaveLength(0);
    // ...but the UI flags it as a device-status 'error' (group inactive) for the stepper.
    expect(computeDevicesStatus({}, model)).toBe('error');
  });

  it('a clean group is clean on both sides', () => {
    const model = {
      electrode_groups: [tetrodeGroup],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [1] },
      ],
    };
    expect(rulesValidation(model).filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(computeDevicesStatus({}, model)).toBe('valid');
  });
});
