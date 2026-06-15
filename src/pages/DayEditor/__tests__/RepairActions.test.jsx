import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RepairActions from '../RepairActions';
import { toIssueViewModel } from '../../../viewModels/dayEditorViewModel';

// Phase 3-f: RepairActions renders the day-editor view-model's classified IssueViewModel list. These
// tests drive REAL validator codes through the real builder (`toIssueViewModel`) so the code → render
// pipeline (ownership hint, repair surface/kind/route, dedup, category grouping) is exercised
// end-to-end, then assert the component's rendering + routing. The code → classification mapping is
// additionally locked in dayEditorViewModel.test.ts.
const vm = (rawIssue) => toIssueViewModel(rawIssue, 'remy-2023-06-22', 'remy');

describe('RepairActions', () => {
  // Every issue carries an ownership-pattern hint (the safe next action + cross-day reach).
  it('renders the ownership-pattern hint next to each issue (animal-setup reaches beyond the day)', () => {
    render(
      <RepairActions
        issues={[vm({ path: 'electrode_groups[0].location', code: 'empty_location', repairSurface: 'animal', message: 'Electrode group 0 has an empty location.' })]}
        onNavigate={vi.fn()}
        animalId="remy"
      />
    );
    // Ownership pattern named, and the cross-day blast radius flagged (a shared/versioned fix).
    expect(screen.getByText('Pin or fix the configuration version')).toBeInTheDocument();
    expect(screen.getByText(/affects more than this day/i)).toBeInTheDocument();
    // Routing is unchanged — the repair button still names the canonical animal-surface target.
    expect(screen.getByRole('button', { name: /fix in animal setup →/i })).toBeInTheDocument();
  });

  it('flags a day-local repair without a cross-day reach cue', () => {
    render(
      <RepairActions
        issues={[vm({ path: 'session_description', code: 'required', message: 'session description is required' })]}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByText(/Fix this day.s recording facts/i)).toBeInTheDocument();
    expect(screen.queryByText(/affects more than this day/i)).not.toBeInTheDocument();
  });

  it('renders a "Fix in <step>" button for a day-surface issue and routes to its step', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <RepairActions
        issues={[vm({ path: 'session_description', code: 'required', message: 'session description is required' })]}
        onNavigate={onNavigate}
      />
    );

    const button = screen.getByRole('button', { name: /fix in overview/i });
    await user.click(button);
    expect(onNavigate).toHaveBeenCalledWith('overview', 'session_description');
  });

  it('navigates with an explicit focusPath when present, not the raw path', async () => {
    // A provenance-retagged geometry error keeps its schema `path` (e.g. an
    // electrode_groups field) but carries an explicit `focusPath` pointing at the day's
    // remove-override control. The button must focus the control that performs the fix.
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <RepairActions
        issues={[vm({
          path: 'electrode_groups[0].location',
          focusPath: 'deviceOverrides.electrode_groups',
          ownerSurface: 'day',
          step: 'devices',
          code: 'required',
          message: 'electrode group location is required',
        })]}
        onNavigate={onNavigate}
      />
    );
    await user.click(screen.getByRole('button', { name: /fix in devices/i }));
    expect(onNavigate).toHaveBeenCalledWith('devices', 'deviceOverrides.electrode_groups');
  });

  it('routes an animal-surface issue (device geometry) to the Animal Editor', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <RepairActions
        issues={[vm({
          path: 'electrode_groups[0].location',
          code: 'empty_location',
          repairSurface: 'animal',
          message: 'Electrode group 0 has an empty location.',
        })]}
        onNavigate={onNavigate}
        animalId="remy"
      />
    );

    const button = screen.getByRole('button', { name: /fix in animal setup/i });
    await user.click(button);
    // The animal surface routes via the 'animal' sentinel so the Day Editor handler
    // can hand off to the Animal Editor route; the field target is preserved.
    expect(onNavigate).toHaveBeenCalledWith('animal', 'electrode_groups[0].location');
  });

  it('routes an AJV schema issue under electrode_groups to the Animal Editor (metadata fallback)', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <RepairActions
        issues={[vm({ path: 'electrode_groups[0].targeted_x', code: 'type', message: 'must be number' })]}
        onNavigate={onNavigate}
        animalId="remy"
      />
    );

    await user.click(screen.getByRole('button', { name: /fix in animal setup/i }));
    expect(onNavigate).toHaveBeenCalledWith('animal', 'electrode_groups[0].targeted_x');
  });

  it('routes a day-surface device override (bad_channel_out_of_range) to the Devices step', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <RepairActions
        issues={[vm({
          path: 'ntrode_electrode_group_channel_map[0]',
          field: 'bad_channels',
          step: 'devices',
          code: 'bad_channel_out_of_range',
          repairSurface: 'day',
          message: 'bad channel out of range',
        })]}
        onNavigate={onNavigate}
      />
    );

    await user.click(screen.getByRole('button', { name: /fix in devices/i }));
    expect(onNavigate).toHaveBeenCalledWith('devices', 'ntrode_electrode_group_channel_map[0]');
  });

  it('collapses duplicate repair buttons for issues that share one underlying fix', () => {
    // A shadowed day geometry override produces both a retagged base schema error and a
    // shadowed_geometry_override — both routing to the same remove-override control. Render
    // both messages, but only ONE "Fix in Devices" button.
    const issues = [
      { code: 'required', path: 'electrode_groups[0].location', focusPath: 'deviceOverrides.electrode_groups', ownerSurface: 'day', step: 'devices', message: 'electrode group location is required' },
      { code: 'shadowed_geometry_override', path: 'deviceOverrides.electrode_groups', focusPath: 'deviceOverrides.electrode_groups', ownerSurface: 'day', step: 'devices', message: 'this day overrides the saved geometry' },
    ];
    render(<RepairActions issues={issues.map(vm)} onNavigate={vi.fn()} />);
    expect(screen.getByText(/location is required/i)).toBeInTheDocument();
    expect(screen.getByText(/overrides the saved geometry/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /fix in devices/i })).toHaveLength(1);
  });

  it('executes a repairCommand (not navigate) when an issue carries one and onRepair is provided', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onRepair = vi.fn();
    const issue = {
      path: 'tasks',
      field: 'tasks',
      ownerSurface: 'day',
      step: 'epochs',
      code: 'malformed_day_collection',
      actionLabel: 'Reset tasks',
      repairCommand: { type: 'resetDayCollection', field: 'tasks' },
      message: "This day's \"tasks\" is corrupt (expected a list).",
    };
    render(<RepairActions issues={[vm(issue)]} onNavigate={onNavigate} onRepair={onRepair} />);

    // The button reads as a destructive reset that names what it resets — not "Fix in …".
    const button = screen.getByRole('button', { name: /reset tasks/i });
    await user.click(button);
    // onRepair receives the dispatch reconstructed from the view-model command (type + payload).
    expect(onRepair).toHaveBeenCalledWith(
      expect.objectContaining({ repairCommand: { type: 'resetDayCollection', field: 'tasks' }, repairSurface: 'day' })
    );
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('renders the executable reset button for a commandable issue (the view-model commits it to execute)', () => {
    const onNavigate = vi.fn();
    const issue = {
      path: 'cameras',
      field: 'cameras',
      ownerSurface: 'animal',
      code: 'malformed_animal_collection',
      actionLabel: 'Reset cameras',
      repairCommand: { type: 'resetAnimalCameras' },
      message: "This animal's \"cameras\" is corrupt (expected a list).",
    };
    render(<RepairActions issues={[vm(issue)]} onNavigate={onNavigate} animalId="remy" />);

    // The view-model classified this commandable issue as an executable repair (Phase 3-f), so the
    // button names the reset action — not "Fix in …". (The Day Editor always wires onRepair.)
    expect(screen.getByRole('button', { name: /reset cameras/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fix in animal setup/i })).not.toBeInTheDocument();
  });

  it('does NOT collapse two issues that share a focusPath but carry DIFFERENT executable commands', async () => {
    // Dedup is keyed on the repair TARGET; two distinct executable repairs (different
    // repairCommands) on the same focusPath must each keep their button, or one fix vanishes.
    const user = userEvent.setup();
    const onRepair = vi.fn();
    const issues = [
      {
        code: 'malformed_bad_channel_override', path: 'deviceOverrides.bad_channels.1',
        focusPath: 'deviceOverrides.bad_channels.1', ownerSurface: 'day', step: 'devices',
        actionLabel: 'Remove failed-channel override',
        repairCommand: { type: 'removeBadChannelOverrideKey', key: '1' },
        message: 'bad_channels 1 is corrupt',
      },
      {
        code: 'malformed_device_override', path: 'deviceOverrides.bad_channels.1',
        focusPath: 'deviceOverrides.bad_channels.1', ownerSurface: 'day', step: 'devices',
        actionLabel: 'Remove device overrides',
        repairCommand: { type: 'resetDeviceOverrides' },
        message: 'whole overrides corrupt',
      },
    ];
    render(<RepairActions issues={issues.map(vm)} onNavigate={vi.fn()} onRepair={onRepair} />);
    // Both executable buttons render (distinct commands), not collapsed to one.
    expect(screen.getByRole('button', { name: /remove failed-channel override/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove device overrides/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /remove device overrides/i }));
    expect(onRepair).toHaveBeenCalledWith(expect.objectContaining({ repairCommand: { type: 'resetDeviceOverrides' } }));
  });

  it('groups issues under workflow-category headings when groupByCategory is set', () => {
    render(
      <RepairActions
        groupByCategory
        issues={[
          { code: 'empty_location', path: 'electrode_groups[0].location', message: 'location is empty' },
          { code: 'duplicate_task_epoch', path: 'tasks[0].task_epochs', message: 'duplicate epoch' },
          { code: 'bad_channel_out_of_range', path: 'ntrode_electrode_group_channel_map[0].bad_channels', message: 'channel 9 out of range' },
        ].map(vm)}
        onNavigate={vi.fn()}
      />
    );

    // Headings in workflow order; every message still renders.
    expect(screen.getByRole('heading', { name: /animal setup/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^day metadata$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /day-specific failed channels/i })).toBeInTheDocument();
    expect(screen.getByText('location is empty')).toBeInTheDocument();
    expect(screen.getByText('channel 9 out of range')).toBeInTheDocument();
  });

  it('dedups the shared repair button in grouped mode when issues share a repair target', () => {
    // Grouped mode keeps ONE shared dedup set across category groups, so two issues that route
    // to the same override-removal control show one button (every message still renders).
    render(
      <RepairActions
        groupByCategory
        issues={[
          {
            code: 'stale_bad_channel_override',
            focusPath: 'deviceOverrides.bad_channels',
            ownerSurface: 'day',
            step: 'devices',
            repairCommand: { type: 'resetBadChannelOverrides' },
            actionLabel: 'Remove failed-channel override',
            message: 'stale override',
          },
          {
            code: 'malformed_bad_channel_override',
            focusPath: 'deviceOverrides.bad_channels',
            ownerSurface: 'day',
            step: 'devices',
            repairCommand: { type: 'resetBadChannelOverrides' },
            actionLabel: 'Remove failed-channel override',
            message: 'corrupt override',
          },
        ].map(vm)}
        onNavigate={vi.fn()}
        onRepair={vi.fn()}
      />
    );

    // Both messages render, but the shared repair button appears exactly once.
    expect(screen.getByText('stale override')).toBeInTheDocument();
    expect(screen.getByText('corrupt override')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /remove failed-channel override/i })).toHaveLength(1);
  });

  it('does NOT render a fix button for non-repairable identity issues (slash ids)', () => {
    render(
      <RepairActions
        issues={[
          { path: 'subject.subject_id', code: 'subject_id_slash', message: 'Subject ID … recreate the animal …' },
          { path: 'session_id', code: 'session_id_slash', message: 'Session ID … fix the Subject ID …' },
        ].map(vm)}
        onNavigate={vi.fn()}
      />
    );

    // The explanatory messages show…
    expect(screen.getByText(/recreate the animal/i)).toBeInTheDocument();
    expect(screen.getByText(/fix the Subject ID/i)).toBeInTheDocument();
    // …but there is no misleading "Fix in …" button that would dead-end on a read-only field.
    expect(screen.queryByRole('button', { name: /fix in/i })).not.toBeInTheDocument();
  });
});
