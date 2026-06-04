/**
 * `updateAnimal` must route the animal-level Hardware Config fields to the model
 * locations the export reads. Previously `data_acq_device`, `technicalDefaults`, and
 * `behavioral_events` updates matched no branch and were silently dropped.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';

const TS = '2023-06-22T12:00:00.000Z';

/**
 * A minimal one-animal workspace.
 *
 * @returns {{ workspace: object, animalId: string }}
 */
function makeWorkspace() {
  const animalId = 'remy';
  const animal = {
    id: animalId,
    subject: { subject_id: animalId, species: 'Rattus norvegicus', sex: 'M', genotype: 'WT', date_of_birth: '2023-01-01T00:00:00', weight: 400, description: 'subj' },
    devices: { data_acq_device: [], device: { name: ['Trodes'] }, electrode_groups: [], ntrode_electrode_group_channel_map: [] },
    cameras: [],
    experimenters: { experimenter_name: ['Doe, J'], lab: 'Frank', institution: 'UCSF' },
    behavioral_events: [],
    days: [],
    created: TS,
    lastModified: TS,
    configurationHistory: [
      { version: 1, date: '2023-06-22', description: 'Initial configuration', devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] },
    ],
  };
  return {
    workspace: { version: '1.0.0', lastModified: TS, animals: { [animalId]: animal }, days: {}, settings: {} },
    animalId,
  };
}

const animalOf = (result, animalId) => result.current.model.workspace.animals[animalId];

describe('updateAnimal routes animal-level Hardware Config fields', () => {
  it('routes data_acq_device under animal.devices (not a dropped top-level field)', () => {
    const { workspace, animalId } = makeWorkspace();
    const { result } = renderHook(() => useStore({ workspace }));

    const device = [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }];
    act(() => {
      result.current.actions.updateAnimal(animalId, { data_acq_device: device });
    });

    const animal = animalOf(result, animalId);
    expect(animal.devices.data_acq_device).toEqual(device);
    // No dropped top-level field.
    expect(animal.data_acq_device).toBeUndefined();
  });

  it('routes technicalDefaults to animal.technicalDefaults and never creates an exported animal.technical', () => {
    const { workspace, animalId } = makeWorkspace();
    const { result } = renderHook(() => useStore({ workspace }));

    act(() => {
      result.current.actions.updateAnimal(animalId, {
        technicalDefaults: { raw_data_to_volts: 0.2, times_period_multiplier: 2 },
      });
    });

    const animal = animalOf(result, animalId);
    expect(animal.technicalDefaults).toEqual({ raw_data_to_volts: 0.2, times_period_multiplier: 2 });
    // The exported technical values live on day.technical, not a top-level animal.technical.
    expect(animal.technical).toBeUndefined();
  });

  it('persists animal-level behavioral_events', () => {
    const { workspace, animalId } = makeWorkspace();
    const { result } = renderHook(() => useStore({ workspace }));

    const events = [{ name: 'reward_left', description: 'Reward at left arm' }];
    act(() => {
      result.current.actions.updateAnimal(animalId, { behavioral_events: events });
    });

    expect(animalOf(result, animalId).behavioral_events).toEqual(events);
  });
});

describe('createDay seeds day.technical from animal.technicalDefaults', () => {
  it('copies the animal defaults into the new day technical block', () => {
    const { workspace, animalId } = makeWorkspace();
    const { result } = renderHook(() => useStore({ workspace }));

    act(() => {
      result.current.actions.updateAnimal(animalId, {
        technicalDefaults: { raw_data_to_volts: 0.3, times_period_multiplier: 3 },
      });
    });
    act(() => {
      result.current.actions.createDay(animalId, '2023-06-22', {
        session_id: 's', session_description: 'd', experiment_description: 'e',
      });
    });

    const day = Object.values(result.current.model.workspace.days)[0];
    expect(day.technical.raw_data_to_volts).toBe(0.3);
    expect(day.technical.times_period_multiplier).toBe(3);
  });

  it('falls back to the standard defaults when the animal has no technicalDefaults', () => {
    const { workspace, animalId } = makeWorkspace();
    const { result } = renderHook(() => useStore({ workspace }));

    act(() => {
      result.current.actions.createDay(animalId, '2023-06-22', {
        session_id: 's', session_description: 'd', experiment_description: 'e',
      });
    });

    const day = Object.values(result.current.model.workspace.days)[0];
    expect(day.technical.raw_data_to_volts).toBe(0.195);
    expect(day.technical.times_period_multiplier).toBe(1.5);
  });
});
