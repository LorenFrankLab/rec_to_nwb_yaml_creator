/**
 * Custom Business Rules Validation
 *
 * Validates business logic that is not easily expressed in JSON schema.
 */

import { isValidSpecies, idHasSlash } from './dandiSubject';

/**
 * Custom business logic validation rules
 *
 * Rules enforced:
 * 1. Tasks with camera_ids require cameras to be defined
 * 2. Associated video files with camera_ids require cameras to be defined
 * 3. Optogenetics configuration must be complete (all or none of the 3 fields)
 * 4. Ntrode channel mappings must have unique physical channels (no duplicates)
 * 5. Ntrode channel mappings must be sequential (no missing channels)
 * 6. Electrode-group ids must be unique within a session
 * 7. Ntrode ids must be unique across the animal's whole channel map
 * 8. DANDI subject conformance: species is a Latin binomial / NCBI URI, and
 *    subject_id / session_id contain no slashes
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

  // Rule 5: Sequential channel mappings (no gaps) in ntrode_electrode_group_channel_map
  // Logical channels (keys) must be sequential starting from 0
  // e.g., {0: 0, 1: 1, 2: 2, 3: 3} is valid, but {0: 0, 2: 2} is not (missing channel 1)
  if (model.ntrode_electrode_group_channel_map?.length > 0) {
    model.ntrode_electrode_group_channel_map.forEach((ntrode) => {
      if (ntrode.map && typeof ntrode.map === 'object') {
        const logicalChannels = Object.keys(ntrode.map).map(Number).sort((a, b) => a - b);

        // Expected channels should go from 0 to the maximum channel number
        // e.g., if we have channels [0, 3], we expect [0, 1, 2, 3]
        const maxChannel = Math.max(...logicalChannels);
        const expectedChannels = Array.from({ length: maxChannel + 1 }, (_, i) => i);

        // Check if logical channels are sequential (0, 1, 2, 3, ...)
        const missingChannels = expectedChannels.filter(ch => !logicalChannels.includes(ch));

        if (missingChannels.length > 0) {
          issues.push({
            path: `ntrode_electrode_group_channel_map[${ntrode.ntrode_id}]`,
            code: 'missing_channels',
            severity: 'error',
            message:
              `Ntrode ${ntrode.ntrode_id} has gaps in channel mapping. ` +
              `Missing logical channel(s): ${missingChannels.join(', ')}. ` +
              `Channels must be sequential starting from 0.`
          });
        }
      }
    });
  }

  // Rule 6: Electrode-group ids must be unique within a session.
  // trodes_to_nwb names the NWB electrode group from this id and Spyglass keys
  // ElectrodeGroup by session + group name, so duplicate ids collapse groups
  // downstream (silent data loss).
  if (model.electrode_groups?.length > 0) {
    const seen = new Set();
    const reported = new Set();
    model.electrode_groups.forEach((group) => {
      const id = group?.id;
      if (id === undefined || id === null) return;
      if (seen.has(id) && !reported.has(id)) {
        reported.add(id);
        issues.push({
          path: 'electrode_groups',
          code: 'duplicate_electrode_group_id',
          severity: 'error',
          message:
            `Duplicate electrode group id "${id}". Each electrode group must have a ` +
            `unique id — duplicates collapse groups during NWB conversion and Spyglass ingestion.`,
        });
      }
      seen.add(id);
    });
  }

  // Rule 7: Ntrode ids must be unique across the animal's whole channel map.
  // `ntrode_id` keys the per-day bad-channel overrides and the NWB ntrode, so a
  // duplicate silently misroutes bad channels and collapses ntrodes downstream.
  if (model.ntrode_electrode_group_channel_map?.length > 0) {
    const seenNtrodes = new Set();
    const reportedNtrodes = new Set();
    model.ntrode_electrode_group_channel_map.forEach((ntrode) => {
      const id = ntrode?.ntrode_id;
      if (id === undefined || id === null) return;
      if (seenNtrodes.has(id) && !reportedNtrodes.has(id)) {
        reportedNtrodes.add(id);
        issues.push({
          path: 'ntrode_electrode_group_channel_map',
          code: 'duplicate_ntrode_id',
          severity: 'error',
          message:
            `Duplicate ntrode id "${id}". Each ntrode must have a unique id — ` +
            `duplicates misroute bad-channel marks and collapse ntrodes downstream.`,
        });
      }
      seenNtrodes.add(id);
    });
  }

  // Rule 8: DANDI subject conformance. The NWB files publish to DANDI, whose
  // Inspector (dandi config) makes these Subject checks CRITICAL/blocking.
  const subject = model.subject;
  if (subject && typeof subject === 'object') {
    // species: a present-but-invalid value (free text like "Rat") is rejected.
    // An empty/missing species is left to the schema's required + pattern check.
    const sp = subject.species;
    if (typeof sp === 'string' && sp.trim() !== '' && !isValidSpecies(sp)) {
      issues.push({
        path: 'subject.species',
        code: 'invalid_species',
        severity: 'error',
        message:
          `Species "${sp}" is not DANDI-valid. Use a Latin binomial (e.g. ` +
          `"Rattus norvegicus") or an NCBI Taxonomy URI — DANDI rejects free text.`,
      });
    }

    if (idHasSlash(subject.subject_id)) {
      issues.push({
        path: 'subject.subject_id',
        code: 'subject_id_slash',
        severity: 'error',
        message: `Subject ID "${subject.subject_id}" must not contain "/" (DANDI rejects slashes in subject_id).`,
      });
    }
  }

  if (idHasSlash(model.session_id)) {
    issues.push({
      path: 'session_id',
      code: 'session_id_slash',
      severity: 'error',
      message: `Session ID "${model.session_id}" must not contain "/" (DANDI rejects slashes in session_id).`,
    });
  }

  return issues;
};
