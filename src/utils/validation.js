/**
 * Validation utilities for YAML metadata
 *
 * This module provides schema validation and custom business rule validation
 * for NWB metadata forms.
 */

import addFormats from 'ajv-formats';
import JsonSchemaFile from '../nwb_schema.json';
const Ajv = require('ajv');

/**
 * Validates form content against the NWB JSON schema
 *
 * @param {object} formContent - The form data to validate
 * @returns {object} Validation result with isValid flag, error messages, and error IDs
 */
export const jsonschemaValidation = (formContent) => {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(JsonSchemaFile);

  validate(formContent);

  const validationMessages =
    validate.errors?.map((error) => {
      return `Key: ${error.instancePath
        .split('/')
        .filter((x) => x !== '')
        .join(', ')}. | Error: ${error.message}`;
    }) || [];

  const errorIds = [
    ...new Set(
      validate.errors?.map((v) => {
        const validationEntries = v.instancePath
          .split('/')
          .filter((x) => x !== '');

        return validationEntries[0];
      })
    ),
  ];

  const isValid = validate.errors === null;

  const message = isValid
    ? 'Data is valid'
    : `Data is not valid - \n ${validationMessages.join('\n \n')}`;

  return {
    valid: isValid,
    isValid,
    jsonSchemaErrorMessages: validationMessages,
    jsonSchemaErrors: validate.errors,
    jsonSchemaErrorIds: errorIds,
    errors: validate.errors,
  };
};

/**
 * Validates business rules that are not easily expressed in JSON schema
 *
 * Rules enforced:
 * 1. Tasks with camera_ids require cameras to be defined
 * 2. Associated video files with camera_ids require cameras to be defined
 * 3. Optogenetics configuration must be complete (all or none of the 3 fields)
 * 4. Ntrode channel mappings must have unique physical channels (no duplicates)
 *
 * @param {object} jsonFileContent - The form data to validate
 * @returns {object} Validation result with isFormValid flag, error messages, and error IDs
 */
export const rulesValidation = (jsonFileContent) => {
  const errorIds = [];
  const errorMessages = [];
  let isFormValid = true;
  const errors = [];

  // check if tasks have a camera but no camera is set
  if (!jsonFileContent.cameras && jsonFileContent.tasks?.length > 0) {
    errorMessages.push(
      'Key: task.camera | Error: There is tasks camera_id, but no camera object with ids. No data is loaded'
    );
    errorIds.push('tasks');
    isFormValid = false;
  }

  // check if associated_video_files have a camera but no camera is set
  if (
    !jsonFileContent.cameras &&
    jsonFileContent.associated_video_files?.length > 0
  ) {
    errorMessages.push(
      `Key: associated_video_files.camera_id. | Error: There is associated_video_files camera_id, but no camera object with ids. No data is loaded`
    );
    errorIds.push('associated_video_files');
    isFormValid = false;
  }

  // check for partial optogenetics configuration
  // If ANY optogenetics field is present, ALL must be present
  // This is required by trodes_to_nwb Python package
  const hasOptoSource = jsonFileContent.opto_excitation_source?.length > 0;
  const hasOpticalFiber = jsonFileContent.optical_fiber?.length > 0;
  const hasVirusInjection = jsonFileContent.virus_injection?.length > 0;

  const optoFieldsPresent = [hasOptoSource, hasOpticalFiber, hasVirusInjection].filter(Boolean).length;

  // Partial configuration detected (some but not all fields present)
  if (optoFieldsPresent > 0 && optoFieldsPresent < 3) {
    errorMessages.push(
      `Key: optogenetics | Error: Partial optogenetics configuration detected. ` +
      `If using optogenetics, ALL fields must be defined: ` +
      `opto_excitation_source${hasOptoSource ? ' ✓' : ' ✗'}, ` +
      `optical_fiber${hasOpticalFiber ? ' ✓' : ' ✗'}, ` +
      `virus_injection${hasVirusInjection ? ' ✓' : ' ✗'}`
    );
    errorIds.push('opto_excitation_source');
    isFormValid = false;
  }

  // check for duplicate channel mappings in ntrode_electrode_group_channel_map
  // Each ntrode's map object must have unique values (no duplicate physical channels)
  // Hardware constraint: each logical channel must map to a unique physical channel
  if (jsonFileContent.ntrode_electrode_group_channel_map?.length > 0) {
    jsonFileContent.ntrode_electrode_group_channel_map.forEach((ntrode) => {
      if (ntrode.map && typeof ntrode.map === 'object') {
        const channelValues = Object.values(ntrode.map);
        const uniqueValues = new Set(channelValues);

        // If duplicate values exist, the Set will have fewer elements than the array
        if (channelValues.length !== uniqueValues.size) {
          // Find which values are duplicated for better error message
          const duplicates = channelValues.filter(
            (value, index) => channelValues.indexOf(value) !== index
          );
          const uniqueDuplicates = [...new Set(duplicates)];

          errorMessages.push(
            `Key: ntrode_electrode_group_channel_map | Error: ntrode_id ${ntrode.ntrode_id} has duplicate channel mappings. ` +
            `Physical channel(s) ${uniqueDuplicates.join(', ')} are mapped to multiple logical channels. ` +
            `Each logical channel must map to a unique physical channel to avoid hardware conflicts.`
          );
          errorIds.push(`ntrode_electrode_group_channel_map_${ntrode.ntrode_id}`);
          isFormValid = false;
        }
      }
    });
  }

  return {
    isFormValid,
    formErrors: errorMessages,
    formErrorIds: errorIds,
    errors,
  };
};
