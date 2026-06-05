import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import ChannelMapEditor from '../AnimalEditor/ChannelMapEditor';
import DevicesStep from '../DayEditor/DevicesStep';

/**
 * Boundary 4 — components NEVER throw on corrupt loaded state.
 *
 * The app preserves corrupt persisted state losslessly (so validation can flag it),
 * which means every component that renders that state must tolerate it: a non-array
 * `bad_channels`, a scalar `deviceOverrides`, etc. must render (degraded/empty + a
 * repair affordance), never crash the editor. This sweep renders the device editors
 * with a battery of corrupt shapes and asserts no throw — the single guardrail behind
 * the per-component repair tests.
 */

beforeEach(() => {
  vi.stubGlobal('alert', vi.fn());
});

describe('ChannelMapEditor tolerates corrupt loaded bad_channels', () => {
  const group = { id: 1, device_type: 'tetrode_12.5', location: 'CA1', targeted_x: 1, targeted_y: 2, targeted_z: 3, units: 'mm' };
  const rowWith = (bad) => [{ electrode_group_id: 1, ntrode_id: 0, bad_channels: bad, map: { 0: 0, 1: 1, 2: 2, 3: 3 } }];

  it.each([
    ['scalar string', '2.9'],
    ['scalar number', 42],
    ['null', null],
    ['out-of-range array', [99]],
    ['non-integer array', ['abc']],
  ])('renders for %s bad_channels without throwing or warning', (_label, bad) => {
    // Corrupt loaded state is first-class here (detected + repaired at runtime), so the
    // editor must render it WITHOUT a React prop-type console warning either.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(<ChannelMapEditor electrodeGroup={group} channelMaps={rowWith(bad)} onSave={vi.fn()} onCancel={vi.fn()} />)
    ).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('DevicesStep tolerates corrupt deviceOverrides', () => {
  const ELECTRODE_GROUPS = [
    { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'd', targeted_location: 'CA1', targeted_x: 2.6, targeted_y: -3.8, targeted_z: 1.5, units: 'mm' },
  ];
  const NTRODE_MAP = [{ ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } }];
  const devices = { electrode_groups: ELECTRODE_GROUPS, ntrode_electrode_group_channel_map: NTRODE_MAP };
  const animal = {
    id: 'a',
    devices,
    configurationHistory: [{ version: 1, date: '2023-06-22', description: 'i', appliedToDays: [], devices }],
  };
  const baseDay = { id: 'd', animalId: 'a', date: '2023-06-22', configurationVersion: 1 };

  it.each([
    ['scalar deviceOverrides', 'corrupt'],
    ['array deviceOverrides', [1, 2]],
    ['scalar bad_channels container', { bad_channels: '2.9' }],
    ['non-array geometry override', { electrode_groups: 'x' }],
    ['stale + corrupt bad_channels keys', { bad_channels: { 999: [0], 0: '23' } }],
  ])('renders for %s without throwing or warning', (_label, deviceOverrides) => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <DevicesStep
          animal={animal}
          day={{ ...baseDay, deviceOverrides }}
          mergedDay={{ ...animal }}
          onFieldUpdate={vi.fn()}
        />
      )
    ).not.toThrow();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
