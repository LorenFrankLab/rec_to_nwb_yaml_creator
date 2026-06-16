/**
 * Recording-day ROW contract (Phase 2 — tabbed-workspace-ia, decision 12 / Tasks 2.5a/2.5b/2.6).
 *
 * A list row is triage, not inspection: it answers "which day" (bare date anchor + muted
 * session description when present), "what's my job" (ONE plain-language status), and links to
 * the day. `session_id`, the filename, and the old uppercase Draft/Validated/Exported chip
 * cluster move OFF the row. The status is honest: a LIVE blocking issue reads "Needs fixing —
 * {reason}" even over a stale stored exported flag.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { RecordingDaysTab } from '../RecordingDaysTab';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

/**
 * The `<tr>` for a row, found via its exact-date link (the chevron link has a distinct name).
 * @param {string} [dateText] - The row's ISO date.
 * @returns {HTMLElement} the row element.
 */
const rowFor = (dateText = '2023-06-22') =>
  screen.getByRole('link', { name: new RegExp(`^${dateText}$`) }).closest('tr');

/**
 * Render the pane for one realistic animal/day, after mutating the day in place.
 * @param {(day: object, animal: object) => void} [mutateDay] - Optional day/animal mutator.
 * @returns {object} render result + the ids.
 */
function renderRealistic(mutateDay) {
  const { animal, day } = buildRealisticWorkspace();
  if (mutateDay) mutateDay(day, animal);
  const result = render(
    <StoreProvider initialState={{ workspace: { animals: { [animal.id]: animal }, days: { [day.id]: day }, settings: {} } }}>
      <RecordingDaysTab animalId={animal.id} />
    </StoreProvider>
  );
  return { ...result, animalId: animal.id, dayId: day.id };
}

