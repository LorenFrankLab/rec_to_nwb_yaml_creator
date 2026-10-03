/**
 * Electrodes per shank, in shank order, for every supported device type.
 *
 * The trodes_to_nwb probe files (device_metadata/probe_metadata) number a
 * probe's electrodes 0..N-1 across its shanks in this order. Most probes
 * split them evenly; 64c-3s6mm6cm-20um-40um-sl has shanks of 21, 21 and 22.
 */
const SHANK_SIZES = {
  'tetrode_12.5': [4],
  'A1x32-6mm-50-177-H32_21mm': [32],
  '128c-4s8mm6cm-20um-40um-sl': [32, 32, 32, 32],
  '128c-4s6mm6cm-15um-26um-sl': [32, 32, 32, 32],
  '128c-4s8mm6cm-15um-26um-sl': [32, 32, 32, 32],
  '128c-4s6mm6cm-20um-40um-sl': [32, 32, 32, 32],
  '128c-4s4mm6cm-20um-40um-sl': [32, 32, 32, 32],
  '128c-4s4mm6cm-15um-26um-sl': [32, 32, 32, 32],
  '32c-2s8mm6cm-20um-40um-dl': [16, 16],
  '64c-4s6mm6cm-20um-40um-dl': [16, 16, 16, 16],
  '64c-3s6mm6cm-20um-40um-sl': [21, 21, 22],
  'NET-EBL-128ch-single-shank': [128],
};

/**
 * Returns the electrode ids on each shank of a device, as numbered in its
 * trodes_to_nwb probe file
 *
 * @param {string} deviceType
 * @returns {number[][]} One array of electrode ids per shank, in shank order;
 *   [] for an unknown device type
 */
export const getShankElectrodeIds = (deviceType) => {
  const shankSizes = Object.prototype.hasOwnProperty.call(SHANK_SIZES, deviceType)
    ? SHANK_SIZES[deviceType]
    : [];
  let firstId = 0;

  return shankSizes.map((shankSize) => {
    const electrodeIds = Array.from({ length: shankSize }, (_, i) => firstId + i);
    firstId += shankSize;
    return electrodeIds;
  });
};

/**
 * Returns the electrode ids on a device's first shank
 *
 * @param {string} deviceType
 * @returns {number[]} The first shank's electrode ids; [0, 1, 2, 3] for an
 *   unknown device type
 */
export const deviceTypeMap = (deviceType) => getShankElectrodeIds(deviceType)[0] || [0, 1, 2, 3];

/**
 * Returns the shank count of a device
 *
 * @param {string} deviceType
 * @returns integer for shank count
 */
export const getShankCount = (deviceType) => getShankElectrodeIds(deviceType).length;
