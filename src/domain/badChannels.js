/**
 * @fileoverview Bad-channel converter semantics (pure).
 *
 * The single owner of what `bad_channels` MEAN for the converter, extracted out of the
 * Day Editor (`BadChannelsEditor`, `DevicesStep`) render bodies so components only render
 * + dispatch. trodes_to_nwb reads `bad_channels`
 * from an electrode group's FIRST ntrode row only, as PROBE-LOCAL electrode indices
 * `0..N-1` spanning all shanks. These helpers encode that rule, the later-row migration
 * (translate + consolidate onto the first row), and the invalid/out-of-range mark
 * interpretation, so the editors decide identically and a UI refactor cannot change
 * converter meaning.
 */

import { getProbeShanks, getProbeElectrodeIds } from '../ntrode/probeCatalog';

/**
 * A group is edited probe-wide (bad channels on the first row only) iff its verified
 * catalog reports more than one shank AND it has more than one ntrode row (so a
 * degenerate 1-row group never collapses to a probe-wide selector).
 *
 * @param {string} deviceType - The electrode group's device type.
 * @param {number} ntrodeRowCount - Number of ntrode rows in the group.
 * @returns {boolean}
 */
export function isMultiShankGroup(deviceType, ntrodeRowCount) {
  return getProbeShanks(deviceType).length > 1 && ntrodeRowCount > 1;
}

/**
 * The probe's full set of probe-local electrode ids (`0..N-1`) for a multi-shank group's
 * first-row selector, as a Set for membership tests.
 *
 * @param {string} deviceType - The electrode group's device type.
 * @returns {Set<number>}
 */
export function probeElectrodeIdSet(deviceType) {
  return new Set(getProbeElectrodeIds(deviceType));
}

/**
 * Coerce a possibly-corrupt persisted `bad_channels` value to an array. A scalar
 * (preserved verbatim by the normalizer so validation can flag it) reads as empty here so
 * iteration never throws; the scalar is surfaced/repaired by its own control.
 *
 * @param {*} value - Raw `bad_channels`.
 * @returns {Array} The array, or `[]` for a non-array.
 */
export function asBadChannelArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Translate a later ntrode row's stored bad-channel entries (row-local map KEYS) to
 * probe-local electrode ids via `rowMap[key]`, keeping only ids representable on the
 * probe-wide selector. The probe-wide selector and the converter both speak probe-local
 * ids, so a later row's marks must be carried over by their mapped id, not their raw
 * row-local index. When the map lacks the key we fall back to the raw key, but drop
 * anything not a representable probe electrode id (an untranslatable, out-of-range mark
 * has no checkbox and the converter ignores it — copying it would fabricate an
 * unrepairable first-row value).
 *
 * @param {*} storedMarks - The later row's raw `bad_channels`.
 * @param {object} rowMap - The later row's `map` (row-local key → probe-local id).
 * @param {Set<number>} probeIdSet - Representable probe electrode ids.
 * @returns {number[]} Representable probe-local ids for this row's marks.
 */
export function translateLaterRowMarks(storedMarks, rowMap, probeIdSet) {
  const stored = asBadChannelArray(storedMarks);
  const map = rowMap || {};
  return stored
    .map((key) => {
      const mapped = map[key];
      return mapped === undefined || mapped === null ? key : mapped;
    })
    .filter((id) => probeIdSet.has(id));
}

/**
 * Union two numeric mark lists into a sorted, de-duplicated array.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
export function unionSortedMarks(a, b) {
  return Array.from(new Set([...a, ...b])).sort((x, y) => x - y);
}

/**
 * Toggle a single mark in a list: adding sorts the result (matching the editors'
 * historical behavior); removing filters in place (the list was already sorted).
 *
 * @param {number[]} marks - Current marks.
 * @param {number} value - The channel/electrode id toggled.
 * @param {boolean} isChecked - Whether it was checked (added) or unchecked (removed).
 * @returns {number[]} The next marks.
 */
export function toggleMark(marks, value, isChecked) {
  const current = asBadChannelArray(marks);
  return isChecked
    ? [...current, value].sort((a, b) => a - b)
    : current.filter((ch) => ch !== value);
}

/**
 * The marks in `marks` that have no corresponding valid id (an out-of-range probe-local
 * id, or a non-integer like `'abc'`) — they block export but the grid can't render a
 * checkbox to clear them, so the editors render an explicit removal control for each.
 *
 * @param {*} marks - Raw `bad_channels`.
 * @param {Set<number>|number[]} validIds - The valid ids for this control.
 * @returns {Array} The invalid marks.
 */
