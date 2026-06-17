/**
 * CreateAnimalWizard — the guided new-animal "deliberate setup" wizard.
 *
 * The wizard is a presentation layer over the EXISTING substrate: it commits identity through
 * `createAnimal`, then steps 2–7 edit the live animal record through the SAME store-bound wiring
 * containers the tabbed Animal View uses (ElectrodeGroups / Cameras / Optogenetics / TaskTypes /
 * RecordingSystem) — never a reimplementation. These tests drive the real store (StoreProvider)
 * and the real containers, so a reused-form assertion fails if a container is swapped for a fork.
 *
 * Outcome-based, not mock-based: "createAnimal was called" is proven by the animal becoming
 * reachable (its setup container renders / the store holds it), never by a spy on the store.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import CreateAnimalWizard from '../CreateAnimalWizard';

const originalHash = window.location.hash;
const wizardCss = readFileSync(
  join(process.cwd(), 'src/pages/Home/CreateAnimalWizard.module.css'),
  'utf8'
);

/**
 * Return a CSS rule body for a simple class selector.
 * @param {string} selector - Class selector, e.g. `.stepper`.
 * @returns {string} The declaration body, or an empty string when absent.
 */
function cssRule(selector) {
  const escapedSelector = selector.replace('.', '\\.');
  return wizardCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] || '';
}

afterEach(() => {
  window.location.hash = originalHash;
});

/** A probe that exposes the live workspace so a test can assert the committed store state. */
let captured;

/**
 * Render-only probe component that captures the live workspace into `captured`.
 * @returns {null} Renders nothing.
 */
function StoreProbe() {
  captured = useStoreContext().model.workspace;
  return null;
}

/**
 * Render the wizard against a fresh, empty store.
 * @param {object} [animals] - Initial workspace.animals (default: empty).
 * @returns {object} The render result.
 */
function renderWizard(animals = {}) {
  captured = null;
  return render(
    <StoreProvider initialState={{ workspace: { animals, days: {}, settings: {} } }}>
      <CreateAnimalWizard />
      <StoreProbe />
    </StoreProvider>
  );
}

/**
 * Fill the step-1 identity with a valid subject.
 * @param {object} user - The userEvent session.
 * @param {object} [root0] - Options.
 * @param {string} [root0.subjectId] - The subject id (default 'laurent').
 */
async function fillIdentity(user, { subjectId = 'laurent' } = {}) {
  await user.type(screen.getByRole('textbox', { name: /Subject ID/i }), subjectId);
  const weight = screen.getByLabelText(/Weight/i);
  await user.clear(weight);
  await user.type(weight, '450');
  // jsdom date inputs don't reliably accept segmented userEvent typing — set the value directly.
  fireEvent.change(screen.getByLabelText(/Date of Birth/i), { target: { value: '2025-01-02' } });
}

