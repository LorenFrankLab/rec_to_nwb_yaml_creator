/**
 * Unit tests for the shared ReconfigurationContextBanner (Phase 3-4 — tabbed-workspace-ia).
 *
 * This is the single implementation the tabbed Animal View renders (the legacy Animal Editor stepper
 * was removed in Phase 5). These pin the component's contract directly;
 * AnimalView.profileHeader.test.jsx proves the host consumes it.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReconfigurationContextBanner from '../ReconfigurationContextBanner';

const animal = {
  id: 'remy',
  configurationHistory: [
    { version: 1, date: '2023-06-22', description: 'v1', devices: {}, appliedToDays: [] },
    { version: 2, date: '2023-07-10', description: 'v2', devices: {}, appliedToDays: [] },
  ],
};
const days = { 'remy-2023-06-24': { id: 'remy-2023-06-24', date: '2023-06-24' } };

describe('ReconfigurationContextBanner', () => {
  it('renders nothing unless the context is a reconfiguration', () => {
    render(
      <ReconfigurationContextBanner animal={animal} routeContext={{ context: null }} days={days} />
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the "editing latest" copy when the version IS the latest', () => {
    render(
      <ReconfigurationContextBanner
        animal={animal}
        routeContext={{ context: 'reconfigure', version: 2, fromDayId: 'remy-2023-06-24', movedDays: 1 }}
        days={days}
      />
    );
    // The "Editing latest …" copy IS the not-a-warning signal (the amber treatment is presentation,
    // verified visually); assert the user-facing message via the status role, not a CSS class.
    expect(screen.getByRole('status')).toHaveTextContent(
      'Editing latest configuration v2 for reconfiguration starting 2023-06-24. Moved 1 day to this version.'
    );
  });

  it('shows the "review vN — current latest is vM" warning for a non-latest version', () => {
    render(
      <ReconfigurationContextBanner
        animal={animal}
        routeContext={{ context: 'reconfigure', version: 1, fromDayId: 'remy-2023-06-24', movedDays: 2 }}
        days={days}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Review configuration v1; current latest is v2 for reconfiguration starting 2023-06-24. Moved 2 days to this version.'
    );
  });
});
