import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReconfigWizard from '../ReconfigWizard';
import FailedChannelsTab from '../FailedChannelsTab';
import { makeReconfigWorkspace } from '../../../state/__tests__/fixtures/reconfigWorkspace';

/**
 * Build the mocked store action the wizard calls. `createConfigurationSnapshotAndApplyForward`
 * appends the snapshot AND pins the day range in one transition, returning the created version
 * (used only for the post-fork navigation).
 *
 * @param {number} [createdVersion] - Version the store reports for the new snapshot.
 * @returns {{ createConfigurationSnapshotAndApplyForward: import('vitest').Mock }}
 */
function makeActions(createdVersion = 3) {
  return {
    createConfigurationSnapshotAndApplyForward: vi.fn().mockReturnValue(createdVersion),
  };
}

describe('ReconfigWizard [integration]', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('forks the current configuration and applies the new version forward to the contiguous day range', async () => {
    const user = userEvent.setup();
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId]; // configurationHistory [v1, v2]; latest = v2 (groups 0,1,2)
    const day = workspace.days[dayIds.day3];
    const prevDay = workspace.days[dayIds.day2];
    const candidateDays = [workspace.days[dayIds.day4], workspace.days[dayIds.day2], workspace.days[dayIds.day3]];
    const actions = makeActions();
    const onClose = vi.fn();

    render(
      <ReconfigWizard
        isOpen
        onClose={onClose}
        animal={animal}
        day={day}
        prevDay={prevDay}
        candidateDays={candidateDays}
        actions={actions}
      />
    );

    await user.type(screen.getByLabelText(/change description/i), 'Lowered CA1 tetrodes');
    await user.click(screen.getByRole('button', { name: /create version/i }));

    // Forks the CURRENT latest configuration (v2 = groups 0,1,2) AND applies it forward to
    // the full chronological suffix in ONE atomic call (no version handed across two actions).
    expect(actions.createConfigurationSnapshotAndApplyForward).toHaveBeenCalledTimes(1);
    const [animalArg, configArg, dayIdsArg] = actions.createConfigurationSnapshotAndApplyForward.mock.calls[0];
    expect(animalArg).toBe(animalId);
    expect(configArg.description).toBe('Lowered CA1 tetrodes');
    expect(configArg.devices.electrode_groups.map((g) => g.id)).toEqual([0, 1, 2]);
    expect(dayIdsArg).toEqual([dayIds.day3, dayIds.day4]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe(
      `#/animal/${animalId}/electrode-groups?context=reconfigure&version=3&fromDay=${dayIds.day3}&movedDays=2`
    );
  });

  it('navigates using the version the store returns, not a prop-derived number', async () => {
    const user = userEvent.setup();
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    const day = workspace.days[dayIds.day3];
    const candidateDays = [workspace.days[dayIds.day3], workspace.days[dayIds.day4]];

    // The store reports version 7 as authoritative; a number re-derived from this
    // animal prop's history length would have guessed 3. The wizard must use 7.
    const actions = makeActions(7);

    render(
      <ReconfigWizard
        isOpen
        onClose={vi.fn()}
        animal={animal}
        day={day}
        prevDay={workspace.days[dayIds.day2]}
        candidateDays={candidateDays}
        actions={actions}
      />
    );

    await user.type(screen.getByLabelText(/change description/i), 'Lowered CA1 tetrodes');
    await user.click(screen.getByRole('button', { name: /create version/i }));

    expect(actions.createConfigurationSnapshotAndApplyForward).toHaveBeenCalledWith(
      animalId,
      expect.objectContaining({ description: 'Lowered CA1 tetrodes' }),
      [dayIds.day3, dayIds.day4]
    );
    expect(window.location.hash).toContain('version=7');
  });

  it('writes and navigates with the resolved animalKey, not the stale animal.id / day.animalId', async () => {
    const user = userEvent.setup();
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    // The store KEY (animalKey) is authoritative. Both the record's `id` field and the day's
    // `animalId` field carry STALE values here; routing the fork by either would misfile the
    // new version onto the wrong animal. The wizard must use animalKey for the write AND the nav.
    const animal = { ...structuredClone(workspace.animals[animalId]), id: 'stale-record-id' };
    const day = { ...workspace.days[dayIds.day3], animalId: 'stale-day-owner' };
    const candidateDays = [day, workspace.days[dayIds.day4]];
    const actions = makeActions(5);

    render(
      <ReconfigWizard
        isOpen
        onClose={vi.fn()}
        animal={animal}
        animalKey={animalId}
        day={day}
        prevDay={workspace.days[dayIds.day2]}
        candidateDays={candidateDays}
        actions={actions}
      />
    );

    await user.type(screen.getByLabelText(/change description/i), 'Lowered CA1 tetrodes');
    await user.click(screen.getByRole('button', { name: /create version/i }));

    const [animalArg] = actions.createConfigurationSnapshotAndApplyForward.mock.calls[0];
    expect(animalArg).toBe(animalId);
    expect(animalArg).not.toBe('stale-record-id');
    expect(animalArg).not.toBe('stale-day-owner');
    expect(window.location.hash).toContain(`#/animal/${animalId}/electrode-groups`);
  });

  it('falls back to a date range when the start day is not among the candidate days', async () => {
    const user = userEvent.setup();
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    const candidateDays = [
      workspace.days[dayIds.day1],
      workspace.days[dayIds.day2],
      workspace.days[dayIds.day3],
      workspace.days[dayIds.day4],
    ];
    // A start day whose id is NOT in candidateDays, dated at day3. The wizard must
    // fall back to the date range (every candidate day on/after that date), not crash
    // or move everything.
    const startDate = workspace.days[dayIds.day3].date;
    const ghostDay = { id: 'ghost-day', date: startDate };
    const expectedIds = candidateDays.filter((d) => d.date >= startDate).map((d) => d.id);
    const actions = makeActions(3);

    render(
      <ReconfigWizard
        isOpen
        onClose={vi.fn()}
        animal={animal}
        day={ghostDay}
        prevDay={workspace.days[dayIds.day2]}
        candidateDays={candidateDays}
        actions={actions}
      />
    );

    await user.type(screen.getByLabelText(/change description/i), 'Lowered CA1 tetrodes');
    await user.click(screen.getByRole('button', { name: /create version/i }));

    expect(actions.createConfigurationSnapshotAndApplyForward).toHaveBeenCalledWith(
      animalId,
      expect.objectContaining({ description: 'Lowered CA1 tetrodes' }),
      expectedIds
    );
    // Sanity: the range excludes earlier days and is non-empty.
    expect(expectedIds).toContain(dayIds.day3);
    expect(expectedIds).toContain(dayIds.day4);
    expect(expectedIds).not.toContain(dayIds.day1);
  });

  it('shows the days that move as a fixed range and notes that earlier days stay pinned', () => {
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    const day = workspace.days[dayIds.day3];
    const prevDay = workspace.days[dayIds.day2];
    const candidateDays = [workspace.days[dayIds.day3], workspace.days[dayIds.day4]];

    render(
      <ReconfigWizard
        isOpen
        onClose={vi.fn()}
        animal={animal}
        day={day}
        prevDay={prevDay}
        candidateDays={candidateDays}
        actions={makeActions()}
      />
    );

    // Affected days are a read-only confirmation list; arbitrary non-contiguous
    // deselection is not exposed.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    const movingList = screen.getByRole('list');
    expect(within(movingList).getByText(new RegExp(workspace.days[dayIds.day3].date))).toBeInTheDocument();
    expect(within(movingList).getByText(new RegExp(workspace.days[dayIds.day4].date))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Days through ${prevDay.date}`))).toBeInTheDocument();

    // The dropped live-vs-snapshot diff UI is gone.
    expect(screen.queryByText(/Added group/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('reconfig-no-change')).not.toBeInTheDocument();
  });

  it('requires a description before forking', async () => {
    const user = userEvent.setup();
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    const day = workspace.days[dayIds.day3];
    const candidateDays = [workspace.days[dayIds.day3]];
    const actions = makeActions();

    render(
      <ReconfigWizard
        isOpen
        onClose={vi.fn()}
        animal={animal}
        day={day}
        prevDay={workspace.days[dayIds.day2]}
        candidateDays={candidateDays}
        actions={actions}
      />
    );

    // No description → blocked with an error, nothing forked.
    await user.click(screen.getByRole('button', { name: /create version/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/description/i);
    expect(actions.createConfigurationSnapshotAndApplyForward).not.toHaveBeenCalled();
  });

  it('refuses to fork when no candidate days are available', async () => {
    const user = userEvent.setup();
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    const day = workspace.days[dayIds.day3];
    const actions = makeActions();

    render(
      <ReconfigWizard
        isOpen
        onClose={vi.fn()}
        animal={animal}
        day={day}
        prevDay={workspace.days[dayIds.day2]}
        candidateDays={[]}
        actions={actions}
      />
    );

    await user.type(screen.getByLabelText(/change description/i), 'Lowered CA1 tetrodes');
    await user.click(screen.getByRole('button', { name: /create version/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/no recording days/i);
    expect(actions.createConfigurationSnapshotAndApplyForward).not.toHaveBeenCalled();
  });

  it('refuses to fork an empty configuration (no probes to version)', async () => {
    const user = userEvent.setup();
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = structuredClone(workspace.animals[animalId]);
    // No probes configured anywhere — forking would create a version with no groups.
    animal.devices = { electrode_groups: [], ntrode_electrode_group_channel_map: [] };
    animal.configurationHistory = [
      { version: 1, date: '2023-06-22', description: 'Empty', devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] },
    ];
    const day = { ...workspace.days[dayIds.day1], configurationVersion: 1 };
    const actions = makeActions();

    render(
      <ReconfigWizard
        isOpen
        onClose={vi.fn()}
        animal={animal}
        day={day}
        prevDay={null}
        candidateDays={[day]}
        actions={actions}
      />
    );

    await user.type(screen.getByLabelText(/change description/i), 'Lowered tetrodes');
    await user.click(screen.getByRole('button', { name: /create version/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/configure probes/i);
    expect(actions.createConfigurationSnapshotAndApplyForward).not.toHaveBeenCalled();
  });
});

describe('FailedChannelsTab configuration-version indicator', () => {
  it('shows the day’s configuration version and how many days share it', () => {
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    const day = workspace.days[dayIds.day1]; // version 1, shared with day2
    const animalDays = [
      workspace.days[dayIds.day1],
      workspace.days[dayIds.day2],
      workspace.days[dayIds.day3],
      workspace.days[dayIds.day4],
    ];

    render(
      <FailedChannelsTab
        animal={animal}
        day={day}
        mergedDay={{}}
        onFieldUpdate={vi.fn()}
        animalDays={animalDays}
        actions={makeActions()}
      />
    );

    const bar = screen.getByText(/Configuration version 1/).closest('.config-version-bar');
    expect(within(bar).getByText(/Applied to 2 days/)).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: /hardware changed starting this day/i })).toBeInTheDocument();
  });
});
