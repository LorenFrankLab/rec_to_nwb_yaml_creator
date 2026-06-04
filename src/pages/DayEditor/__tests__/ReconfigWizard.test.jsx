import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReconfigWizard from '../ReconfigWizard';
import DevicesStep from '../DevicesStep';
import { makeReconfigWorkspace } from '../../../state/__tests__/fixtures/reconfigWorkspace';

/**
 * Build mocked store actions the wizard calls. `addConfigurationSnapshot` returns the
 * created version (as the real store action does), which the wizard threads into
 * `applyConfigurationForward`.
 *
 * @param {number} [createdVersion] - Version the store reports for the new snapshot.
 * @returns {{ addConfigurationSnapshot: import('vitest').Mock, applyConfigurationForward: import('vitest').Mock }}
 */
function makeActions(createdVersion = 3) {
  return {
    addConfigurationSnapshot: vi.fn().mockReturnValue(createdVersion),
    applyConfigurationForward: vi.fn(),
  };
}

describe('ReconfigWizard [integration]', () => {
  it('forks the current configuration and applies the new version forward to the selected days', async () => {
    const user = userEvent.setup();
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId]; // configurationHistory [v1, v2]; latest = v2 (groups 0,1,2)
    const day = workspace.days[dayIds.day3];
    const prevDay = workspace.days[dayIds.day2];
    const candidateDays = [workspace.days[dayIds.day3], workspace.days[dayIds.day4]];
    const actions = makeActions();

    render(
      <ReconfigWizard
        isOpen
        onClose={vi.fn()}
        animal={animal}
        day={day}
        prevDay={prevDay}
        candidateDays={candidateDays}
        actions={actions}
      />
    );

    await user.type(screen.getByLabelText(/change description/i), 'Lowered CA1 tetrodes');
    await user.click(screen.getByRole('button', { name: /create version/i }));

    // Forks the CURRENT latest configuration (v2 = groups 0,1,2) into a new version...
    expect(actions.addConfigurationSnapshot).toHaveBeenCalledTimes(1);
    const [animalArg, configArg] = actions.addConfigurationSnapshot.mock.calls[0];
    expect(animalArg).toBe(animalId);
    expect(configArg.description).toBe('Lowered CA1 tetrodes');
    expect(configArg.devices.electrode_groups.map((g) => g.id)).toEqual([0, 1, 2]);

    // ...then applies the returned version (3) forward to the selected days.
    expect(actions.applyConfigurationForward).toHaveBeenCalledWith(animalId, 3, [dayIds.day3, dayIds.day4]);
  });

  it('applies forward using the version the store returns, not a prop-derived number', async () => {
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

    expect(actions.applyConfigurationForward).toHaveBeenCalledWith(animalId, 7, [dayIds.day3, dayIds.day4]);
  });

  it('shows the days that move and notes that earlier days stay pinned (no live-vs-snapshot diff)', () => {
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

    // Affected (moving) days are selectable checkboxes; earlier days are explicitly
    // noted as pinned.
    expect(screen.getByRole('checkbox', { name: new RegExp(workspace.days[dayIds.day3].date) })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: new RegExp(workspace.days[dayIds.day4].date) })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Days through ${prevDay.date}`))).toBeInTheDocument();

    // The dropped live-vs-snapshot diff UI is gone.
    expect(screen.queryByText(/Added group/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('reconfig-no-change')).not.toBeInTheDocument();
  });

  it('requires a description and at least one day before forking', async () => {
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
    expect(actions.addConfigurationSnapshot).not.toHaveBeenCalled();
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
    expect(actions.addConfigurationSnapshot).not.toHaveBeenCalled();
  });
});

describe('DevicesStep configuration-version indicator', () => {
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
      <DevicesStep
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
    expect(within(bar).getByRole('button', { name: /reconfigure devices/i })).toBeInTheDocument();
  });
});
