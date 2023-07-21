import JsonTetrode_12_5 from './../franklabnwb-git-subtree/json_schema_files/tetrode_12_5.json';
import JsonA1x32_6mm_50_177_H32_21mm from './../franklabnwb-git-subtree/json_schema_files/A1x32-6mm-50-177-H32_21mm.json';
import Json128c_4s8mm6cm_20um_40um_sl from './../franklabnwb-git-subtree/json_schema_files/128c-4s8mm6cm-20um-40um-sl.json';
import Json128c_4s6mm6cm_15um_26um_sl from './../franklabnwb-git-subtree/json_schema_files/128c-4s6mm6cm-15um-26um-sl.json';
import Json32c_2s8mm6cm_20um_40um_dl from './../franklabnwb-git-subtree/json_schema_files/32c-2s8mm6cm-20um-40um-dl.json';
import Json64c_4s6mm6cm_20um_40um_dl from './../franklabnwb-git-subtree/json_schema_files/64c-4s6mm6cm-20um-40um-dl.json';
import Json64c_3s6mm6cm_20um_40um_sl from './../franklabnwb-git-subtree/json_schema_files/64c-3s6mm6cm-20um-40um-sl.json';


/**
 * maps device type to device json schema file
 *
 * @param {string} deviceType
 * @returns
 */
export const deviceTypeMap = (deviceType) => {
  let mapJsonSchema = {};

  switch (deviceType) {
    case 'tetrode_12.5':
      mapJsonSchema = structuredClone(JsonTetrode_12_5);
      break;
    case 'A1x32-6mm-50-177-H32_21mm':
      mapJsonSchema = structuredClone(JsonA1x32_6mm_50_177_H32_21mm);
      break;
    case '128c-4s8mm6cm-20um-40um-sl':
      mapJsonSchema = structuredClone(Json128c_4s8mm6cm_20um_40um_sl);
      break;
    case '128c-4s6mm6cm-15um-26um-sl':
      mapJsonSchema = structuredClone(Json128c_4s6mm6cm_15um_26um_sl);
      break;
    case '32c-2s8mm6cm-20um-40um-dl':
      mapJsonSchema = structuredClone(Json32c_2s8mm6cm_20um_40um_dl);
      break;
    case '64c-4s6mm6cm-20um-40um-dl':
      mapJsonSchema = structuredClone(Json64c_4s6mm6cm_20um_40um_dl);
      break;
    case '64c-3s6mm6cm-20um-40um-sl':
      mapJsonSchema = structuredClone(Json64c_3s6mm6cm_20um_40um_sl);
      break;
    default:
      break;
  }

  return mapJsonSchema;
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
