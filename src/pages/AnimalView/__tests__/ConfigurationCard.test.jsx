/**
 * @file Unit tests for ConfigurationCard — the current-configuration card on the setup surface.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfigurationCard from '../ConfigurationCard';

const CARD = {
  version: 1,
  sinceDate: '2023-06-22',
  dayCount: 10,
  probes: [
    { label: 'Probe 0 · CA1', deviceType: 'tetrode_12.5', coords: '(3, 2.5, 2) mm' },
    { label: 'Probe 1 · mPFC', deviceType: 'tetrode_12.5', coords: '' },
  ],
  newConfigurationLabel: 'New configuration…',
};

describe('ConfigurationCard', () => {
  it('renders the version line and per-probe rows', () => {
    render(<ConfigurationCard card={CARD} />);
    expect(screen.getByText(/v1 \(current\) · since 2023-06-22 · 10 days/)).toBeInTheDocument();
    expect(screen.getByText('Probe 0 · CA1')).toBeInTheDocument();
    expect(screen.getByText('tetrode_12.5 · (3, 2.5, 2) mm')).toBeInTheDocument();
    // A probe with no coords shows just the device type (no trailing separator).
    expect(screen.getByText('tetrode_12.5')).toBeInTheDocument();
  });

  it('renders the behavior-only empty state when there are no probes', () => {
    render(<ConfigurationCard card={{ version: 1, dayCount: 0, probes: [], newConfigurationLabel: 'New configuration…' }} />);
    expect(screen.getByText(/no probes configured/i)).toBeInTheDocument();
  });

  it('shows the New configuration action only when a handler is given, and fires it', async () => {
    const user = userEvent.setup();
    const onNewConfiguration = vi.fn();
    const { rerender } = render(<ConfigurationCard card={CARD} />);
    expect(screen.queryByRole('button', { name: /new configuration/i })).not.toBeInTheDocument();

    rerender(<ConfigurationCard card={CARD} onNewConfiguration={onNewConfiguration} />);
    await user.click(screen.getByRole('button', { name: /new configuration/i }));
    expect(onNewConfiguration).toHaveBeenCalledTimes(1);
  });
});
