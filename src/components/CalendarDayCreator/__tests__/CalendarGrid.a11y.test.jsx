/**
 * @file Calendar keyboard/a11y (Phase 8A-2). The month grid must:
 *  - expose six weekly rows of seven cells (not one 42-cell row), so AT grid navigation
 *    announces weeks × days instead of "row of 42";
 *  - use a roving tabindex so Tab always reaches a cell — even when today is in another month
 *    (the old today-only tabindex left the whole grid keyboard-unreachable off the current month);
 *  - move the roving focus with arrow keys.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarGrid } from '../CalendarGrid';

const noop = () => {};

/**
 * Render the grid on June 2023 (deterministically far from any wall-clock "today", so the
 * today-absent roving path is exercised).
 * @param {object} [props] - Prop overrides.
 * @returns {ReturnType<typeof render>}
 */
function renderGrid(props = {}) {
  return render(
    <CalendarGrid
      currentMonth={{ year: 2023, month: 5 }}
      selectedDates={new Set()}
      existingDays={[]}
      onDateSelect={noop}
      {...props}
    />
  );
}

describe('CalendarGrid keyboard/a11y', () => {
  it('splits the month into six weekly rows of seven cells (not one 42-cell row)', () => {
    renderGrid();
    const grid = screen.getByRole('grid');
    const rows = within(grid).getAllByRole('row');
    // 1 weekday header row + 6 week rows.
    expect(rows).toHaveLength(7);
    for (const row of rows.slice(1)) {
      expect(within(row).getAllByRole('gridcell')).toHaveLength(7);
    }
  });

  it('owns its rows through rowgroups and announces the displayed month + multi-select', () => {
    renderGrid();
    const grid = screen.getByRole('grid');
    // Valid WAI-ARIA ownership chain: grid → rowgroup(s) → row → gridcell.
    expect(within(grid).getAllByRole('rowgroup').length).toBeGreaterThanOrEqual(2);
    // Month-aware accessible name (not a static "Calendar dates"), and multi-select advertised.
    expect(grid).toHaveAccessibleName(/June 2023 calendar/i);
    expect(grid).toHaveAttribute('aria-multiselectable', 'true');
  });

  it('exposes exactly ONE focusable cell (roving tabindex) when today is not in the displayed month', () => {
    renderGrid();
    const focusable = screen.getAllByRole('gridcell').filter((c) => c.tabIndex === 0);
    expect(focusable).toHaveLength(1);
  });

  it('defaults the roving focus to the first selectable cell of the displayed month when today is absent', () => {
    renderGrid();
    const active = screen.getAllByRole('gridcell').find((c) => c.tabIndex === 0);
    expect(active).toHaveAttribute('aria-label', expect.stringContaining('June 1, 2023'));
  });

  it('moves the roving focus with the arrow keys', async () => {
    const user = userEvent.setup();
    renderGrid();
    const active = screen.getAllByRole('gridcell').find((c) => c.tabIndex === 0);
    active.focus();

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toHaveAttribute('aria-label', expect.stringContaining('June 2, 2023'));
    expect(document.activeElement.tabIndex).toBe(0);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toHaveAttribute('aria-label', expect.stringContaining('June 9, 2023'));
  });

  it('keeps an existing-recording cell focusable (aria-disabled, not removed from the grid) for continuous navigation', () => {
    renderGrid({ existingDays: ['2023-06-02'] });
    const cells = screen.getAllByRole('gridcell');
    const existing = cells.find((c) => /June 2, 2023/.test(c.getAttribute('aria-label') || ''));
    expect(existing).toHaveAttribute('aria-disabled', 'true');
    // Focusable for grid navigation (roving), but not a real disabled button removed from the grid.
    expect(existing).not.toBeDisabled();
  });
});
