/**
 * @fileoverview Day-level device-override cleanup decisions (pure).
 *
 * The single owner of which `day.deviceOverrides` shapes are malformed/stale/shadowing and
 * therefore need a removal control, extracted out of the `DevicesStep` render body. This is
 * the editing-surface counterpart of {@link module:domain/validation.dayOverrideIssues}: the
 * validator surfaces each unhonorable override as an export-blocking issue, and this
 * classifier tells the Devices step exactly which removal controls to render so every such
 * issue is repairable. The two MUST agree shape-for-shape (covered by a correspondence test).
 */

/**
 * Whether `value` is a plain object record (not null, not an array).
 *
 * @param {*} value
 * @returns {boolean}
 */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Classify a day's `deviceOverrides` into the malformed/stale/shadowing shapes the Devices
 * step renders removal controls for. Mirrors the merge's refuse-to-apply branches (and
 * `dayOverrideIssues`):
 *  - `wholeOverridesMalformed`: `deviceOverrides` is present but not a record (the merge
 *    reads keys off it → all undefined → fail-open to the snapshot);
 *  - `badChannelContainerMalformed`: a `bad_channels` container present but not an
 *    ntrode_id→list map (the merge ignores it);
 *  - `staleOverrideKeys`: `bad_channels` keys with no resolved ntrode (dangling);
 *  - `corruptValueKeys`: `bad_channels` keys whose value is not a list (the merge declines);
 *  - `presentGeometryKeys`: any present `electrode_groups` / ntrode-map override (non-array
 *    is corrupt; a valid array SHADOWS the snapshot — both removed the same way).
 *
 * The raw `overridesRecord` / `badChannelContainer` / `badChannelContainerIsRecord` are
 * returned too so the step's removal handlers can rewrite the override safely.
 *
 * @param {object} day - The day record (reads `deviceOverrides`).
 * @param {Set<string>} resolvedNtrodeIds - Ntrode ids present in the resolved channel map.
 * @returns {{
 *   overridesRecord: object|null,
 *   wholeOverridesMalformed: boolean,
 *   badChannelContainer: *,
 *   badChannelContainerIsRecord: boolean,
 *   badChannelContainerMalformed: boolean,
 *   staleOverrideKeys: string[],
 *   corruptValueKeys: string[],
 *   presentGeometryKeys: string[],
 *   hasOverrideCleanup: boolean,
 * }}
 */
export function classifyDeviceOverrides(day, resolvedNtrodeIds) {
  const rawOverrides = day?.deviceOverrides;
  const overridesRecord = isRecord(rawOverrides) ? rawOverrides : null;

  // The WHOLE deviceOverrides is present but not a record (e.g. a restored scalar
  // "corrupt"): the merge reads override keys off it (all undefined → fail-open), so it
  // would export as if clean.
  const wholeOverridesMalformed = rawOverrides != null && overridesRecord === null;

  const badChannelContainer = overridesRecord?.bad_channels;
  const badChannelContainerIsRecord = isRecord(badChannelContainer);
  // The container is present but not an ntrode→list map (e.g. scalar "2.9"): remove the
  // whole override (there are no per-key controls to render).
  const badChannelContainerMalformed = badChannelContainer != null && !badChannelContainerIsRecord;

  // Per-key problems, partitioned for distinct labels: stale (no resolved ntrode) vs.
  // corrupt value (resolved key, non-array value). Both removed by deleting the key.
  const staleOverrideKeys = badChannelContainerIsRecord
    ? Object.keys(badChannelContainer).filter((key) => !resolvedNtrodeIds.has(String(key)))
    : [];
  const corruptValueKeys = badChannelContainerIsRecord
    ? Object.keys(badChannelContainer).filter(
        (key) => resolvedNtrodeIds.has(String(key)) && !Array.isArray(badChannelContainer[key])
      )
    : [];

  // Geometry overrides. The app never PRODUCES a day-level geometry override, so any present
  // one is anomalous: non-array → corrupt (merge fell back to the snapshot); array → a valid
  // override that SHADOWS the editable snapshot. Both are removed by dropping the key.
  const presentGeometryKeys = overridesRecord
    ? ['electrode_groups', 'ntrode_electrode_group_channel_map'].filter(
        (k) => overridesRecord[k] != null
      )
    : [];

  const hasOverrideCleanup =
    wholeOverridesMalformed ||
    staleOverrideKeys.length > 0 ||
    corruptValueKeys.length > 0 ||
    badChannelContainerMalformed ||
    presentGeometryKeys.length > 0;

  return {
    overridesRecord,
    wholeOverridesMalformed,
    badChannelContainer,
    badChannelContainerIsRecord,
    badChannelContainerMalformed,
    staleOverrideKeys,
    corruptValueKeys,
    presentGeometryKeys,
    hasOverrideCleanup,
  };
}
