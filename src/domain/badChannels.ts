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

/** Parameters for {@link buildProbeWideBadChannelMap}. */
interface BuildProbeWideBadChannelMapParams {
  /** The full current `{ [ntrodeId]: number[] }` map. */
  badChannels: Record<string, number[]>;
  /** The group's first ntrode id. */
  firstNtrodeId: number | string;
  /** The group's later ntrode rows (each with `ntrode_id`/`map`). */
  laterNtrodes: Array<{ ntrode_id: number | string; map: Record<string, number> }>;
  /** The probe-local electrode id toggled. */
  electrodeId: number;
  /** Whether the box was checked. */
  isChecked: boolean;
  /** The group's device type (for the probe id set). */
  deviceType: string;
}

/** Parameters for {@link validBadChannelIds}. */
interface ValidBadChannelIdsParams {
  /** The group's device type. */
  deviceType: string;
  /** Whether this is the first row of a multi-shank group. */
  isMultiShankFirstRow: boolean;
  /** The row's `map` (used for the single-shank/per-row range). */
  rowMap?: Record<string, unknown>;
}

/**
 * A group is edited probe-wide (bad channels on the first row only) iff its verified
 * catalog reports more than one shank AND it has more than one ntrode row (so a
 * degenerate 1-row group never collapses to a probe-wide selector).
 *
 * @param deviceType - The electrode group's device type.
 * @param ntrodeRowCount - Number of ntrode rows in the group.
 * @returns
 */
export function isMultiShankGroup(deviceType: string, ntrodeRowCount: number): boolean {
  return getProbeShanks(deviceType).length > 1 && ntrodeRowCount > 1;
}

/**
 * The probe's full set of probe-local electrode ids (`0..N-1`) for a multi-shank group's
 * first-row selector, as a Set for membership tests.
 *
 * @param deviceType - The electrode group's device type.
 * @returns
 */
export function probeElectrodeIdSet(deviceType: string): Set<number> {
  return new Set(getProbeElectrodeIds(deviceType));
}

/**
 * Coerce a possibly-corrupt persisted `bad_channels` value to an array. A scalar
 * (preserved verbatim by the normalizer so validation can flag it) reads as empty here so
 * iteration never throws; the scalar is surfaced/repaired by its own control.
 *
 * @param value - Raw `bad_channels`.
 * @returns The array, or `[]` for a non-array.
 */
export function asBadChannelArray(value: unknown): number[] {
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
 * @param storedMarks - The later row's raw `bad_channels`.
 * @param rowMap - The later row's `map` (row-local key → probe-local id).
 * @param probeIdSet - Representable probe electrode ids.
 * @returns Representable probe-local ids for this row's marks.
 */
export function translateLaterRowMarks(
  storedMarks: unknown,
  rowMap: Record<string, number> | null | undefined,
  probeIdSet: Set<number>
): number[] {
  const stored = asBadChannelArray(storedMarks);
  // The local widens the value type to include the runtime-possible `undefined` (a key
  // absent from the map) and `null`, so the `=== undefined || === null` fallback below
  // typechecks under strict (where a bare `Record<string, number>` index would be `number`).
  const map: Record<string, number | null | undefined> = rowMap || {};
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
 * @param a
 * @param b
 * @returns
 */
export function unionSortedMarks(a: number[], b: number[]): number[] {
  return Array.from(new Set([...a, ...b])).sort((x, y) => x - y);
}

/**
 * Toggle a single mark in a list: adding sorts the result (matching the editors'
 * historical behavior); removing filters in place (the list was already sorted).
 *
 * @param marks - Current marks.
 * @param value - The channel/electrode id toggled.
 * @param isChecked - Whether it was checked (added) or unchecked (removed).
 * @returns The next marks.
 */
export function toggleMark(marks: unknown, value: number, isChecked: boolean): number[] {
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
 * @param marks - Raw `bad_channels`.
 * @param validIds - The valid ids for this control.
 * @returns The invalid marks.
 */
export function invalidBadChannelMarks(marks: unknown, validIds: Set<number> | number[]): number[] {
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
 * @param params
 * @param params.badChannels - The full current `{ [ntrodeId]: number[] }` map.
 * @param params.firstNtrodeId - The group's first ntrode id.
 * @param params.laterNtrodes - The group's later ntrode rows (each with `ntrode_id`/`map`).
 * @param params.electrodeId - The probe-local electrode id toggled.
 * @param params.isChecked - Whether the box was checked.
 * @param params.deviceType - The group's device type (for the probe id set).
 * @returns The complete next `bad_channels` map.
 */
export function buildProbeWideBadChannelMap({
  badChannels,
  firstNtrodeId,
  laterNtrodes,
  electrodeId,
  isChecked,
  deviceType,
}: BuildProbeWideBadChannelMapParams): Record<string, number[]> {
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
 * The valid probe-local ids for ONE ntrode row's bad-channel control. For the first row of
 * a multi-shank group the valid range is the whole probe (`0..N-1`, what the converter
 * honors); otherwise it is the row's own map keys.
 *
 * @param params
 * @param params.deviceType - The group's device type.
 * @param params.isMultiShankFirstRow - Whether this is the first row of a multi-shank group.
 * @param params.rowMap - The row's `map` (used for the single-shank/per-row range).
 * @returns The valid ids.
 */
export function validBadChannelIds({
  deviceType,
  isMultiShankFirstRow,
  rowMap,
}: ValidBadChannelIdsParams): number[] {
  return isMultiShankFirstRow
    ? getProbeElectrodeIds(deviceType)
    : Object.keys(rowMap || {}).map(Number);
}
