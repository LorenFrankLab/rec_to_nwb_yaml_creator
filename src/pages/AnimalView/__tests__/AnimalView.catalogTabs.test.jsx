/**
 * Tests for the catalog/library setup tabs mounted into AnimalView (Phase 3-3 — tabbed-workspace-ia).
 *
 * Phase 3-3 replaces the Phase-1 placeholder for the `recording-system`, `cameras`, `dio`, and
 * `optogenetics` tabs with their extracted containers (from 3-1), adds their scope descriptors and
 * the optogenetics status chip, and hoists the 3-field RawCorruptionBanner to the AnimalView level
 * (charter decision 1). Uses the REAL containers (no mocks) so the integration is genuine.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { AnimalView } from '../index';

/**
 * A configured animal whose four catalog sections render their real content.
 * @param {object} [overrides] - Fields to override on the base animal record.
 * @returns {object} The remy animal record.
 */
function buildAnimal(overrides = {}) {
  return {
    id: 'remy',
    subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
    devices: {
      electrode_groups: [],
      ntrode_electrode_group_channel_map: [],
      data_acq_device: [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }],
    },
    technicalDefaults: { raw_data_to_volts: 0.195, times_period_multiplier: 1.5 },
    cameras: [{ id: 0, camera_name: 'overhead_camera', meters_per_pixel: 0.001, manufacturer: 'AV', model: 'Mako', lens: 'Fuji' }],
    behavioral_events: [{ name: 'Din1', description: 'reward' }],
    optogenetics: undefined,
    configurationHistory: [
      { version: 1, date: '2023-06-22', description: 'Initial', devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] },
    ],
    days: [],
    ...overrides,
  };
}

/**
 * Render AnimalView for a tab against a seeded store.
 * @param {string} tab - The active tab.
 * @param {object} [animal] - The remy animal record.
 * @returns {object} render result
 */
function renderView(tab, animal = buildAnimal()) {
  return render(
    <StoreProvider initialState={{ workspace: { animals: { remy: animal }, days: {}, settings: {} } }}>
      <AnimalView animalId="remy" tab={tab} />
    </StoreProvider>
  );
}

const PLACEHOLDER = /this section moves here in a later phase/i;

describe('AnimalView — catalog/library tabs render (Phase 3-3)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/recording-system' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('renders the recording-system container, not the placeholder', () => {
    renderView('recording-system');
    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
    // DataAcqSection renders the catalog as a table with an Add control (the catalog list, not a
    // single-device form). The seeded system name appears in the table.
    expect(screen.getByRole('button', { name: /add recording system/i })).toBeInTheDocument();
    expect(screen.getAllByText('SpikeGadgets').length).toBeGreaterThan(0);
  });

  it('renders the cameras container, not the placeholder', () => {
    renderView('cameras');
    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
    expect(screen.getByText('overhead_camera')).toBeInTheDocument();
  });

  it('renders the optogenetics container, not the placeholder', () => {
    renderView('optogenetics');
    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
  });

  it('renders the task-types container, not the placeholder', () => {
    renderView('task-types');
    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
    // The seeded animal has no task types yet → the catalog empty state with its CTA.
    expect(screen.getByRole('button', { name: /Add First Task Type/i })).toBeInTheDocument();
  });
});

describe('AnimalView — catalog containers persist edits to the store (GAP-A)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/recording-system' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  /** Live-store probe: exposes remy's data-acq devices for assertions. */
  function DataAcqProbe() {
    const { model } = useStoreContext();
    return (
      <pre data-testid="data-acq">
        {JSON.stringify(model.workspace.animals.remy?.devices?.data_acq_device || [])}
      </pre>
    );
  }

  it('writes a recording-system (data-acq name) edit through the container to the store', async () => {
    // The catalog containers' real job is wiring the store callback (useAnimalFieldUpdate); the
    // presentational sections test against a MOCKED callback, so this pins the actual container→store
    // seam — a regression that drops/mis-shapes the write would otherwise render green.
    const user = userEvent.setup();
    render(
      <StoreProvider initialState={{ workspace: { animals: { remy: buildAnimal() }, days: {}, settings: {} } }}>
        <AnimalView animalId="remy" tab="recording-system" />
        <DataAcqProbe />
      </StoreProvider>
    );

    // Open the catalog row's editor, rename, save — the write flows through the container's callback.
    await user.click(screen.getByRole('button', { name: /edit recording system SpikeGadgets/i }));
    const nameField = screen.getByLabelText(/^name/i);
    await user.clear(nameField);
    await user.type(nameField, 'SpikeGadgets_MCU');
    await user.click(screen.getByRole('button', { name: /save recording system/i }));

    const devices = JSON.parse(screen.getByTestId('data-acq').textContent);
    expect(devices).toHaveLength(1);
    expect(devices[0].name).toBe('SpikeGadgets_MCU');
  });

  /** Live-store probe: exposes remy's task-type catalog for assertions. */
  function TaskTypesProbe() {
    const { model } = useStoreContext();
    return (
      <pre data-testid="task-types">{JSON.stringify(model.workspace.animals.remy?.taskTypes || [])}</pre>
    );
  }

  it('writes a Task Types catalog add through the container to the store (real seam, not a mock)', async () => {
    // The Task Types container writes through updateAnimal({ taskTypes }); the presentational tests
    // use a MOCKED callback, so this pins the actual container→store persistence — a dropped
    // applyAnimalUpdates branch (the taskInstances-class silent failure) would otherwise render green.
    const user = userEvent.setup();
    render(
      <StoreProvider initialState={{ workspace: { animals: { remy: buildAnimal() }, days: {}, settings: {} } }}>
        <AnimalView animalId="remy" tab="task-types" />
        <TaskTypesProbe />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /Add First Task Type/i }));
    await user.type(screen.getByLabelText(/Task name/i), 'w-track');
    await user.type(screen.getByLabelText('Description'), 'Continuous alternation');
    await user.type(screen.getByLabelText('Environment'), 'elevated W-track');
    await user.click(screen.getByRole('button', { name: /Save task type/i }));

    const taskTypes = JSON.parse(screen.getByTestId('task-types').textContent);
    expect(taskTypes).toHaveLength(1);
    expect(taskTypes[0]).toMatchObject({ id: 'tasktype-0', task_name: 'w-track', task_description: 'Continuous alternation' });
  });
});

