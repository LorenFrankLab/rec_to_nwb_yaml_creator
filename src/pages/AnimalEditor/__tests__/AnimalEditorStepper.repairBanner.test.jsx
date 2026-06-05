/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import AnimalEditorStepper from '../AnimalEditorStepper';
import { useAnimalIdFromUrl } from '../../../hooks/useAnimalIdFromUrl';

// NOTE: unlike AnimalEditorStepper.corruptCollections.test.jsx, this suite renders the REAL
// HardwareConfigStep (and its RawCorruptionBanner) over a REAL store, to prove the end-to-end
// join: stepper.handleRepair → applyRepairCommand → store mutation → banner clears. A wiring
// bug (wrong animalId, omitted ctx.animal) would surface here, where the two halves' own unit
// tests cannot.
vi.mock('../../../hooks/useAnimalIdFromUrl', () => ({
  useAnimalIdFromUrl: vi.fn(),
}));

const baseAnimal = (overrides) => ({
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M', genotype: 'WT', date_of_birth: '2023-01-01', weight: 100, description: 'x' },
  experimenters: { experimenter_name: ['Doe, J'], lab: 'Frank', institution: 'UCSF' },
  devices: { data_acq_device: [{ name: 'SG', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }], device: { name: ['Trodes'] }, electrode_groups: [], ntrode_electrode_group_channel_map: [] },
  technicalDefaults: { raw_data_to_volts: 0.195, times_period_multiplier: 1.5 },
  configurationHistory: [{ version: 1, date: '2023-01-01', description: 'i', devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] }],
  cameras: [],
  days: [],
  created: '2023-01-01T00:00:00.000Z', lastModified: '2023-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  useAnimalIdFromUrl.mockReturnValue('remy');
  // ?field=cameras deep-links to the Hardware Config step (index 2), where the banner lives.
  window.location.hash = '#/animal/remy/editor?field=cameras';
});

describe('AnimalEditorStepper — RawCorruptionBanner end-to-end repair', () => {
  it('executes Reset cameras through the real store and clears the banner in place', async () => {
    const user = userEvent.setup();
    const initialState = { workspace: { animals: { remy: baseAnimal({ cameras: 'nope' }) }, days: {}, settings: {} } };

    render(
      <StoreProvider initialState={initialState}>
        <AnimalEditorStepper />
      </StoreProvider>
    );

    const reset = screen.getByRole('button', { name: /^reset cameras$/i });
    await user.click(reset);

    expect(screen.queryByRole('button', { name: /^reset cameras$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/"cameras" is corrupt/i)).not.toBeInTheDocument();
  });

  it('executes Reset data acquisition devices through the real store and clears the banner', async () => {
    const user = userEvent.setup();
    const initialState = {
      workspace: {
        animals: { remy: baseAnimal({ devices: { data_acq_device: 'corrupt', device: { name: ['Trodes'] }, electrode_groups: [], ntrode_electrode_group_channel_map: [] } }) },
        days: {},
        settings: {},
      },
    };

    render(
      <StoreProvider initialState={initialState}>
        <AnimalEditorStepper />
      </StoreProvider>
    );

    const reset = screen.getByRole('button', { name: /reset data acquisition devices/i });
    await user.click(reset);

    expect(screen.queryByRole('button', { name: /reset data acquisition devices/i })).not.toBeInTheDocument();
  });
});
