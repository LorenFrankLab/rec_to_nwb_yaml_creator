import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DevicesStep from '../DevicesStep';

/**
 * MEDIUM review finding 3 — stale bad-channel override is visible but not repairable.
 *
 * A `stale_bad_channel_override` issue (path `deviceOverrides.bad_channels`, e.g. key
 * `999` with no resolved ntrode) routes to the Devices step, but DevicesStep only
 * renders controls for RESOLVED ntrodes — the stale key has no row, no anchor, no
 * clear action (a repair dead-end). DevicesStep must detect override keys that match
 * NO resolved ntrode_id and render a visible, focusable repair control carrying
 * `data-field-path="deviceOverrides.bad_channels"` whose click removes only that key
 * via a single atomic `onFieldUpdate('deviceOverrides.bad_channels', nextObject)`.
 */
describe('DevicesStep — stale bad-channel override repair (Finding 3)', () => {
  const ELECTRODE_GROUPS = [
    {
      id: 0,
      location: 'CA1',
      device_type: 'tetrode_12.5',
      description: 'Dorsal CA1 tetrode',
      targeted_location: 'CA1',
      targeted_x: 2.6,
      targeted_y: -3.8,
      targeted_z: 1.5,
      units: 'mm',
    },
  ];
  const NTRODE_MAP = [
    { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
  ];
  const historyFor = (devices) => [
    { version: 1, date: '2023-06-22', description: 'Initial', devices, appliedToDays: [] },
  ];
  const mockAnimal = {
    id: 'test-animal',
    devices: { electrode_groups: ELECTRODE_GROUPS, ntrode_electrode_group_channel_map: NTRODE_MAP },
    configurationHistory: historyFor({
      electrode_groups: ELECTRODE_GROUPS,
      ntrode_electrode_group_channel_map: NTRODE_MAP,
    }),
  };
  const mockMergedDay = { ...mockAnimal };

  let onFieldUpdate;
  beforeEach(() => {
    onFieldUpdate = vi.fn();
  });

  it('renders a focusable repair control for an override key with no resolved ntrode', () => {
    // ntrode 0 resolves; ntrode 999 is stale (no matching ntrode_id).
    const day = {
      id: 'd1',
      animalId: 'test-animal',
      date: '2023-06-22',
      configurationVersion: 1,
      deviceOverrides: { bad_channels: { '0': [1], '999': [2] } },
    };

    render(
      <DevicesStep
        animal={mockAnimal}
        day={day}
        mergedDay={mockMergedDay}
        onFieldUpdate={onFieldUpdate}
      />
    );

    const control = screen.getByRole('button', { name: /stale failed-channel override for ntrode 999/i });
    expect(control).toBeInTheDocument();
    expect(control).toHaveAttribute('data-field-path', 'deviceOverrides.bad_channels');
  });

  it('does NOT render a stale repair control for a key that DOES resolve to an ntrode', () => {
    const day = {
      id: 'd1',
      animalId: 'test-animal',
      date: '2023-06-22',
      configurationVersion: 1,
      deviceOverrides: { bad_channels: { '0': [1] } },
    };

    render(
      <DevicesStep
        animal={mockAnimal}
        day={day}
        mergedDay={mockMergedDay}
        onFieldUpdate={onFieldUpdate}
      />
    );

    expect(screen.queryByRole('button', { name: /stale failed-channel override/i })).toBeNull();
  });

  it('clicking the repair control emits ONE atomic update removing ONLY the stale key', async () => {
    const user = userEvent.setup();
    const day = {
      id: 'd1',
      animalId: 'test-animal',
      date: '2023-06-22',
      configurationVersion: 1,
      deviceOverrides: { bad_channels: { '0': [1], '999': [2] } },
    };

    render(
      <DevicesStep
        animal={mockAnimal}
        day={day}
        mergedDay={mockMergedDay}
        onFieldUpdate={onFieldUpdate}
      />
    );

    await user.click(screen.getByRole('button', { name: /stale failed-channel override for ntrode 999/i }));

    expect(onFieldUpdate).toHaveBeenCalledTimes(1);
    expect(onFieldUpdate).toHaveBeenCalledWith('deviceOverrides.bad_channels', { '0': [1] });
  });

  it('renders one repair control per stale key when several are present', () => {
    const day = {
      id: 'd1',
      animalId: 'test-animal',
      date: '2023-06-22',
      configurationVersion: 1,
      deviceOverrides: { bad_channels: { '0': [1], '999': [2], '888': [3] } },
    };

    render(
      <DevicesStep
        animal={mockAnimal}
        day={day}
        mergedDay={mockMergedDay}
        onFieldUpdate={onFieldUpdate}
      />
    );

    expect(screen.getByRole('button', { name: /stale failed-channel override for ntrode 999/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stale failed-channel override for ntrode 888/i })).toBeInTheDocument();
  });
});

/**
 * Round-6 review findings — every malformed `deviceOverrides` shape that blocks export
 * (surfaced by `dayOverrideIssues`) must also be REPAIRABLE on the Devices step, not
 * just gated. The merge declines to apply these, so they have no editor row; DevicesStep
 * renders a focusable removal control for each.
 */
describe('DevicesStep — malformed override repair (round-6)', () => {
  const ELECTRODE_GROUPS = [
    {
      id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'Dorsal CA1 tetrode',
      targeted_location: 'CA1', targeted_x: 2.6, targeted_y: -3.8, targeted_z: 1.5, units: 'mm',
    },
  ];
  const NTRODE_MAP = [
    { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
  ];
  const mockAnimal = {
    id: 'test-animal',
    devices: { electrode_groups: ELECTRODE_GROUPS, ntrode_electrode_group_channel_map: NTRODE_MAP },
    configurationHistory: [
      { version: 1, date: '2023-06-22', description: 'Initial', appliedToDays: [], devices: { electrode_groups: ELECTRODE_GROUPS, ntrode_electrode_group_channel_map: NTRODE_MAP } },
    ],
  };
  const mockMergedDay = { ...mockAnimal };
  const baseDay = { id: 'd1', animalId: 'test-animal', date: '2023-06-22', configurationVersion: 1 };

  let onFieldUpdate;
  beforeEach(() => { onFieldUpdate = vi.fn(); });

  const renderWith = (deviceOverrides) =>
    render(<DevicesStep animal={mockAnimal} day={{ ...baseDay, deviceOverrides }} mergedDay={mockMergedDay} onFieldUpdate={onFieldUpdate} />);

  it('offers a per-key removal for a malformed (non-array) VALUE under a valid ntrode key', async () => {
    const user = userEvent.setup();
    renderWith({ bad_channels: { '0': '23' } });
    const control = screen.getByRole('button', { name: /corrupt failed-channel override for ntrode 0/i });
    expect(control).toHaveAttribute('data-field-path', 'deviceOverrides.bad_channels');
    await user.click(control);
    expect(onFieldUpdate).toHaveBeenCalledTimes(1);
    expect(onFieldUpdate).toHaveBeenCalledWith('deviceOverrides.bad_channels', {});
  });

  it('offers a whole-container removal for a scalar bad_channels container', async () => {
    const user = userEvent.setup();
    renderWith({ bad_channels: '2.9' });
    const control = screen.getByRole('button', { name: /remove corrupt failed-channel override/i });
    expect(control).toHaveAttribute('data-field-path', 'deviceOverrides.bad_channels');
    await user.click(control);
    expect(onFieldUpdate).toHaveBeenCalledTimes(1);
    // The whole deviceOverrides is rewritten without the corrupt bad_channels key.
    expect(onFieldUpdate).toHaveBeenCalledWith('deviceOverrides', {});
  });

  it('offers removal for a malformed (non-array) geometry override', async () => {
    const user = userEvent.setup();
    renderWith({ electrode_groups: 'corrupt' });
    const control = screen.getByRole('button', { name: /remove corrupt electrode_groups override/i });
    expect(control).toHaveAttribute('data-field-path', 'deviceOverrides.electrode_groups');
    await user.click(control);
    expect(onFieldUpdate).toHaveBeenCalledTimes(1);
    expect(onFieldUpdate).toHaveBeenCalledWith('deviceOverrides', {});
  });

  it('does not render any malformed-override control for clean overrides', () => {
    renderWith({ bad_channels: { '0': [1] } });
    expect(screen.queryByRole('button', { name: /corrupt/i })).toBeNull();
  });
});
