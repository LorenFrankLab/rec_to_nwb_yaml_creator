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
 * 11. Optical fibers, virus injections and the excitation source have distinct names
 * 12. There is at least one task
 * 13. Subject values pynwb rejects (date_of_birth, unknown fields, types); a non-ISO age warns
 * 14. An empty video list warns
 * 15. Several virus injections, or one virus with different titers, warn
 * 16. A subject id the converter cannot group with its recordings warns
 * 17. A virus injection's hemisphere is left or right
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
import JsonSchemaFile from '../nwb_schema.json';

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

/**
 * The fields pynwb's Subject accepts (pynwb 3.1.3). trodes_to_nwb passes `subject` to it as it
 * is, so any other field stops the conversion with a TypeError.
 */
export const NWB_SUBJECT_FIELDS = [
  'age', 'age__reference', 'description', 'genotype', 'sex', 'species', 'subject_id', 'weight',
  'date_of_birth', 'strain',
];

/**
 * The fields of a subject that pynwb's Subject does not accept.
 *
 * @param {*} subject - The subject object (anything else has none)
 * @returns {string[]} The unknown field names, in file order
 */
export const unknownSubjectFields = (subject) =>
  subject && typeof subject === 'object' && !Array.isArray(subject)
    ? Object.keys(subject).filter(
      (key) => subject[key] !== undefined && !NWB_SUBJECT_FIELDS.includes(key)
    )
    : [];

// PyYAML (which trodes_to_nwb reads the file with) loads a plain timestamp with a time of day as
// a datetime; anything else stays text, and a date alone loads as a date. Mirrors its resolver.
const PYYAML_DATETIME =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[Tt]|[ \t]+)(\d{1,2}):(\d{2}):(\d{2})(?:\.\d*)?(?:[ \t]*(?:Z|[-+](\d{1,2})(?::(\d{2}))?))?$/;

/**
 * Whether trodes_to_nwb reads a date_of_birth value as a datetime, which pynwb's Subject requires.
 * An impossible date or time (2023-02-30, 24:00) is not one: PyYAML fails to read the whole file.
 *
 * @param {*} value - The date_of_birth value
 * @returns {boolean} True when it loads as a valid datetime
 */
export const readsAsDatetime = (value) => {
  const match = typeof value === 'string' ? PYYAML_DATETIME.exec(value) : null;
  if (!match) return false;
  const [year, month, day, hour, minute, second, zoneHours = 0, zoneMinutes = 0] =
    match.slice(1).map((part) => Number(part ?? 0));
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return (
    year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= monthDays &&
    hour <= 23 && minute <= 59 && second <= 59 && zoneHours * 60 + zoneMinutes < 24 * 60
  );
};

// An ISO 8601 duration, exactly as NWB Inspector's check_subject_age reads it (CRITICAL under
// the DANDI configuration). A range "lower/upper" is accepted, either side may be blank.
const ISO_DURATION =
  /^P(?!$)(\d+(?:\.\d+)?Y)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?W)?(\d+(?:\.\d+)?D)?(T(?=\d)(\d+(?:\.\d+)?H)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?S)?)?$/;

/**
 * Whether a subject age passes NWB Inspector's check_subject_age.
 *
 * @param {string} age - The age text
 * @returns {boolean} True for an ISO 8601 duration or a range of them
 */
export const isIsoAge = (age) => {
  if (ISO_DURATION.test(age)) return true;
  const bounds = age.split('/');
  return bounds.length === 2 && bounds.every((bound) => bound === '' || ISO_DURATION.test(bound));
};

const AGE_UNITS = { d: 'D', day: 'D', days: 'D', w: 'W', wk: 'W', wks: 'W', week: 'W', weeks: 'W', mo: 'M', month: 'M', months: 'M', y: 'Y', yr: 'Y', yrs: 'Y', year: 'Y', years: 'Y' };

