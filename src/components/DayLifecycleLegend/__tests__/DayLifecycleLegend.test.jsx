/**
 * @file Tests for DayLifecycleLegend — the shared reference legend for the day-lifecycle
 * vocabulary (Phase 8A-1). It explains each status word once, so the same legend can sit on
 * Animal Days and the Validation Summary instead of one-off explanations per surface.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DayLifecycleLegend from '../DayLifecycleLegend';
import {
  DAY_LIFECYCLE_ORDER,
  DAY_LIFECYCLE_LABEL,
  DAY_LIFECYCLE_DESCRIPTION,
} from '../../../domain/dayLifecycle';

describe('DayLifecycleLegend', () => {
  it('lists every lifecycle state with its shared label and description', () => {
    render(<DayLifecycleLegend />);

    for (const variant of DAY_LIFECYCLE_ORDER) {
      expect(screen.getByText(DAY_LIFECYCLE_LABEL[variant])).toBeInTheDocument();
      expect(screen.getByText(DAY_LIFECYCLE_DESCRIPTION[variant])).toBeInTheDocument();
    }
  });

  it('exposes the legend as a labelled group', () => {
    render(<DayLifecycleLegend />);
    expect(
      screen.getByRole('group', { name: /what do these statuses mean/i })
    ).toBeInTheDocument();
  });

  it('is collapsed by default (details on demand) and opens on click', async () => {
    const user = userEvent.setup();
    const { container } = render(<DayLifecycleLegend />);

    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);

    await user.click(screen.getByText(/what do these statuses mean/i));
    expect(details.open).toBe(true);
  });

  it('accepts a custom summary label', () => {
    render(<DayLifecycleLegend summaryText="Status key" />);
    expect(screen.getByText('Status key')).toBeInTheDocument();
  });
});
