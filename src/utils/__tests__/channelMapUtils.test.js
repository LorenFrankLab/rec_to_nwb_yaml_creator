/**
 * @jest-environment jsdom
 */

import {
  generateChannelMapsForGroup,
  generateAllChannelMaps,
  getNextNtrodeId
} from '../channelMapUtils';

describe('channelMapUtils', () => {
  describe('generateChannelMapsForGroup', () => {
    test('generates maps for tetrode (4 channels, 1 shank)', () => {
      const electrodeGroup = {
        id: '0',
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const result = generateChannelMapsForGroup(electrodeGroup);

      expect(result).toHaveLength(1); // 1 shank
      expect(result[0]).toEqual({
        electrode_group_id: '0',
        ntrode_id: '0',
        electrode_id: 0,
        bad_channels: [],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 }
      });
    });

    test('generates maps for 128-channel probe (128 channels, 4 shanks)', () => {
      const electrodeGroup = {
        id: '1',
        device_type: '128c-4s8mm6cm-20um-40um-sl',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const result = generateChannelMapsForGroup(electrodeGroup);

      expect(result).toHaveLength(4); // 4 shanks

      // Check first shank
      expect(result[0]).toEqual({
        electrode_group_id: '1',
        ntrode_id: '0',
        electrode_id: 0,
        bad_channels: [],
        map: expect.objectContaining({
          0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7,
          8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15,
          16: 16, 17: 17, 18: 18, 19: 19, 20: 20, 21: 21, 22: 22, 23: 23,
          24: 24, 25: 25, 26: 26, 27: 27, 28: 28, 29: 29, 30: 30, 31: 31
        })
      });

      // Check second shank
      expect(result[1].ntrode_id).toBe('1');
      expect(result[1].electrode_group_id).toBe('1');

      // Check third shank
      expect(result[2].ntrode_id).toBe('2');

      // Check fourth shank
      expect(result[3].ntrode_id).toBe('3');
    });

    test('uses sequential ntrode IDs starting from 0', () => {
      const electrodeGroup = {
        id: '5',
        device_type: '64c-4s6mm6cm-20um-40um-dl',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const result = generateChannelMapsForGroup(electrodeGroup);

      expect(result).toHaveLength(4); // 4 shanks
      expect(result[0].ntrode_id).toBe('0');
      expect(result[1].ntrode_id).toBe('1');
      expect(result[2].ntrode_id).toBe('2');
      expect(result[3].ntrode_id).toBe('3');
    });

    test('uses custom starting ntrode ID', () => {
      const electrodeGroup = {
        id: '0',
        device_type: '32c-2s8mm6cm-20um-40um-dl',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const result = generateChannelMapsForGroup(electrodeGroup, 10);

      expect(result).toHaveLength(2); // 2 shanks
      expect(result[0].ntrode_id).toBe('10');
      expect(result[1].ntrode_id).toBe('11');
    });

    test('creates identity mapping for each device type', () => {
      const electrodeGroup = {
        id: '0',
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const result = generateChannelMapsForGroup(electrodeGroup);

      // Identity mapping: channel index maps to channel number
      expect(result[0].map).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
    });

    test('handles electrode group with unknown device type (return empty array)', () => {
      const electrodeGroup = {
        id: '0',
        device_type: 'unknown_device',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const result = generateChannelMapsForGroup(electrodeGroup);

      expect(result).toEqual([]);
    });

    test('handles electrode group with undefined device type (return empty array)', () => {
      const electrodeGroup = {
        id: '0',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
        // device_type is undefined
      };

      const result = generateChannelMapsForGroup(electrodeGroup);

      expect(result).toEqual([]);
    });

    test('sets bad_channels to empty array by default', () => {
      const electrodeGroup = {
        id: '0',
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const result = generateChannelMapsForGroup(electrodeGroup);

      expect(result[0].bad_channels).toEqual([]);
    });

    test('sets electrode_id to 0 by default', () => {
      const electrodeGroup = {
        id: '0',
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const result = generateChannelMapsForGroup(electrodeGroup);

      expect(result[0].electrode_id).toBe(0);
    });

    test('includes electrode_group_id from source group', () => {
      const electrodeGroup = {
        id: '42',
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const result = generateChannelMapsForGroup(electrodeGroup);

      expect(result[0].electrode_group_id).toBe('42');
    });

    test('returns new objects (not mutating inputs)', () => {
      const electrodeGroup = {
        id: '0',
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const originalGroup = { ...electrodeGroup };
      const result = generateChannelMapsForGroup(electrodeGroup);

      expect(electrodeGroup).toEqual(originalGroup);
      expect(result[0]).not.toBe(electrodeGroup);
    });
  });

  describe('generateAllChannelMaps', () => {
    test('handles multiple groups', () => {
      const electrodeGroups = [
        {
          id: '0',
          device_type: 'tetrode_12.5',
          location: 'CA1',
          targeted_location: 'CA1',
          targeted_x: 1.0,
          targeted_y: 2.0,
          targeted_z: 3.0,
          units: 'mm'
        },
        {
          id: '1',
          device_type: 'tetrode_12.5',
          location: 'CA3',
          targeted_location: 'CA3',
          targeted_x: 2.0,
          targeted_y: 3.0,
          targeted_z: 4.0,
          units: 'mm'
        }
      ];

      const result = generateAllChannelMaps(electrodeGroups);

      expect(result).toHaveLength(2); // 1 shank per tetrode, 2 tetrodes
      expect(result[0].electrode_group_id).toBe('0');
      expect(result[1].electrode_group_id).toBe('1');
    });

    test('maintains sequential IDs across groups', () => {
      const electrodeGroups = [
        {
          id: '0',
          device_type: '32c-2s8mm6cm-20um-40um-dl', // 2 shanks
          location: 'CA1',
          targeted_location: 'CA1',
          targeted_x: 1.0,
          targeted_y: 2.0,
          targeted_z: 3.0,
          units: 'mm'
        },
        {
          id: '1',
          device_type: '64c-3s6mm6cm-20um-40um-sl', // 3 shanks
          location: 'CA3',
          targeted_location: 'CA3',
          targeted_x: 2.0,
          targeted_y: 3.0,
          targeted_z: 4.0,
          units: 'mm'
        }
      ];

      const result = generateAllChannelMaps(electrodeGroups);

      expect(result).toHaveLength(5); // 2 + 3 = 5 total shanks

      // First group gets IDs 0-1
      expect(result[0].ntrode_id).toBe('0');
      expect(result[1].ntrode_id).toBe('1');

      // Second group gets IDs 2-4
      expect(result[2].ntrode_id).toBe('2');
      expect(result[3].ntrode_id).toBe('3');
      expect(result[4].ntrode_id).toBe('4');
    });

    test('handles empty array', () => {
      const result = generateAllChannelMaps([]);
      expect(result).toEqual([]);
    });

    test('skips groups with unknown device types', () => {
      const electrodeGroups = [
        {
          id: '0',
          device_type: 'tetrode_12.5',
          location: 'CA1',
          targeted_location: 'CA1',
          targeted_x: 1.0,
          targeted_y: 2.0,
          targeted_z: 3.0,
          units: 'mm'
        },
        {
          id: '1',
          device_type: 'unknown_device',
          location: 'CA3',
          targeted_location: 'CA3',
          targeted_x: 2.0,
          targeted_y: 3.0,
          targeted_z: 4.0,
          units: 'mm'
        }
      ];

      const result = generateAllChannelMaps(electrodeGroups);

      expect(result).toHaveLength(1);
      expect(result[0].electrode_group_id).toBe('0');
    });
  });

  describe('getNextNtrodeId', () => {
    test('finds max ID correctly', () => {
      const existingMaps = [
        { ntrode_id: '0', electrode_group_id: '0', electrode_id: 0, bad_channels: [], map: {} },
        { ntrode_id: '5', electrode_group_id: '1', electrode_id: 0, bad_channels: [], map: {} },
        { ntrode_id: '3', electrode_group_id: '2', electrode_id: 0, bad_channels: [], map: {} }
      ];

      const result = getNextNtrodeId(existingMaps);

      expect(result).toBe('6'); // max is 5, next is 6
    });

    test('returns "0" for empty array', () => {
      const result = getNextNtrodeId([]);
      expect(result).toBe('0');
    });

    test('handles string IDs correctly', () => {
      const existingMaps = [
        { ntrode_id: '10', electrode_group_id: '0', electrode_id: 0, bad_channels: [], map: {} },
        { ntrode_id: '20', electrode_group_id: '1', electrode_id: 0, bad_channels: [], map: {} }
      ];

      const result = getNextNtrodeId(existingMaps);

      expect(result).toBe('21');
    });

    test('handles single map', () => {
      const existingMaps = [
        { ntrode_id: '7', electrode_group_id: '0', electrode_id: 0, bad_channels: [], map: {} }
      ];

      const result = getNextNtrodeId(existingMaps);

      expect(result).toBe('8');
    });
  });
});
