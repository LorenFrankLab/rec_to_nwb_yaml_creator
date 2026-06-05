/**
 * Channel Map Auto-Generation Utilities
 *
 * These utilities automatically generate ntrode channel maps from electrode group configurations.
 * Each ntrode represents one shank of a multi-channel probe, with an identity mapping between
 * channel indices and hardware channel numbers.
 */

import { getProbeShanks } from '../ntrode/probeCatalog';

/**
 * Generates default ntrode channel maps for a single electrode group
 *
 * Creates one ntrode per shank, using the VERIFIED probe catalog
 * (`getProbeShanks`) as the source of truth for how the probe's electrode ids
 * partition across shanks. For shank `i`, the ntrode's `map` has local keys
 * `0 … (shank_i.electrodeIds.length − 1)` mapping to `shank_i.electrodeIds[key]`.
 *
 * This is BYTE-IDENTICAL to the prior length-math generator for the evenly
 * partitioned probes (a 4-shank 128c probe still emits `0..31, 32..63, 64..95,
 * 96..127`). It also generates the UNEVEN `64c-3s6mm6cm-20um-40um-sl` probe
 * correctly — 3 ntrodes with 21/21/22 keys mapping to ids `0..20`, `21..41`,
 * `42..63` — where the old math silently dropped electrode ids 60–63.
 *
 * `ntrode_id` and `electrode_group_id` are integers end-to-end.
 *
 * @param {object} electrodeGroup - Electrode group configuration object
 * @param {number} electrodeGroup.id - Integer identifier for the electrode group
 * @param {string} electrodeGroup.device_type - Device/probe type (e.g., 'tetrode_12.5')
 * @param {number} [startingNtrodeId=0] - Starting ID for ntrode numbering (default: 0)
 * @returns {Array<object>} Array of ntrode channel map objects, one per shank
 *
 * @example
 * // Generate maps for a tetrode (4 channels, 1 shank)
 * const group = { id: 0, device_type: 'tetrode_12.5', location: 'CA1' };
 * generateChannelMapsForGroup(group);
 * // Returns:
 * // [{
 * //   electrode_group_id: 0,
 * //   ntrode_id: 0,
 * //   bad_channels: [],
 * //   map: { 0: 0, 1: 1, 2: 2, 3: 3 }
 * // }]
 *
 * @example
 * // Generate maps for a 128-channel probe (128 channels, 4 shanks)
 * const group = { id: 1, device_type: '128c-4s8mm6cm-20um-40um-sl', location: 'CA1' };
 * generateChannelMapsForGroup(group, 10);
 * // Returns 4 ntrodes with IDs 10, 11, 12, 13 and per-shank electrode-id offsets
 */
export function generateChannelMapsForGroup(electrodeGroup, startingNtrodeId = 0) {
  const { device_type } = electrodeGroup;
  const parsedGroupId = parseInt(electrodeGroup.id, 10);
  const electrode_group_id = Number.isNaN(parsedGroupId) ? 0 : parsedGroupId;

  // Return empty array if device type is missing or unknown
  if (!device_type) {
    return [];
  }

  // The catalog is the source of truth for per-shank electrode-id partitioning.
  // Unknown/uncatalogued device types yield no shanks (empty array).
  const shanks = getProbeShanks(device_type);
  if (shanks.length === 0) {
    return [];
  }

  // Create one ntrode per shank. Local keys are 0..(shankLen-1); values are the
  // shank's actual electrode ids (which already carry any multi-shank offset).
  return shanks.map((shank, i) => {
    const map = shank.electrodeIds.reduce((acc, electrodeId, idx) => {
      acc[idx] = electrodeId;
      return acc;
    }, {});

    return {
      electrode_group_id,
      ntrode_id: startingNtrodeId + i,
      bad_channels: [],
      map,
    };
  });
}

/**
 * Generates complete channel maps for all electrode groups
 *
 * Processes an array of electrode groups and generates ntrode channel maps for each,
 * maintaining sequential ntrode IDs across all groups.
 *
 * @param {Array<object>} electrodeGroups - Array of electrode group configuration objects
 * @returns {Array<object>} Complete array of channel maps for all groups
 *
 * @example
 * const groups = [
 *   { id: 0, device_type: '32c-2s8mm6cm-20um-40um-dl', location: 'CA1' }, // 2 shanks
 *   { id: 1, device_type: '64c-3s6mm6cm-20um-40um-sl', location: 'CA3' }  // 3 shanks
 * ];
 * generateAllChannelMaps(groups);
 * // Returns 5 ntrodes total with integer IDs 0, 1, 2, 3, 4
 */
export function generateAllChannelMaps(electrodeGroups) {
  const allMaps = [];
  let currentNtrodeId = 0;

  for (const group of electrodeGroups) {
    const groupMaps = generateChannelMapsForGroup(group, currentNtrodeId);
    allMaps.push(...groupMaps);
    currentNtrodeId += groupMaps.length;
  }

  return allMaps;
}

/**
 * Returns the next available integer ntrode ID.
 *
 * Finds the maximum `ntrode_id` across the existing maps and returns the next
 * integer, so a newly-added group's ntrodes never collide with existing ones.
 * Returns 0 for an empty array. Numeric-string ids from legacy/imported data are
 * parsed; an id that does not parse to a number is treated as `-1` (i.e. excluded
 * from the max), so a single corrupt entry can't poison the result to `NaN` and an
 * all-corrupt map still yields `0`. The corrupt entry itself is surfaced loudly by
 * schema validation (integer `ntrode_id`) and the duplicate-ntrode_id rule at export.
 *
 * @param {Array<object>} existingMaps - Array of existing channel map objects
 * @returns {number} Next available integer ntrode ID
 *
 * @example
 * const maps = [{ ntrode_id: 0 }, { ntrode_id: 5 }, { ntrode_id: 3 }];
 * nextNtrodeId(maps); // Returns 6
 *
 * @example
 * nextNtrodeId([]); // Returns 0
 */
export function nextNtrodeId(existingMaps) {
  if (!existingMaps || existingMaps.length === 0) {
    return 0;
  }

  const maxId = Math.max(
    ...existingMaps.map((m) => {
      const parsed = parseInt(m.ntrode_id, 10);
      return Number.isNaN(parsed) ? -1 : parsed;
    })
  );
  return maxId + 1;
}
