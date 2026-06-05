import { describe, it, expect } from 'vitest';
import {
  normalizeDevices,
  normalizeElectrodeGroup,
  normalizeElectrodeGroupWithDefaults,
  normalizeNtrodeMap,
  normalizeNtrodeMapWithDefaults,
  normalizeWorkspaceDevices,
  parseExactInteger,
} from '../deviceNormalization';

describe('parseExactInteger (Normalization Contract)', () => {
  it('returns the integer for a genuine integer or exact integer-string', () => {
    expect(parseExactInteger(2)).toBe(2);
    expect(parseExactInteger(0)).toBe(0);
    expect(parseExactInteger('2')).toBe(2);
    expect(parseExactInteger('0')).toBe(0);
    expect(parseExactInteger('-3')).toBe(-3);
  });

  it('PRESERVES corrupt values unchanged so schema/rules can flag them', () => {
    // Non-integer number and inexact strings are never coerced or synthesized.
    expect(parseExactInteger(2.9)).toBe(2.9);
    expect(parseExactInteger('2.9')).toBe('2.9');
    expect(parseExactInteger('abc')).toBe('abc');
    expect(parseExactInteger('')).toBe('');
    expect(parseExactInteger(' 2')).toBe(' 2');
    expect(parseExactInteger('1e3')).toBe('1e3');
    expect(parseExactInteger(null)).toBeNull();
    expect(parseExactInteger(undefined)).toBeUndefined();
  });
});

describe('device normalization (strict export/load path)', () => {
  it('coerces a clean integer-string id to an integer without synthesizing text', () => {
    const group = normalizeElectrodeGroup({
      id: '2',
      location: ' CA1 ',
      device_type: 'tetrode_12.5',
      description: 'CA1 tetrode 1',
      targeted_location: ' CA1 ',
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
      description: 'CA1 tetrode 1',
      targeted_location: 'CA1',
      targeted_x: 1.25,
      targeted_y: -2.5,
      targeted_z: 3,
      units: 'mm',
    });
    expect(group).not.toHaveProperty('bad_channels');
  });

  it('does NOT synthesize description/targeted_location from location (leaves empty)', () => {
    const group = normalizeElectrodeGroup({
      id: 0,
      location: 'CA1',
      device_type: 'tetrode_12.5',
      // no description, no targeted_location
    });

    expect(group.description).toBe('');
    expect(group.targeted_location).toBe('');
  });

  it('PRESERVES a corrupt electrode-group id so AJV integer type can flag it', () => {
    const group = normalizeElectrodeGroup({ id: 'abc', location: 'CA1', device_type: 'tetrode_12.5' });
    expect(group.id).toBe('abc');

    const decimal = normalizeElectrodeGroup({ id: '2.9', location: 'CA1', device_type: 'tetrode_12.5' });
    expect(decimal.id).toBe('2.9');
  });

  it('coerces clean ntrode ids and PRESERVES lossless map entries', () => {
    const ntrode = normalizeNtrodeMap({
      ntrode_id: '7',
      electrode_group_id: '2',
      electrode_id: 12,
      bad_channels: ['1', 1, 3],
      map: { 0: '4', 1: 5 },
    });

    expect(ntrode).toEqual({
      ntrode_id: 7,
      electrode_group_id: 2,
      bad_channels: [1, 3],
      map: { 0: 4, 1: 5 },
    });
    expect(ntrode).not.toHaveProperty('electrode_id');
  });

  it('PRESERVES corrupt ntrode ids and corrupt map entries (no coercion, no drop)', () => {
    const ntrode = normalizeNtrodeMap({
      ntrode_id: 'abc',
      electrode_group_id: 'abc',
      bad_channels: [],
      // "2.9" must NOT become 2 (lossy); "bad" key must NOT be dropped.
      map: { 0: '2.9', bad: 'value' },
    });

    expect(ntrode.ntrode_id).toBe('abc');
    expect(ntrode.electrode_group_id).toBe('abc');
    expect(ntrode.map).toEqual({ 0: '2.9', bad: 'value' });
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
              { id: '0', location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1', targeted_location: 'CA1', bad_channels: '' },
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
                  { id: '1', location: 'CA3', device_type: 'tetrode_12.5', description: 'CA3', targeted_location: 'CA3', bad_channels: '' },
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

describe('device normalization (creation-defaults path)', () => {
  it('synthesizes description/targeted_location and a default id when creating', () => {
    const group = normalizeElectrodeGroupWithDefaults(
      { location: ' CA1 ', device_type: 'tetrode_12.5' },
      3
    );

    expect(group.id).toBe(3);
    expect(group.location).toBe('CA1');
    // Creation may legitimately fill blanks from location.
    expect(group.description).toBe('CA1');
    expect(group.targeted_location).toBe('CA1');
  });

  it('keeps explicit creation text and a clean integer-string id', () => {
    const group = normalizeElectrodeGroupWithDefaults(
      { id: '2', location: 'CA1', device_type: 'tetrode_12.5', description: 'tet', targeted_location: 'CA1' },
      0
    );
    expect(group.id).toBe(2);
    expect(group.description).toBe('tet');
  });

  it('applies fallback ids when creating an ntrode row without ids', () => {
    const ntrode = normalizeNtrodeMapWithDefaults({ map: { 0: 0 }, bad_channels: [] }, 5, 7);
    expect(ntrode.ntrode_id).toBe(5);
    expect(ntrode.electrode_group_id).toBe(7);
  });
});
