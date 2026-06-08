/**
 * Unit tests for WarningAcknowledgement (Phase 3-6) — the reusable pre-export warning review.
 *
 * Pins the component's contract directly (the per-animal Validation & Export tab and the future
 * Phase 4 batch screen both consume it): it lists each day → its warning messages, renders nothing
 * when there are no warnings, and reports the checkbox state through onChange.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WarningAcknowledgement from '../WarningAcknowledgement';

const items = [
  { key: 'remy-2023-06-22', label: 'remy — remy_20230622', warnings: [{ message: 'Inconsistent capitalization of CA1 / ca1.' }] },
  { key: 'remy-2023-06-23', label: 'remy — remy_20230623', warnings: [{ message: 'Orphaned associated file.' }] },
];

describe('WarningAcknowledgement', () => {
  it('renders nothing when there are no warning items', () => {
    const { container } = render(
      <WarningAcknowledgement items={[]} acknowledged={false} onChange={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each day → its warning messages (content-explicit, not a bare count)', () => {
    render(<WarningAcknowledgement items={items} acknowledged={false} onChange={() => {}} />);
    const group = screen.getByRole('group', { name: /outstanding warnings to review/i });
    expect(within(group).getByText(/remy_20230622/)).toBeInTheDocument();
    expect(within(group).getByText(/inconsistent capitalization/i)).toBeInTheDocument();
    expect(within(group).getByText(/orphaned associated file/i)).toBeInTheDocument();
  });

  it('reports the checkbox state through onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WarningAcknowledgement items={items} acknowledged={false} onChange={onChange} />);
    await user.click(screen.getByRole('checkbox', { name: /reviewed these warnings/i }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
