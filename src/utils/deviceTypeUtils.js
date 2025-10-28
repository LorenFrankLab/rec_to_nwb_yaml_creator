/**
 * Device type metadata mapping
 * Contains channel count and shank count for each supported probe type
 * @private
 */
const DEVICE_METADATA = {
  'tetrode_12.5': { channels: 4, shanks: 1 },
  'A1x32-6mm-50-177-H32_21mm': { channels: 32, shanks: 1 },
  '128c-4s8mm6cm-20um-40um-sl': { channels: 128, shanks: 4 },
  '128c-4s6mm6cm-15um-26um-sl': { channels: 128, shanks: 4 },
  '128c-4s8mm6cm-15um-26um-sl': { channels: 128, shanks: 4 },
  '128c-4s6mm6cm-20um-40um-sl': { channels: 128, shanks: 4 },
  '128c-4s4mm6cm-20um-40um-sl': { channels: 128, shanks: 4 },
  '128c-4s4mm6cm-15um-26um-sl': { channels: 128, shanks: 4 },
  '32c-2s8mm6cm-20um-40um-dl': { channels: 32, shanks: 2 },
  '64c-4s6mm6cm-20um-40um-dl': { channels: 64, shanks: 4 },
  '64c-3s6mm6cm-20um-40um-sl': { channels: 64, shanks: 3 },
  'NET-EBL-128ch-single-shank': { channels: 128, shanks: 1 },
};

/**
 * Returns an array of all available device/probe types
 *
 * @returns {string[]} Array of device type strings
 * @example
 * getDeviceTypes()
 * // ['tetrode_12.5', 'A1x32-6mm-50-177-H32_21mm', ...]
 */
export function getDeviceTypes() {
  return Object.keys(DEVICE_METADATA);
}

/**
 * Returns the number of channels for a given device type
 *
 * @param {string} deviceType - The device type identifier
 * @returns {number} Number of channels (0 if device type is invalid)
 * @example
 * getChannelCount('tetrode_12.5')     // 4
 * getChannelCount('128c-4s8mm6cm-20um-40um-sl')  // 128
 * getChannelCount('unknown_device')    // 0
 */
export function getChannelCount(deviceType) {
  return DEVICE_METADATA[deviceType]?.channels || 0;
}

/**
 * Returns the number of shanks for a given device type
 *
 * @param {string} deviceType - The device type identifier
 * @returns {number} Number of shanks (0 if device type is invalid)
 * @example
 * getShankCount('tetrode_12.5')  // 1
 * getShankCount('128c-4s8mm6cm-20um-40um-sl')  // 4
 * getShankCount('unknown_device')  // 0
 */
export function getShankCount(deviceType) {
  return DEVICE_METADATA[deviceType]?.shanks || 0;
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
  return deviceType in DEVICE_METADATA;
}
