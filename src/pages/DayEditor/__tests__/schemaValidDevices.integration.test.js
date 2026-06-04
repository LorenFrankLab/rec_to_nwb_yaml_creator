/**
 * Schema-valid device-output tests for the workspace export path.
 *
 * Proves the merged export emits electrode groups and ntrode maps the schema
 * accepts: integer `id` / `ntrode_id` / `electrode_group_id`, the required
 * `description` / `targeted_location`, a non-empty `device.name`, no stray
 * non-schema keys (`electrode_id` on ntrodes, a `bad_channels` string on groups),
 * and per-shank electrode-ID offsets for multi-shank probes.
 */
import { describe, it, expect } from 'vitest';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { schemaValidation } from '../../../validation/schemaValidation';
import { validate } from '../../../validation';
import { generateChannelMapsForGroup } from '../../../utils/channelMapUtils';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

describe('schema-valid device output (workspace export)', () => {
  it('merged device output passes schema for a fully-configured session', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);

    expect(schemaValidation(merged)).toEqual([]);
  });

  it('a fully-configured session validates with zero issues (schema + rules)', () => {
    const { animal, day } = buildRealisticWorkspace();
    expect(validate(mergeDayMetadata(animal, day))).toEqual([]);
  });

  it('exported devices carry no stray keys and a non-empty device.name', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);

    // device.name is present and non-empty (schema minItems: 1).
    expect(merged.device.name.length).toBeGreaterThan(0);

    // Electrode groups carry integer ids and no stray bad_channels string.
    merged.electrode_groups.forEach((g) => {
      expect(typeof g.id).toBe('number');
      expect(g).not.toHaveProperty('bad_channels');
      expect(typeof g.description).toBe('string');
      expect(g.description.trim()).not.toBe('');
      expect(typeof g.targeted_location).toBe('string');
      expect(g.targeted_location.trim()).not.toBe('');
    });

    // Ntrodes carry integer ids and no stray electrode_id.
    merged.ntrode_electrode_group_channel_map.forEach((n) => {
      expect(typeof n.ntrode_id).toBe('number');
      expect(typeof n.electrode_group_id).toBe('number');
      expect(n).not.toHaveProperty('electrode_id');
    });
  });

  it('normalizes legacy snapshot device keys at the export boundary', () => {
    const { animal, day } = buildRealisticWorkspace();
    animal.devices.device = { name: [] };
    animal.configurationHistory[0].devices = {
      electrode_groups: [
        {
          id: '0',
          location: 'CA1',
          device_type: 'tetrode_12.5',
          targeted_x: '3',
          targeted_y: '2.5',
          targeted_z: '2',
          units: 'mm',
          bad_channels: '',
        },
      ],
      ntrode_electrode_group_channel_map: [
        {
          ntrode_id: '1',
          electrode_group_id: '0',
          electrode_id: 8,
          bad_channels: ['2'],
          map: { 0: '0', 1: '1', 2: '2', 3: '3' },
        },
      ],
    };

    const merged = mergeDayMetadata(animal, day);

    expect(merged.device.name).toEqual(['Trodes']);
    expect(merged.electrode_groups[0]).toMatchObject({
      id: 0,
      description: 'CA1',
      targeted_location: 'CA1',
      targeted_x: 3,
      targeted_y: 2.5,
      targeted_z: 2,
    });
    expect(merged.electrode_groups[0]).not.toHaveProperty('bad_channels');
    expect(merged.ntrode_electrode_group_channel_map[0]).toMatchObject({
      ntrode_id: 1,
      electrode_group_id: 0,
      bad_channels: [2],
      map: { 0: 0, 1: 1, 2: 2, 3: 3 },
    });
    expect(merged.ntrode_electrode_group_channel_map[0]).not.toHaveProperty('electrode_id');
    expect(schemaValidation(merged)).toEqual([]);
  });

  it('a multi-shank probe exports per-shank electrode-ID offsets and is schema-valid', () => {
    const { animal, day } = buildRealisticWorkspace();

    // Replace the configured devices with a single 128ch 4-shank probe.
    const group = {
      id: 0,
      location: 'CA1',
      device_type: '128c-4s8mm6cm-20um-40um-sl',
      description: 'CA1 128-channel 4-shank probe',
      targeted_location: 'CA1',
      targeted_x: 3,
      targeted_y: 2.5,
      targeted_z: 2,
      units: 'mm',
    };
    const ntrodes = generateChannelMapsForGroup(group, 0);
    animal.configurationHistory[0].devices = {
      electrode_groups: [group],
      ntrode_electrode_group_channel_map: ntrodes,
    };

    const merged = mergeDayMetadata(animal, day);

    // Four shanks, each a contiguous 32-electrode block: 0..31, 32..63, 64..95, 96..127.
    const blocks = merged.ntrode_electrode_group_channel_map.map((n) => Object.values(n.map));
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toEqual(Array.from({ length: 32 }, (_, i) => i));
    expect(blocks[1]).toEqual(Array.from({ length: 32 }, (_, i) => 32 + i));
    expect(blocks[2]).toEqual(Array.from({ length: 32 }, (_, i) => 64 + i));
    expect(blocks[3]).toEqual(Array.from({ length: 32 }, (_, i) => 96 + i));

    expect(schemaValidation(merged)).toEqual([]);
  });
});