describe('RecordingDaysTab — day row contract (decision 12)', () => {
  it('renders the bare date as the row link and drops session_id from the row (Task 2.6)', () => {
    const { dayId } = renderRealistic();
    const link = screen.getByRole('link', { name: /^2023-06-22$/ });
    expect(link).toHaveAttribute('href', `#/day/${dayId}`);
    // session_id (filename seed) is inspection detail — it must not appear on the row.
    expect(screen.queryByText('remy_20230622')).not.toBeInTheDocument();
  });

  it('shows the session description muted under the date when present, truncatable (Task 2.5b)', () => {
    const { container } = renderRealistic();
    const desc = container.querySelector('[data-testid="day-session-desc"]');
    expect(desc).toBeInTheDocument();
    expect(desc).toHaveTextContent('Day 45 of chronic recording, W-track alternation');
    // The full text is on `title` so a CSS-ellipsis truncation stays recoverable on hover.
    expect(desc).toHaveAttribute('title', 'Day 45 of chronic recording, W-track alternation');
  });

  it('omits the description element entirely when no session description is present', () => {
    const { container } = renderRealistic((day) => {
      delete day.session.session_description;
    });
    expect(container.querySelector('[data-testid="day-session-desc"]')).not.toBeInTheDocument();
    // The bare date still reads fine.
    expect(screen.getByRole('link', { name: /^2023-06-22$/ })).toBeInTheDocument();
  });

  it('exposes the "Add Recording Days" button by its VISIBLE name (label parity, no hidden aria-label)', () => {
    renderRealistic();
    // The accessible name must equal the visible text so voice control / screen readers find the
    // control by what it says — not a hidden "Show calendar" aria-label. (aria-expanded conveys state.)
    const button = screen.getByRole('button', { name: 'Add Recording Days' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /show calendar/i })).not.toBeInTheDocument();
  });

  it('shows the shared lifecycle legend above the day list (vocabulary defined once)', () => {
    renderRealistic();
    // The same collapsible legend used on the Validation Summary explains the row status words.
    expect(screen.getByText(/what do these statuses mean/i)).toBeInTheDocument();
  });

  it('does not show the lifecycle legend when the animal has no recording days', () => {
    const { animal } = buildRealisticWorkspace();
    animal.days = [];
    render(
      <StoreProvider
        initialState={{ workspace: { animals: { [animal.id]: animal }, days: {}, settings: {} } }}
      >
        <RecordingDaysTab animalId={animal.id} />
      </StoreProvider>
    );
    // No day rows to triage → the legend is suppressed (it only explains row statuses).
    expect(screen.queryByText(/what do these statuses mean/i)).not.toBeInTheDocument();
  });

  it('renders ONE plain-language status via the StatusPill, not the old chip cluster (Task 2.5a)', () => {
    const { container } = renderRealistic((day) => {
      day.state = { draft: true, validated: false, exported: false };
    });
    // The realistic day passes the export gate but is unsaved → the live-readiness word
    // "Ready to export" (scoped to the row; the shared legend lists the same word as reference).
    expect(within(rowFor()).getByText('Ready to export')).toBeInTheDocument();
    // The old uppercase status-chip cluster is gone.
    expect(container.querySelector('.status-chip')).not.toBeInTheDocument();
  });

  it('maps a persisted-validated (not exported) day to "Validated" (the saved fact, not live "Ready to export")', () => {
    // Scope to the row: the shared legend also lists every status word, so a global text query
    // would match the legend too.
    renderRealistic((day) => {
      day.state = { draft: false, validated: true, exported: false };
    });
    const row = rowFor();
    expect(within(row).getByText('Validated')).toBeInTheDocument();
    // A persisted-validated day shows the SAVED fact ("Validated"), not the live-readiness word
    // ("Ready to export") — both are live-valid, but the row distinguishes saved from unsaved.
    expect(within(row).queryByText('Ready to export')).not.toBeInTheDocument();
  });

  it('renders "Draft — incomplete" for an incomplete (not export-ready) day', () => {
    // A day with no errors but a missing required Overview field is incomplete (not export-ready),
    // so the row reads the draft state — proving the draft branch wires through to the rendered row.
    renderRealistic((day) => {
      day.state = { draft: true, validated: false, exported: false };
      day.session = { ...day.session, session_id: undefined };
    });
    expect(within(rowFor()).getByText('Draft — incomplete')).toBeInTheDocument();
  });

  it('shows "Re-link to export" (not an export-ready claim) on a recovered-unlinked row', () => {
    // A recovered day whose record points at this animal but is NOT in its index
    // (RECOVERED_UNLINKED) flows through the same OK-row markup, carrying the "not in day list"
    // note. Its metadata is valid, but it is NOT exportable until re-linked (the batch export
    // filters it out), so the row must NOT claim "Ready to export" — it shows the actionable
    // linkage blocker instead.
    renderRealistic((day, animal) => {
      animal.days = []; // unlink: record exists in the days map but not in the index
      day.state = { draft: true, validated: false, exported: false };
    });
    // "not in day list" appears in the review note and on the date.
    expect(screen.getAllByText(/not in day list/i).length).toBeGreaterThan(0);
    const row = rowFor();
    expect(within(row).getByText('Re-link to export')).toBeInTheDocument();
    expect(within(row).queryByText('Ready to export')).not.toBeInTheDocument();
  });

  it('shows "Needs fixing — {reason}" for a live error, overriding a stale exported flag', () => {
    renderRealistic((day) => {
      day.state = { draft: false, validated: true, exported: true };
      day.tasks = 'not-an-array'; // corrupt shape → a live blocking issue
    });
    const row = rowFor();
    expect(within(row).getByText(/^Needs fixing — /)).toBeInTheDocument();
    // The stale "Exported" must NOT be shown on the row (the legend lists it as a reference word,
    // so scope this to the row).
    expect(within(row).queryByText(/exported/i)).not.toBeInTheDocument();
  });

  it('humanizes a raw schema key in the "Needs fixing" reason (display only)', () => {
    // S1 audit finding: the day-row status must not leak a raw snake_case schema key.
    // Empty a required string field so its blocking message leads with the key, and assert
    // the row sentence-cases it ("Experiment description …" not "experiment_description …").
    renderRealistic((day) => {
      day.state = { draft: false, validated: false, exported: false };
      day.session.experiment_description = '   '; // whitespace-only → empty-pattern violation
    });
    const status = screen.getByText(/^Needs fixing — Experiment description/);
    expect(status).toBeInTheDocument();
    expect(status).not.toHaveTextContent('experiment_description');
  });
});
