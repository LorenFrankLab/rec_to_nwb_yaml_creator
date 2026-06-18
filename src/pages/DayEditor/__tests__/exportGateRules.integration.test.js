/**
 * Validation / export-gate integration.
 *
 * Proves the cross-reference/channel rules flow through `validate` → `computeStepStatus(...).export`
 * (the Phase 1 fail-closed gate): an error-severity rule drives `export === 'error'`,
 * while a warning-severity rule (mixed-case location) leaves export reachable.
 */
import { describe, it, expect } from 'vitest';
import { computeStepStatus } from '../../../domain/validation';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

describe('validation rules and the export gate', () => {
  it('a clean configured day exports (baseline)', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    expect(computeStepStatus(day, merged).export).toBe('valid');
  });

  it('a dangling camera reference blocks export', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    // Point a task at a camera id no camera defines.
    merged.tasks[0].camera_id = [99];
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('an out-of-range channel value blocks export', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    merged.ntrode_electrode_group_channel_map[1].map = { 0: 4, 1: 5, 2: 6, 3: 7 };
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('a mixed-case location warning-severity does NOT block export', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    // Two groups already use 'CA1'; lowercase one of them to trip the
    // region-fragmentation warning without adding any error.
    const firstCA1 = merged.electrode_groups.findIndex((g) => g.location === 'CA1');
    merged.electrode_groups[firstCA1].location = 'ca1';
    expect(computeStepStatus(day, merged).export).toBe('valid');
  });

  it('a suspicious optogenetics source power warning-severity does NOT block export', () => {
    const { animal, day } = buildRealisticWorkspace();
    animal.optogenetics = {
      opto_excitation_source: [{
        name: 'Omicron LuxX+ Blue',
        model_name: 'Omicron LuxX+ 488-100',
        description: 'Laser for optogenetic stimulation',
        wavelength_in_nm: 488,
        power_in_W: 200,
        intensity_in_W_per_m2: 10000000000,
      }],
      optical_fiber: [{
        name: 'Fiber 1',
        hardware_name: 'demo fiber device',
        implanted_fiber_description: 'optogenetic fiber in CA1',
        hemisphere: 'right',
        location: 'CA1',
        ap_in_mm: 0,
        ml_in_mm: 0,
        dv_in_mm: 0,
        roll_in_deg: 0,
        pitch_in_deg: 0,
        yaw_in_deg: 0,
        reference: 'Bregma at the cortical surface',
      }],
      virus_injection: [{
        name: 'Injection 1',
        description: 'Viral injection for optogenetic stimulation',
        virus_name: 'demo_virus_1',
        volume_in_uL: 0.45,
        volume_in_ul: 100,
        titer_in_vg_per_ml: 1000000000,
        location: 'CA1',
        hemisphere: 'right',
        ap_in_mm: 0,
        ml_in_mm: 0,
        dv_in_mm: 0,
        roll_in_deg: 0,
        pitch_in_deg: 0,
        yaw_in_deg: 0,
        reference: 'Bregma at the cortical surface',
      }],
      optogenetic_stimulation_software: 'fsgui',
    };
    const merged = mergeDayMetadata(animal, day);

    expect(computeStepStatus(day, merged).export).toBe('valid');
  });
});
