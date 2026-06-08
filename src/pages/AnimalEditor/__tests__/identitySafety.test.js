import { describe, it, expect } from 'vitest';
import {
  findIdentityDivergence,
  collectCameraIdentities,
  collectDataAcqIdentities,
  cameraIdentityChanged,
} from '../identitySafety';

describe('cameraIdentityChanged (Phase 8.7 Task 5b)', () => {
  const cam = { id: 0, camera_name: 'overhead', manufacturer: 'Allied', model: 'Mako', lens: '8mm', meters_per_pixel: 0.001 };

  it('is false when nothing identity-relevant changed', () => {
    expect(cameraIdentityChanged(cam, { ...cam })).toBe(false);
    // id is NOT an identity field — changing only the id is not an identity change.
    expect(cameraIdentityChanged(cam, { ...cam, id: 5 })).toBe(false);
  });

  it('is true when calibration / lens / model / manufacturer / name changes', () => {
    expect(cameraIdentityChanged(cam, { ...cam, meters_per_pixel: 0.002 })).toBe(true);
    expect(cameraIdentityChanged(cam, { ...cam, lens: '6mm' })).toBe(true);
    expect(cameraIdentityChanged(cam, { ...cam, model: 'ace' })).toBe(true);
    expect(cameraIdentityChanged(cam, { ...cam, manufacturer: 'Basler' })).toBe(true);
    expect(cameraIdentityChanged(cam, { ...cam, camera_name: 'overhead_zoomed' })).toBe(true);
  });

  it('treats null/undefined/"" as equivalent (no spurious change)', () => {
    expect(cameraIdentityChanged({ ...cam, lens: undefined }, { ...cam, lens: '' })).toBe(false);
    expect(cameraIdentityChanged({ ...cam, model: null }, { ...cam, model: '' })).toBe(false);
  });
});

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

  it('excludes the ENTIRE catalog of the edited animal when no index is given', () => {
    // The animal owns a multi-entry catalog now; the divergence registry the Recording System editor
    // consumes must exclude ALL of the current animal's own systems (intra-catalog name collisions are
    // caught by the editor's own uniqueness check) — otherwise editing entry N could spuriously diverge
    // against sibling entry M.
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
        jaq: { id: 'jaq', devices: { data_acq_device: [{ name: 'NP', system: 'Open Ephys', amplifier: 'IMEC', adc_circuit: 'IMEC' }] } },
      },
    };

    expect(collectDataAcqIdentities(multiDeviceWorkspace, { animalId: 'remy' }).map((e) => e.name)).toEqual(['NP']);
  });
});
