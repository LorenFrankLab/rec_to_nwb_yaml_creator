import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ValidationStep from '../ValidationStep';
import * as validation from '../../../validation';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

afterEach(() => vi.restoreAllMocks());

describe('ValidationStep', () => {
  const baseProps = { animal: {}, day: {}, mergedDay: {} };

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

  it('shows a ready indicator when there are no error-severity issues', () => {
    vi.spyOn(validation, 'validate').mockReturnValue([]);

    render(<ValidationStep {...baseProps} />);

    expect(screen.getByText(/ready to export/i)).toBeInTheDocument();
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
