import { describe, it, expect } from 'vitest';
import {
  findIdentityDivergence,
  collectCameraIdentities,
  collectDataAcqIdentities,
} from '../identitySafety';

describe('findIdentityDivergence', () => {
  const registry = [
    { name: 'overhead', label: 'remy camera 0', fields: { id: 0, meters_per_pixel: 0.001, lens: '8mm', model: 'Mako', manufacturer: 'Allied' } },
  ];

  it('returns null for an unused name', () => {
    expect(findIdentityDivergence('side', { id: 1, meters_per_pixel: 0.001, lens: '8mm', model: 'Mako', manufacturer: 'Allied' }, registry)).toBeNull();
  });

  it('returns null for an identical reuse (safe)', () => {
    expect(
      findIdentityDivergence('overhead', { id: 0, meters_per_pixel: 0.001, lens: '8mm', model: 'Mako', manufacturer: 'Allied' }, registry)
    ).toBeNull();
  });

  it('flags a reuse with a different calibration and names the differing field', () => {
    const result = findIdentityDivergence(
      'overhead',
      { id: 0, meters_per_pixel: 0.002, lens: '8mm', model: 'Mako', manufacturer: 'Allied' },
      registry
    );
    expect(result).not.toBeNull();
    expect(result.differingFields).toEqual(['meters_per_pixel']);
    expect(result.existing.label).toBe('remy camera 0');
  });

  it('flags a reuse with a different numeric id', () => {
    const result = findIdentityDivergence(
      'overhead',
      { id: 5, meters_per_pixel: 0.001, lens: '8mm', model: 'Mako', manufacturer: 'Allied' },
      registry
    );
    expect(result.differingFields).toEqual(['id']);
  });

  it('normalizes surrounding whitespace on identity names', () => {
    const result = findIdentityDivergence(
      ' overhead ',
      { id: 0, meters_per_pixel: 0.002, lens: '8mm', model: 'Mako', manufacturer: 'Allied' },
      registry
    );
    expect(result.differingFields).toEqual(['meters_per_pixel']);
  });
});

describe('collectCameraIdentities', () => {
  const workspace = {
    animals: {
      remy: { id: 'remy', cameras: [{ id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, lens: '8mm', model: 'Mako', manufacturer: 'Allied' }] },
      jaq: { id: 'jaq', cameras: [{ id: 0, camera_name: 'side', meters_per_pixel: 0.0012, lens: '6mm', model: 'Mako', manufacturer: 'Allied' }] },
    },
  };

  it('collects every camera across animals', () => {
    expect(collectCameraIdentities(workspace).map((e) => e.name).sort()).toEqual(['overhead', 'side']);
  });

  it('excludes the camera being edited so it is not self-divergent', () => {
    const registry = collectCameraIdentities(workspace, { animalId: 'remy', id: 0 });
    expect(registry.map((e) => e.name)).toEqual(['side']);
  });
});

describe('collectDataAcqIdentities', () => {
  const workspace = {
    animals: {
      remy: { id: 'remy', devices: { data_acq_device: [{ name: 'SG', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }] } },
      jaq: { id: 'jaq', devices: { data_acq_device: [{ name: 'OE', system: 'Open Ephys', amplifier: 'Intan', adc_circuit: 'Intan' }] } },
    },
  };

  it('collects data-acq identities across animals', () => {
    expect(collectDataAcqIdentities(workspace).map((e) => e.name).sort()).toEqual(['OE', 'SG']);
  });

  it('excludes the animal being edited', () => {
    expect(collectDataAcqIdentities(workspace, 'remy').map((e) => e.name)).toEqual(['OE']);
  });

  it('can exclude only the selected data-acq item on the edited animal', () => {
    const multiDeviceWorkspace = {
      animals: {
        remy: {
          id: 'remy',
          devices: {
            data_acq_device: [
              { name: 'SG', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
              { name: 'OE', system: 'Open Ephys', amplifier: 'Intan', adc_circuit: 'Intan' },
            ],
          },
        },
      },
    };

    expect(collectDataAcqIdentities(multiDeviceWorkspace, { animalId: 'remy', index: 0 }).map((e) => e.name)).toEqual(['OE']);
  });
});
