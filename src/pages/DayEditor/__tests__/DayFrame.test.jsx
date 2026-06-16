import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
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

  // ── 4-tab bar ──
  it('renders exactly the four tabs Day / Epochs / Failed channels / DIO', () => {
    renderFrame();
    const nav = screen.getByRole('navigation', { name: /day editor sections/i });
    expect(within(nav).getByRole('button', { name: 'Day' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Epochs' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Failed channels' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'DIO' })).toBeInTheDocument();
  });

  it('opens on the Day tab and freely navigates to any tab on click', async () => {
    const user = userEvent.setup();
    renderFrame();
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Failed channels' }));
    expect(screen.getByText(/Setup & Failed Channels/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Failed channels' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Epochs' }));
    expect(screen.getByRole('button', { name: 'Epochs' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'DIO' }));
    expect(screen.getByRole('heading', { level: 2, name: /behavioral events/i })).toBeInTheDocument();
  });

  it('cycles tabs with the Alt+→ / Alt+← keyboard shortcuts', () => {
    renderFrame();
    act(() => emitStepperShortcut('next')); // day → epochs
    expect(screen.getByRole('button', { name: 'Epochs' })).toHaveAttribute('aria-current', 'page');
    act(() => emitStepperShortcut('next')); // → channels
    expect(screen.getByRole('button', { name: 'Failed channels' })).toHaveAttribute('aria-current', 'page');
    act(() => emitStepperShortcut('prev')); // → epochs
    expect(screen.getByRole('button', { name: 'Epochs' })).toHaveAttribute('aria-current', 'page');
  });

  it('moves focus to the panel (#main-content) on a tab change', async () => {
    const user = userEvent.setup();
    renderFrame();
    const main = document.getElementById('main-content');
    expect(main).not.toHaveFocus(); // initial mount does not steal focus
    await user.click(screen.getByRole('button', { name: 'Failed channels' }));
    expect(main).toHaveFocus();
  });

  // ── Transitional Export affordance (ExportStep kept until Phase 5) ──
  it('reveals the kept Export step via the header Export action, with the download disabled while invalid', async () => {
    const user = userEvent.setup();
    renderFrame();
    await user.click(screen.getByRole('button', { name: /^Export$/ }));
    expect(screen.getByRole('heading', { name: /Export YAML/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download yaml/i })).toBeDisabled();
  });

  // ── Repair flows (executable repairs surface on the readiness bar / Day tab) ──
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

  it('executes a session reset in place from the Day tab (malformed session → Reset session clears it)', async () => {
    const user = userEvent.setup();
    renderFrame({
      workspace: { animals: { remy: mockAnimal }, days: { 'remy-2023-06-22': { ...mockDay, session: 'corrupt' } }, settings: {} },
    });
    // The Day tab is the default; its RawCorruptionBanner offers the reset. (The readiness bar also
    // surfaces a "Reset session" fix for the same blocker, so scope to the panel.)
    const panel = document.getElementById('main-content');
    const reset = within(panel).getByRole('button', { name: /^reset session$/i });
    await user.click(reset);
    expect(within(panel).queryByRole('button', { name: /^reset session$/i })).not.toBeInTheDocument();
  });
});
