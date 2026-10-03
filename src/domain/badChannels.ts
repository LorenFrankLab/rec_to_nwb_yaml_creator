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
 * converter meaning. The "Files" section below translates between what the app stores (a
 * row's ticked local channels) and what a file carries, for the legacy form's download and
 * upload and for the workspace export and YAML import.
 */

import { getProbeShanks, getProbeElectrodeIds } from '../ntrode/probeCatalog';
import { isRecord } from '../utils/records';

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

// ── Files ────────────────────────────────────────────────────────────────────────────────────
// In a file, trodes_to_nwb reads `bad_channels` only from the FIRST
// `ntrode_electrode_group_channel_map` row of each electrode group, and reads each value as a
// probe electrode id (convert_yaml.py add_electrode_groups); a later row's list is never read. A
// row's `map` takes the row's local channel (key) to a probe electrode id (value)
// (convert_rec_header.py make_hw_channel_map). Where the app keeps a row's ticked local channels
// (the legacy form; a single-shank group in the Day Editor), they are translated through the map
// on the way out and back on the way in.
//
// A value that is not one of its row's channel keys is kept unchanged as an electrode id (an
// import keeps a first-row id that no channel maps to that way, so validation still sees it). A
// tick on a channel with no electrode assigned (-1, the legacy map's empty option) is left out of
// the file: there is no electrode to mark, and the map value itself fails validation.

/** A channel-map row as the file helpers read it (decoded YAML or app state: a tolerant boundary). */
type ChannelMapRow = Record<string, unknown>;

/**
 * Whether `value` is a probe electrode id (a non-negative integer).
 *
 * @param value - A map value or bad-channel entry.
 * @returns
 */
function isElectrodeId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Whether `value` is one of the channel keys of `rowMap`.
 *
 * @param rowMap - A row's `map`.
 * @param value - A bad-channel entry.
 * @returns
 */
function isChannelOf(rowMap: unknown, value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    isRecord(rowMap) &&
    Object.prototype.hasOwnProperty.call(rowMap, String(value))
  );
}

/**
 * The value a ticked channel is written as in a file: the electrode id it maps to; the value
 * itself when it is not one of the row's channels; `undefined` (left out) when the channel has no
 * electrode assigned.
 *
 * @param rowMap - The row's `map` (local channel → probe electrode id).
 * @param value - One entry of the row's stored `bad_channels`.
 * @returns
 */
function fileValueOfMark(rowMap: unknown, value: unknown): unknown {
  if (!isChannelOf(rowMap, value)) return value;
  const id = (rowMap as Record<string, unknown>)[String(value)];
  return isElectrodeId(id) ? id : undefined;
}

/**
 * The channel of `rowMap` that maps to electrode `id`, or `undefined` when none does. Only
 * canonical integer keys count (`"01"` is not channel 1).
 *
 * @param rowMap - A row's `map`.
 * @param id - A probe electrode id from a file.
 * @returns
 */
function channelOfElectrode(rowMap: unknown, id: unknown): number | undefined {
  if (!isRecord(rowMap) || !isElectrodeId(id)) return undefined;
  const key = Object.keys(rowMap).find(
    (k) => String(Number(k)) === k && Number.isInteger(Number(k)) && rowMap[k] === id
  );
  return key === undefined ? undefined : Number(key);
}

/**
 * Append `value` to `list` unless it is `undefined` or already listed.
 *
 * @param list
 * @param value
 */
function addOnce(list: unknown[], value: unknown): void {
  if (value !== undefined && !list.includes(value)) list.push(value);
}

/**
 * Whether the row lists at least one bad channel.
 *
 * @param row
 * @returns
 */
function hasMarks(row: ChannelMapRow): boolean {
  return Array.isArray(row.bad_channels) && row.bad_channels.length > 0;
}

/**
 * Group channel-map rows by electrode group, groups and rows in file order (the converter takes
 * a group's first row in file order). A row without a group id is its own group.
 *
 * @param rows - `ntrode_electrode_group_channel_map`.
 * @returns The rows of each group.
 */
function groupRows(rows: unknown[]): ChannelMapRow[][] {
  const groups = new Map<unknown, ChannelMapRow[]>();
  rows.forEach((row, index) => {
    if (!isRecord(row)) return;
    const groupId = row.electrode_group_id;
    const key = groupId === undefined || groupId === null ? Symbol(index) : groupId;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  });
  return Array.from(groups.values());
}

/**
 * A copy of `model` with `update` applied to each electrode group's rows, or `model` itself when
 * `needed` is false for every group. A group with a row whose list is not an array is left as it
 * is, for validation to report.
 *
 * @param model - Legacy form data or a parsed file.
 * @param update - Changes one group's rows in place.
 * @param needed - Whether a group needs `update`.
 * @returns
 */
function updateGroups<T>(
  model: T,
  update: (rows: Array<ChannelMapRow & { bad_channels: unknown[] }>) => void,
  needed: (rows: ChannelMapRow[]) => boolean
): T {
  const rows = isRecord(model) ? model.ntrode_electrode_group_channel_map : undefined;
  if (!Array.isArray(rows) || !groupRows(rows).some(needed)) return model;

  const updated = structuredClone(model) as T & { ntrode_electrode_group_channel_map: unknown[] };
  groupRows(updated.ntrode_electrode_group_channel_map).forEach((group) => {
    if (group.every((row) => Array.isArray(row.bad_channels))) {
      update(group as Array<ChannelMapRow & { bad_channels: unknown[] }>);
    }
  });
  return updated;
}

