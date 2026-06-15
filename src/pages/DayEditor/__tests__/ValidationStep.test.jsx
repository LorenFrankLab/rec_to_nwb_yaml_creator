import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ValidationStep from '../ValidationStep';
import { buildDayEditorViewModel, toIssueViewModel } from '../../../viewModels/dayEditorViewModel';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

// Phase 3-f: ValidationStep renders the day-editor view-model's classified issue list (`vm.issues`)
// and export gate (`vm.export`). List-rendering tests build issue inputs from REAL validator codes via
// the real builder (`toIssueViewModel`) so the code → render pipeline is exercised; readiness tests
// build the real view-model (`buildDayEditorViewModel`) so the authoritative gate is exercised.
//
// The Info severity bucket is gone: validateDay never emits `info`, so the view-model surfaces only
// `error`/`warning` issues; an unexpected severity is mapped to a blocking error (fail-safe), not
// silently dropped.
const ISSUE = (raw) => toIssueViewModel(raw, 'remy-2023-06-22', 'remy');
const BLOCKED = { open: false, blockingIssues: [], blockingSteps: [], message: '', action: { label: 'Download YAML' } };

// Build the day-editor view-model for the realistic fixture, with an optional day/animal mutation.
const realisticVm = (mutate) => {
  const { animal, day } = buildRealisticWorkspace();
  if (mutate) mutate(animal, day);
  return buildDayEditorViewModel({ animals: { [animal.id]: animal }, days: { [day.id]: day } }, day.id);
};

