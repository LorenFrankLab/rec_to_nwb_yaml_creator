/**
 * Custom Business Rules Validation
 *
 * Validates business logic that is not easily expressed in JSON schema.
 */

import { isValidSpecies, idHasSlash } from './dandiSubject';
import { getChannelCount } from '../utils/deviceTypeUtils';
import { deviceTypeMap } from '../ntrode/deviceTypes';

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
        message:
          `Subject ID "${subject.subject_id}" must not contain "/" (DANDI rejects slashes). ` +
          `The Subject ID is the animal's identity and can't be edited here — recreate the ` +
          `animal with a slash-free ID.`,
      });
    }
  }

  if (idHasSlash(model.session_id)) {
    issues.push({
      path: 'session_id',
      code: 'session_id_slash',
      severity: 'error',
      message:
        `Session ID "${model.session_id}" must not contain "/" (DANDI rejects slashes). ` +
        `The Session ID is derived from the Subject ID and date — fix the Subject ID (by ` +
        `recreating the animal with a slash-free ID).`,
    });
  }

  // Rule 9 (Phase 6, Task 1): dangling camera references.
  // Every value in each tasks[].camera_id ARRAY and each scalar
  // associated_video_files[].camera_id must reference an existing cameras[].id.
  // (Existing Rules 1/2 only catch the no-cameras-at-all case; this catches a
  // reference to a camera id that no camera defines — e.g. after a camera is
  // deleted or a CSV/copy import introduces a stale id.)
  // Only when a cameras array is present. When `cameras` is entirely absent,
  // Rules 1/2 above already report "no cameras defined" — don't double-report.
  const validCameraIds = Array.isArray(model.cameras)
    ? new Set(model.cameras.map((c) => c?.id).filter((id) => id !== undefined && id !== null))
    : null;
  if (validCameraIds) (model.tasks || []).forEach((task, ti) => {
    if (!Array.isArray(task?.camera_id)) return;
    task.camera_id.forEach((cid) => {
      if (cid === undefined || cid === null) return;
      if (!validCameraIds.has(cid)) {
        issues.push({
          path: `tasks[${ti}].camera_id`,
          field: 'camera_id',
          step: 'epochs',
          actionLabel: 'Fix task camera',
          code: 'dangling_camera_ref',
          severity: 'error',
          message:
            `Task ${ti + 1}${task.task_name ? ` ("${task.task_name}")` : ''} references ` +
            `camera id ${cid}, but no camera with that id is defined. Pick an existing ` +
            `camera or restore the missing one.`,
        });
      }
    });
  });
  // Video camera_id is a SCALAR integer, not an array (schema nwb_schema.json:892).
  if (validCameraIds) (model.associated_video_files || []).forEach((video, vi) => {
    const cid = video?.camera_id;
    if (cid === undefined || cid === null) return;
    if (!validCameraIds.has(cid)) {
      issues.push({
        path: `associated_video_files[${vi}].camera_id`,
        field: 'camera_id',
        step: 'epochs',
        actionLabel: 'Fix video camera',
        code: 'dangling_camera_ref',
        severity: 'error',
        message:
          `Video ${vi + 1}${video.name ? ` ("${video.name}")` : ''} references camera id ` +
          `${cid}, but no camera with that id is defined. Pick an existing camera or ` +
          `restore the missing one.`,
      });
    }
  });

  // Rule 11 (Phase 6, Task 3): channel bounds (see designs.md#channel-map-semantics).
  // Map VALUES are probe electrode ids, reset PER electrode group (a second
  // tetrode is 0..3, not 4..7). Bounds come from the real device helpers:
  //   getChannelCount(device_type)  → total probe electrode ids [0, count)
  //   deviceTypeMap(device_type)    → the per-shank electrode-id list (its length
  //                                   is the channel count of one ntrode/shank)
  // Looked up via the ntrode's electrode group's device_type. Unknown devices
  // (count 0) are skipped here — Task 5 reports them.
  if (model.ntrode_electrode_group_channel_map?.length > 0) {
    const groupById = new Map(
      (model.electrode_groups || [])
        .filter((g) => g?.id !== undefined && g?.id !== null)
        .map((g) => [g.id, g])
    );
    // Collect the value set per electrode group for the partition check (b).
    const valuesByGroup = new Map();

    model.ntrode_electrode_group_channel_map.forEach((ntrode) => {
      const group = groupById.get(ntrode?.electrode_group_id);
      const deviceType = group?.device_type;
      const channelCount = getChannelCount(deviceType);
      if (!channelCount) return; // dangling group / unknown device handled elsewhere

      const perNtrodeCount = deviceTypeMap(deviceType).length;
      const map = ntrode.map && typeof ntrode.map === 'object' ? ntrode.map : {};

      // (a) every map value is an integer in [0, channelCount)
      const values = Object.values(map);
      const outOfRange = values.filter(
        (v) => !Number.isInteger(v) || v < 0 || v >= channelCount
      );
      if (outOfRange.length > 0) {
        issues.push({
          path: `ntrode_electrode_group_channel_map[${ntrode.ntrode_id}]`,
          field: 'map',
          step: 'devices',
          actionLabel: 'Fix channel map',
          code: 'channel_value_out_of_range',
          severity: 'error',
          message:
            `Ntrode ${ntrode.ntrode_id} maps to electrode id(s) ` +
            `${[...new Set(outOfRange)].join(', ')}, outside the valid range 0–${channelCount - 1} ` +
            `for device "${deviceType}". Probe electrode ids reset per electrode group.`,
        });
      }

      // (c) map keys are 0 … (perNtrodeCount − 1)
      const keys = Object.keys(map).map(Number);
      const keySet = new Set(keys);
      const keysValid =
        keys.length === perNtrodeCount &&
        keys.every((k) => Number.isInteger(k) && k >= 0 && k < perNtrodeCount) &&
        keySet.size === perNtrodeCount;
      if (!keysValid) {
        issues.push({
          path: `ntrode_electrode_group_channel_map[${ntrode.ntrode_id}]`,
          field: 'map',
          step: 'devices',
          actionLabel: 'Fix channel map',
          code: 'channel_key_out_of_range',
          severity: 'error',
          message:
            `Ntrode ${ntrode.ntrode_id} channel-map keys must be 0–${perNtrodeCount - 1} ` +
            `(one per channel of device "${deviceType}").`,
        });
      }

      // (d) bad_channels indices are in [0, channelCount)
      const badChannels = Array.isArray(ntrode.bad_channels) ? ntrode.bad_channels : [];
      const badOutOfRange = badChannels.filter(
        (b) => !Number.isInteger(b) || b < 0 || b >= channelCount
      );
      if (badOutOfRange.length > 0) {
        issues.push({
          path: `ntrode_electrode_group_channel_map[${ntrode.ntrode_id}]`,
          field: 'bad_channels',
          step: 'devices',
          actionLabel: 'Fix bad channels',
          code: 'bad_channel_out_of_range',
          severity: 'error',
          message:
            `Ntrode ${ntrode.ntrode_id} marks bad channel(s) ` +
            `${[...new Set(badOutOfRange)].join(', ')}, outside the valid range 0–${channelCount - 1} ` +
            `for device "${deviceType}".`,
        });
      }

      // Accumulate values for this group's partition check.
      if (!valuesByGroup.has(ntrode.electrode_group_id)) {
        valuesByGroup.set(ntrode.electrode_group_id, { deviceType, channelCount, values: [] });
      }
      valuesByGroup.get(ntrode.electrode_group_id).values.push(...values);
    });

    // (b) within an electrode group, the ntrodes' values partition 0 … channelCount−1
    // (unique + complete — catches a missing per-shank offset or cross-shank collision).
    valuesByGroup.forEach(({ deviceType, channelCount, values }, groupId) => {
      const inRange = values.filter((v) => Number.isInteger(v) && v >= 0 && v < channelCount);
      const unique = new Set(inRange);
      const partitions =
        values.length === channelCount &&
        inRange.length === channelCount &&
        unique.size === channelCount;
      if (!partitions) {
        issues.push({
          path: `ntrode_electrode_group_channel_map`,
          field: 'map',
          step: 'devices',
          actionLabel: 'Fix channel map',
          code: 'channel_partition_invalid',
          severity: 'error',
          message:
            `Electrode group ${groupId} ("${deviceType}") channel map must cover electrode ids ` +
            `0–${channelCount - 1} exactly once across its ntrodes (no gaps, duplicates, or ` +
            `out-of-range values). Multi-shank probes offset each shank by its channel count.`,
        });
      }
    });
  }

  // Rule 10 (Phase 6, Task 2): dangling electrode-group references.
  // Every ntrode_electrode_group_channel_map[].electrode_group_id must reference
  // an existing electrode_groups[].id (otherwise the ntrode maps onto nothing
  // and trodes_to_nwb/Spyglass silently drop or misattach the channels).
  if (model.ntrode_electrode_group_channel_map?.length > 0) {
    const validGroupIds = new Set(
      (model.electrode_groups || []).map((g) => g?.id).filter((id) => id !== undefined && id !== null)
    );
    model.ntrode_electrode_group_channel_map.forEach((ntrode) => {
      const egid = ntrode?.electrode_group_id;
      if (egid === undefined || egid === null) return;
      if (!validGroupIds.has(egid)) {
        issues.push({
          path: `ntrode_electrode_group_channel_map[${ntrode.ntrode_id}]`,
          field: 'electrode_group_id',
          step: 'devices',
          actionLabel: 'Fix channel map',
          code: 'dangling_electrode_group_ref',
          severity: 'error',
          message:
            `Ntrode ${ntrode.ntrode_id} references electrode group id ${egid}, but no ` +
            `electrode group with that id exists. Remove the ntrode or add the group.`,
        });
      }
    });
  }

  return issues;
};
