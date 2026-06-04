import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReconfigWizard from '../ReconfigWizard';
import DevicesStep from '../DevicesStep';
import { makeReconfigWorkspace } from '../../../state/__tests__/fixtures/reconfigWorkspace';

/**
 * Build mocked store actions the wizard calls.
 *
 * @returns {{ addConfigurationSnapshot: import('vitest').Mock, applyConfigurationForward: import('vitest').Mock }}
 */
function makeActions() {
  return {
    addConfigurationSnapshot: vi.fn(),
    applyConfigurationForward: vi.fn(),
  };
}

describe('ReconfigWizard [integration]', () => {
  it('versions the live config and applies it forward with the correct version and day ids', async () => {
    const user = userEvent.setup();
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    const day = workspace.days[dayIds.day3];
    const prevDay = workspace.days[dayIds.day2]; // resolves v1; animal.devices is v2 → a real diff
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

    // The diff is non-empty (v1 → v2 added group 2 + ntrode 3, changed ntrode 2).
    expect(screen.getByText(/Added group 2/)).toBeInTheDocument();
    expect(screen.getByText(/Added ntrode 3/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/change description/i), 'Lowered CA1 tetrodes');
    await user.click(screen.getByRole('button', { name: /apply to/i }));

    // Creates the snapshot from the live (v2) config...
    expect(actions.addConfigurationSnapshot).toHaveBeenCalledTimes(1);
    const [animalArg, configArg] = actions.addConfigurationSnapshot.mock.calls[0];
    expect(animalArg).toBe(animalId);
    expect(configArg.description).toBe('Lowered CA1 tetrodes');
    expect(configArg.devices.electrode_groups.map((g) => g.id)).toEqual([0, 1, 2]);

    // ...then applies the NEW version (3 = existing 2 snapshots + 1) forward to the days.
    expect(actions.applyConfigurationForward).toHaveBeenCalledWith(animalId, 3, [dayIds.day3, dayIds.day4]);
  });

  it('shows a no-change state and disables apply when the config is unchanged', () => {
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId]; // devices === v2
    const day = workspace.days[dayIds.day4];
    const prevDay = workspace.days[dayIds.day3]; // also v2 → no diff vs animal.devices
    const actions = makeActions();

    render(
      <ReconfigWizard
        isOpen
        onClose={vi.fn()}
        animal={animal}
        day={day}
        prevDay={prevDay}
        candidateDays={[workspace.days[dayIds.day4]]}
        actions={actions}
      />
    );

    expect(screen.getByTestId('reconfig-no-change')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply to/i })).toBeDisabled();
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
