/**
 * First-run "Set up this animal" card (Phase 2 — tabbed-workspace-ia, Task 2.3 / decision 8).
 *
 * A new/under-configured animal leads the Recording Days tab with a prominent per-section setup
 * card driven by getAnimalSectionStatus (the SAME source as the section-nav hollow-○ todo rings,
 * so we don't show "todo" three ways). It is honest and NON-gating: behavior-only days are valid,
 * so a never-configured electrode section is a neutral "To do", never a "set up electrodes first"
 * gate. Each item links to its setup TAB (not the legacy stepper). The card disappears once the
 * animal is established (subject set AND at least one recording day); the ambient nav rings then
 * carry the signal. The separate "Review existing data" state is a different concern and stays.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { RecordingDaysTab } from '../RecordingDaysTab';

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
});

/**
 * Render the recording-days pane for one animal directly.
 * @param {string} animalId - The animal whose pane to render.
 * @param {object} animals - workspace.animals
 * @param {object} [days] - workspace.days
 * @returns {object} render result
 */
function renderPane(animalId, animals, days = {}) {
  return render(
    <StoreProvider initialState={{ workspace: { animals, days, settings: {} } }}>
      <RecordingDaysTab animalId={animalId} />
    </StoreProvider>
  );
}

/** A new animal: subject set on create, no shared hardware, no days. */
const newAnimal = {
  id: 'newbie',
  subject: { subject_id: 'newbie', species: 'Rattus norvegicus', sex: 'M' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  behavioral_events: [],
  configurationHistory: [{ version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [] }, appliedToDays: [] }],
  days: [],
};

