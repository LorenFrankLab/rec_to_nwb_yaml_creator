/**
 * Channel Map Auto-Generation Utilities
 *
 * These utilities automatically generate ntrode channel maps from electrode group configurations.
 * Each ntrode represents one shank of a multi-channel probe, with an identity mapping between
 * channel indices and hardware channel numbers.
 */

import { deviceTypeMap } from '../ntrode/deviceTypes';
import { getShankCount } from './deviceTypeUtils';

/**
 * Generates default ntrode channel maps for a single electrode group
 *
 * Creates one ntrode per shank, mapping each logical position to a probe electrode
 * id. The probe's electrode ids (`0 … channelCount - 1`) are partitioned across the
 * shanks: shank `i`'s value for local key `idx` is `i * perShankCount + channels[idx]`,
 * so a 4-shank probe emits `0..31, 32..63, 64..95, 96..127` rather than `0..31` four
 * times. `ntrode_id` and `electrode_group_id` are integers end-to-end.
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
  const { id: electrode_group_id, device_type } = electrodeGroup;

  // Return empty array if device type is missing or unknown
  if (!device_type) {
    return [];
  }

  const channels = deviceTypeMap(device_type);
  const shankCount = getShankCount(device_type);

  // Return empty array if device type is not recognized (shankCount will be 0)
  if (shankCount === 0) {
    return [];
  }

  // The per-shank electrode count partitions the probe's electrode ids across shanks.
  const perShankCount = channels.length;

  // Create one ntrode per shank
  const ntrodes = [];
  for (let i = 0; i < shankCount; i++) {
    // Map each logical position to its probe electrode id, offset by the shank index
    // so multi-shank probes partition the probe's electrode ids across shanks.
    const map = channels.reduce((acc, channelNum, idx) => {
      acc[idx] = i * perShankCount + channelNum;
      return acc;
    }, {});

    ntrodes.push({
      electrode_group_id,
      ntrode_id: startingNtrodeId + i,
      bad_channels: [],
      map
    });
  }

  return ntrodes;
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
 * Returns 0 for an empty array. Tolerates string-typed ids from legacy/imported
 * data (parsed defensively) while always returning an integer.
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
