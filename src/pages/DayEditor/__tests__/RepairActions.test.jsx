import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RepairActions from '../RepairActions';

describe('RepairActions', () => {
  it('renders a "Fix in <step>" button for a day-surface issue and routes to its step', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <RepairActions
        issues={[{ path: 'session_description', code: 'required', message: 'session description is required' }]}
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
        issues={[{
          path: 'electrode_groups[0].location',
          focusPath: 'deviceOverrides.electrode_groups',
          ownerSurface: 'day',
          step: 'devices',
          code: 'required',
          message: 'electrode group location is required',
        }]}
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
        issues={[{
          path: 'electrode_groups[0].location',
          code: 'empty_location',
          repairSurface: 'animal',
          message: 'Electrode group 0 has an empty location.',
        }]}
        onNavigate={onNavigate}
        animalId="remy"
      />
    );

    const button = screen.getByRole('button', { name: /fix in animal editor/i });
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
        issues={[{ path: 'electrode_groups[0].targeted_x', code: 'type', message: 'must be number' }]}
        onNavigate={onNavigate}
        animalId="remy"
      />
    );

    await user.click(screen.getByRole('button', { name: /fix in animal editor/i }));
    expect(onNavigate).toHaveBeenCalledWith('animal', 'electrode_groups[0].targeted_x');
  });

  it('routes a day-surface device override (bad_channel_out_of_range) to the Devices step', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <RepairActions
        issues={[{
          path: 'ntrode_electrode_group_channel_map[0]',
          field: 'bad_channels',
          step: 'devices',
          code: 'bad_channel_out_of_range',
          repairSurface: 'day',
          message: 'bad channel out of range',
        }]}
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
    render(<RepairActions issues={issues} onNavigate={vi.fn()} />);
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
    render(<RepairActions issues={[issue]} onNavigate={onNavigate} onRepair={onRepair} />);

    // The button reads as a destructive reset that names what it resets — not "Fix in …".
    const button = screen.getByRole('button', { name: /reset tasks/i });
    await user.click(button);
    expect(onRepair).toHaveBeenCalledWith(issue);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('falls back to a navigate button when no onRepair is wired (backward compatible)', async () => {
    const user = userEvent.setup();
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
    render(<RepairActions issues={[issue]} onNavigate={onNavigate} animalId="remy" />);

    // With no executor wired, the commandable issue still routes to its editable owner.
    const button = screen.getByRole('button', { name: /fix in animal editor/i });
    await user.click(button);
    expect(onNavigate).toHaveBeenCalledWith('animal', 'cameras');
  });

  it('does NOT render a fix button for non-repairable identity issues (slash ids)', () => {
    render(
      <RepairActions
        issues={[
          { path: 'subject.subject_id', code: 'subject_id_slash', message: 'Subject ID … recreate the animal …' },
          { path: 'session_id', code: 'session_id_slash', message: 'Session ID … fix the Subject ID …' },
        ]}
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
