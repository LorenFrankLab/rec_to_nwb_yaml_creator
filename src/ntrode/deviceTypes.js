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
    case 'NET-EBL-128ch-single-shank':
      defaults = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
        25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
        48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
        70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92,
        93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112,
        113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127
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
    case 'NET-EBL-128ch-single-shank':
      shankCount = 1;
      break;
    default:
      break;
  }

  return shankCount;
}