/**
 * Legacy form → file, for the download: every row's ticked channels as the electrode ids they map
 * to, on the group's first row; later rows `[]`.
 *
 * @param form - Legacy form data.
 * @returns A converted copy, or `form` itself when no row has a bad channel.
 */
export function toFileBadChannels<T>(form: T): T {
  return updateGroups(
    form,
    (rows) => {
      const ids: unknown[] = [];
      rows.forEach((row) => {
        row.bad_channels.forEach((value) => addOnce(ids, fileValueOfMark(row.map, value)));
      });
      rows.forEach((row, index) => {
        row.bad_channels = index === 0 ? ids : [];
      });
    },
    (rows) => rows.some(hasMarks)
  );
}

/**
 * A parsed file in the shape this app writes, for an upload before validation: a later row's list
 * (that row's own channel keys, as earlier versions of the legacy form wrote them) moves to the
 * group's first row as electrode ids. A group whose later rows are empty is left as written.
 *
 * @param file - A parsed metadata file.
 * @returns A converted copy, or `file` itself when no later row has a bad channel.
 */
export function canonicalizeFileBadChannels<T>(file: T): T {
  return updateGroups(
    file,
    ([first, ...later]) => {
      later.forEach((row) => {
        row.bad_channels.forEach((value) => addOnce(first.bad_channels, fileValueOfMark(row.map, value)));
        row.bad_channels = [];
      });
    },
    ([, ...later]) => later.some(hasMarks)
  );
}

/**
 * File → legacy form, for an upload after validation: each first-row electrode id becomes a tick
 * on the row and channel that map to it. An id that no channel maps to stays on the first row.
 *
 * @param file - A file in the shape {@link canonicalizeFileBadChannels} returns.
 * @returns A converted copy, or `file` itself when no row has a bad channel.
 */
export function toFormBadChannels<T>(file: T): T {
  return updateGroups(
    file,
    (rows) => {
      const [first] = rows;
      const ids = first.bad_channels;
      first.bad_channels = [];
      ids.forEach((id) => {
        const target = rows.find((row) => channelOfElectrode(row.map, id) !== undefined);
        if (target) {
          addOnce(target.bad_channels, channelOfElectrode(target.map, id));
        } else {
          addOnce(first.bad_channels, id);
        }
      });
    },
    (rows) => rows.some(hasMarks)
  );
}

/** The electrode-group fields the Day Editor classifies a group by. */
interface GroupDevice {
  id?: unknown;
  device_type?: unknown;
}

/**
 * Apply `translate` to the stored marks of every row the Day Editor edits per row (channel keys):
 * every group {@link isMultiShankGroup} rejects, classified exactly as the Failed Channels section
 * does (the group's `device_type` and its number of rows). A multi-shank group's first row holds
 * probe electrode ids (the probe-wide selector) and is left as it is.
 *
 * @param electrodeGroups - The electrode groups.
 * @param rows - The ntrode rows.
 * @param translate - Maps one row's marks.
 * @returns New rows (a translated row is a copy; the others are the same objects).
 */
function mapSingleShankRows<T extends { electrode_group_id?: unknown; bad_channels?: unknown; map?: unknown }>(
  electrodeGroups: unknown,
  rows: T[],
  translate: (marks: unknown[], rowMap: unknown) => unknown[]
): T[] {
  const groups: GroupDevice[] = Array.isArray(electrodeGroups) ? electrodeGroups : [];
  return rows.map((row) => {
    if (!isRecord(row) || !Array.isArray(row.bad_channels) || row.bad_channels.length === 0) return row;
    const deviceType = groups.find((g) => isRecord(g) && g.id === row.electrode_group_id)?.device_type;
    const rowCount = rows.filter((r) => isRecord(r) && r.electrode_group_id === row.electrode_group_id).length;
    if (isMultiShankGroup(deviceType as string, rowCount)) return row;
    return { ...row, bad_channels: translate(row.bad_channels, row.map) };
  });
}

/**
 * Workspace export: a single-shank row's stored failed channels (its channel keys) as the
 * electrode ids they map to, in place on the row.
 *
 * @param electrodeGroups - The day's electrode groups.
 * @param rows - The day's ntrode rows with their stored `bad_channels`.
 * @returns The rows as the file carries them.
 */
export function singleShankBadChannelsToFile<
  T extends { electrode_group_id?: unknown; bad_channels?: unknown; map?: unknown },
>(electrodeGroups: unknown, rows: T[]): T[] {
  return mapSingleShankRows(electrodeGroups, rows, (marks, rowMap) =>
    marks.map((value) => fileValueOfMark(rowMap, value)).filter((value) => value !== undefined)
  );
}

/**
 * Workspace YAML import: a single-shank row's electrode ids from a file as the channel keys the Day
 * Editor stores. An id that no channel maps to is kept.
 *
 * @param electrodeGroups - The file's electrode groups.
 * @param rows - The file's ntrode rows.
 * @returns The rows with stored-shape `bad_channels`.
 */
export function singleShankBadChannelsFromFile<
  T extends { electrode_group_id?: unknown; bad_channels?: unknown; map?: unknown },
>(electrodeGroups: unknown, rows: T[]): T[] {
  return mapSingleShankRows(electrodeGroups, rows, (marks, rowMap) =>
    marks.map((id) => channelOfElectrode(rowMap, id) ?? id)
  );
}
