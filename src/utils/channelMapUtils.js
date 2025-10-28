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
 * Creates one ntrode per shank, with identity channel mapping based on device type.
 * Each ntrode gets sequential ID starting from the provided startingNtrodeId.
 *
 * @param {object} electrodeGroup - Electrode group configuration object
 * @param {string} electrodeGroup.id - Unique identifier for the electrode group
 * @param {string} electrodeGroup.device_type - Device/probe type (e.g., 'tetrode_12.5')
 * @param {number} [startingNtrodeId=0] - Starting ID for ntrode numbering (default: 0)
 * @returns {Array<object>} Array of ntrode channel map objects, one per shank
 *
 * @example
 * // Generate maps for a tetrode (4 channels, 1 shank)
 * const group = { id: '0', device_type: 'tetrode_12.5', location: 'CA1' };
 * generateChannelMapsForGroup(group);
 * // Returns:
 * // [{
 * //   electrode_group_id: '0',
 * //   ntrode_id: '0',
 * //   electrode_id: 0,
 * //   bad_channels: [],
 * //   map: { 0: 0, 1: 1, 2: 2, 3: 3 }
 * // }]
 *
 * @example
 * // Generate maps for a 128-channel probe (128 channels, 4 shanks)
 * const group = { id: '1', device_type: '128c-4s8mm6cm-20um-40um-sl', location: 'CA1' };
 * generateChannelMapsForGroup(group, 10);
 * // Returns 4 ntrodes with IDs '10', '11', '12', '13'
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

  // Create one ntrode per shank
  const ntrodes = [];
  for (let i = 0; i < shankCount; i++) {
    // Create identity mapping: channel index → channel number
    const map = channels.reduce((acc, channelNum, idx) => {
      acc[idx] = channelNum;
      return acc;
    }, {});

    ntrodes.push({
      electrode_group_id,
      ntrode_id: String(startingNtrodeId + i),
      electrode_id: 0,
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
 *   { id: '0', device_type: '32c-2s8mm6cm-20um-40um-dl', location: 'CA1' }, // 2 shanks
 *   { id: '1', device_type: '64c-3s6mm6cm-20um-40um-sl', location: 'CA3' }  // 3 shanks
 * ];
 * generateAllChannelMaps(groups);
 * // Returns 5 ntrodes total with IDs '0', '1', '2', '3', '4'
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
 * Returns the next available ntrode ID
 *
 * Finds the maximum ntrode_id in the existing maps array and returns the next sequential ID.
 * Returns '0' if the array is empty.
 *
 * @param {Array<object>} existingMaps - Array of existing channel map objects
 * @returns {string} Next available ntrode ID as a string
 *
 * @example
 * const maps = [
 *   { ntrode_id: '0', ... },
 *   { ntrode_id: '5', ... },
 *   { ntrode_id: '3', ... }
 * ];
 * getNextNtrodeId(maps); // Returns '6'
 *
 * @example
 * getNextNtrodeId([]); // Returns '0'
 */
export function getNextNtrodeId(existingMaps) {
  if (existingMaps.length === 0) {
    return '0';
  }

  const maxId = Math.max(...existingMaps.map(m => parseInt(m.ntrode_id, 10)));
  return String(maxId + 1);
}