describe('CreateAnimalWizard — structure', () => {
  it('renders the 7-step tablist with Identity active', () => {
    renderWizard();
    const tablist = screen.getByRole('tablist', { name: /setup steps/i });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      expect.stringMatching(/Identity/),
      expect.stringMatching(/Electrodes/),
      expect.stringMatching(/Cameras/),
      expect.stringMatching(/Optogenetics/),
      expect.stringMatching(/Tasks/),
      expect.stringMatching(/Recording system/),
      expect.stringMatching(/Team/),
    ]);
    expect(within(tablist).getByRole('tab', { name: /Identity/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('keeps the 7-step tablist on a single scroll row', () => {
    renderWizard();
    const tablist = screen.getByTestId('wizard-stepper');
    expect(tablist).toHaveAttribute('data-layout', 'single-row-scroll');
    expect(within(tablist).getAllByRole('tab')).toHaveLength(7);
    expect(cssRule('.stepper')).toMatch(/display:\s*flex/);
    expect(cssRule('.stepper')).toMatch(/flex-wrap:\s*nowrap/);
    expect(cssRule('.stepper')).toMatch(/overflow-x:\s*auto/);
    expect(cssRule('.step')).toMatch(/flex:\s*0 0 auto/);
    expect(cssRule('.step')).toMatch(/white-space:\s*nowrap/);
  });

  it('shows the DANDI identity guidance (binomial species + single-letter sex)', () => {
    renderWizard();
    expect(screen.getByText(/Latin binomial/i)).toBeInTheDocument();
    expect(screen.getByText(/free text like/i)).toBeInTheDocument();
  });
});

describe('CreateAnimalWizard — step navigation + commit', () => {
  it('blocks Next on an invalid identity (no createAnimal, stays on Identity)', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /Next/i }));
    // Still on Identity; the animal was not created.
    expect(screen.getByRole('tab', { name: /Identity/ })).toHaveAttribute('aria-selected', 'true');
    expect(Object.keys(captured.animals)).toHaveLength(0);
    expect(screen.getByText(/Subject ID is required/i)).toBeInTheDocument();
  });

  it('creates the animal on the first advance and renders the REUSED electrode container', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillIdentity(user);
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // The animal now exists in the store (proves createAnimal committed)…
    expect(captured.animals.laurent).toBeTruthy();
    // …and the Electrodes step renders the real ElectrodeGroupsStep (not a reimplementation).
    expect(screen.getByRole('tab', { name: /Electrodes/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/No Electrode Groups Configured/i)).toBeInTheDocument();
  });

  it('Back returns to the Identity step', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillIdentity(user);
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Back/i }));
    expect(screen.getByRole('tab', { name: /Identity/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('offers a behavior-only skip on the Electrodes step', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillIdentity(user);
    await user.click(screen.getByRole('button', { name: /Next/i }));
    // The behavior-only affordance is present on the electrodes step.
    expect(screen.getByRole('button', { name: /behavior-only/i })).toBeInTheDocument();
  });

  it('reuses each setup container when its step is opened', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillIdentity(user);
    await user.click(screen.getByRole('button', { name: /Next/i })); // → Electrodes

    await user.click(screen.getByRole('tab', { name: /Cameras/ }));
    expect(screen.getByText(/No Cameras Configured/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Optogenetics/ }));
    expect(screen.getByText(/This animal has optogenetics/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Tasks/ }));
    expect(screen.getByText(/No Task Types Defined/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Recording system/ }));
    // The animal is seeded with the lab-standard rig, so DataAcqSection renders it (proves reuse).
    expect(screen.getAllByText('SpikeGadgets').length).toBeGreaterThan(0);
  });

  it('finishes on the Team step → navigates to the animal days route', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillIdentity(user);
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('tab', { name: /Team/ }));
    await user.click(screen.getByRole('button', { name: /Create animal/i }));
    expect(window.location.hash).toBe('#/animal/laurent/days');
  });

  it('Team step edits experimenters through updateAnimal', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillIdentity(user);
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('tab', { name: /Team/ }));

    const labField = screen.getByRole('textbox', { name: /^Lab/i });
    await user.clear(labField);
    await user.type(labField, 'Frank Lab');
    await user.tab();

    expect(captured.animals.laurent.experimenters.lab).toBe('Frank Lab');
  });
});

