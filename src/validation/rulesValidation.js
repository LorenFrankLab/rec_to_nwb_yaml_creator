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
 * 2. Single-valued camera_id references require cameras to be defined
 * 3. Optogenetics configuration must be complete (all or none of the 3 fields)
 * 4. Ntrode channel mappings must have unique physical channels (no duplicates)
 * 5. Every camera_id reference must match a defined camera id
 * 6. optogenetic_stimulation_software is required when optogenetics is configured
 * 7. Optical fibers and virus injections carry a reference; one excitation source at most
 * 8. FsGUI protocols need complete optogenetics, task epochs and an existing DIO event
 * 9. Behavioral event names and descriptions are unique
 * 10. Camera, electrode group and ntrode ids are unique; channel-map rows name a group
 *
 * Rules 7-10 are the trodes_to_nwb crash guards of the modern branch's rule set, with the same
 * codes and messages.
 *
 * @param {object} model - The form data to validate
 * @returns {Issue[]} Array of validation issues with format:
 *   {
 *     path: string,       // Normalized path: "tasks", "optogenetics", etc.
 *     code: string,       // Rule code: "missing_camera", "partial_configuration", etc.
 *     severity: "error",  // "error" blocks the download; "warning" asks the user to confirm
 *     message: string     // User-friendly message
 *   }
 */
import { getDefinedCameraIds } from '../utils/cameraReferences';

/**
 * The values used by more than one item, compared as the converter compares them (raw values,
 * no trimming). Unset values (`undefined`, `null`, `''`) are never duplicates.
 *
 * @param {Array} items - The list to check (anything else counts as empty)
 * @param {Function} valueOf - Reads the compared value from an item
 * @returns {Array} The repeated values, each once, in first-seen order
 */
const repeatedValues = (items, valueOf) => {
  const seen = new Set();
  const repeated = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const value = valueOf(item);
    if (value === undefined || value === null || value === '') return;
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  });
  return [...repeated];
};

