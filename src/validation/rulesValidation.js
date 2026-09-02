/**
 * Custom Business Rules Validation
 *
 * Validates business logic that is not easily expressed in JSON schema.
 */

/**
 * Custom business logic validation rules
 *
 * Rules enforced:
 * 1. Tasks with camera_ids require cameras to be defined
 * 2. Associated video files with camera_ids require cameras to be defined
 * 3. Optogenetics configuration must be complete (all or none of the 3 fields)
 * 4. Ntrode channel mappings must have unique physical channels (no duplicates)
 * 5. Every camera_id reference must match a defined camera id
 * 6. optogenetic_stimulation_software is required when optogenetics is configured
 *
 * @param {object} model - The form data to validate
 * @returns {Issue[]} Array of validation issues with format:
 *   {
 *     path: string,       // Normalized path: "tasks", "optogenetics", etc.
 *     code: string,       // Rule code: "missing_camera", "partial_configuration", etc.
 *     severity: "error",  // Always "error" for rule violations
 *     message: string     // User-friendly message
 *   }
 */
import { getDefinedCameraIds } from '../utils/cameraReferences';

export const rulesValidation = (model) => {
  // Handle null/undefined model gracefully
  if (!model || typeof model !== 'object') {
    return [];
  }

  const issues = [];

  // Rule 1: Tasks with camera_ids require cameras to be defined
  // Only trigger if tasks have non-empty camera_id arrays
  if (!model.cameras && model.tasks?.length > 0) {
    const tasksWithCameras = model.tasks.some(task =>
      task.camera_id && Array.isArray(task.camera_id) && task.camera_id.length > 0
    );

    if (tasksWithCameras) {
      issues.push({
        path: 'tasks',
        code: 'missing_camera',
        severity: 'error',
        message: 'Tasks have camera_ids, but no cameras are defined'
      });
    }
  }

  // Rule 2: Associated video files with camera_ids require cameras
  // Only trigger if video files have non-empty camera_id arrays
  if (!model.cameras && model.associated_video_files?.length > 0) {
    const videosWithCameras = model.associated_video_files.some(video =>
      video.camera_id && Array.isArray(video.camera_id) && video.camera_id.length > 0
    );

    if (videosWithCameras) {
      issues.push({
        path: 'associated_video_files',
        code: 'missing_camera',
        severity: 'error',
        message: 'Associated video files have camera_ids, but no cameras are defined'
      });
    }
  }

  // Rule 3: Optogenetics all-or-nothing configuration
  const hasOptoSource = model.opto_excitation_source?.length > 0;
  const hasOpticalFiber = model.optical_fiber?.length > 0;
  const hasVirusInjection = model.virus_injection?.length > 0;
  const optoFieldsPresent = [hasOptoSource, hasOpticalFiber, hasVirusInjection].filter(Boolean).length;

  // Partial configuration detected (some but not all fields present)
  if (optoFieldsPresent > 0 && optoFieldsPresent < 3) {
    issues.push({
      path: 'optogenetics',
      code: 'partial_configuration',
      severity: 'error',
      message:
        `Partial optogenetics configuration detected. All fields required: ` +
        `opto_excitation_source${hasOptoSource ? ' ✓' : ' ✗'}, ` +
        `optical_fiber${hasOpticalFiber ? ' ✓' : ' ✗'}, ` +
        `virus_injection${hasVirusInjection ? ' ✓' : ' ✗'}`
    });
  }

  // Rule 3b: optogenetics needs the stimulation software name
  // trodes_to_nwb silently skips ALL optogenetics metadata when this string is
  // empty, so an omission here would drop the sections above from the NWB file.
  if (optoFieldsPresent === 3) {
    const software = model.optogenetic_stimulation_software;
    if (typeof software !== 'string' || software.trim() === '') {
      issues.push({
        path: 'optogenetic_stimulation_software',
        code: 'missing_stimulation_software',
        severity: 'error',
        message:
          'Optogenetic Stimulation Software is required when optogenetics ' +
          'sections are filled in (e.g. "fsgui").',
      });
    }
  }

  // Rule 4: No duplicate channel mappings in ntrode_electrode_group_channel_map
  // Each ntrode's map object must have unique values (no duplicate physical channels)
  // Hardware constraint: each logical channel must map to a unique physical channel
  if (model.ntrode_electrode_group_channel_map?.length > 0) {
    model.ntrode_electrode_group_channel_map.forEach((ntrode) => {
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

          issues.push({
            path: `ntrode_electrode_group_channel_map[${ntrode.ntrode_id}]`,
            code: 'duplicate_channels',
            severity: 'error',
            message:
              `Ntrode ${ntrode.ntrode_id} has duplicate channel mappings. ` +
              `Physical channel(s) ${uniqueDuplicates.join(', ')} are mapped ` +
              `to multiple logical channels.`
          });
        }
      }
    });
  }

  // Rule 5: camera_id references must point at a defined camera
  // Stale references (camera removed or renumbered) are invisible in the form,
  // so they are reported here to keep them out of the exported YAML.
  if (Array.isArray(model.cameras)) {
    const definedIds = new Set(getDefinedCameraIds(model.cameras));
    const unknownIds = (ids) =>
      ids.filter((id) => !definedIds.has(parseInt(id, 10)));
    const report = (path, ids) => {
      issues.push({
        path,
        code: 'unknown_camera',
        severity: 'error',
        message:
          `${path} references camera id(s) ${ids.join(', ')} that are not ` +
          `defined in cameras. Remove the reference or add the camera.`,
      });
    };

    ['tasks', 'fs_gui_yamls'].forEach((key) => {
      (model[key] || []).forEach((item, index) => {
        if (!Array.isArray(item?.camera_id)) return;
        const unknown = unknownIds(item.camera_id);
        if (unknown.length > 0) report(`${key}[${index}].camera_id`, unknown);
      });
    });

    (model.associated_video_files || []).forEach((video, index) => {
      const id = video?.camera_id;
      if (id === '' || id === undefined || id === null) return;
      if (!definedIds.has(parseInt(id, 10))) {
        report(`associated_video_files[${index}].camera_id`, [id]);
      }
    });
  }

  return issues;
};
