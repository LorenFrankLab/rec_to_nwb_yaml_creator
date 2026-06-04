import { describe, it, expect } from 'vitest';
import {
  normalizeDevices,
  normalizeElectrodeGroup,
  normalizeNtrodeMap,
  normalizeWorkspaceDevices,
} from '../deviceNormalization';

describe('device normalization', () => {
  it('coerces electrode groups to schema keys with integer ids', () => {
    const group = normalizeElectrodeGroup({
      id: '2',
      location: ' CA1 ',
      device_type: 'tetrode_12.5',
      targeted_x: '1.25',
      targeted_y: '-2.5',
      targeted_z: '3',
      units: ' mm ',
      bad_channels: '1,2',
    });

    expect(group).toEqual({
      id: 2,
      location: 'CA1',
      device_type: 'tetrode_12.5',
      description: 'CA1',
      targeted_location: 'CA1',
      targeted_x: 1.25,
      targeted_y: -2.5,
      targeted_z: 3,
      units: 'mm',
    });
    expect(group).not.toHaveProperty('bad_channels');
  });

  it('coerces ntrode ids and drops non-schema map keys', () => {
    const ntrode = normalizeNtrodeMap({
      ntrode_id: '7',
      electrode_group_id: '2',
      electrode_id: 12,
      bad_channels: ['1', 1, 3],
      map: { 0: '4', 1: 5, bad: 'value' },
    });

    expect(ntrode).toEqual({
      ntrode_id: 7,
      electrode_group_id: 2,
      bad_channels: [1, 3],
      map: { 0: 4, 1: 5 },
    });
    expect(ntrode).not.toHaveProperty('electrode_id');
  });

  it('defaults partial devices to a non-empty Trodes device name', () => {
    expect(normalizeDevices({ device: { name: [] } }).device.name).toEqual(['Trodes']);
    expect(normalizeDevices({}).device.name).toEqual(['Trodes']);
  });

  it('normalizes animals, snapshots, and day device overrides in a workspace', () => {
    const workspace = {
      animals: {
        remy: {
          devices: {
            device: { name: [] },
            electrode_groups: [
              { id: '0', location: 'CA1', device_type: 'tetrode_12.5', bad_channels: '' },
            ],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: '1', electrode_group_id: '0', electrode_id: 4, bad_channels: [], map: { 0: 0 } },
            ],
          },
          configurationHistory: [
            {
              version: 1,
              devices: {
                electrode_groups: [
                  { id: '1', location: 'CA3', device_type: 'tetrode_12.5', bad_channels: '' },
                ],
                ntrode_electrode_group_channel_map: [
                  { ntrode_id: '2', electrode_group_id: '1', electrode_id: 9, bad_channels: [], map: { 0: 4 } },
                ],
              },
            },
          ],
        },
      },
      days: {
        d1: {
          deviceOverrides: {
            bad_channels: { 2: ['0', 1] },
          },
        },
      },
    };

    const normalized = normalizeWorkspaceDevices(workspace);

    expect(normalized.animals.remy.devices.device.name).toEqual(['Trodes']);
    expect(normalized.animals.remy.devices.electrode_groups[0]).not.toHaveProperty('bad_channels');
    expect(normalized.animals.remy.devices.ntrode_electrode_group_channel_map[0]).not.toHaveProperty('electrode_id');
    expect(normalized.animals.remy.configurationHistory[0].devices.electrode_groups[0].id).toBe(1);
    expect(normalized.days.d1.deviceOverrides.bad_channels).toEqual({ 2: [0, 1] });
  });
});
