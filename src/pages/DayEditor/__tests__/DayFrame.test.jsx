import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import DayEditorFrame from '../DayEditorFrame';

import { useDayIdFromUrl } from '../../../hooks/useDayIdFromUrl';
import { emitStepperShortcut } from '../../../hooks/stepperShortcuts';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

// Mock the day-id hook so each test drives the routed day.
vi.mock('../../../hooks/useDayIdFromUrl', () => ({
  useDayIdFromUrl: vi.fn(),
}));

describe('DayEditorFrame', () => {
  const mockAnimal = {
    id: 'remy',
    subject: { subject_id: 'remy', species: 'Rat', sex: 'M', genotype: 'WT', date_of_birth: '2023-01-01' },
    experimenters: { experimenter_name: ['John Doe'], lab: 'Test Lab', institution: 'Test Institution' },
    devices: { data_acq_device: [], device: { name: [] } },
    configurationHistory: [{ version: 1, devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] } }],
    cameras: [],
    days: ['remy-2023-06-22'],
  };

  const mockDay = {
    id: 'remy-2023-06-22',
    configurationVersion: 1,
    date: '2023-06-22',
    animalId: 'remy',
    session: { session_id: 'remy_20230622', session_description: 'Day 45', experiment_description: '' },
    tasks: [],
    behavioral_events: [],
    associated_files: [],
    associated_video_files: [],
    technical: { times_period_multiplier: 1.5, raw_data_to_volts: 0.195, default_header_file_path: '', units: {} },
    state: { validationErrors: [] },
  };

  const mockInitialState = {
    workspace: { animals: { remy: mockAnimal }, days: { 'remy-2023-06-22': mockDay }, settings: {} },
  };

  // A known export-ready day+animal (the realistic fixture — its download is enabled, so validateDay
  // returns no blocking errors) for the readiness-quiet path.
  const validState = (() => {
    const { animal, day } = buildRealisticWorkspace();
    return { workspace: { animals: { [animal.id]: animal }, days: { [day.id]: day }, settings: {} }, dayId: day.id };
  })();

  const renderFrame = (state = mockInitialState) =>
    render(
      <StoreProvider initialState={state}>
        <DayEditorFrame />
      </StoreProvider>
    );

  beforeEach(() => {
    useDayIdFromUrl.mockReturnValue('remy-2023-06-22');
    Element.prototype.scrollIntoView = vi.fn();
  });

  // ── Shell / owner resolution (preserved from the former stepper) ──
  it('shows error when day not found', () => {
    useDayIdFromUrl.mockReturnValue('nonexistent-day');
    renderFrame();
    expect(screen.getByText(/Day not found/i)).toBeInTheDocument();
  });

  it('shows error when no dayId in URL', () => {
    useDayIdFromUrl.mockReturnValue(null);
    renderFrame();
    expect(screen.getByText(/No day ID provided/i)).toBeInTheDocument();
  });

  it('does not resolve a present-but-unresolvable animalId via the indexing animal (no wrong-owner edit)', () => {
    renderFrame({
      workspace: {
        animals: { remy: { ...mockAnimal, days: ['remy-2023-06-22'] } },
        days: { 'remy-2023-06-22': { ...mockDay, animalId: 'ghost' } },
        settings: {},
      },
    });
    expect(screen.getByText(/Animal not found: ghost/i)).toBeInTheDocument();
    expect(screen.queryByText(/Day Editor: remy/i)).not.toBeInTheDocument();
  });

  it('does not resolve a non-string (object) animalId via key coercion', () => {
    renderFrame({
      workspace: {
        animals: { remy: { ...mockAnimal, days: ['remy-2023-06-22'] } },
        days: { 'remy-2023-06-22': { ...mockDay, animalId: { not: 'a string' } } },
        settings: {},
      },
    });
    expect(screen.getByText(/Animal not found: another animal \(unreadable id\)/i)).toBeInTheDocument();
  });

  it('resolves a day with no animalId via the indexing animal (recovered-day recovery)', () => {
    const recoveredDay = { ...mockDay };
    delete recoveredDay.animalId;
    renderFrame({
      workspace: {
        animals: { remy: { ...mockAnimal, days: ['remy-2023-06-22'] } },
        days: { 'remy-2023-06-22': recoveredDay },
        settings: {},
      },
    });
    expect(screen.getByRole('heading', { level: 1, name: /Day Editor: remy - 2023-06-22/i })).toBeInTheDocument();
  });

  it('does not crash when the animal has a corrupt configurationHistory (merge throws by design)', () => {
    expect(() =>
      renderFrame({
        ...mockInitialState,
        workspace: { ...mockInitialState.workspace, animals: { remy: { ...mockAnimal, configurationHistory: 'corrupt' } } },
      })
    ).not.toThrow();
    expect(screen.getByRole('heading', { level: 1, name: /Day Editor:/i })).toBeInTheDocument();
  });

  it('clears first-run validation deferral on open so real blockers surface', async () => {
    const { animal, day } = buildRealisticWorkspace();
    day.tasks = 'not-an-array';
    day.state = { draft: true, validated: false, exported: false, validationDeferred: true };
    useDayIdFromUrl.mockReturnValue(day.id);
    renderFrame({
      workspace: { animals: { [animal.id]: animal }, days: { [day.id]: day }, settings: {} },
    });

    await waitFor(() => expect(screen.getByText(/issues? block export/i)).toBeInTheDocument());
  });

  it('renders the level-1 heading with animal and date', () => {
    renderFrame();
    expect(screen.getByRole('heading', { level: 1, name: /Day Editor: remy - 2023-06-22/i })).toBeInTheDocument();
  });

  // ── Header: breadcrumb, scope card, chips, autosave ──
  it('renders the breadcrumb in the header (shared by all tabs), routing Animal to the animal view', () => {
    renderFrame();
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Animal: remy/i })).toHaveAttribute('href', '#/animal/remy/days');
  });

  it('renders the read-only animal scope card with an Edit animal setup link', () => {
    renderFrame();
    const scope = screen.getByRole('complementary', { name: /animal setup/i });
    expect(within(scope).getByRole('link', { name: /edit animal setup/i })).toHaveAttribute('href', '#/animal/remy/days');
  });

  it('renders the day configuration chip', () => {
    renderFrame();
    expect(screen.getByText(/Configuration v1/i)).toBeInTheDocument();
  });

  it('does not optimistically show "Saved" when a field is edited', async () => {
    const user = userEvent.setup();
    renderFrame();
    const field = screen.getAllByRole('textbox')[0];
    await user.type(field, 'x');
    expect(screen.queryByText(/^Saved /)).not.toBeInTheDocument();
  });

  // ── Readiness bar (issue-driven, from validateDay) ──
  it('readiness bar is loud with per-issue Fix actions when the day has blocking errors', () => {
    // The mock animal's species "Rat" is not DANDI-valid → a blocking error.
    renderFrame();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/issue(s)? block export/i);
    expect(within(alert).getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('readiness bar is quiet ("Ready to export") when nothing blocks', () => {
    useDayIdFromUrl.mockReturnValue(validState.dayId);
    renderFrame({ workspace: validState.workspace });
    expect(screen.getByText(/ready to export/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a non-actionable blocking issue (slash session_id) with its message but no dead Fix button', () => {
    // A slash in the derived session_id is DANDI-invalid but read-only (no in-app field to fix), so
    // the readiness bar must surface the message WITHOUT a dead "Fix" button (repairSurface 'none').
    renderFrame({
      workspace: {
        animals: { remy: mockAnimal },
        days: {
          'remy-2023-06-22': { ...mockDay, session: { ...mockDay.session, session_id: 'remy/20230622' } },
        },
        settings: {},
      },
    });
    const slashMsg = screen.getByText(/Session ID "remy\/20230622" must not contain/i);
    expect(within(slashMsg.closest('li')).queryByRole('button')).not.toBeInTheDocument();
  });

  // ── Grouped vertical rail ──
  it('renders the grouped vertical rail with the five mock sections', () => {
    renderFrame();
    const nav = screen.getByRole('navigation', { name: /day editor sections/i });
    expect(within(nav).getByText('SESSION')).toBeInTheDocument();
    expect(within(nav).getByText('RECORDING')).toBeInTheDocument();
    expect(within(nav).getByText('FINISH')).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /^Overview/ })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /^Files & Weight/ })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /^Devices & Failed Channels/ })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /^Tasks & Epochs/ })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /^Validation & Export/ })).toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: /^DIO/ })).not.toBeInTheDocument();
  });

  it('folds each tab status label into the accessible name', () => {
    renderFrame();
    const nav = screen.getByRole('navigation', { name: /day editor sections/i });
    expect(within(nav).getByRole('button', { name: /Overview.*Has errors/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /Tasks & Epochs.*Incomplete/i })).toBeInTheDocument();
  });

  it('opens on Overview and freely navigates to any section on click', async () => {
    const user = userEvent.setup();
    renderFrame();
    expect(screen.getByRole('button', { name: /^Overview/ })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: /^Devices & Failed Channels/ }));
    expect(screen.getByRole('heading', { level: 2, name: /Devices & Failed Channels/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /behavioral events/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Devices & Failed Channels/ })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: /^Tasks & Epochs/ }));
    expect(screen.getByRole('button', { name: /^Tasks & Epochs/ })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: /^Files & Weight/ }));
    expect(screen.getByRole('heading', { level: 2, name: /Files & Weight/i })).toBeInTheDocument();
  });

  it('steps tabs with the Alt+→ / Alt+← keyboard shortcuts', () => {
    renderFrame();
    act(() => emitStepperShortcut('next')); // overview → files
    expect(screen.getByRole('button', { name: /^Files & Weight/ })).toHaveAttribute('aria-current', 'page');
    act(() => emitStepperShortcut('next')); // → devices
    expect(screen.getByRole('button', { name: /^Devices & Failed Channels/ })).toHaveAttribute('aria-current', 'page');
    act(() => emitStepperShortcut('prev')); // → files
    expect(screen.getByRole('button', { name: /^Files & Weight/ })).toHaveAttribute('aria-current', 'page');
  });

  it('CLAMPS the Alt+ tab stepping at both ends (does not wrap)', () => {
    renderFrame();
    expect(screen.getByRole('button', { name: /^Overview/ })).toHaveAttribute('aria-current', 'page');
    act(() => emitStepperShortcut('prev'));
    expect(screen.getByRole('button', { name: /^Overview/ })).toHaveAttribute('aria-current', 'page');

    // Step to the last section, then Alt+→ stays there.
    for (let i = 0; i < 5; i += 1) act(() => emitStepperShortcut('next'));
    expect(screen.getByRole('button', { name: /^Validation & Export/ })).toHaveAttribute('aria-current', 'page');
    act(() => emitStepperShortcut('next'));
    expect(screen.getByRole('button', { name: /^Validation & Export/ })).toHaveAttribute('aria-current', 'page');
  });

  it('routes to the owning tab when arriving with a ?field= repair deep-link', async () => {
    // A cross-day batch "Fix in …" link lands on #/day/:id?field=<field>; behavioral events now
    // fold into the recording section.
    const originalHash = window.location.hash;
    window.location.hash = '#/day/remy-2023-06-22?field=behavioral_events';
    try {
      renderFrame();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /^Devices & Failed Channels/ })).toHaveAttribute('aria-current', 'page')
      );
    } finally {
      window.location.hash = originalHash;
    }
  });

  it('re-routes on a same-day query-only hash change (already on the day, a batch Fix click)', async () => {
    // A batch "Fix in …" link for the CURRENT day changes ONLY the hash query (the day id is unchanged),
    // so useDayIdFromUrl reports the same id and the routing must still fire — otherwise the user is left
    // on the Export panel instead of the target tab.
    const originalHash = window.location.hash;
    window.location.hash = '#/day/remy-2023-06-22';
    try {
      renderFrame();
      expect(screen.getByRole('button', { name: /^Overview/ })).toHaveAttribute('aria-current', 'page');

      await act(async () => {
        window.location.hash = '#/day/remy-2023-06-22?step=behavioral&field=behavioral_events';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /^Devices & Failed Channels/ })).toHaveAttribute('aria-current', 'page')
      );
    } finally {
      window.location.hash = originalHash;
    }
  });

  it('prefers an explicit ?step= over field-name inference when routing a deep-link', async () => {
    // unpinned_configuration routes to step `devices` but focuses `configurationVersion` — a field that
    // alone infers the `validation` catch-all. The explicit step must win → Devices section.
    const originalHash = window.location.hash;
    window.location.hash = '#/day/remy-2023-06-22?field=configurationVersion&step=devices';
    try {
      renderFrame();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /^Devices & Failed Channels/ })).toHaveAttribute('aria-current', 'page')
      );
    } finally {
      window.location.hash = originalHash;
    }
  });

  it('moves focus to the panel (#main-content) on a tab change', async () => {
    const user = userEvent.setup();
    renderFrame();
    const main = document.getElementById('main-content');
    expect(main).not.toHaveFocus(); // initial mount does not steal focus
    await user.click(screen.getByRole('button', { name: /^Devices & Failed Channels/ }));
    expect(main).toHaveFocus();
  });

  // ── Export-preview surface (revealed by the header Export action) ──
  it('reveals the export-preview surface via the header Export action, with the download disabled while invalid', async () => {
    const user = userEvent.setup();
    renderFrame();
    await user.click(screen.getByRole('button', { name: /^Export$/ }));
    expect(screen.getByRole('heading', { name: /Export — 2023-06-22/ })).toBeInTheDocument();
    // The mock animal's species "Rat" is not DANDI-valid → the export gate blocks the download.
    expect(screen.getByRole('button', { name: /^Download$/ })).toBeDisabled();
  });

  // ── Repair flows (executable repairs surface on the readiness bar / Overview section) ──
  it('executes a raw-shape repair from the readiness bar (Reset tasks clears the corruption)', async () => {
    const user = userEvent.setup();
    renderFrame({
      workspace: { animals: { remy: mockAnimal }, days: { 'remy-2023-06-22': { ...mockDay, tasks: {} } }, settings: {} },
    });
    const reset = screen.getByRole('button', { name: /^reset tasks$/i });
    await user.click(reset);
    expect(screen.queryByRole('button', { name: /^reset tasks$/i })).not.toBeInTheDocument();
  });

  it('executes a configurationHistory rebuild from the readiness bar (missing history → Rebuild clears it)', async () => {
    const user = userEvent.setup();
    renderFrame({
      workspace: { animals: { remy: { ...mockAnimal, configurationHistory: [] } }, days: { 'remy-2023-06-22': mockDay }, settings: {} },
    });
    const rebuild = screen.getByRole('button', { name: /^rebuild device configuration history$/i });
    await user.click(rebuild);
    expect(screen.queryByRole('button', { name: /^rebuild device configuration history$/i })).not.toBeInTheDocument();
  });

  it('executes a session reset in place from Overview (malformed session → Reset session clears it)', async () => {
    const user = userEvent.setup();
    renderFrame({
      workspace: { animals: { remy: mockAnimal }, days: { 'remy-2023-06-22': { ...mockDay, session: 'corrupt' } }, settings: {} },
    });
    // Overview is the default; its RawCorruptionBanner offers the reset. (The readiness bar also
    // surfaces a "Reset session" fix for the same blocker, so scope to the panel.)
    const panel = document.getElementById('main-content');
    const reset = within(panel).getByRole('button', { name: /^reset session$/i });
    await user.click(reset);
    expect(within(panel).queryByRole('button', { name: /^reset session$/i })).not.toBeInTheDocument();
  });
});