export const rulesValidation = (model) => {
  // Handle null/undefined model gracefully
  if (!model || typeof model !== 'object') {
    return [];
  }

  const issues = [];

  // Rule 1: Tasks with camera_ids require cameras to be defined
  // Only trigger if tasks have non-empty camera_id arrays
  if (!model.cameras && Array.isArray(model.tasks) && model.tasks.length > 0) {
    const tasksWithCameras = model.tasks.some(task =>
      task?.camera_id && Array.isArray(task.camera_id) && task.camera_id.length > 0
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

  // Rule 2: Single-valued camera references require cameras
  // associated_video_files[].camera_id and fs_gui_yamls[].camera_id are
  // scalar integers, including 0, so test explicitly for an unset value.
  if (!model.cameras) {
    const hasCameraId = (item) =>
      item?.camera_id !== '' &&
      item?.camera_id !== undefined &&
      item?.camera_id !== null;

    [
      ['associated_video_files', 'Associated video files'],
      ['fs_gui_yamls', 'Fs-gui YAML entries'],
    ].forEach(([key, label]) => {
      if (Array.isArray(model[key]) && model[key].some(hasCameraId)) {
        issues.push({
          path: key,
          code: 'missing_camera',
          severity: 'error',
          message: `${label} have camera_ids, but no cameras are defined`,
        });
      }
    });
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
      if (ntrode?.map && typeof ntrode.map === 'object') {
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

    // tasks[].camera_id is an integer array
    (Array.isArray(model.tasks) ? model.tasks : []).forEach((task, index) => {
      if (!Array.isArray(task?.camera_id)) return;
      const unknown = unknownIds(task.camera_id);
      if (unknown.length > 0) report(`tasks[${index}].camera_id`, unknown);
    });

    // associated_video_files[].camera_id and fs_gui_yamls[].camera_id are
    // single integers ('' when unset)
    ['associated_video_files', 'fs_gui_yamls'].forEach((key) => {
      (Array.isArray(model[key]) ? model[key] : []).forEach((item, index) => {
        const id = item?.camera_id;
        if (id === '' || id === undefined || id === null) return;
        if (!definedIds.has(parseInt(id, 10))) {
          report(`${key}[${index}].camera_id`, [id]);
        }
      });
    });
  }

  // Rule 7: optical fibers and virus injections need a coordinate reference, and there is at
  // most one excitation source. trodes_to_nwb reads `reference` unconditionally (KeyError when
  // missing) and raises a ValueError on more than one opto_excitation_source.
  const nonEmptyStr = (v) => typeof v === 'string' && v.trim() !== '';
  [
    ['optical_fiber', model.optical_fiber],
    ['virus_injection', model.virus_injection],
  ].forEach(([key, items]) => {
    if (!Array.isArray(items)) return;
    items.forEach((item, i) => {
      if (!nonEmptyStr(item?.reference)) {
        issues.push({
          path: `${key}[${i}].reference`,
          code: 'missing_opto_reference',
          severity: 'error',
          message:
            `${key === 'optical_fiber' ? 'Optical fiber' : 'Virus injection'} ${i + 1}` +
            `${nonEmptyStr(item?.name) ? ` ("${item.name}")` : ''} is missing a coordinate ` +
            `reference (e.g. "Bregma at the cortical surface"). trodes_to_nwb requires it and ` +
            `crashes without it.`,
        });
      }
    });
  });

  if (Array.isArray(model.opto_excitation_source) && model.opto_excitation_source.length > 1) {
    issues.push({
      path: 'opto_excitation_source',
      code: 'multiple_excitation_sources',
      severity: 'error',
      message:
        `${model.opto_excitation_source.length} optogenetic excitation sources are defined, ` +
        `but trodes_to_nwb supports exactly one (it raises an error on more). Keep a single ` +
        `opto_excitation_source.`,
    });
  }

  // Rule 8: FsGUI protocols. The converter writes them only after the optogenetics metadata,
  // which it skips unless all four optogenetics fields are filled in (KeyError then). Each epoch
  // indexes the session's epochs table (IndexError, or silently another epoch's start/stop
  // times), and dio_output_name looks up a behavioral event by name (KeyError). The form offers
  // only valid choices, but an imported value, or a renamed or removed event, is caught here.
  // (Camera references are Rule 5.)
  if (Array.isArray(model.fs_gui_yamls) && model.fs_gui_yamls.length > 0) {
    const optoComplete =
      [model.opto_excitation_source, model.optical_fiber, model.virus_injection].every(
        (items) => Array.isArray(items) && items.length > 0
      ) && nonEmptyStr(model.optogenetic_stimulation_software);
    if (!optoComplete) {
      issues.push({
        path: 'fs_gui_yamls',
        code: 'fs_gui_requires_optogenetics',
        severity: 'error',
        message:
          `FsGUI optogenetics protocols are present, but the optogenetics configuration is ` +
          `incomplete (or off). trodes_to_nwb crashes converting FsGUI protocols without the ` +
          `full optogenetics implant metadata. Complete the optogenetics sections, or remove ` +
          `these FsGUI protocols.`,
      });
    }

    const taskEpochs = new Set();
    (Array.isArray(model.tasks) ? model.tasks : []).forEach((task) => {
      (Array.isArray(task?.task_epochs) ? task.task_epochs : []).forEach((epoch) => {
        if (epoch !== undefined && epoch !== null) taskEpochs.add(epoch);
      });
    });
    const eventNames = new Set(
      (Array.isArray(model.behavioral_events) ? model.behavioral_events : [])
        .map((event) => event?.name)
        .filter((name) => typeof name === 'string' && name !== '')
    );

    model.fs_gui_yamls.forEach((fsGui, fi) => {
      const label = `FsGUI protocol ${fi + 1}${fsGui?.name ? ` ("${fsGui.name}")` : ''}`;
      (Array.isArray(fsGui?.epochs) ? fsGui.epochs : []).forEach((epoch) => {
        if (epoch === undefined || epoch === null || epoch === '') return;
        if (!taskEpochs.has(epoch)) {
          issues.push({
            path: `fs_gui_yamls[${fi}].epochs`,
            code: 'orphaned_fs_gui_epoch',
            severity: 'error',
            message:
              `${label} references task epoch ${epoch}, which no task defines. Point it at an ` +
              `existing epoch or remove it.`,
          });
        }
      });

      // A blank value is the schema's required check.
      const dio = fsGui?.dio_output_name;
      if (typeof dio === 'string' && dio.trim() !== '' && !eventNames.has(dio)) {
        issues.push({
          path: `fs_gui_yamls[${fi}].dio_output_name`,
          code: 'dangling_dio_output',
          severity: 'error',
          message:
            `${label} uses DIO output "${dio}", which no behavioral event defines. ` +
            `trodes_to_nwb looks up the behavioral event by this name and fails if it is ` +
            `missing — use an existing behavioral event name.`,
        });
      }
    });
  }

  // Rule 9: behavioral events. A duplicate name collides on the Spyglass DIOEvents primary key
  // and in trodes_to_nwb; convert_dios keys DIO channels by description and raises a ValueError
  // on a duplicate. A blank name is an unused channel, not a duplicate.
  repeatedValues(model.behavioral_events, (event) =>
    typeof event?.name === 'string' && event.name.trim() !== '' ? event.name : undefined
  ).forEach((name) => {
    issues.push({
      path: 'behavioral_events',
      code: 'duplicate_behavioral_event_name',
      severity: 'error',
      message:
        `Duplicate behavioral event name "${name}". Each behavioral (DIO) event name ` +
        `must be unique — duplicates collide on the Spyglass DIOEvents primary key.`,
    });
  });
  repeatedValues(model.behavioral_events, (event) => event?.description).forEach((desc) => {
    issues.push({
      path: 'behavioral_events',
      code: 'duplicate_behavioral_event_description',
      severity: 'error',
      message:
        `Duplicate behavioral event description "${desc}". The converter keys DIO ` +
        `channels by description and fails on duplicates — each must be unique.`,
    });
  });

  // Rule 10: identities. The converter names NWB devices and groups from these ids
  // ("camera_device {id}", the electrode group name), so a duplicate collides or collapses two
  // into one; ntrode_id keys the channel map. A channel-map row must name an existing electrode
  // group, or the converter fails looking it up.
  repeatedValues(model.cameras, (camera) => camera?.id).forEach((id) => {
    issues.push({
      path: 'cameras',
      code: 'duplicate_camera_id',
      severity: 'error',
      message:
        `Duplicate camera id "${id}". Camera ids must be unique — the converter names ` +
        `each NWB camera device "camera_device ${id}" and videos reference it by id.`,
    });
  });
  repeatedValues(model.electrode_groups, (group) => group?.id).forEach((id) => {
    issues.push({
      path: 'electrode_groups',
      code: 'duplicate_electrode_group_id',
      severity: 'error',
      message:
        `Duplicate electrode group id "${id}". Each electrode group must have a ` +
        `unique id — duplicates collapse groups during NWB conversion and Spyglass ingestion.`,
    });
  });
  repeatedValues(model.ntrode_electrode_group_channel_map, (ntrode) => ntrode?.ntrode_id).forEach(
    (id) => {
      issues.push({
        path: 'ntrode_electrode_group_channel_map',
        code: 'duplicate_ntrode_id',
        severity: 'error',
        message:
          `Duplicate ntrode id "${id}". Each ntrode must have a unique id — ` +
          `duplicates misroute bad-channel marks and collapse ntrodes downstream.`,
      });
    }
  );

  if (Array.isArray(model.ntrode_electrode_group_channel_map)) {
    const groupIds = new Set(
      (Array.isArray(model.electrode_groups) ? model.electrode_groups : [])
        .map((group) => group?.id)
        .filter((id) => id !== undefined && id !== null)
    );
    model.ntrode_electrode_group_channel_map.forEach((ntrode) => {
      const groupId = ntrode?.electrode_group_id;
      if (groupId === undefined || groupId === null) return;
      if (!groupIds.has(groupId)) {
        issues.push({
          path: `ntrode_electrode_group_channel_map[${ntrode.ntrode_id}]`,
          code: 'dangling_electrode_group_ref',
          severity: 'error',
          message:
            `Ntrode ${ntrode.ntrode_id} references electrode group id ${groupId}, but no ` +
            `electrode group with that id exists. Remove the ntrode or add the group.`,
        });
      }
    });
  }

  return issues;
};