describe('ValidationStep', () => {
  it('renders safely when the optional animal prop is omitted', () => {
    // `animal` is optional (it arrives via the DayEditorContext bundle, or is absent in an isolated
    // render). Rendering without it must not throw — guarded by the body's `animal?.id`.
    expect(() => render(<ValidationStep day={{}} mergedDay={{}} />)).not.toThrow();
  });

  it('renders each issue under its severity heading with message and path', () => {
    render(
      <ValidationStep
        issues={[
          ISSUE({ severity: 'error', path: 'session_id', code: 'required', message: 'session_id is required' }),
          ISSUE({ severity: 'warning', path: 'tasks[0].task_epochs', code: 'epoch_overlap', message: 'epochs overlap' }),
        ]}
        exportGate={BLOCKED}
      />
    );

    expect(screen.getByRole('heading', { name: /error/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /warning/i })).toBeInTheDocument();

    // The view-model humanizes the display message (leading snake_case field token sentence-cased).
    expect(screen.getByText('Session id is required')).toBeInTheDocument();
    expect(screen.getByText('epochs overlap')).toBeInTheDocument();

    // Paths are shown alongside their messages.
    expect(screen.getByText('tasks[0].task_epochs')).toBeInTheDocument();
  });

  it('groups issues by user workflow category, not by editor step', () => {
    render(
      <ValidationStep
        issues={[
          ISSUE({ severity: 'error', code: 'empty_location', path: 'electrode_groups[0].location', message: 'location is empty' }),
          ISSUE({ severity: 'error', code: 'duplicate_task_epoch', path: 'tasks[0].task_epochs', message: 'duplicate epoch' }),
          ISSUE({ severity: 'error', code: 'bad_channel_out_of_range', path: 'ntrode_electrode_group_channel_map[0].bad_channels', message: 'channel 9 out of range' }),
        ]}
        exportGate={BLOCKED}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /animal setup/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^day metadata$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /day-specific failed channels/i })).toBeInTheDocument();
  });

  it('shows the ownership-pattern hint (and cross-day reach) next to errors (Task 9)', () => {
    render(
      <ValidationStep
        issues={[ISSUE({ severity: 'error', code: 'empty_location', path: 'electrode_groups[0].location', message: 'location is empty' })]}
        exportGate={BLOCKED}
        onNavigate={vi.fn()}
      />
    );

    // The probe/location error names the configuration-version ownership and flags that fixing it
    // reaches past this day — without changing the workflow-category grouping or the repair route.
    expect(screen.getByText('Pin or fix the configuration version')).toBeInTheDocument();
    expect(screen.getByText(/affects more than this day/i)).toBeInTheDocument();
  });

  it('suppresses the ownership-pattern hint for non-blocking warnings (Task 9)', () => {
    // A warning carries its own specific advice and no repair button; the generic pattern action
    // and the emphasized cross-day cue would be noise (and could contradict the advisory).
    render(
      <ValidationStep
        issues={[ISSUE({ severity: 'warning', code: 'inconsistent_location_case', path: 'electrode_groups[0].location', message: 'location capitalization is inconsistent' })]}
        exportGate={BLOCKED}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('location capitalization is inconsistent')).toBeInTheDocument();
    expect(screen.queryByText('Pin or fix the configuration version')).not.toBeInTheDocument();
    expect(screen.queryByText(/affects more than this day/i)).not.toBeInTheDocument();
  });

  it('shows a blocked indicator and an error count when errors exist', () => {
    render(
      <ValidationStep
        issues={[
          ISSUE({ severity: 'error', path: 'session_id', code: 'required', message: 'required' }),
          ISSUE({ severity: 'warning', path: 'cameras', code: 'w', message: 'a warning' }),
        ]}
        exportGate={BLOCKED}
      />
    );

    expect(screen.getByText(/1 error/i)).toBeInTheDocument();
    expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();
  });

  it('shows a ready indicator only when the REAL export gate is open (all steps valid)', () => {
    // A fully-configured, fully-valid day passes the export gate. The realistic fixture day is
    // live-valid but NOT persisted-validated (state.draft), so it reads "Ready to export".
    const vm = realisticVm();
    render(<ValidationStep issues={vm.issues} exportGate={vm.export} />);
    expect(screen.getByText(/ready to export/i)).toBeInTheDocument();
  });

  it('reads a persisted-validated day as "Validated" (saved), distinct from live "Ready to export"', () => {
    const vm = realisticVm((animal, day) => {
      day.state = { draft: false, validated: true, exported: false };
    });
    render(<ValidationStep issues={vm.issues} exportGate={vm.export} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/Validated/);
    expect(status).toHaveTextContent(/saved/i);
    expect(status).not.toHaveTextContent(/Ready to export/);
  });

  it('reads an exported day as "Exported" while all checks still pass', () => {
    const vm = realisticVm((animal, day) => {
      day.state = { draft: false, validated: true, exported: true };
    });
    render(<ValidationStep issues={vm.issues} exportGate={vm.export} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/Exported/);
    expect(status).toHaveTextContent(/all checks (still )?pass/i);
  });

  it('does NOT say ready when there are zero errors but a prerequisite step is incomplete', () => {
    // Zero errors, but the gate is closed by an incomplete prerequisite step.
    render(<ValidationStep issues={[]} exportGate={BLOCKED} />);
    expect(screen.queryByText(/ready to export/i)).not.toBeInTheDocument();
    expect(screen.getByText(/complete the required steps/i)).toBeInTheDocument();
  });

  it('renders without throwing when mergedDay is undefined', () => {
    expect(() => render(<ValidationStep mergedDay={undefined} />)).not.toThrow();
  });

  it('surfaces an issue with an unexpected severity (treated as a blocking error) rather than dropping it', () => {
    render(
      <ValidationStep
        issues={[ISSUE({ severity: undefined, path: 'cameras', code: 'odd', message: 'unclassified issue' })]}
        exportGate={BLOCKED}
      />
    );

    // The view-model maps an unknown severity to a blocking error (fail-safe), so it surfaces under Errors.
    expect(screen.getByRole('heading', { name: /error/i })).toBeInTheDocument();
    expect(screen.getByText('unclassified issue')).toBeInTheDocument();
  });

  it('routes a day-surface error (session) to the owning Day-Editor step with the field target', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <ValidationStep
        issues={[ISSUE({ severity: 'error', path: 'session_description', code: 'required', message: 'session description is required' })]}
        exportGate={BLOCKED}
        onNavigate={onNavigate}
      />
    );

    await user.click(screen.getByRole('button', { name: /fix in overview/i }));
    expect(onNavigate).toHaveBeenCalledWith('overview', 'session_description');
  });

  it('routes an animal-surface error (device geometry) to the Animal Editor', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <ValidationStep
        issues={[ISSUE({ severity: 'error', path: 'electrode_groups[0].targeted_x', code: 'type', message: 'must be number' })]}
        exportGate={BLOCKED}
        animal={{ id: 'remy' }}
        onNavigate={onNavigate}
      />
    );

    // The button names the Animal Editor (the editable owner), not the Devices step.
    await user.click(screen.getByRole('button', { name: /fix in animal setup/i }));
    expect(screen.queryByRole('button', { name: /fix in devices/i })).not.toBeInTheDocument();
    expect(onNavigate).toHaveBeenCalledWith('animal', 'electrode_groups[0].targeted_x');
  });

  it('does not render repair actions for non-error issues', () => {
    render(
      <ValidationStep
        issues={[ISSUE({ severity: 'warning', path: 'cameras', code: 'w', message: 'a warning' })]}
        exportGate={BLOCKED}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /fix in/i })).not.toBeInTheDocument();
  });

  it('surfaces real validation errors computed from the merged metadata', () => {
    // A complete realistic day validates clean; drop a required animal field so the merge omits it,
    // producing a real schema error — proving the view-model validates the merged model.
    const vm = realisticVm((animal) => {
      delete animal.experimenters.lab;
    });
    render(<ValidationStep issues={vm.issues} exportGate={vm.export} />);

    // The raw AJV "must have required property 'lab'" is humanized at the builder ("Lab is required").
    expect(screen.getByText('Lab is required')).toBeInTheDocument();
    expect(screen.queryByText(/must have required property/i)).not.toBeInTheDocument();
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();
  });

  it('surfaces the cross-day bad-channel monotonicity block (and is NOT "ready")', () => {
    // The Validation summary must reflect the SAME export gate the Export step enforces. A day that
    // silently un-fails an earlier same-config bad channel is export-blocked — the block exists
    // relative to the animal's OTHER days, so the view-model is built over the full animal index.
    const { animal, day: day1 } = buildRealisticWorkspace();
    day1.deviceOverrides = { bad_channels: { 1: [2] } }; // ntrode 1, channel 2 bad on the earlier day
    const day2 = structuredClone(day1);
    day2.id = 'remy-2023-06-23';
    day2.date = '2023-06-23';
    day2.experimentDate = '06232023';
    day2.deviceOverrides = { bad_channels: { 1: [] } }; // later day silently un-fails it (no ack)
    animal.days = [day1.id, day2.id];
    const vm = buildDayEditorViewModel(
      { animals: { [animal.id]: animal }, days: { [day1.id]: day1, [day2.id]: day2 } },
      day2.id
    );

    render(<ValidationStep issues={vm.issues} exportGate={vm.export} onNavigate={vi.fn()} />);

    expect(screen.getByText(/marked bad on an earlier recording day/i)).toBeInTheDocument();
    expect(screen.queryByText(/ready to export/i)).not.toBeInTheDocument();
  });
});
