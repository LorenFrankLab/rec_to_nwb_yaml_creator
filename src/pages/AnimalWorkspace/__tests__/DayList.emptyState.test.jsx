/**
 * DayList zero-state tests (epoch-editor Phase 8).
 *
 * The per-animal recording-days pane's empty state. Pins the onboarding zero-state with its
 * "add recording day(s)" CTA, that the CTA invokes the add handler, and that the corrupt-index error
 * state stays a plain notice (not the onboarding card).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DayList from '../DayList';

/**
 * DayList requires many handlers; default them to no-ops so each test sets only what it asserts.
 *
 * @param overrides - Props to override the no-op defaults (e.g. `onAddDay`, `daysCorrupt`).
 * @returns The render result.
 */
function renderDayList(overrides = {}) {
  const props = {
    rows: [],
    daysCorrupt: false,
    animalId: 'remy',
    selectedDayIds: new Set(),
    allSelected: false,
    onToggleAll: () => {},
    onToggleDay: () => {},
    onRepairCommand: () => {},
    onOpenDay: () => {},
    onDuplicateDay: () => {},
    onExportDay: () => {},
    onDeleteDay: () => {},
    ...overrides,
  };
  return render(<DayList {...props} />);
}

describe('DayList zero-state', () => {
  it('shows the onboarding empty state with an add-day CTA that fires the handler', async () => {
    const user = userEvent.setup();
    const onAddDay = vi.fn();
    renderDayList({ onAddDay });

    expect(screen.getByRole('heading', { name: /no recording days yet/i })).toBeInTheDocument();
    const cta = screen.getByRole('button', { name: /add recording day/i });
    await user.click(cta);
    expect(onAddDay).toHaveBeenCalledTimes(1);
  });

  it('renders the empty state without a CTA when no add handler is provided', () => {
    renderDayList();
    expect(screen.getByRole('heading', { name: /no recording days yet/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add recording day/i })).not.toBeInTheDocument();
  });

  it('shows the corrupt-index error notice (not the onboarding card) when the index is corrupt', () => {
    renderDayList({ daysCorrupt: true, onAddDay: () => {} });
    expect(screen.getByText(/corrupt and can't be shown/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add recording day/i })).not.toBeInTheDocument();
  });
});