describe('AnimalView — catalog tab scope descriptors (Phase 3-3)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/recording-system' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('recording-system scope: animal-wide catalog, each day uses one', () => {
    renderView('recording-system');
    expect(screen.getByText(/animal-wide catalog.*each recording day uses one/i)).toBeInTheDocument();
    // No longer the false "no per-day version" framing.
    expect(screen.queryByText(/no per-day version/i)).not.toBeInTheDocument();
  });

  it('cameras scope descriptor', () => {
    renderView('cameras');
    expect(screen.getByText(/catalog — referenced per day/i)).toBeInTheDocument();
  });

});

describe('AnimalView — optogenetics status chip (Phase 3-3)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/optogenetics' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('shows "Not used — no stimulation" for an opto-free animal', () => {
    renderView('optogenetics'); // optogenetics: undefined
    expect(screen.getByText(/not used — no stimulation/i)).toBeInTheDocument();
  });

  it('does not show the "not used" chip once an animal has started configuring opto', () => {
    const animal = buildAnimal({
      // A partially-configured opto (a non-empty excitation source, other sections still empty) IS
      // using opto, so the "Not used — no stimulation" chip must NOT show — that empty-state chip is
      // keyed to the NONE (never-configured) state only; the section-nav reads "incomplete" here.
      optogenetics: { opto_excitation_source: [{ name: 'laser', wavelength_in_nm: 473 }], optical_fiber: [], virus_injection: [] },
    });
    renderView('optogenetics', animal);
    expect(screen.queryByText(/not used — no stimulation/i)).not.toBeInTheDocument();
  });
});

describe('AnimalView — unsaved-edit guard extends to the CameraModal (charter decision 2)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/cameras' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  /**
   * Render the cameras tab and open the CameraModal so there are pending edits.
   * @returns {object} The userEvent instance for driving subsequent interactions.
   */
  async function renderWithOpenCameraModal() {
    const user = userEvent.setup();
    renderView('cameras');
    await user.click(screen.getByRole('button', { name: /add camera/i }));
    expect(screen.getByRole('heading', { name: /add camera/i })).toBeInTheDocument();
    return user;
  }

  it('intercepts a section-nav switch with the discard confirm when the CameraModal is open', async () => {
    const user = await renderWithOpenCameraModal();
    await user.click(screen.getByRole('link', { name: /^recording system$/i }));
    expect(screen.getByRole('alertdialog', { name: /discard unsaved changes/i })).toBeInTheDocument();
  });

  it('cancel keeps the cameras tab and the open CameraModal', async () => {
    const user = await renderWithOpenCameraModal();
    await user.click(screen.getByRole('link', { name: /^recording system$/i }));
    await user.click(screen.getByRole('button', { name: /keep editing/i }));
    expect(screen.queryByRole('alertdialog', { name: /discard unsaved changes/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /add camera/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/animal/remy/cameras');
  });

  it('confirm navigates away and dismisses the guard', async () => {
    const user = await renderWithOpenCameraModal();
    await user.click(screen.getByRole('link', { name: /^recording system$/i }));
    await user.click(screen.getByRole('button', { name: /discard changes/i }));
    expect(screen.queryByRole('alertdialog', { name: /discard unsaved changes/i })).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/animal/remy/recording-system');
  });
});
