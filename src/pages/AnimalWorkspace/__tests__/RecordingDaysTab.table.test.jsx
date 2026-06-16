/**
 * Recording Days TABLE contract (Phase 2 — epoch-editor).
 *
 * The day list is a `<table>` (mockup: animal-page.html): a checkbox column + select-all, a contextual
 * bulk bar that appears only on selection ("N selected · Export selected · Delete"), real date + chevron
 * links (no row-level onclick — the accessible-row contract), and the status via the shared StatusPill
 * over the day-lifecycle vocabulary. The ≤~60-days scoping decision means NO search/sort/pagination.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { RecordingDaysTab } from '../RecordingDaysTab';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

/** A workspace with the realistic animal carrying TWO ok days, for selection + bulk-bar tests. */
function buildTwoDayWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  const secondDay = {
    ...structuredClone(day),
    id: 'remy-2023-06-25',
    date: '2023-06-25',
    experimentDate: '06252023',
    session: { ...day.session, session_id: 'remy_20230625' },
  };
  animal.days = [day.id, secondDay.id];
  return {
    animal,
    dayIds: [day.id, secondDay.id],
    workspace: {
      animals: { [animal.id]: animal },
      days: { [day.id]: day, [secondDay.id]: secondDay },
      settings: {},
    },
  };
}

/** Render the recording-days pane for the two-day realistic animal. */
function renderTwoDay() {
  const { animal, dayIds, workspace } = buildTwoDayWorkspace();
  const result = render(
    <StoreProvider initialState={{ workspace }}>
      <RecordingDaysTab animalId={animal.id} />
    </StoreProvider>
  );
  return { ...result, animalId: animal.id, dayIds };
}

describe('RecordingDaysTab — days table', () => {
  it('renders the days as a table with a select-all header checkbox + a per-row checkbox', () => {
    renderTwoDay();
    expect(screen.getByRole('table')).toBeInTheDocument();
    // Select-all in the header.
    expect(screen.getByRole('checkbox', { name: /select all recording days/i })).toBeInTheDocument();
    // One checkbox per OK day row.
    expect(screen.getByRole('checkbox', { name: /select 2023-06-22/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /select 2023-06-25/i })).toBeInTheDocument();
  });

  it('keeps the date and chevron as real links (no row-level onclick)', () => {
    const { dayIds } = renderTwoDay();
    const dateLink = screen.getByRole('link', { name: /^2023-06-22$/ });
    expect(dateLink).toHaveAttribute('href', `#/day/${dayIds[0]}`);
    // A distinct chevron link opens the same day (the accessible-row contract — two real links,
    // no clickable <tr>).
    const chevron = screen.getByRole('link', { name: /open 2023-06-22/i });
    expect(chevron).toHaveAttribute('href', `#/day/${dayIds[0]}`);
  });

  it('shows the status via the shared StatusPill (day-lifecycle vocabulary), not the old chip cluster', () => {
    renderTwoDay();
    const row = screen.getByRole('link', { name: /^2023-06-22$/ }).closest('tr');
    // The realistic day passes the gate but is unsaved → "Ready to export".
    expect(within(row).getByText('Ready to export')).toBeInTheDocument();
    // The old uppercase status-chip cluster is gone.
    expect(row.querySelector('.status-chip')).not.toBeInTheDocument();
  });

  it('reveals the contextual bulk bar only after a row is selected', async () => {
    const user = userEvent.setup();
    renderTwoDay();

    // Hidden before any selection.
    expect(screen.queryByRole('button', { name: /export selected/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /select 2023-06-22/i }));

    // The bar appears with the count + the two bulk actions.
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export selected/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('select-all checks every OK row and toggling it off clears the selection', async () => {
    const user = userEvent.setup();
    renderTwoDay();

    await user.click(screen.getByRole('checkbox', { name: /select all recording days/i }));
    expect(screen.getByRole('checkbox', { name: /select 2023-06-22/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /select 2023-06-25/i })).toBeChecked();
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /select all recording days/i }));
    expect(screen.getByRole('checkbox', { name: /select 2023-06-22/i })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /export selected/i })).not.toBeInTheDocument();
  });
});
