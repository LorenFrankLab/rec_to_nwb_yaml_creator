/**
 * @jest-environment jsdom
 */

import {
  generateChannelMapsForGroup,
  generateAllChannelMaps,
  nextNtrodeId
} from '../channelMapUtils';

describe('channelMapUtils', () => {
  describe('generateChannelMapsForGroup', () => {
    test('generates maps for tetrode (4 channels, 1 shank)', () => {
      const electrodeGroup = {
        id: 0,
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
      // Integer IDs end-to-end; no stray electrode_id key.
      expect(result[0]).toEqual({
        electrode_group_id: 0,
        ntrode_id: 0,
        bad_channels: [],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 }
      });
    });

    test('offsets electrode IDs per shank for a multi-shank probe', () => {
      // A 128-channel 4-shank probe partitions probe electrode ids 0..127 across
      // its four shanks: 0..31, 32..63, 64..95, 96..127 (not 0..31 four times).
      const electrodeGroup = {
        id: 1,
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

      const shankBlock = (offset) =>
        Object.fromEntries(Array.from({ length: 32 }, (_, i) => [i, offset + i]));

      expect(result[0].map).toEqual(shankBlock(0));   // 0..31
      expect(result[1].map).toEqual(shankBlock(32));  // 32..63
      expect(result[2].map).toEqual(shankBlock(64));  // 64..95
      expect(result[3].map).toEqual(shankBlock(96));  // 96..127

      // Across the group the values partition 0..127 exactly once.
      const allValues = result.flatMap((n) => Object.values(n.map)).sort((a, b) => a - b);
      expect(allValues).toEqual(Array.from({ length: 128 }, (_, i) => i));
    });

    test('uses sequential integer ntrode IDs starting from 0', () => {
      const electrodeGroup = {
        id: 5,
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
      expect(result.map((n) => n.ntrode_id)).toEqual([0, 1, 2, 3]);
    });

    test('uses custom starting ntrode ID', () => {
      const electrodeGroup = {
        id: 0,
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
      expect(result.map((n) => n.ntrode_id)).toEqual([10, 11]);
    });

    test('creates identity mapping for a single-shank device', () => {
      const electrodeGroup = {
        id: 0,
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const result = generateChannelMapsForGroup(electrodeGroup);

      // Identity mapping: channel index maps to probe electrode id
      expect(result[0].map).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
    });

    test('handles electrode group with unknown device type (return empty array)', () => {
      const electrodeGroup = {
        id: 0,
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
        id: 0,
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
        id: 0,
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

    test('does not emit a stray electrode_id key', () => {
      const electrodeGroup = {
        id: 0,
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const result = generateChannelMapsForGroup(electrodeGroup);

      expect(result[0]).not.toHaveProperty('electrode_id');
    });

    test('inherits integer electrode_group_id from source group', () => {
      const electrodeGroup = {
        id: 42,
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm'
      };

      const result = generateChannelMapsForGroup(electrodeGroup);

      expect(result[0].electrode_group_id).toBe(42);
    });

    test('returns new objects (not mutating inputs)', () => {
      const electrodeGroup = {
        id: 0,
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
    test('handles multiple groups with integer IDs', () => {
      const electrodeGroups = [
        {
          id: 0,
          device_type: 'tetrode_12.5',
          location: 'CA1',
          targeted_location: 'CA1',
          targeted_x: 1.0,
          targeted_y: 2.0,
          targeted_z: 3.0,
          units: 'mm'
        },
        {
          id: 1,
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
      expect(result[0].electrode_group_id).toBe(0);
      expect(result[1].electrode_group_id).toBe(1);
    });

    test('a second tetrode group resets map values to 0..3 (probe-local ids)', () => {
      const electrodeGroups = [
        {
          id: 0,
          device_type: 'tetrode_12.5',
          location: 'CA1',
          targeted_location: 'CA1',
          targeted_x: 1.0,
          targeted_y: 2.0,
          targeted_z: 3.0,
          units: 'mm'
        },
        {
          id: 1,
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

      // ntrode_id still increments globally, but the map VALUES reset per group:
      // a tetrode probe only has electrode ids 0..3.
      expect(result[0].map).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
      expect(result[1].map).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
    });

    test('maintains sequential integer ntrode IDs across groups', () => {
      const electrodeGroups = [
        {
          id: 0,
          device_type: '32c-2s8mm6cm-20um-40um-dl', // 2 shanks
          location: 'CA1',
          targeted_location: 'CA1',
          targeted_x: 1.0,
          targeted_y: 2.0,
          targeted_z: 3.0,
          units: 'mm'
        },
        {
          id: 1,
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
      expect(result.map((n) => n.ntrode_id)).toEqual([0, 1, 2, 3, 4]);
    });

    test('handles empty array', () => {
      const result = generateAllChannelMaps([]);
      expect(result).toEqual([]);
    });

    test('skips groups with unknown device types', () => {
      const electrodeGroups = [
        {
          id: 0,
          device_type: 'tetrode_12.5',
          location: 'CA1',
          targeted_location: 'CA1',
          targeted_x: 1.0,
          targeted_y: 2.0,
          targeted_z: 3.0,
          units: 'mm'
        },
        {
          id: 1,
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
      expect(result[0].electrode_group_id).toBe(0);
    });
  });

  describe('incremental add collision-safety (nextNtrodeId + generateChannelMapsForGroup)', () => {
    test('a second group added after the first does not restart ntrode_id at 0', () => {
      // First add: a 4-shank probe occupies ntrode ids 0..3.
      const group0 = { id: 0, device_type: '128c-4s8mm6cm-20um-40um-sl', location: 'CA1' };
      const firstMaps = generateChannelMapsForGroup(group0, nextNtrodeId([]));
      expect(firstMaps.map((n) => n.ntrode_id)).toEqual([0, 1, 2, 3]);

      // Second add: ntrode ids continue after the current max (3) → 4, not 0.
      const group1 = { id: 1, device_type: 'tetrode_12.5', location: 'CA3' };
      const secondMaps = generateChannelMapsForGroup(group1, nextNtrodeId(firstMaps));
      expect(secondMaps.map((n) => n.ntrode_id)).toEqual([4]);

      const allIds = [...firstMaps, ...secondMaps].map((n) => n.ntrode_id);
      expect(new Set(allIds).size).toBe(allIds.length); // all unique
      allIds.forEach((id) => expect(typeof id).toBe('number'));
    });
  });

  describe('nextNtrodeId', () => {
    test('returns an integer one past the max existing ntrode_id', () => {
      const existingMaps = [
        { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: {} },
        { ntrode_id: 5, electrode_group_id: 1, bad_channels: [], map: {} },
        { ntrode_id: 3, electrode_group_id: 2, bad_channels: [], map: {} }
      ];

      expect(nextNtrodeId(existingMaps)).toBe(6); // max is 5, next is 6
    });

    test('returns 0 for an empty array', () => {
      expect(nextNtrodeId([])).toBe(0);
    });

    test('tolerates string-typed ntrode_id from legacy/imported data', () => {
      const existingMaps = [
        { ntrode_id: '10', electrode_group_id: 0, bad_channels: [], map: {} },
        { ntrode_id: '20', electrode_group_id: 1, bad_channels: [], map: {} }
      ];

      expect(nextNtrodeId(existingMaps)).toBe(21);
    });

    test('handles a single map', () => {
      const existingMaps = [
        { ntrode_id: 7, electrode_group_id: 0, bad_channels: [], map: {} }
      ];

      expect(nextNtrodeId(existingMaps)).toBe(8);
    });

    test('ignores a non-numeric ntrode_id instead of returning NaN', () => {
      // A single corrupt id must not poison Math.max to NaN; it is excluded.
      const existingMaps = [
        { ntrode_id: 'abc', electrode_group_id: 0, bad_channels: [], map: {} },
        { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: {} },
      ];

      expect(nextNtrodeId(existingMaps)).toBe(3);
    });

    test('returns 0 when every ntrode_id is non-numeric', () => {
      const existingMaps = [
        { ntrode_id: undefined, electrode_group_id: 0, bad_channels: [], map: {} },
        { ntrode_id: '', electrode_group_id: 1, bad_channels: [], map: {} },
      ];

      expect(nextNtrodeId(existingMaps)).toBe(0);
    });
  });
  // Probe Metadata Contract: the generator builds one ntrode per shank from the
  // VERIFIED probe catalog (converter truth), not from length-math. For even
  // probes the output is BYTE-IDENTICAL to the prior generator; the 64c-3s probe
  // is now generated correctly (uneven 21/21/22 partition covering ids 0..63).
  describe('catalog-driven generation (Probe Metadata Contract)', () => {
    const group = (id, device_type) => ({
      id,
      device_type,
      location: 'CA1',
      targeted_location: 'CA1',
      targeted_x: 1.0,
      targeted_y: 2.0,
      targeted_z: 3.0,
      units: 'mm',
    });

    // Reference even-probe output computed from the prior (correct) generator,
    // so a regression on even probes is caught byte-identically.
    const evenBlock = (offset, len) =>
      Object.fromEntries(Array.from({ length: len }, (_, i) => [i, offset + i]));

    it('128c-4s8mm6cm-20um-40um-sl is byte-identical (4 shanks, 0..31/32..63/64..95/96..127)', () => {
      const result = generateChannelMapsForGroup(group(0, '128c-4s8mm6cm-20um-40um-sl'));
      expect(result).toHaveLength(4);
      expect(result[0].map).toEqual(evenBlock(0, 32));
      expect(result[1].map).toEqual(evenBlock(32, 32));
      expect(result[2].map).toEqual(evenBlock(64, 32));
      expect(result[3].map).toEqual(evenBlock(96, 32));
      expect(result.map((n) => n.ntrode_id)).toEqual([0, 1, 2, 3]);
    });

    it('32c-2s8mm6cm-20um-40um-dl is byte-identical (2 shanks, 0..15/16..31)', () => {
      const result = generateChannelMapsForGroup(group(0, '32c-2s8mm6cm-20um-40um-dl'));
      expect(result).toHaveLength(2);
      expect(result[0].map).toEqual(evenBlock(0, 16));
      expect(result[1].map).toEqual(evenBlock(16, 16));
    });

    it('64c-4s6mm6cm-20um-40um-dl is byte-identical (4 shanks, 16 per shank)', () => {
      const result = generateChannelMapsForGroup(group(0, '64c-4s6mm6cm-20um-40um-dl'));
      expect(result).toHaveLength(4);
      expect(result[0].map).toEqual(evenBlock(0, 16));
      expect(result[1].map).toEqual(evenBlock(16, 16));
      expect(result[2].map).toEqual(evenBlock(32, 16));
      expect(result[3].map).toEqual(evenBlock(48, 16));
    });

    it('tetrode_12.5 is byte-identical (1 shank, 0..3)', () => {
      const result = generateChannelMapsForGroup(group(0, 'tetrode_12.5'));
      expect(result).toHaveLength(1);
      expect(result[0].map).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
    });

    it('64c-3s generates a converter-valid uneven 21/21/22 map covering ids 0..63', () => {
      const result = generateChannelMapsForGroup(group(0, '64c-3s6mm6cm-20um-40um-sl'));
      expect(result).toHaveLength(3); // 3 shanks

      // Per-shank local keys are 0..(len-1); values are the shank's electrode ids.
      expect(result[0].map).toEqual(evenBlock(0, 21));   // keys 0..20 -> 0..20
      expect(result[1].map).toEqual(evenBlock(21, 21));  // keys 0..20 -> 21..41
      expect(result[2].map).toEqual(evenBlock(42, 22));  // keys 0..21 -> 42..63

      expect(result.map((n) => Object.keys(n.map).length)).toEqual([21, 21, 22]);

      // Across the group the values cover 0..63 exactly once (no dropped 60..63).
      const allValues = result.flatMap((n) => Object.values(n.map)).sort((a, b) => a - b);
      expect(allValues).toEqual(Array.from({ length: 64 }, (_, i) => i));
    });
  });
});
