import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import FailedChannelsTab from '../DayEditor/FailedChannelsTab';

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

describe('FailedChannelsTab tolerates corrupt deviceOverrides', () => {
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
        <FailedChannelsTab
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
