import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ValidationStep from '../ValidationStep';
import * as validation from '../../../validation';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

afterEach(() => vi.restoreAllMocks());

describe('ValidationStep', () => {
  const baseProps = { animal: {}, day: {}, mergedDay: {} };

  it('declares a default for the optional animal prop', () => {
    expect(ValidationStep.defaultProps).toHaveProperty('animal', null);
  });

  it('renders each issue under its severity heading with message and path', () => {
    vi.spyOn(validation, 'validate').mockReturnValue([
      { severity: 'error', path: 'session_id', code: 'required', message: 'session_id is required' },
      { severity: 'warning', path: 'tasks[0].task_epochs', code: 'epoch_overlap', message: 'epochs overlap' },
      { severity: 'info', path: 'cameras', code: 'no_cameras', message: 'no cameras defined' },
    ]);

    render(<ValidationStep {...baseProps} />);

    expect(screen.getByRole('heading', { name: /error/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /warning/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /info/i })).toBeInTheDocument();

    expect(screen.getByText('session_id is required')).toBeInTheDocument();
    expect(screen.getByText('epochs overlap')).toBeInTheDocument();
    expect(screen.getByText('no cameras defined')).toBeInTheDocument();

    // Paths are shown alongside their messages.
    expect(screen.getByText('tasks[0].task_epochs')).toBeInTheDocument();
  });

  it('groups issues by user workflow category, not by editor step', () => {
    vi.spyOn(validation, 'validate').mockReturnValue([
      { severity: 'error', code: 'empty_location', path: 'electrode_groups[0].location', message: 'location is empty' },
      { severity: 'error', code: 'duplicate_task_epoch', path: 'tasks[0].task_epochs', message: 'duplicate epoch' },
      { severity: 'error', code: 'bad_channel_out_of_range', path: 'ntrode_electrode_group_channel_map[0].bad_channels', message: 'channel 9 out of range' },
    ]);

    render(<ValidationStep {...baseProps} onNavigate={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /animal setup/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^day metadata$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /day-specific failed channels/i })).toBeInTheDocument();
  });

  it('shows the ownership-pattern hint (and cross-day reach) next to errors (Task 9)', () => {
    vi.spyOn(validation, 'validate').mockReturnValue([
      { severity: 'error', code: 'empty_location', path: 'electrode_groups[0].location', message: 'location is empty' },
    ]);

    render(<ValidationStep {...baseProps} onNavigate={vi.fn()} />);

    // The probe/location error names the configuration-version ownership and flags that fixing it
    // reaches past this day — without changing the workflow-category grouping or the repair route.
    expect(screen.getByText('Pin or fix the configuration version')).toBeInTheDocument();
    expect(screen.getByText(/affects more than this day/i)).toBeInTheDocument();
  });

  it('suppresses the ownership-pattern hint for non-blocking warnings/info (Task 9)', () => {
    // A warning carries its own specific advice and no repair button; the generic pattern action
    // and the emphasized cross-day cue would be noise (and could contradict the advisory).
    vi.spyOn(validation, 'validate').mockReturnValue([
      { severity: 'warning', code: 'inconsistent_location_case', path: 'electrode_groups[0].location', message: 'location capitalization is inconsistent' },
    ]);

    render(<ValidationStep {...baseProps} onNavigate={vi.fn()} />);

    expect(screen.getByText('location capitalization is inconsistent')).toBeInTheDocument();
    expect(screen.queryByText('Pin or fix the configuration version')).not.toBeInTheDocument();
    expect(screen.queryByText(/affects more than this day/i)).not.toBeInTheDocument();
  });

  it('shows a blocked indicator and an error count when errors exist', () => {
    vi.spyOn(validation, 'validate').mockReturnValue([
      { severity: 'error', path: 'session_id', code: 'required', message: 'required' },
      { severity: 'warning', path: 'cameras', code: 'w', message: 'a warning' },
    ]);

    render(<ValidationStep {...baseProps} />);

    expect(screen.getByText(/1 error/i)).toBeInTheDocument();
    expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();
  });

  it('shows a ready indicator only when the REAL export gate is open (all steps valid)', () => {
    // A fully-configured, fully-valid day (real validation) passes isExportEnabled.
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    render(<ValidationStep animal={animal} day={day} mergedDay={merged} />);
    expect(screen.getByText(/ready to export/i)).toBeInTheDocument();
  });

  it('does NOT say ready when there are zero errors but a prerequisite step is incomplete', () => {
    // No validation errors, but an empty day → overview/devices incomplete → export still gated.
    vi.spyOn(validation, 'validate').mockReturnValue([]);
    render(<ValidationStep {...baseProps} />);
    expect(screen.queryByText(/ready to export/i)).not.toBeInTheDocument();
    expect(screen.getByText(/complete the required steps/i)).toBeInTheDocument();
  });

  it('renders without throwing when mergedDay is undefined', () => {
    expect(() => render(<ValidationStep mergedDay={undefined} />)).not.toThrow();
  });

  it('surfaces an issue with an unexpected severity under the Info heading rather than dropping it', () => {
    vi.spyOn(validation, 'validate').mockReturnValue([
      { severity: undefined, path: 'cameras', code: 'odd', message: 'unclassified issue' },
    ]);

    render(<ValidationStep {...baseProps} />);

    expect(screen.getByRole('heading', { name: /info/i })).toBeInTheDocument();
    expect(screen.getByText('unclassified issue')).toBeInTheDocument();
  });

  it('routes a day-surface error (session) to the owning Day-Editor step with the field target', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    vi.spyOn(validation, 'validate').mockReturnValue([
      { severity: 'error', path: 'session_description', code: 'required', message: 'session description is required' },
    ]);

    render(<ValidationStep {...baseProps} onNavigate={onNavigate} />);

    await user.click(screen.getByRole('button', { name: /fix in overview/i }));

    expect(onNavigate).toHaveBeenCalledWith('overview', 'session_description');
  });

  it('routes an animal-surface error (device geometry) to the Animal Editor', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    vi.spyOn(validation, 'validate').mockReturnValue([
      { severity: 'error', path: 'electrode_groups[0].targeted_x', code: 'type', message: 'must be number' },
    ]);

    render(<ValidationStep {...baseProps} animal={{ id: 'remy' }} onNavigate={onNavigate} />);

    // The button names the Animal Editor (the editable owner), not the Devices step.
    await user.click(screen.getByRole('button', { name: /fix in animal setup/i }));
    expect(screen.queryByRole('button', { name: /fix in devices/i })).not.toBeInTheDocument();

    expect(onNavigate).toHaveBeenCalledWith('animal', 'electrode_groups[0].targeted_x');
  });

  it('does not render repair actions for non-error issues', () => {
    const onNavigate = vi.fn();
    vi.spyOn(validation, 'validate').mockReturnValue([
      { severity: 'warning', path: 'cameras', code: 'w', message: 'a warning' },
    ]);

    render(<ValidationStep {...baseProps} onNavigate={onNavigate} />);

    expect(screen.queryByRole('button', { name: /fix in/i })).not.toBeInTheDocument();
  });

  it('surfaces real validation errors computed from the merged metadata', () => {
    const { animal, day } = buildRealisticWorkspace();
    // A complete realistic day validates clean; drop a required field to produce a
    // real schema error, proving the step runs validation against the merged model.
    const { lab, ...mergedDay } = mergeDayMetadata(animal, day);

    render(<ValidationStep animal={animal} day={day} mergedDay={mergedDay} />);

    expect(
      screen.getByText(/must have required property 'lab'/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();
  });
});
