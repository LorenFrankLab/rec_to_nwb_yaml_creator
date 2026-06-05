import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MalformedCollectionNotice from '../MalformedCollectionNotice';

/**
 * Boundary 1 repair surface — a corrupt (non-array) day collection blocks export but
 * has no editor row (the merge laundered it to []). This shared notice renders a
 * focusable reset control per malformed collection it owns, carrying the issue's
 * focusPath (the bare field key) so repair-focus lands on it; clicking resets the
 * field to [], clearing the raw-shape issue.
 */
const FIELDS = [
  { key: 'tasks', label: 'tasks' },
  { key: 'associated_files', label: 'associated files' },
];

describe('MalformedCollectionNotice', () => {
  it('renders a focusable reset control only for malformed (non-array) owned fields', () => {
    render(
      <MalformedCollectionNotice
        day={{ tasks: {}, associated_files: [] }}
        fields={FIELDS}
        onReset={vi.fn()}
      />
    );
    const control = screen.getByRole('button', { name: /reset corrupt tasks/i });
    expect(control).toHaveAttribute('data-field-path', 'tasks');
    // associated_files is a clean array → no control.
    expect(screen.queryByRole('button', { name: /reset corrupt associated files/i })).toBeNull();
  });

  it('clicking reset invokes onReset with the field key (the caller resets it to [])', async () => {
    // This component only fires the callback; that resetting to [] CLEARS the underlying
    // malformed_day_collection issue is proven by the validation/repairability tests.
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<MalformedCollectionNotice day={{ tasks: 'corrupt' }} fields={FIELDS} onReset={onReset} />);
    await user.click(screen.getByRole('button', { name: /reset corrupt tasks/i }));
    expect(onReset).toHaveBeenCalledWith('tasks');
  });

  it('renders nothing when no owned field is malformed', () => {
    const { container } = render(
      <MalformedCollectionNotice day={{ tasks: [], associated_files: [] }} fields={FIELDS} onReset={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a non-record day (handled at the store level)', () => {
    const { container } = render(
      <MalformedCollectionNotice day={null} fields={FIELDS} onReset={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