/** A partly-configured animal (electrodes + cameras), still no days. */
const configuredAnimal = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: {
    electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5', targeted_location: 'CA1' }],
    ntrode_electrode_group_channel_map: [{ ntrode_id: 0, electrode_group_id: 0, map: { 0: 0 } }],
    data_acq_device: [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }],
  },
  cameras: [{ id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, lens: '16mm', model: 'X', manufacturer: 'Y' }],
  behavioral_events: [],
  configurationHistory: [{ version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5', targeted_location: 'CA1' }] }, appliedToDays: [] }],
  days: [],
};

describe('Set up this animal card — first-run onboarding', () => {
  it('leads a new animal with a "Set up this animal" card listing the six setup sections', () => {
    renderPane('newbie', { newbie: newAnimal });
    const card = screen.getByRole('region', { name: /set up this animal/i });
    expect(within(card).getByText('Electrode Groups')).toBeInTheDocument();
    expect(within(card).getByText('Channel Maps')).toBeInTheDocument();
    expect(within(card).getByText('Recording System')).toBeInTheDocument();
    expect(within(card).getByText('Cameras')).toBeInTheDocument();
    expect(within(card).getByText('Optogenetics')).toBeInTheDocument();
  });

  it('links each section to its setup TAB (not the legacy stepper route)', () => {
    renderPane('newbie', { newbie: newAnimal });
    const card = screen.getByRole('region', { name: /set up this animal/i });
    const links = within(card).getAllByRole('link');
    const hrefs = links.map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('#/animal/newbie/electrode-groups');
    expect(hrefs).toContain('#/animal/newbie/cameras');
    expect(hrefs).toContain('#/animal/newbie/optogenetics');
    // No card link routes to the legacy stepper / repair-field deep link (that is Phase 3a).
    expect(hrefs.every((h) => h && !h.includes('/editor'))).toBe(true);
  });

  it('gives each section action a distinct accessible name including the section (not a bare "Set up →")', () => {
    renderPane('newbie', { newbie: newAnimal });
    const card = screen.getByRole('region', { name: /set up this animal/i });
    // A screen-reader links list must distinguish the actions, so the section is in the name.
    expect(within(card).getByRole('link', { name: /set up electrode groups/i })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /set up cameras/i })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /set up optogenetics/i })).toBeInTheDocument();
  });

  it('marks never-configured sections "To do" and configured sections done', () => {
    renderPane('remy', { remy: configuredAnimal });
    const card = screen.getByRole('region', { name: /set up this animal/i });
    // Cameras + electrodes are configured → not flagged todo; optogenetics is not configured.
    const cameras = within(card).getByText('Cameras').closest('.setup-card-item');
    const optogenetics = within(card).getByText('Optogenetics').closest('.setup-card-item');
    expect(cameras.className).not.toMatch(/setup-card-item-todo/);
    expect(optogenetics.className).toMatch(/setup-card-item-todo/);
  });

  it('marks a configured section "Needs fixing" (NOT "Done") when it holds an export-blocking error', () => {
    // The card and the section-nav must agree: a section that is present (so "Done" by mere
    // presence) but holds an export-BLOCKING error (red ● in the nav) must not read "Done" in the
    // card. Scenario: an under-configured animal (no subject → card shows) whose day pins a config
    // with an empty electrode-group location (an export-blocking error attributed to electrode-groups).
    const { animal, day } = buildRealisticWorkspace();
    animal.subject.subject_id = ''; // card shows despite the day
    // Present in the working devices → "Done" by presence...
    animal.devices.electrode_groups = [
      { id: 0, location: 'CA1', device_type: 'tetrode_12.5', targeted_location: 'CA1' },
    ];
    // ...but the day's PINNED config has the export-blocking empty location.
    animal.configurationHistory[0].devices.electrode_groups[0].location = '';
    renderPane('remy', { remy: animal }, { [day.id]: day });

    const card = screen.getByRole('region', { name: /set up this animal/i });
    const eg = within(card).getByText('Electrode Groups').closest('.setup-card-item');
    expect(within(eg).getByText(/needs fixing/i)).toBeInTheDocument();
    expect(within(eg).queryByText(/^done$/i)).not.toBeInTheDocument();
  });

  it('frames optional sections honestly (if ephys / if video), never as a gate', () => {
    renderPane('newbie', { newbie: newAnimal });
    const card = screen.getByRole('region', { name: /set up this animal/i });
    // "if ephys" applies to both Electrode Groups and Channel Maps.
    expect(within(card).getAllByText(/if ephys/i).length).toBeGreaterThan(0);
    expect(within(card).getByText(/if video/i)).toBeInTheDocument();
    // No "set up electrodes first" mandatory-gate language (behavior-only days are valid).
    expect(within(card).queryByText(/set up electrodes (first|before)/i)).not.toBeInTheDocument();
    expect(within(card).queryByText(/before (creating|exporting)/i)).not.toBeInTheDocument();
  });

  it('replaces the old "Animal setup" checklist region (no Set Up Electrodes link to the editor)', () => {
    renderPane('newbie', { newbie: newAnimal });
    expect(screen.queryByRole('region', { name: /^animal setup$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /set up electrodes/i })).not.toBeInTheDocument();
  });
});

describe('Set up this animal card — established animals (absent)', () => {
  it('hides the card once the animal has a subject AND at least one recording day', () => {
    const animal = { ...newAnimal, days: ['newbie-2024-01-02'] };
    const days = {
      'newbie-2024-01-02': { id: 'newbie-2024-01-02', animalId: 'newbie', date: '2024-01-02', session: { session_id: 's' }, state: {} },
    };
    renderPane('newbie', { newbie: animal }, days);
    expect(screen.queryByRole('region', { name: /set up this animal/i })).not.toBeInTheDocument();
  });

  it('still shows the card when days exist but the subject is missing (under-configured)', () => {
    const animal = { ...newAnimal, subject: {}, days: ['newbie-2024-01-02'] };
    const days = {
      'newbie-2024-01-02': { id: 'newbie-2024-01-02', animalId: 'newbie', date: '2024-01-02', session: { session_id: 's' }, state: {} },
    };
    renderPane('newbie', { newbie: animal }, days);
    expect(screen.getByRole('region', { name: /set up this animal/i })).toBeInTheDocument();
  });
});
