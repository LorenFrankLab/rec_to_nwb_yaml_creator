/**
 * IssueOwnershipHint (Phase 8.7 Task 9). Validation/Export issue copy must additionally NAME the
 * ownership pattern — the safe next action ("Fix shared animal setup", "Select the item used on
 * this day", "Override this day's technical value", "Pin or fix the configuration version",
 * "Repair recovered data") — and flag when correcting an issue reaches beyond the day in front of
 * the user.
 *
 * Phase 3-f: the hint renders the classification straight off the IssueViewModel (the builder
 * resolved it from `ownershipForIssue`); it re-decides nothing. These tests feed view-models built
 * from real validator codes via `ownershipForIssue` (the same mapping the builder applies), so the
 * rendering is exercised AND the copy can't drift from the single ownership descriptor source.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import IssueOwnershipHint from '../IssueOwnershipHint';
import { ownershipForIssue } from '../../../domain/workflowOwnership';

// Build the ownership slice of an IssueViewModel from a raw issue, mirroring toIssueViewModel.
const hintVm = (rawIssue) => {
  const descriptor = ownershipForIssue(rawIssue);
  return {
    severity: 'error',
    message: '',
    ownership: descriptor.pattern,
    ownershipAction: descriptor.primaryAction,
    reachesBeyondDay: descriptor.reachesBeyondDay,
  };
};

describe('IssueOwnershipHint', () => {
  it('names the configuration-version action and flags cross-day reach for a probe/location error', () => {
    // empty_location is the versioned physical snapshot each day pins → reaches beyond this day.
    render(<IssueOwnershipHint issue={hintVm({ code: 'empty_location', path: 'electrode_groups.0.location' })} />);
    expect(screen.getByText('Pin or fix the configuration version')).toBeInTheDocument();
    expect(screen.getByText(/affects more than this day/i)).toBeInTheDocument();
  });

  it('names the day-side camera selection action with NO cross-day reach', () => {
    // dangling_camera_ref is the DAY side of a catalog reference — selecting the camera used on
    // this day is a local repair, so it must NOT warn "touches N days".
    render(<IssueOwnershipHint issue={hintVm({ code: 'dangling_camera_ref', path: 'tasks.0.camera_id' })} />);
    expect(screen.getByText('Select the item used on this day')).toBeInTheDocument();
    expect(screen.queryByText(/affects more than this day/i)).not.toBeInTheDocument();
  });

  it('names the recovered-data action for a corrupt/recovered-shape issue', () => {
    // malformed_day_collection is a real existing-data code → recovered_data pattern.
    render(<IssueOwnershipHint issue={hintVm({ code: 'malformed_day_collection', path: '' })} />);
    expect(screen.getByText('Repair recovered data')).toBeInTheDocument();
  });

  it('renders the view-model primaryAction verbatim and gates the reach cue on reachesBeyondDay', () => {
    // Drive several representative codes — one per distinct ownership pattern reachable here — and
    // assert the hint mirrors the view-model's ownership slice exactly. (Each code is a REAL
    // validator code so the mapping, not just the rendering, is exercised.)
    const codes = [
      'empty_location', // configuration_version (animal) — reaches beyond the day
      'dangling_camera_ref', // animal_catalog_reference (day) — local
      'duplicate_behavioral_event_description', // day_exported_list — local
      'unpinned_configuration', // configuration_version (day) — local
      'malformed_day_collection', // recovered_data — local
    ];
    for (const code of codes) {
      const issue = { code, path: '' };
      const descriptor = ownershipForIssue(issue);
      const { unmount } = render(<IssueOwnershipHint issue={hintVm(issue)} />);
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
      <IssueOwnershipHint issue={hintVm({ code: 'empty_location', path: '' })} />
    );
    const hint = container.querySelector('[data-ownership-pattern]');
    expect(hint).toHaveAttribute('data-ownership-pattern', 'configuration_version');
  });

  it('renders the day-metadata default action for an unclassified issue', () => {
    // The builder's default pattern (a day fact — a local repair, no cross-day reach). (The copy uses
    // a typographic apostrophe, so match loosely.)
    render(<IssueOwnershipHint issue={hintVm(null)} />);
    expect(screen.getByText(/Fix this day.s recording facts/i)).toBeInTheDocument();
    expect(screen.queryByText(/affects more than this day/i)).not.toBeInTheDocument();
  });
});