export function invalidBadChannelMarks(marks, validIds) {
  const valid = validIds instanceof Set ? validIds : new Set(validIds);
  return asBadChannelArray(marks).filter((v) => !valid.has(v));
}

/**
 * Build the WHOLE next `bad_channels` map (`{ [ntrodeId]: number[] }` shape, used by the
 * Day Editor) for a multi-shank probe-wide toggle: the first row becomes the UNION of its
 * toggled selection and every later row's TRANSLATED marks, and every later row is cleared
 * to `[]`. This both edits the selection and migrates loaded later-row corruption so
 * `multishank_bad_channels_ignored` passes. Emitted as one object for an atomic write.
 *
 * @param {object} params
 * @param {object} params.badChannels - The full current `{ [ntrodeId]: number[] }` map.
 * @param {number|string} params.firstNtrodeId - The group's first ntrode id.
 * @param {Array} params.laterNtrodes - The group's later ntrode rows (each with `ntrode_id`/`map`).
 * @param {number} params.electrodeId - The probe-local electrode id toggled.
 * @param {boolean} params.isChecked - Whether the box was checked.
 * @param {string} params.deviceType - The group's device type (for the probe id set).
 * @returns {object} The complete next `bad_channels` map.
 */
export function buildProbeWideBadChannelMap({
  badChannels,
  firstNtrodeId,
  laterNtrodes,
  electrodeId,
  isChecked,
  deviceType,
}) {
  const probeIdSet = probeElectrodeIdSet(deviceType);
  const firstKey = String(firstNtrodeId);
  const firstSelection = toggleMark(badChannels[firstKey] || [], electrodeId, isChecked);
  const translated = laterNtrodes.flatMap((n) =>
    translateLaterRowMarks(badChannels[String(n.ntrode_id)], n.map, probeIdSet)
  );
  const next = { ...badChannels };
  next[firstKey] = unionSortedMarks(firstSelection, translated);
  laterNtrodes.forEach((n) => {
    next[String(n.ntrode_id)] = [];
  });
  return next;
}

/**
 * Build the migrated channel-map rows (array-of-rows shape) for a multi-shank probe-wide
 * toggle. The first row becomes the UNION
 * of its toggled selection and every later row's TRANSLATED marks; later rows are cleared
 * to `[]` when they carry a non-empty array OR a preserved corrupt scalar (both are
 * converter-ignored corruption the hidden later-row grid can't otherwise repair).
 *
 * Takes an options object (not positional args) to match its Day-Editor twin
 * {@link buildProbeWideBadChannelMap} and make the same-typed `electrodeId`/`isChecked`
 * non-transposable.
 *
 * @param {object} params
 * @param {Array} params.channelMaps - The group's local channel-map rows (each with `bad_channels`/`map`).
 * @param {number} params.electrodeId - The probe-local electrode id toggled.
 * @param {boolean} params.isChecked - Whether the box was checked.
 * @param {string} params.deviceType - The group's device type (for the probe id set).
 * @returns {Array} The next channel-map rows.
 */
export function migrateProbeWideChannelMaps({ channelMaps, electrodeId, isChecked, deviceType }) {
  const probeIdSet = probeElectrodeIdSet(deviceType);
  const translatedLaterMarks = channelMaps
    .slice(1)
    .flatMap((map) => translateLaterRowMarks(map.bad_channels, map.map, probeIdSet));

  return channelMaps.map((map, idx) => {
    if (idx === 0) {
      const firstSelection = toggleMark(map.bad_channels, electrodeId, isChecked);
      return { ...map, bad_channels: unionSortedMarks(firstSelection, translatedLaterMarks) };
    }
    const isNonEmptyArray = Array.isArray(map.bad_channels) && map.bad_channels.length > 0;
    const isScalar = !Array.isArray(map.bad_channels) && map.bad_channels != null;
    if (isNonEmptyArray || isScalar) {
      return { ...map, bad_channels: [] };
    }
    return map;
  });
}

/**
 * The valid probe-local ids for ONE ntrode row's bad-channel control. For the first row of
 * a multi-shank group the valid range is the whole probe (`0..N-1`, what the converter
 * honors); otherwise it is the row's own map keys.
 *
 * @param {object} params
 * @param {string} params.deviceType - The group's device type.
 * @param {boolean} params.isMultiShankFirstRow - Whether this is the first row of a multi-shank group.
 * @param {object} params.rowMap - The row's `map` (used for the single-shank/per-row range).
 * @returns {number[]} The valid ids.
 */
export function validBadChannelIds({ deviceType, isMultiShankFirstRow, rowMap }) {
  return isMultiShankFirstRow
    ? getProbeElectrodeIds(deviceType)
    : Object.keys(rowMap || {}).map(Number);
}
