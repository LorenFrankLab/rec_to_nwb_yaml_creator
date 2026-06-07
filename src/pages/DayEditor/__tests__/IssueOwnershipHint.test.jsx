/**
 * IssueOwnershipHint (Phase 8.7 Task 9). Validation/Export issue copy must additionally NAME the
 * ownership pattern — the safe next action ("Fix shared animal setup", "Select the item used on
 * this day", "Override this day's technical value", "Pin or fix the configuration version",
 * "Repair recovered data") — and flag when correcting an issue reaches beyond the day in front of
 * the user. The hint renders the descriptor from `ownershipForIssue`; it never re-decides routing
 * (that stays on the RepairActionButton) or grouping (that stays on the workflow category).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import IssueOwnershipHint from '../IssueOwnershipHint';
import { ownershipForIssue } from '../../../domain/workflowOwnership';

describe('IssueOwnershipHint', () => {
  it('names the configuration-version action and flags cross-day reach for a probe/location error', () => {
    // empty_location is the versioned physical snapshot each day pins → reaches beyond this day.
    render(<IssueOwnershipHint issue={{ code: 'empty_location', path: 'electrode_groups.0.location' }} />);
    expect(screen.getByText('Pin or fix the configuration version')).toBeInTheDocument();
    expect(screen.getByText(/affects more than this day/i)).toBeInTheDocument();
  });

  it('names the day-side camera selection action with NO cross-day reach', () => {
    // dangling_camera_ref is the DAY side of a catalog reference — selecting the camera used on
    // this day is a local repair, so it must NOT warn "touches N days".
    render(<IssueOwnershipHint issue={{ code: 'dangling_camera_ref', path: 'tasks.0.camera_id' }} />);
    expect(screen.getByText('Select the item used on this day')).toBeInTheDocument();
    expect(screen.queryByText(/affects more than this day/i)).not.toBeInTheDocument();
  });

  it('renders the descriptor primaryAction verbatim and gates the reach cue on reachesBeyondDay', () => {
    // Drive several representative codes and assert the hint mirrors ownershipForIssue exactly,
    // so the rendered copy can never drift from the single ownership descriptor source.
    const codes = [
      'empty_location',
      'dangling_camera_ref',
      'duplicate_behavioral_event_description',
      'unpinned_configuration',
      'raw_corruption',
    ];
    for (const code of codes) {
      const issue = { code, path: '' };
      const descriptor = ownershipForIssue(issue);
      const { unmount } = render(<IssueOwnershipHint issue={issue} />);
      expect(screen.getByText(descriptor.primaryAction)).toBeInTheDocument();
      if (descriptor.reachesBeyondDay) {
        expect(screen.getByText(/affects more than this day/i)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/affects more than this day/i)).not.toBeInTheDocument();
      }
      unmount();
    }
  });

  it('exposes the resolved ownership pattern as a data attribute for styling/testing', () => {
    const { container } = render(
      <IssueOwnershipHint issue={{ code: 'empty_location', path: '' }} />
    );
    const hint = container.querySelector('.issue-ownership-hint');
    expect(hint).toHaveAttribute('data-ownership-pattern', 'configuration_version');
  });

  it('is robust to a null/empty issue (falls back to the day-metadata default)', () => {
    render(<IssueOwnershipHint issue={null} />);
    // The default pattern is a day fact — a local repair, no cross-day reach. (The copy uses a
    // typographic apostrophe, so match loosely.)
    expect(screen.getByText(/Fix this day.s recording facts/i)).toBeInTheDocument();
    expect(screen.queryByText(/affects more than this day/i)).not.toBeInTheDocument();
  });
});
