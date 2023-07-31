/**
 * maps device type to device json schema file
 *
 * @param {string} deviceType
 * @returns
 */
export const deviceTypeMap = (deviceType) => {
  let defaults = [0, 1, 2, 3];

  switch (deviceType) {
    case 'tetrode_12.5':
      defaults = [0, 1, 2, 3];
      break;
    case 'A1x32-6mm-50-177-H32_21mm':
      defaults = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
        19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
      ];
      break;
    case '128c-4s8mm6cm-20um-40um-sl':
      defaults = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
        19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
      ];
      break;
    case '128c-4s6mm6cm-15um-26um-sl':
      defaults = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
        19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
      ];
      break;
    case '32c-2s8mm6cm-20um-40um-dl':
      defaults = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
      break;
    case '64c-4s6mm6cm-20um-40um-dl':
      defaults = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
      break;
    case '64c-3s6mm6cm-20um-40um-sl':
      defaults = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
        19
      ];
      break;
    default:
      break;
  }

  return defaults;
};


/**
 * Returns the shank count of a device
 *
 * @param {string} deviceType
 * @returns integer for shank count
 */
export const getShankCount = (deviceType) => {
  let shankCount = 0;

  switch (deviceType) {
    case 'tetrode_12.5':
      shankCount = 1;
      break;
    case 'A1x32-6mm-50-177-H32_21mm':
      shankCount = 1;
      break;
    case '128c-4s8mm6cm-20um-40um-sl':
      shankCount = 4;
      break;
    case '128c-4s6mm6cm-15um-26um-sl':
      shankCount = 4;
      break;
    case '32c-2s8mm6cm-20um-40um-dl':
      shankCount = 2;
      break;
    case '64c-4s6mm6cm-20um-40um-dl':
      shankCount = 4;
      break;
    case '64c-3s6mm6cm-20um-40um-sl':
      shankCount = 3;
      break;
    default:
      break;
  }

  return shankCount;
}
