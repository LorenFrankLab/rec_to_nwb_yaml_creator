/**
 * Custom Business Rules Validation
 *
 * Validates business logic that is not easily expressed in JSON schema.
 */

import { isValidSpecies, idHasSlash } from './dandiSubject';
import { getChannelCount, validateDeviceType } from '../utils/deviceTypeUtils';
import {
  getProbeShanks,
  getProbeElectrodeIds,
  isProbeCatalogConsistent,
} from '../ntrode/probeCatalog';

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
  if (!model.cameras && Array.isArray(model.tasks) && model.tasks.length > 0) {
    const tasksWithCameras = model.tasks.some(task =>
      task.camera_id && Array.isArray(task.camera_id) && task.camera_id.length > 0
    );

    if (tasksWithCameras) {
      issues.push({
        path: 'tasks',
        code: 'missing_camera',
        repairSurface: 'day',
        severity: 'error',
        message: 'Tasks have camera_ids, but no cameras are defined'
      });
    }
  }

  // Rule 2: Associated video files with camera_ids require cameras
  // Only trigger if video files have non-empty camera_id arrays
  if (!model.cameras && Array.isArray(model.associated_video_files) && model.associated_video_files.length > 0) {
    const videosWithCameras = model.associated_video_files.some(video =>
      video.camera_id && Array.isArray(video.camera_id) && video.camera_id.length > 0
    );

    if (videosWithCameras) {
      issues.push({
        path: 'associated_video_files',
        code: 'missing_camera',
        repairSurface: 'day',
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
      repairSurface: 'day',
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
  if (Array.isArray(model.ntrode_electrode_group_channel_map) && model.ntrode_electrode_group_channel_map.length > 0) {
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
            repairSurface: 'animal',
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
  if (Array.isArray(model.ntrode_electrode_group_channel_map) && model.ntrode_electrode_group_channel_map.length > 0) {
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
            repairSurface: 'animal',
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
  if (Array.isArray(model.electrode_groups) && model.electrode_groups.length > 0) {
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
          repairSurface: 'animal',
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
  if (Array.isArray(model.ntrode_electrode_group_channel_map) && model.ntrode_electrode_group_channel_map.length > 0) {
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
          repairSurface: 'animal',
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
        repairSurface: 'day',
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
        repairSurface: 'none',
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
      repairSurface: 'none',
      severity: 'error',
      message:
        `Session ID "${model.session_id}" must not contain "/" (DANDI rejects slashes). ` +
        `The Session ID is derived from the Subject ID and date — fix the Subject ID (by ` +
        `recreating the animal with a slash-free ID).`,
    });
  }

  // Rule 9: dangling camera references.
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
  if (validCameraIds) (Array.isArray(model.tasks) ? model.tasks : []).forEach((task, ti) => {
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
          repairSurface: 'day',
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
  if (validCameraIds) (Array.isArray(model.associated_video_files) ? model.associated_video_files : []).forEach((video, vi) => {
    const cid = video?.camera_id;
    // A blank/empty camera_id is an incomplete row; the schema's required/type
    // check owns that with a clear message — don't emit "references camera id ,".
    if (cid === undefined || cid === null || cid === '') return;
    if (!validCameraIds.has(cid)) {
      issues.push({
        path: `associated_video_files[${vi}].camera_id`,
        field: 'camera_id',
        step: 'epochs',
        actionLabel: 'Fix video camera',
        code: 'dangling_camera_ref',
        repairSurface: 'day',
        severity: 'error',
        message:
          `Video ${vi + 1}${video.name ? ` ("${video.name}")` : ''} references camera id ` +
          `${cid}, but no camera with that id is defined. Pick an existing camera or ` +
          `restore the missing one.`,
      });
    }
  });

  // Rule 11 (Phase Probe Metadata Contract): catalog-driven channel bounds.
  // The VERIFIED probe catalog (probeCatalog.js, transcribed from trodes_to_nwb)
  // is the source of truth. Map VALUES are probe electrode ids, reset PER
  // electrode group, and partitioned across shanks (a 2nd tetrode is 0..3 not 4..7;
  // a 64c-3s probe partitions 64 ids UNEVENLY as 21/21/22). Per electrode group:
  //   (a) every map value is in getProbeElectrodeIds(device_type) [0, total);
  //   (b) the group's ntrode values cover getProbeElectrodeIds exactly once;
  //   (c) the group's ntrode ROW COUNT equals num_shanks, and — matching rows to
  //       shanks BY ORDER — row i's keys are 0..(shank_i.electrodeIds.length-1);
  //   (d) bad_channels are probe-local indices in [0, total).
  // Unknown devices (no shanks) are skipped here — Rule 13 (unknown_device_type) reports them.
  if (Array.isArray(model.ntrode_electrode_group_channel_map) && model.ntrode_electrode_group_channel_map.length > 0) {
    const groupById = new Map(
      (Array.isArray(model.electrode_groups) ? model.electrode_groups : [])
        .filter((g) => g?.id !== undefined && g?.id !== null)
        .map((g) => [g.id, g])
    );

    // Per-row checks (a)/(d) and key-count (c), with rows matched to shanks BY
    // ORDER within each group. `rowIndexByGroup` tracks each group's next shank.
    const rowIndexByGroup = new Map();
    // Collect the value set per electrode group for the coverage check (b).
    const valuesByGroup = new Map();

    model.ntrode_electrode_group_channel_map.forEach((ntrode) => {
      const group = groupById.get(ntrode?.electrode_group_id);
      const deviceType = group?.device_type;
      const channelCount = getChannelCount(deviceType);
      if (!channelCount) return; // dangling group / unknown device handled elsewhere

      const shanks = getProbeShanks(deviceType);
      const electrodeIdSet = new Set(getProbeElectrodeIds(deviceType));
      const gid = ntrode.electrode_group_id;
      const rowIndex = rowIndexByGroup.get(gid) ?? 0;
      rowIndexByGroup.set(gid, rowIndex + 1);
      // The shank this row should mirror (by order); undefined if there are more
      // rows than shanks (an excess row — flagged by the coverage/count checks).
      const shank = shanks[rowIndex];
      const map = ntrode.map && typeof ntrode.map === 'object' ? ntrode.map : {};

      // (a) every map value is a probe electrode id of this device.
      const values = Object.values(map);
      const outOfRange = values.filter((v) => !electrodeIdSet.has(v));
      if (outOfRange.length > 0) {
        issues.push({
          path: `ntrode_electrode_group_channel_map[${ntrode.ntrode_id}]`,
          field: 'map',
          step: 'devices',
          actionLabel: 'Fix channel map',
          code: 'channel_value_out_of_range',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Ntrode ${ntrode.ntrode_id} maps to electrode id(s) ` +
            `${[...new Set(outOfRange)].join(', ')}, outside the valid range 0–${channelCount - 1} ` +
            `for device "${deviceType}". Probe electrode ids reset per electrode group.`,
        });
      }

      // (c) this row's keys are 0..(shank_i.electrodeIds.length-1). When there is
      // no matching shank (excess row), the expected count is 0, so any key fails.
      const expectedKeyCount = shank ? shank.electrodeIds.length : 0;
      const keys = Object.keys(map).map(Number);
      const keySet = new Set(keys);
      const keysValid =
        keys.length === expectedKeyCount &&
        keys.every((k) => Number.isInteger(k) && k >= 0 && k < expectedKeyCount) &&
        keySet.size === expectedKeyCount;
      if (!keysValid) {
        issues.push({
          path: `ntrode_electrode_group_channel_map[${ntrode.ntrode_id}]`,
          field: 'map',
          step: 'devices',
          actionLabel: 'Fix channel map',
          code: 'channel_key_out_of_range',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Ntrode ${ntrode.ntrode_id} channel-map keys must be 0–${expectedKeyCount - 1} ` +
            `(one per channel of shank ${rowIndex + 1} of device "${deviceType}").`,
        });
      }

      // (d) bad_channels indices are probe-local, in [0, channelCount).
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
          repairSurface: 'day',
          severity: 'error',
          message:
            `Ntrode ${ntrode.ntrode_id} marks bad channel(s) ` +
            `${[...new Set(badOutOfRange)].join(', ')}, outside the valid range 0–${channelCount - 1} ` +
            `for device "${deviceType}".`,
        });
      }

      // Accumulate values for this group's coverage check.
      if (!valuesByGroup.has(gid)) {
        valuesByGroup.set(gid, { deviceType, channelCount, values: [] });
      }
      valuesByGroup.get(gid).values.push(...values);
    });

    // (b) within an electrode group, the ntrodes' values must cover EVERY probe
    // electrode id 0 … channelCount-1 exactly once (complete + unique). The
    // converter looks up hw_channel_map[group][str(electrode_id)] for every probe
    // electrode (convert_yaml.add_electrode_groups), so a gap (e.g. a 64c-3s map
    // that under-generates to 60 of 64 ids) or a cross-shank collision (missing
    // per-shank offset) breaks conversion. Skipped when (a) already flagged an
    // out-of-range value for the group, so a single mistake yields a single error.
    valuesByGroup.forEach(({ deviceType, channelCount, values }, groupId) => {
      // (e) the group's ntrode ROW COUNT must equal the probe's shank count. An
      // extra (e.g. empty `{ map: {} }`) row contributes no values and would slip
      // past the coverage check, but the converter expects exactly one row per
      // shank (convert_rec_header header check), so flag the mismatch.
      const expectedRows = getProbeShanks(deviceType).length;
      const actualRows = rowIndexByGroup.get(groupId) ?? 0;
      if (expectedRows > 0 && actualRows !== expectedRows) {
        issues.push({
          path: `ntrode_electrode_group_channel_map`,
          field: 'map',
          step: 'devices',
          actionLabel: 'Fix channel map',
          code: 'channel_row_count_mismatch',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Electrode group ${groupId} ("${deviceType}") has ${actualRows} channel-map row(s) ` +
            `but the probe has ${expectedRows} shank(s). There must be exactly one ntrode row per ` +
            `shank — remove extra rows or add the missing one.`,
        });
        return; // a row-count problem subsumes the coverage check
      }
      const electrodeIdSet = new Set(getProbeElectrodeIds(deviceType));
      const anyOutOfRange = values.some((v) => !electrodeIdSet.has(v));
      if (anyOutOfRange) return; // (a) owns this group's error
      const unique = new Set(values);
      const covers = values.length === channelCount && unique.size === channelCount;
      if (!covers) {
        issues.push({
          path: `ntrode_electrode_group_channel_map`,
          field: 'map',
          step: 'devices',
          actionLabel: 'Fix channel map',
          code: 'channel_partition_invalid',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Electrode group ${groupId} ("${deviceType}") channel map must cover electrode ids ` +
            `0–${channelCount - 1} exactly once across its ntrodes (no gaps or duplicates). The ` +
            `converter looks up every probe electrode id, so a missing id fails conversion.`,
        });
      }
    });
  }

  // Rule 12: non-empty, consistent location / targeted_location.
  // Spyglass auto-creates BrainRegion rows from electrode_group.location by exact
  // string (no trim/case-fold); targeted_location is schema-required and used by
  // trodes_to_nwb as the per-electrode location. Both must be non-empty; a
  // mixed-case duplicate location fragments regions (warning).
  if (Array.isArray(model.electrode_groups) && model.electrode_groups.length > 0) {
    const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';
    model.electrode_groups.forEach((group, gi) => {
      if (!nonEmpty(group?.location)) {
        issues.push({
          path: `electrode_groups[${gi}].location`,
          field: 'location',
          step: 'devices',
          actionLabel: 'Set location',
          code: 'empty_location',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Electrode group ${group?.id ?? gi} has an empty location. A non-empty brain ` +
            `region is required — Spyglass creates a BrainRegion from this exact string.`,
        });
      }
      if (!nonEmpty(group?.targeted_location)) {
        issues.push({
          path: `electrode_groups[${gi}].targeted_location`,
          field: 'targeted_location',
          step: 'devices',
          actionLabel: 'Set targeted location',
          code: 'empty_targeted_location',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Electrode group ${group?.id ?? gi} has an empty targeted_location. It is ` +
            `required and used downstream as the per-electrode location.`,
        });
      }
    });

    // Warning: the same location spelled with different case across groups
    // (e.g. "CA1" vs "ca1") fragments Spyglass BrainRegion rows.
    const byLower = new Map();
    model.electrode_groups.forEach((group) => {
      const loc = group?.location;
      if (typeof loc !== 'string' || loc.trim() === '') return;
      const key = loc.trim().toLowerCase();
      if (!byLower.has(key)) byLower.set(key, new Set());
      byLower.get(key).add(loc.trim());
    });
    byLower.forEach((variants) => {
      if (variants.size > 1) {
        issues.push({
          path: 'electrode_groups',
          field: 'location',
          step: 'devices',
          actionLabel: 'Make location capitalization consistent',
          code: 'inconsistent_location_case',
          repairSurface: 'animal',
          severity: 'warning',
          message:
            `Inconsistent capitalization of the same location across electrode groups: ` +
            `${[...variants].map((v) => `"${v}"`).join(', ')}. Use one spelling — Spyglass ` +
            `treats these as different brain regions and fragments queries.`,
        });
      }
    });
  }

  // Rule 13: device_type is a known/registered probe.
  // An unknown device_type hard-fails downstream (trodes_to_nwb FileNotFoundError
  // loading the probe metadata). Guards copy/CSV-import-introduced values.
  if (Array.isArray(model.electrode_groups) && model.electrode_groups.length > 0) {
    model.electrode_groups.forEach((group, gi) => {
      const dt = group?.device_type;
      if (dt === undefined || dt === null || dt === '') return; // schema 'required' owns the empty case
      if (!validateDeviceType(dt)) {
        issues.push({
          path: `electrode_groups[${gi}].device_type`,
          field: 'device_type',
          step: 'devices',
          actionLabel: 'Pick a supported probe',
          code: 'unknown_device_type',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Electrode group ${group?.id ?? gi} uses device_type "${dt}", which is not a ` +
            `supported probe. Conversion fails when the probe metadata can't be found — ` +
            `choose a known device type.`,
        });
      }
    });
  }

  // Rule 20 (Probe Metadata Contract): the device_type's catalog entry must be
  // INTERNALLY CONSISTENT (contiguous electrode ids 0..n-1, no gaps/dupes, shank
  // count matches). A known-but-inconsistent catalog entry would generate a
  // converter-invalid channel map, so export is BLOCKED and the probe is NAMED.
  // Entirely-unknown device types are owned by Rule 13 (unknown_device_type).
  if (Array.isArray(model.electrode_groups) && model.electrode_groups.length > 0) {
    const reportedProbes = new Set();
    model.electrode_groups.forEach((group, gi) => {
      const dt = group?.device_type;
      if (dt === undefined || dt === null || dt === '') return; // schema owns empty
      if (!validateDeviceType(dt)) return; // unknown -> Rule 13 owns it
      if (isProbeCatalogConsistent(dt)) return; // consistent -> nothing to report
      if (reportedProbes.has(dt)) return; // one error per inconsistent probe
      reportedProbes.add(dt);
      issues.push({
        path: `electrode_groups[${gi}].device_type`,
        field: 'device_type',
        step: 'devices',
        actionLabel: 'Pick a supported probe',
        code: 'inconsistent_probe_catalog',
        repairSurface: 'animal',
        severity: 'error',
        message:
          `Electrode group ${group?.id ?? gi} uses device type "${dt}", whose channel geometry is ` +
          `inconsistent and cannot be exported (its channel map would fail conversion). Choose a ` +
          `different, supported probe type. If you believe "${dt}" should be supported, contact your ` +
          `lab's pipeline maintainer.`,
      });
    });
  }

  // Rule 14: behavioral-event names unique within the day.
  // A duplicate dio_event name is a hard Spyglass DIOEvents primary-key violation
  // and a trodes_to_nwb ValueError.
  if (Array.isArray(model.behavioral_events) && model.behavioral_events.length > 0) {
    const seenNames = new Set();
    const reportedNames = new Set();
    model.behavioral_events.forEach((event) => {
      const name = event?.name;
      if (name === undefined || name === null || name === '') return;
      if (seenNames.has(name) && !reportedNames.has(name)) {
        reportedNames.add(name);
        issues.push({
          path: 'behavioral_events',
          field: 'name',
          step: 'epochs',
          actionLabel: 'Rename behavioral event',
          code: 'duplicate_behavioral_event_name',
          repairSurface: 'day',
          severity: 'error',
          message:
            `Duplicate behavioral event name "${name}". Each behavioral (DIO) event name ` +
            `must be unique — duplicates collide on the Spyglass DIOEvents primary key.`,
        });
      }
      seenNames.add(name);
    });
  }

  // Rule 15: task/video epoch dependencies.
  // (a) task epochs are unique across task rows — Spyglass TaskEpoch is keyed by
  //     session + epoch, so the same epoch number in two tasks collides.
  // (b) each non-empty associated_video_files entry has a task_epochs that matches
  //     some task's task_epochs — an orphaned video silently does not import
  //     (common_behav.py:451, common_task.py:240). Scalar camera_id validity is
  //     Rule 9.
  // A task with epochs and no camera is the explicitly-allowed no-camera path (a
  // camera-less epoch is valid; only a *video* needs a backing epoch + camera).
  if (Array.isArray(model.tasks) && model.tasks.length > 0) {
    const epochOwners = new Map(); // epoch -> count across task rows
    model.tasks.forEach((task) => {
      const epochs = Array.isArray(task?.task_epochs) ? task.task_epochs : [];
      epochs.forEach((e) => {
        if (e === undefined || e === null) return;
        epochOwners.set(e, (epochOwners.get(e) || 0) + 1);
      });
    });
    const reportedEpochs = new Set();
    epochOwners.forEach((count, epoch) => {
      if (count > 1 && !reportedEpochs.has(epoch)) {
        reportedEpochs.add(epoch);
        issues.push({
          path: 'tasks',
          field: 'task_epochs',
          step: 'epochs',
          actionLabel: 'Fix task epochs',
          code: 'duplicate_task_epoch',
          repairSurface: 'day',
          severity: 'error',
          message:
            `Task epoch ${epoch} is used by more than one task. Each epoch belongs to a ` +
            `single task — duplicates collide on the Spyglass TaskEpoch key.`,
        });
      }
    });
  }

  if (Array.isArray(model.associated_video_files) && model.associated_video_files.length > 0) {
    const taskEpochSet = new Set();
    (Array.isArray(model.tasks) ? model.tasks : []).forEach((task) => {
      (Array.isArray(task?.task_epochs) ? task.task_epochs : []).forEach((e) => {
        if (e !== undefined && e !== null) taskEpochSet.add(e);
      });
    });
    model.associated_video_files.forEach((video, vi) => {
      const epoch = video?.task_epochs;
      // Blank/empty task_epochs is an incomplete row; schema required/type owns it.
      if (epoch === undefined || epoch === null || epoch === '') return;
      if (!taskEpochSet.has(epoch)) {
        issues.push({
          path: `associated_video_files[${vi}].task_epochs`,
          field: 'task_epochs',
          step: 'epochs',
          actionLabel: 'Fix video epoch',
          code: 'orphaned_video',
          repairSurface: 'day',
          severity: 'error',
          message:
            `Video ${vi + 1}${video.name ? ` ("${video.name}")` : ''} references task epoch ` +
            `${epoch}, which no task defines. Spyglass silently drops videos without a ` +
            `matching task epoch — point it at an existing epoch.`,
        });
      }
    });
  }

  // orphaned_file: an associated_files[].task_epochs (scalar) must match some
  // task's epochs. Preserved (never silently scrubbed) stale references surface
  // here so the user can repair them instead of losing the value (Load-Time Orphan
  // Visibility Contract).
  if (Array.isArray(model.associated_files) && model.associated_files.length > 0) {
    const taskEpochSet = new Set();
    (Array.isArray(model.tasks) ? model.tasks : []).forEach((task) => {
      (Array.isArray(task?.task_epochs) ? task.task_epochs : []).forEach((e) => {
        if (e !== undefined && e !== null) taskEpochSet.add(e);
      });
    });
    model.associated_files.forEach((file, fi) => {
      const epoch = file?.task_epochs;
      if (epoch === undefined || epoch === null || epoch === '') return; // schema owns empty
      if (!taskEpochSet.has(epoch)) {
        issues.push({
          path: `associated_files[${fi}].task_epochs`,
          field: 'task_epochs',
          step: 'epochs',
          actionLabel: 'Fix file epoch',
          code: 'orphaned_file',
          repairSurface: 'day',
          severity: 'error',
          message:
            `Associated file ${fi + 1}${file.name ? ` ("${file.name}")` : ''} references task ` +
            `epoch ${epoch}, which no task defines. Point it at an existing epoch or remove it.`,
        });
      }
    });
  }

  // Rule 16: workspace/dataset identity consistency (Spyglass).
  // Within the exported model, a reused identity name must carry identical
  // dependent metadata, else Spyglass raises a divergence error or silently reuses
  // the wrong row. (The editing-time guard is the camera/data-acq/task-name editor; this catches
  // imported/existing invalid state in the exported file.)
  const identityDivergences = (items, nameKey, depKeys, code, label, noun) => {
    if (!Array.isArray(items)) return; // schema owns wrong-type (e.g. object) cases
    const seen = new Map(); // name -> first item's dependent signature
    const reported = new Set();
    items.forEach((item) => {
      const name = item?.[nameKey];
      if (name === undefined || name === null || name === '') return;
      const sig = JSON.stringify(depKeys.map((k) => item?.[k] ?? null));
      if (!seen.has(name)) {
        seen.set(name, sig);
      } else if (seen.get(name) !== sig && !reported.has(name)) {
        reported.add(name);
        issues.push({
          path: noun,
          field: nameKey,
          step: noun === 'tasks' ? 'epochs' : 'devices',
          repairSurface: noun === 'tasks' ? 'day' : 'animal',
          actionLabel: label,
          code,
          severity: 'error',
          message:
            `${noun === 'tasks' ? 'Task' : noun === 'cameras' ? 'Camera' : 'Data-acquisition device'} ` +
            `"${name}" is reused with different ${depKeys.join('/')}. In Spyglass the name is an ` +
            `identity — reuse the same name only with identical metadata, or use a new name.`,
        });
      }
    });
  };
  identityDivergences(
    model.cameras, 'camera_name',
    ['id', 'meters_per_pixel', 'lens', 'model', 'manufacturer'],
    'divergent_camera_identity', 'Use a new camera name', 'cameras'
  );
  identityDivergences(
    model.data_acq_device, 'name',
    ['system', 'amplifier', 'adc_circuit'],
    'divergent_data_acq_identity', 'Use a new device name', 'data_acq_device'
  );
  identityDivergences(
    model.tasks, 'task_name',
    ['task_description'],
    'divergent_task_identity', 'Use a new task name', 'tasks'
  );

  // Rule 10: dangling electrode-group references.
  // Every ntrode_electrode_group_channel_map[].electrode_group_id must reference
  // an existing electrode_groups[].id (otherwise the ntrode maps onto nothing
  // and trodes_to_nwb/Spyglass silently drop or misattach the channels).
  if (Array.isArray(model.ntrode_electrode_group_channel_map) && model.ntrode_electrode_group_channel_map.length > 0) {
    const validGroupIds = new Set(
      (Array.isArray(model.electrode_groups) ? model.electrode_groups : []).map((g) => g?.id).filter((id) => id !== undefined && id !== null)
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
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Ntrode ${ntrode.ntrode_id} references electrode group id ${egid}, but no ` +
            `electrode group with that id exists. Remove the ntrode or add the group.`,
        });
      }
    });
  }

  // Rule 17: behavioral-event DESCRIPTION uniqueness.
  // trodes_to_nwb (convert_dios) keys DIO channels by behavioral_events[].description
  // and raises a ValueError on a duplicate description. (Rule 14 covers `name`.)
  if (Array.isArray(model.behavioral_events) && model.behavioral_events.length > 0) {
    const seenDesc = new Set();
    const reportedDesc = new Set();
    model.behavioral_events.forEach((event) => {
      const desc = event?.description;
      if (desc === undefined || desc === null || desc === '') return;
      if (seenDesc.has(desc) && !reportedDesc.has(desc)) {
        reportedDesc.add(desc);
        issues.push({
          path: 'behavioral_events',
          field: 'description',
          step: 'epochs',
          actionLabel: 'Rename behavioral event description',
          code: 'duplicate_behavioral_event_description',
          repairSurface: 'day',
          severity: 'error',
          message:
            `Duplicate behavioral event description "${desc}". The converter keys DIO ` +
            `channels by description and fails on duplicates — each must be unique.`,
        });
      }
      seenDesc.add(desc);
    });
  }

  // Rule 18: camera id uniqueness.
  // The converter names NWB camera devices `camera_device {id}` and videos
  // dereference that exact name, so duplicate cameras[].id collide downstream.
  if (Array.isArray(model.cameras) && model.cameras.length > 0) {
    const seenCam = new Set();
    const reportedCam = new Set();
    model.cameras.forEach((camera) => {
      const id = camera?.id;
      if (id === undefined || id === null) return;
      if (seenCam.has(id) && !reportedCam.has(id)) {
        reportedCam.add(id);
        issues.push({
          path: 'cameras',
          field: 'id',
          step: 'devices',
          actionLabel: 'Use a unique camera id',
          code: 'duplicate_camera_id',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Duplicate camera id "${id}". Camera ids must be unique — the converter names ` +
            `each NWB camera device "camera_device ${id}" and videos reference it by id.`,
        });
      }
      seenCam.add(id);
    });
  }

  // Rule 19: multi-shank bad_channels are ignored
  // downstream. convert_yaml.add_electrode_groups uses ONLY the first ntrode row
  // matching an electrode group for `bad_channels` (then tests every probe
  // electrode against it). So bad_channels marked on a *later* row of a multi-row
  // (multi-shank) group are silently dropped during conversion.
  if (Array.isArray(model.ntrode_electrode_group_channel_map) &&
      model.ntrode_electrode_group_channel_map.length > 0) {
    const firstRowByGroup = new Map();
    model.ntrode_electrode_group_channel_map.forEach((ntrode) => {
      const gid = ntrode?.electrode_group_id;
      if (gid === undefined || gid === null) return;
      if (!firstRowByGroup.has(gid)) firstRowByGroup.set(gid, ntrode);
    });
    const reportedGroups = new Set();
    model.ntrode_electrode_group_channel_map.forEach((ntrode) => {
      const gid = ntrode?.electrode_group_id;
      if (gid === undefined || gid === null) return;
      const isFirst = firstRowByGroup.get(gid) === ntrode;
      const hasBad = Array.isArray(ntrode.bad_channels) && ntrode.bad_channels.length > 0;
      if (!isFirst && hasBad && !reportedGroups.has(gid)) {
        reportedGroups.add(gid);
        issues.push({
          path: `ntrode_electrode_group_channel_map[${ntrode.ntrode_id}]`,
          field: 'bad_channels',
          step: 'devices',
          actionLabel: 'Move bad channels to the first ntrode row',
          code: 'multishank_bad_channels_ignored',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Bad channels on ntrode ${ntrode.ntrode_id} (electrode group ${gid}) are ignored ` +
            `during conversion: trodes_to_nwb reads bad_channels only from the group's first ` +
            `ntrode row. Mark all of this group's bad channels (as probe-local indices) on ` +
            `that first row.`,
        });
      }
    });
  }

  return issues;
};
