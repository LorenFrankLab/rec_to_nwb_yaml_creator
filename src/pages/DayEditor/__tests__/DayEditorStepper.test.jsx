import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import DayEditorStepper from '../DayEditorStepper';

import { useDayIdFromUrl } from '../../../hooks/useDayIdFromUrl';

// Mock the hook
vi.mock('../../../hooks/useDayIdFromUrl', () => ({
  useDayIdFromUrl: vi.fn(),
}));

describe('DayEditorStepper', () => {
  const mockAnimal = {
    id: 'remy',
    subject: {
      subject_id: 'remy',
      species: 'Rat',
      sex: 'M',
      genotype: 'WT',
      date_of_birth: '2023-01-01',
    },
    experimenters: {
      experimenter_name: ['John Doe'],
      lab: 'Test Lab',
      institution: 'Test Institution',
    },
    devices: {
      data_acq_device: [],
      device: { name: [] },
    },
    configurationHistory: [{
      version: 1,
      devices: {
        electrode_groups: [],
        ntrode_electrode_group_channel_map: [],
      },
    }],
    cameras: [],
  };

  const mockDay = {
    // Every production-created day carries its id + configurationVersion; the fixture must
    // too, or DevicesStep (which requires day.id) trips a prop-type warning on mount.
    id: 'remy-2023-06-22',
    configurationVersion: 1,
    date: '2023-06-22',
    animalId: 'remy',
    session: {
      session_id: 'remy_20230622',
      session_description: 'Day 45',
      experiment_description: '',
    },
    tasks: [],
    behavioral_events: [],
    associated_files: [],
    associated_video_files: [],
    technical: {
      times_period_multiplier: 1.5,
      raw_data_to_volts: 0.195,
      default_header_file_path: '',
      units: {},
    },
    state: {
      validationErrors: [],
    },
  };

  const mockInitialState = {
    workspace: {
      animals: {
        remy: mockAnimal,
      },
      days: {
        'remy-2023-06-22': mockDay,
      },
      settings: {},
    },
  };

  beforeEach(() => {
    useDayIdFromUrl.mockReturnValue('remy-2023-06-22');

    // Mock scrollIntoView (not implemented in JSDOM)
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('shows error when day not found', () => {
    useDayIdFromUrl.mockReturnValue('nonexistent-day');

    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    expect(screen.getByText(/Day not found/i)).toBeInTheDocument();
  });

  it('shows error when no dayId in URL', () => {
    useDayIdFromUrl.mockReturnValue(null);

    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    expect(screen.getByText(/No day ID provided/i)).toBeInTheDocument();
  });

  it('does not crash when the edited day\'s animal has a corrupt configurationHistory (merge throws by design)', () => {
    // mergeDayMetadata throws on a non-array configurationHistory; the stepper must
    // try/catch it and render the fail-closed editor (heading present) rather than crash.
    const corruptState = {
      ...mockInitialState,
      workspace: {
        ...mockInitialState.workspace,
        animals: { remy: { ...mockAnimal, configurationHistory: 'corrupt' } },
      },
    };

    expect(() =>
      render(
        <StoreProvider initialState={corruptState}>
          <DayEditorStepper />
        </StoreProvider>
      )
    ).not.toThrow();
    expect(screen.getByRole('heading', { name: /Day Editor:/i })).toBeInTheDocument();
  });

  it('renders header with animal and date', () => {
    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    expect(screen.getByText(/Day Editor: remy - 2023-06-22/i)).toBeInTheDocument();
  });

  it('renders step navigation', () => {
    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    expect(screen.getByRole('button', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Devices/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Epochs/i })).toBeInTheDocument();
  });

  it('renders OverviewStep by default', () => {
    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Session Metadata should be visible by default
    expect(screen.getByText('Session Metadata')).toBeInTheDocument();

    // Breadcrumb navigation should be present
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();

    // Inherited metadata should be hidden by default (can be expanded)
    expect(screen.queryByText('Subject Information')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inherited subject metadata/i })).toBeInTheDocument();
  });

  it('navigates between steps without emitting React warnings', async () => {
    const user = userEvent.setup();
    // The repair / fail-closed gate requires a clean console: a realistic day fixture
    // (with its id, as every production-created day has) must not trip a required-prop
    // warning when the Devices step mounts.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Click devices step
    const devicesButton = screen.getByRole('button', { name: /Devices/i });
    await user.click(devicesButton);

    // Should show devices stub
    expect(screen.getByText(/Devices Configuration/i)).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('computes step status from validation', () => {
    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Check that step navigation exists (status computed internally)
    const overviewButton = screen.getByRole('button', { name: /Overview/i });
    expect(overviewButton).toBeInTheDocument();
  });

  it('does not optimistically show "Saved" when a field is edited', async () => {
    const user = userEvent.setup();

    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Edit the first editable field in the Overview step.
    const field = screen.getAllByRole('textbox')[0];
    await user.type(field, 'x');

    // Real save status comes from the store's debounced autosave; the stepper must
    // not fake an immediate local "Saved" (the removed false-success pattern).
    expect(screen.queryByText(/^Saved /)).not.toBeInTheDocument();
  });

  it('renders back button to animal workspace', () => {
    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Check for back button
    const backButton = screen.getByRole('link', { name: /back to workspace/i });
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute('href', '#/workspace?animal=remy');
    expect(backButton.textContent).toContain('Back');
  });

  // Repair routing for a subject identity issue. The mock animal's species "Rat" is
  // free text (not a Latin binomial), so the Validation step shows a blocking
  // `invalid_species` error. The inherited subject fields ARE editable in the Day
  // Editor Overview step (Phase 5 made them repairable in place; the Animal Editor
  // has no subject step), so the repair routes to Overview, not the Animal Editor.
  it('routes an inherited subject-identity repair (species) to the Overview step', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/day/remy-2023-06-22';

    render(
      <StoreProvider initialState={mockInitialState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Go to the Validation step where blocking issues list their repair actions.
    await user.click(screen.getByRole('button', { name: /^Validation/i }));

    // The species issue (subject.species) offers a "Fix in Overview" button.
    const speciesIssue = screen.getByText(/Species "Rat" is not DANDI-valid/i);
    const speciesRepair = within(speciesIssue.closest('li')).getByRole('button', {
      name: /fix in overview/i,
    });
    await user.click(speciesRepair);

    // Stays in the Day Editor and lands on the Overview step (the editable owner),
    // not the Animal Editor.
    expect(window.location.hash).not.toBe('#/animal/remy/editor');
    expect(screen.getByRole('button', { name: /^Overview/i })).toHaveAttribute('aria-current', 'step');
  });

  // A corrupt/legacy import can persist a sibling day's `tasks` as a truthy
  // non-array (e.g. `{}`). The dataset-wide task_description scan must not assume
  // array-ness of that persisted shape — otherwise `.forEach` throws during render
  // and crashes the whole Day Editor BEFORE the fail-closed validation UI can
  // surface the corruption. (Medium)
  it('does not crash when a sibling day has a corrupt non-array tasks shape', () => {
    const corruptSiblingState = {
      workspace: {
        animals: { remy: mockAnimal },
        days: {
          'remy-2023-06-22': mockDay,
          // Sibling day with a truthy-but-not-array tasks (survives `tasks || []`).
          'remy-2023-06-23': {
            ...mockDay,
            date: '2023-06-23',
            session: { ...mockDay.session, session_id: 'remy_20230623' },
            tasks: {},
          },
        },
        settings: {},
      },
    };

    expect(() =>
      render(
        <StoreProvider initialState={corruptSiblingState}>
          <DayEditorStepper />
        </StoreProvider>
      )
    ).not.toThrow();

    // The editor renders normally for the valid current day.
    expect(screen.getByText(/Day Editor: remy - 2023-06-22/i)).toBeInTheDocument();
  });

  // Phase 2: a commandable corruption (raw-shape malformed_day_collection) renders an
  // EXECUTABLE reset button on the Validation step. Clicking it performs the documented
  // reset through the store (DayEditorStepper.onRepair → applyRepairCommand → updateDay),
  // so the corruption — and its button — clear in place rather than dead-ending on navigation.
  it('executes a raw-shape repair command in place (Reset tasks clears the corruption)', async () => {
    const user = userEvent.setup();
    const corruptState = {
      workspace: {
        animals: { remy: mockAnimal },
        days: { 'remy-2023-06-22': { ...mockDay, tasks: {} } },
        settings: {},
      },
    };

    render(
      <StoreProvider initialState={corruptState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Validation/i }));

    // The corrupt-tasks issue offers an executable "Reset tasks" button (not "Fix in …").
    const resetButton = screen.getByRole('button', { name: /^reset tasks$/i });
    await user.click(resetButton);

    // The reset wrote `tasks: []` through the store, so the corruption and its button are gone.
    expect(screen.queryByRole('button', { name: /^reset tasks$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/"tasks" is corrupt/i)).not.toBeInTheDocument();
  });

  it('executes an animal-collection repair command in place (Reset cameras clears the corruption)', async () => {
    const user = userEvent.setup();
    const corruptState = {
      workspace: {
        animals: { remy: { ...mockAnimal, cameras: 'nope' } },
        days: { 'remy-2023-06-22': mockDay },
        settings: {},
      },
    };

    render(
      <StoreProvider initialState={corruptState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Validation/i }));

    const resetButton = screen.getByRole('button', { name: /^reset cameras$/i });
    await user.click(resetButton);

    expect(screen.queryByRole('button', { name: /^reset cameras$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/"cameras" is corrupt/i)).not.toBeInTheDocument();
  });

  // Phase 2: a real animal whose configurationHistory is missing/empty resolves no day —
  // the merge throws and export fails closed. It must still be REPAIRABLE: a "Rebuild device
  // configuration history" button executes rebuildConfigurationHistory through the store,
  // reseeding a v1 snapshot from the animal's current devices, and the issue clears.
  it('executes a configurationHistory rebuild in place (missing history → Rebuild clears it)', async () => {
    const user = userEvent.setup();
    const brokenState = {
      workspace: {
        animals: { remy: { ...mockAnimal, configurationHistory: [] } },
        days: { 'remy-2023-06-22': mockDay },
        settings: {},
      },
    };

    render(
      <StoreProvider initialState={brokenState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Validation/i }));

    const rebuildButton = screen.getByRole('button', { name: /^rebuild device configuration history$/i });
    await user.click(rebuildButton);

    expect(
      screen.queryByRole('button', { name: /^rebuild device configuration history$/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/configuration history is missing or empty/i)).not.toBeInTheDocument();
  });

  // Phase 3: a malformed (non-record) day session loses its read-only session_id and
  // dead-ends. The Overview step shows an executable "Reset session" banner that restores
  // the canonical session_id through the store.
  it('executes a session reset in place (malformed session → Reset session clears it)', async () => {
    const user = userEvent.setup();
    const corruptState = {
      workspace: {
        animals: { remy: mockAnimal },
        days: { 'remy-2023-06-22': { ...mockDay, session: 'corrupt' } },
        settings: {},
      },
    };

    render(
      <StoreProvider initialState={corruptState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Overview is the default step; the banner is visible immediately.
    const resetButton = screen.getByRole('button', { name: /^reset session$/i });
    await user.click(resetButton);

    expect(screen.queryByRole('button', { name: /^reset session$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/session metadata is corrupt/i)).not.toBeInTheDocument();
  });

  it('does not offer a repair button for a slash session_id (read-only identity dead-end)', async () => {
    const user = userEvent.setup();

    // A session_id containing "/" is DANDI-invalid but derived from the (read-only)
    // subject id, so there is no in-app field to fix — the Validation step must show
    // the explanatory message WITHOUT a misleading "Fix in …" button.
    const slashState = {
      workspace: {
        animals: { remy: mockAnimal },
        days: {
          'remy-2023-06-22': {
            ...mockDay,
            session: { ...mockDay.session, session_id: 'remy/20230622' },
          },
        },
        settings: {},
      },
    };

    render(
      <StoreProvider initialState={slashState}>
        <DayEditorStepper />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Validation/i }));

    const slashIssue = screen.getByText(/Session ID "remy\/20230622" must not contain/i);
    expect(
      within(slashIssue.closest('li')).queryByRole('button', { name: /fix in/i })
    ).not.toBeInTheDocument();
  });
});
