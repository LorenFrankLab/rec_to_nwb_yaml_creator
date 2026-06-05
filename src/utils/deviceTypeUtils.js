/**
 * Device-type geometry helpers.
 *
 * Geometry (channel count, shank count, device-type validity) is derived from the
 * VERIFIED probe catalog (`src/ntrode/probeCatalog.js`), which transcribes the
 * trodes_to_nwb probe metadata. The catalog is the single source of truth so the
 * app can never disagree with the converter about a probe's electrode count or how
 * its electrodes partition across shanks.
 */

import {
  getProbeMetadata,
  getProbeElectrodeIds,
} from '../ntrode/probeCatalog';

/**
 * The supported device/probe types, in their canonical order.
 * @private
 */
const DEVICE_TYPES = [
  'tetrode_12.5',
  'A1x32-6mm-50-177-H32_21mm',
  '128c-4s8mm6cm-20um-40um-sl',
  '128c-4s6mm6cm-15um-26um-sl',
  '128c-4s8mm6cm-15um-26um-sl',
  '128c-4s6mm6cm-20um-40um-sl',
  '128c-4s4mm6cm-20um-40um-sl',
  '128c-4s4mm6cm-15um-26um-sl',
  '32c-2s8mm6cm-20um-40um-dl',
  '64c-4s6mm6cm-20um-40um-dl',
  '64c-3s6mm6cm-20um-40um-sl',
  'NET-EBL-128ch-single-shank',
];

/**
 * Returns an array of all available device/probe types
 *
 * @returns {string[]} Array of device type strings
 * @example
 * getDeviceTypes()
 * // ['tetrode_12.5', 'A1x32-6mm-50-177-H32_21mm', ...]
 */
export function getDeviceTypes() {
  return [...DEVICE_TYPES];
}

/**
 * Returns the number of channels (probe electrode ids) for a given device type.
 *
 * Derived from the probe catalog: the total number of electrode ids across all
 * shanks. Returns 0 for an unknown device type.
 *
 * @param {string} deviceType - The device type identifier
 * @returns {number} Number of channels (0 if device type is invalid)
 * @example
 * getChannelCount('tetrode_12.5')     // 4
 * getChannelCount('128c-4s8mm6cm-20um-40um-sl')  // 128
 * getChannelCount('64c-3s6mm6cm-20um-40um-sl')   // 64
 * getChannelCount('unknown_device')    // 0
 */
export function getChannelCount(deviceType) {
  return getProbeElectrodeIds(deviceType).length;
}

/**
 * Returns the number of shanks for a given device type.
 *
 * Derived from the probe catalog. Returns 0 for an unknown device type.
 *
 * @param {string} deviceType - The device type identifier
 * @returns {number} Number of shanks (0 if device type is invalid)
 * @example
 * getShankCount('tetrode_12.5')  // 1
 * getShankCount('128c-4s8mm6cm-20um-40um-sl')  // 4
 * getShankCount('64c-3s6mm6cm-20um-40um-sl')   // 3
 * getShankCount('unknown_device')  // 0
 */
export function getShankCount(deviceType) {
  const meta = getProbeMetadata(deviceType);
  return meta ? meta.num_shanks : 0;
}

/**
 * Validates whether a given string is a valid device type
 *
 * @param {*} deviceType - Value to validate
 * @returns {boolean} True if the device type is valid and known, false otherwise
 * @example
 * validateDeviceType('tetrode_12.5')  // true
 * validateDeviceType('unknown')        // false
 * validateDeviceType(null)             // false
 */
export function validateDeviceType(deviceType) {
  return typeof deviceType === 'string' && getProbeMetadata(deviceType) !== undefined;
}