/**
 * The ISO 8601 duration an age most likely means (`P164` or `164` → `P164D`, `6 weeks` →
 * `P6W`), or null when that cannot be told. A bare number is read as days.
 *
 * @param {string|number} age - The age as written
 * @returns {string|null} The suggested duration
 */
export const likelyIsoAge = (age) => {
  const match = /^\s*P?\s*(\d+(?:\.\d+)?)\s*([a-z]*)\s*$/i.exec(String(age));
  if (!match) return null;
  const unit = match[2] === '' ? 'D' : AGE_UNITS[match[2].toLowerCase()];
  return unit ? `P${match[1]}${unit}` : null;
};

// The characters a subject id may hold so trodes_to_nwb, which splits file names on "_", can group
// {date}_{subject}_metadata.yml with the {date}_{subject}_{epoch}_{tag}.rec files. (The modern
// branch's RECORDING_SUBJECT_TOKEN_PATTERN.)
const RECORDING_SUBJECT_TOKEN_PATTERN = /^[A-Za-z0-9-]+$/;

// The schema's own (unanchored) date_of_birth pattern: a value it rejects gets its message.
const SCHEMA_DATE_OF_BIRTH = new RegExp(
  JsonSchemaFile.properties.subject.properties.date_of_birth.pattern
);

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

  // Rule 11: optogenetics device names. trodes_to_nwb adds the excitation source and every
  // optical fiber to the NWB file as devices named after them, and builds the virus injections
  // into containers keyed by name, so a repeated name (or a fiber named like the source) raises
  // a ValueError. A blank name is the schema's required check.
  const nonBlankName = (item) =>
    typeof item?.name === 'string' && item.name.trim() !== '' ? item.name : undefined;
  repeatedValues(model.optical_fiber, nonBlankName).forEach((name) => {
    issues.push({
      path: 'optical_fiber',
      code: 'duplicate_opto_device_name',
      severity: 'error',
      message:
        `More than one optical fiber is named "${name}". trodes_to_nwb stores each fiber as ` +
        `a device named after it and fails on a repeated name — give each fiber its own name.`,
    });
  });
  repeatedValues(model.virus_injection, nonBlankName).forEach((name) => {
    issues.push({
      path: 'virus_injection',
      code: 'duplicate_opto_device_name',
      severity: 'error',
      message:
        `More than one virus injection is named "${name}". trodes_to_nwb stores each ` +
        `injection under its name and fails on a repeated name — give each injection its own name.`,
    });
  });
  const sourceNames = new Set(
    (Array.isArray(model.opto_excitation_source) ? model.opto_excitation_source : [])
      .map((source) => source?.name)
      .filter((name) => typeof name === 'string' && name.trim() !== '')
  );
  (Array.isArray(model.optical_fiber) ? model.optical_fiber : []).forEach((fiber, i) => {
    if (typeof fiber?.name === 'string' && sourceNames.has(fiber.name)) {
      issues.push({
        path: `optical_fiber[${i}].name`,
        code: 'duplicate_opto_device_name',
        severity: 'error',
        message:
          `Optical fiber ${i + 1} is named "${fiber.name}", the same as the excitation source. ` +
          `trodes_to_nwb stores both as devices, which need different names.`,
      });
    }
  });

  // Rule 12: at least one task. trodes_to_nwb always builds the position data from the tasks'
  // epochs and fails when the list is empty.
  if (Array.isArray(model.tasks) && model.tasks.length === 0) {
    issues.push({
      path: 'tasks',
      code: 'no_tasks',
      severity: 'error',
      message:
        'Add at least one task (with its epochs). trodes_to_nwb builds the position data ' +
        'from the tasks and fails when there are none.',
    });
  }

  // Rule 13: subject values pynwb rejects, which mostly arrive in imported files.
  const subject = model.subject;
  if (subject && typeof subject === 'object' && !Array.isArray(subject)) {
    // date_of_birth must load as a datetime. The schema's pattern is not anchored and also allows
    // a time without seconds (2023-01-10T00:00), which PyYAML keeps as text: pynwb then raises a
    // TypeError. Values the schema rejects are left to its message.
    const dateOfBirth = subject.date_of_birth;
    if (
      typeof dateOfBirth === 'string' &&
      SCHEMA_DATE_OF_BIRTH.test(dateOfBirth) &&
      !readsAsDatetime(dateOfBirth)
    ) {
      const minutesOnly = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})?$/.exec(dateOfBirth);
      const suggestion = minutesOnly && readsAsDatetime(`${minutesOnly[1]}:00${minutesOnly[2] || ''}`)
        ? `${minutesOnly[1]}:00${minutesOnly[2] || ''}`
        : '2023-01-10T00:00:00.000Z';
      issues.push({
        path: 'subject.date_of_birth',
        code: 'subject_date_of_birth_format',
        severity: 'error',
        message:
          `Date of birth "${dateOfBirth}" must be a real date with a time to the second, ` +
          `such as "${suggestion}". trodes_to_nwb cannot read this one as a date and time, ` +
          `so it fails to create the NWB subject.`,
      });
    }

    // Any field pynwb's Subject does not know stops the conversion. The import leaves such
    // fields out; this catches one that reaches the download another way.
    unknownSubjectFields(subject).forEach((key) => {
      issues.push({
        path: `subject.${key}`,
        code: 'unknown_subject_field',
        severity: 'error',
        message:
          `Subject field "${key}" is not part of the NWB subject (allowed: ` +
          `${NWB_SUBJECT_FIELDS.join(', ')}). trodes_to_nwb fails on it — remove it.`,
      });
    });

    // pynwb accepts only text for age and strain, and only "birth" or "gestational" for
    // age__reference.
    if (subject.age !== undefined && subject.age !== null && typeof subject.age !== 'string') {
      const likely = likelyIsoAge(subject.age);
      issues.push({
        path: 'subject.age',
        code: 'subject_value_type',
        severity: 'error',
        message:
          `Subject age ${JSON.stringify(subject.age)} is not text. trodes_to_nwb fails on it; ` +
          `write it as an ISO 8601 duration${likely ? `, e.g. "${likely}"` : ' such as "P90D"'}.`,
      });
    }
    if (subject.strain !== undefined && subject.strain !== null && typeof subject.strain !== 'string') {
      issues.push({
        path: 'subject.strain',
        code: 'subject_value_type',
        severity: 'error',
        message:
          `Subject strain ${JSON.stringify(subject.strain)} is not text. trodes_to_nwb fails on ` +
          `it — write the strain as text.`,
      });
    }
    if (
      subject.age__reference !== undefined &&
      subject.age__reference !== 'birth' &&
      subject.age__reference !== 'gestational'
    ) {
      issues.push({
        path: 'subject.age__reference',
        code: 'subject_value_type',
        severity: 'error',
        message:
          `Subject age__reference ${JSON.stringify(subject.age__reference)} must be "birth" or ` +
          `"gestational". trodes_to_nwb fails on any other value.`,
      });
    }

    // A non-empty age must be an ISO 8601 duration, or DANDI's NWB Inspector rejects the file
    // (check_subject_age). Advisory: the conversion itself succeeds.
    if (typeof subject.age === 'string' && subject.age.trim() !== '' && !isIsoAge(subject.age)) {
      const likely = likelyIsoAge(subject.age);
      issues.push({
        path: 'subject.age',
        code: 'subject_age_format',
        severity: 'warning',
        message:
          `Subject age "${subject.age}" is not an ISO 8601 duration, so DANDI's NWB Inspector ` +
          `rejects it. ${likely ? `Did you mean "${likely}"?` : 'Use e.g. "P90D" (90 days) or "P12W" (12 weeks); a range such as "P90D/P120D" is allowed.'}`,
      });
    }
  }

  // Rule 14: an empty video list. The current trodes_to_nwb release always adds the video
  // files and fails (UnboundLocalError) when the list is empty, even for a session recorded
  // without video. Advisory: that is a converter bug, and the session may truly have no video.
  if (Array.isArray(model.associated_video_files) && model.associated_video_files.length === 0) {
    issues.push({
      path: 'associated_video_files',
      code: 'no_associated_videos',
      severity: 'warning',
      message:
        'No video files are listed. The current trodes_to_nwb release stops with an error ' +
        'when the video list is empty, even for a session recorded without video.',
    });
  }

  // Rule 15: several virus injections. trodes_to_nwb links every optical fiber to the FIRST
  // injection, and records each virus once with the titer of its first injection. Advisory:
  // the file converts, but the NWB file does not say what the injections were.
  if (Array.isArray(model.virus_injection) && model.virus_injection.length > 1) {
    const first = model.virus_injection[0];
    issues.push({
      path: 'virus_injection',
      code: 'multiple_virus_injections',
      severity: 'warning',
      message:
        `${model.virus_injection.length} virus injections are listed. trodes_to_nwb links ` +
        `every optical fiber to the first one${first?.name ? ` ("${first.name}")` : ''}, so the ` +
        `NWB file will say every fiber targets that injection's virus.`,
    });
    const titers = new Map();
    model.virus_injection.forEach((injection) => {
      const virus = injection?.virus_name;
      const titer = injection?.titer_in_vg_per_ml;
      if (typeof virus !== 'string' || virus === '' || titer === undefined || titer === null || titer === '') return;
      if (!titers.has(virus)) titers.set(virus, []);
      if (!titers.get(virus).some((seen) => Number(seen) === Number(titer))) titers.get(virus).push(titer);
    });
    titers.forEach((values, virus) => {
      if (values.length < 2) return;
      issues.push({
        path: 'virus_injection',
        code: 'conflicting_virus_titers',
        severity: 'warning',
        message:
          `Virus "${virus}" is injected with different titers (${values.join(', ')} vg/ml). ` +
          `trodes_to_nwb records the virus once, with the first titer (${values[0]}); the ` +
          `others are lost.`,
      });
    });
  }

  // Rule 16: a subject id the converter cannot group with its recordings. trodes_to_nwb finds a
  // session's files by splitting their names on "_" ({date}_{subject}_...), so the id may hold
  // only letters, digits and hyphens. A blank id is the schema's required check.
  const subjectId = model.subject?.subject_id;
  if (
    typeof subjectId === 'string' &&
    subjectId.trim() !== '' &&
    !RECORDING_SUBJECT_TOKEN_PATTERN.test(subjectId)
  ) {
    const problem = subjectId.includes('_')
      ? 'contains an underscore, which the converter uses to split filename parts'
      : /\s/.test(subjectId)
        ? 'contains whitespace'
        : 'contains characters that cannot appear in a recording filename';
    issues.push({
      path: 'subject.subject_id',
      code: 'subject_id_not_recording_compatible',
      severity: 'warning',
      message:
        `Subject ID "${subjectId}" ${problem}. Use only letters, digits and hyphens so ` +
        `{date}_{subject}_metadata.yml groups with the {date}_{subject}_{epoch}_{tag}.rec files.`,
    });
  }

  // Rule 17: trodes_to_nwb accepts only "left" or "right" (any case) as a virus injection's
  // hemisphere and raises a ValueError otherwise ("bilateral" in an imported file, for example).
  // A blank value is the schema's required check.
  (Array.isArray(model.virus_injection) ? model.virus_injection : []).forEach((injection, i) => {
    const hemisphere = injection?.hemisphere;
    if (
      typeof hemisphere === 'string' &&
      hemisphere.trim() !== '' &&
      !['left', 'right'].includes(hemisphere.toLowerCase())
    ) {
      issues.push({
        path: `virus_injection[${i}].hemisphere`,
        code: 'invalid_injection_hemisphere',
        severity: 'error',
        message:
          `Virus injection ${i + 1}${injection?.name ? ` ("${injection.name}")` : ''} has ` +
          `hemisphere "${hemisphere}". trodes_to_nwb accepts only "left" or "right" — record ` +
          `one injection per hemisphere.`,
      });
    }
  });

  return issues;
};