describe('CreateAnimalWizard — post-create identity edits (the fragile create-early invariants)', () => {
  /**
   * Create the animal then return to the Identity step for editing.
   * @param {object} user - The userEvent session.
   */
  async function createThenEditIdentity(user) {
    await fillIdentity(user);
    await user.click(screen.getByRole('button', { name: /Next/i })); // creates → Electrodes
    await user.click(screen.getByRole('tab', { name: /Identity/ }));
  }

  it('locks the subject_id (the store key) once the animal exists', async () => {
    const user = userEvent.setup();
    renderWizard();
    await createThenEditIdentity(user);
    expect(screen.getByRole('textbox', { name: /Subject ID/i })).toHaveAttribute('readonly');
  });

  it('persists a genotype edit through updateAnimal', async () => {
    const user = userEvent.setup();
    renderWizard();
    await createThenEditIdentity(user);
    const genotype = screen.getByRole('textbox', { name: /Genotype/i });
    await user.clear(genotype);
    await user.type(genotype, 'PV-Cre');
    await user.tab();
    expect(captured.animals.laurent.subject.genotype).toBe('PV-Cre');
  });

  it('persists a Sex change (the select must commit, not just update local state)', async () => {
    const user = userEvent.setup();
    renderWizard();
    await createThenEditIdentity(user);
    await user.selectOptions(screen.getByLabelText('Sex'), 'F');
    expect(captured.animals.laurent.subject.sex).toBe('F');
  });

  it('does NOT persist an invalid species (other + blank custom) — the whole draft must validate', async () => {
    const user = userEvent.setup();
    renderWizard();
    await createThenEditIdentity(user);
    // Switch to a custom species but leave it blank → the draft is invalid; the prior valid
    // species must be kept (never overwritten with an empty string).
    await user.selectOptions(screen.getByLabelText('Species'), 'other');
    await user.tab();
    expect(captured.animals.laurent.subject.species).not.toBe('');
    expect(captured.animals.laurent.subject.species).toBe('Rattus norvegicus');
  });

  it('surfaces the error and BLOCKS navigation when a post-create identity edit is invalid (no silent drop)', async () => {
    const user = userEvent.setup();
    renderWizard();
    await createThenEditIdentity(user);
    await user.selectOptions(screen.getByLabelText('Species'), 'other'); // custom left blank → invalid
    await user.click(screen.getByRole('button', { name: /Next/i }));
    // The user's invalid edit is not silently dropped: the wizard stays on Identity and surfaces
    // the error, rather than navigating on with the edit lost.
    expect(screen.getByRole('tab', { name: /Identity/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Custom species name is required/i)).toBeInTheDocument();
  });

  it('lets a VALID post-create edit advance (the locked subject_id must not self-collision-block)', async () => {
    const user = userEvent.setup();
    renderWizard();
    await createThenEditIdentity(user);
    const genotype = screen.getByRole('textbox', { name: /Genotype/i });
    await user.clear(genotype);
    await user.type(genotype, 'scn2a');
    await user.click(screen.getByRole('button', { name: /Next/i }));
    // Advances to the next step (the self-collision against the just-created animal must be excluded),
    // and the edit is persisted.
    expect(screen.getByRole('tab', { name: /Electrodes/ })).toHaveAttribute('aria-selected', 'true');
    expect(captured.animals.laurent.subject.genotype).toBe('scn2a');
  });
});

describe('CreateAnimalWizard — Team step', () => {
  /**
   * Create the animal and open the Team step.
   * @param {object} user - The userEvent session.
   */
  async function createThenOpenTeam(user) {
    await fillIdentity(user);
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('tab', { name: /Team/ }));
  }

  it('persists removing an experimenter immediately (not only when another field commits)', async () => {
    const user = userEvent.setup();
    renderWizard();
    await createThenOpenTeam(user);

    await user.type(screen.getByRole('textbox', { name: /Experimenter 1/ }), 'Doe, Jane');
    await user.click(screen.getByRole('button', { name: /Add experimenter/i }));
    await user.type(screen.getByRole('textbox', { name: /Experimenter 2/ }), 'Roe, Rick');
    await user.tab(); // commit both

    await user.click(screen.getByRole('button', { name: /Remove experimenter 2/i }));
    expect(captured.animals.laurent.experimenters.experimenter_name).toEqual(['Doe, Jane']);
  });
});

describe('CreateAnimalWizard — Save draft', () => {
  it('creates the animal and navigates to its days (a valid-but-partial draft persists)', async () => {
    const user = userEvent.setup();
    renderWizard();
    await fillIdentity(user);
    await user.click(screen.getByRole('button', { name: /Save draft/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/draft saved/i);
    expect(captured.animals.laurent).toBeTruthy();
    await waitFor(() => expect(window.location.hash).toBe('#/animal/laurent/days'));
  });

  it('blocks Save draft on an invalid identity', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /Save draft/i }));
    expect(Object.keys(captured.animals)).toHaveLength(0);
    expect(screen.getByText(/Subject ID is required/i)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('CreateAnimalWizard — adopt handshake (#/home?animal=<id>)', () => {
  it('continues an existing animal: identity is seeded + locked, the setup is the live record', () => {
    window.location.hash = '#/home?animal=emmett';
    renderWizard({
      emmett: {
        id: 'emmett',
        subject: {
          subject_id: 'emmett',
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'PV-Cre',
          date_of_birth: '2023-01-01T00:00:00',
          weight: 450,
          description: 'PV-Cre rat',
        },
        devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
        days: [],
        configurationHistory: [{ version: 1, devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] }],
      },
    });

    const subjectInput = screen.getByLabelText(/Subject ID/i);
    expect(subjectInput).toHaveValue('emmett');
    // The animal already exists, so its store-key subject_id is locked.
    expect(subjectInput).toHaveAttribute('readonly');
    // Identity is seeded from the adopted animal.
    expect(screen.getByLabelText(/Species/i)).toHaveValue('Rattus norvegicus');
  });
});

describe('CreateAnimalWizard — alternate start options', () => {
  it('offers import + copy start options that route to their full-page screens', () => {
    renderWizard();
    expect(screen.getByRole('link', { name: /Import a YAML/i })).toHaveAttribute('href', '#/import');
    expect(screen.getByRole('link', { name: /Copy from another animal/i })).toHaveAttribute(
      'href',
      '#/copy-from-animal'
    );
  });
});
