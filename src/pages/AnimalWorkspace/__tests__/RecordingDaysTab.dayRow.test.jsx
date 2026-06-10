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
import { render, screen } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { RecordingDaysTab } from '../RecordingDaysTab';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

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
    const link = screen.getByRole('link', { name: /2023-06-22/i });
    expect(link).toHaveAttribute('href', `#/day/${dayId}`);
    // session_id (filename seed) is inspection detail — it must not appear on the row.
    expect(screen.queryByText('remy_20230622')).not.toBeInTheDocument();
  });

  it('shows the session description muted under the date when present, truncatable (Task 2.5b)', () => {
    const { container } = renderRealistic();
    const desc = container.querySelector('.day-session-desc');
    expect(desc).toBeInTheDocument();
    expect(desc).toHaveTextContent('Day 45 of chronic recording, W-track alternation');
    // The full text is on `title` so a CSS-ellipsis truncation stays recoverable on hover.
    expect(desc).toHaveAttribute('title', 'Day 45 of chronic recording, W-track alternation');
  });

  it('omits the description element entirely when no session description is present', () => {
    const { container } = renderRealistic((day) => {
      delete day.session.session_description;
    });
    expect(container.querySelector('.day-session-desc')).not.toBeInTheDocument();
    // The bare date still reads fine.
    expect(screen.getByRole('link', { name: /2023-06-22/i })).toBeInTheDocument();
  });

  it('renders ONE plain-language status, not the old Draft/Validated/Exported chip cluster (Task 2.5a)', () => {
    const { container } = renderRealistic((day) => {
      day.state = { draft: true, validated: false, exported: false };
    });
    expect(screen.getByText('Draft — not yet validated')).toBeInTheDocument();
    // The old uppercase status-chip cluster is gone.
    expect(container.querySelector('.status-chip')).not.toBeInTheDocument();
  });

  it('maps a validated (not exported) day to "Ready to export"', () => {
    renderRealistic((day) => {
      day.state = { draft: false, validated: true, exported: false };
    });
    expect(screen.getByText('Ready to export')).toBeInTheDocument();
  });

  it('renders a computed status alongside the orphan note on a recovered-unlinked row', () => {
    // A recovered day whose record points at this animal but is NOT in its index
    // (RECOVERED_UNLINKED) flows through the same OK-row markup, so it now carries BOTH the
    // "not in day list" note AND a plain-language status. The valid fixture (config history
    // present) merges cleanly, so a draft orphan reads as a draft — not a crash, not blank.
    renderRealistic((day, animal) => {
      animal.days = []; // unlink: record exists in the days map but not in the index
      day.state = { draft: true, validated: false, exported: false };
    });
    // "not in day list" appears both in the review note and on the row.
    expect(screen.getAllByText(/not in day list/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Draft — not yet validated')).toBeInTheDocument();
  });

  it('shows "Needs fixing — {reason}" for a live error, overriding a stale exported flag', () => {
    renderRealistic((day) => {
      day.state = { draft: false, validated: true, exported: true };
      day.tasks = 'not-an-array'; // corrupt shape → a live blocking issue
    });
    expect(screen.getByText(/^Needs fixing — /)).toBeInTheDocument();
    // The stale "Exported" must NOT be shown.
    expect(screen.queryByText('Exported')).not.toBeInTheDocument();
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
