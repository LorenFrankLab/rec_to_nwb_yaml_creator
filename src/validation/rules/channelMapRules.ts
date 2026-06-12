/**
 * @fileoverview Ntrode channel-map business rules (extracted from rulesValidation.js, Phase split).
 *
 * Rules over `ntrode_electrode_group_channel_map`: unique physical-channel mappings, sequential
 * logical channels, unique ntrode ids, catalog-driven channel bounds + per-group coverage (against
 * the VERIFIED probe catalog), dangling electrode-group references, and the multi-shank bad-channel
 * silent-drop. Each maps to a downstream trodes_to_nwb / Spyglass failure. Pure; moved verbatim.
 */

import type { ValidationIssue, ValidationModel } from '../issueTypes';

import { getChannelCount } from '../../utils/deviceTypeUtils';
import { getProbeShanks, getProbeElectrodeIds } from '../../ntrode/probeCatalog';

/**
 * Rule 4: no duplicate channel mappings — each ntrode's map values must be unique.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function duplicateChannelMappings(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
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

  return issues;
}

/**
 * Rule 5: sequential channel mappings — logical channels (keys) must be 0..max with no gaps.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function sequentialChannelMappings(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
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

  return issues;
}

/**
 * Rule 7: Ntrode ids must be unique across the animal's whole channel map.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function uniqueNtrodeIds(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
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

  return issues;
}

/**
 * Rule 11: catalog-driven channel bounds + per-group coverage.
 *
 * The VERIFIED probe catalog (probeCatalog.js, transcribed from trodes_to_nwb) is the source of
 * truth. Map VALUES are probe electrode ids, reset PER electrode group, partitioned across shanks.
 * Per electrode group: (a) every map value is a probe electrode id; (c) each row's keys are
 * 0..(shank.electrodeIds.length-1); (d) bad_channels are probe-local indices; (b) the group's
 * ntrodes' values cover every probe electrode id exactly once; (e) the row count equals num_shanks.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function channelBounds(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
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
      const electrodeIdSet = new Set<unknown>(getProbeElectrodeIds(deviceType));
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
      const badChannels: any[] = Array.isArray(ntrode.bad_channels) ? ntrode.bad_channels : [];
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
      const electrodeIdSet = new Set<unknown>(getProbeElectrodeIds(deviceType));
      const anyOutOfRange = values.some((v: unknown) => !electrodeIdSet.has(v));
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

  return issues;
}

/**
 * Rule 10: dangling electrode-group references — every ntrode's electrode_group_id must reference
 * an existing electrode_groups[].id.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function danglingElectrodeGroupRefs(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Otherwise the ntrode maps onto nothing and trodes_to_nwb/Spyglass silently drop or misattach
  // the channels.
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

  return issues;
}

/**
 * Rule 19: multi-shank bad_channels are ignored downstream — convert_yaml.add_electrode_groups uses
 * ONLY the first ntrode row of a group for bad_channels, so marks on a later row are silently dropped.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function multishankBadChannels(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
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
          actionLabel: 'Edit bad channels',
          code: 'multishank_bad_channels_ignored',
          // Repaired in the Day Editor Devices step, whose probe-wide bad-channel
          // selector writes probe-local indices to the group's first ntrode row.
          repairSurface: 'day',
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
}
