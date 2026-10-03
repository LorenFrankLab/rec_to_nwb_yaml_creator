/**
 * Bad-channel converter semantics (pure helpers) — preserves the rules the three editors
 * used to embed in their render bodies: single-shank marks, multi-shank first-row probe-wide
 * marks, later-row ignored/translated marks, invalid probe-local ids, and the probe-wide
 * migration. trodes_to_nwb reads bad_channels from the first ntrode row only, as probe-local
 * ids `0..N-1` spanning all shanks; these tests lock that meaning.
 */
import { describe, it, expect } from 'vitest';
import {
  isMultiShankGroup,
  asBadChannelArray,
  translateLaterRowMarks,
  unionSortedMarks,
  toggleMark,
  invalidBadChannelMarks,
  buildProbeWideBadChannelMap,
  validBadChannelIds,
  probeElectrodeIdSet,
  toFileBadChannels,
  canonicalizeFileBadChannels,
  toFormBadChannels,
} from '../badChannels';

const SINGLE = 'tetrode_12.5'; // 1 shank, ids 0..3
const MULTI = '32c-2s8mm6cm-20um-40um-dl'; // 2 shanks, ids 0..31 (16 + 16)

// A 2-shank group: row 1 maps row-local 0..15 → probe 0..15; row 2 → probe 16..31.
const rowMap = (offset) => Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i, offset + i]));
const twoShankRows = (firstBad, secondBad) => [
  { ntrode_id: 1, electrode_group_id: 0, bad_channels: firstBad, map: rowMap(0) },
  { ntrode_id: 2, electrode_group_id: 0, bad_channels: secondBad, map: rowMap(16) },
];

describe('isMultiShankGroup', () => {
  it('is false for a single-shank probe even with multiple rows', () => {
    expect(isMultiShankGroup(SINGLE, 4)).toBe(false);
  });
  it('is true for a multi-shank probe with >1 ntrode row', () => {
    expect(isMultiShankGroup(MULTI, 2)).toBe(true);
  });
  it('is false for a multi-shank probe collapsed to a single row', () => {
    expect(isMultiShankGroup(MULTI, 1)).toBe(false);
  });
  it('is false for an unknown/undefined device type (no catalog shanks)', () => {
    expect(isMultiShankGroup(undefined, 2)).toBe(false);
  });
});

describe('asBadChannelArray / toggleMark / unionSortedMarks', () => {
  it('coerces a corrupt scalar bad_channels to []', () => {
    expect(asBadChannelArray('2.9')).toEqual([]);
    expect(asBadChannelArray(5)).toEqual([]);
    expect(asBadChannelArray([1, 2])).toEqual([1, 2]);
  });
  it('adds (sorted) and removes a mark, tolerating a scalar', () => {
    expect(toggleMark([3, 1], 2, true)).toEqual([1, 2, 3]);
    expect(toggleMark([1, 2, 3], 2, false)).toEqual([1, 3]);
    expect(toggleMark('corrupt', 2, true)).toEqual([2]);
  });
  it('removes the last mark to an empty list and tolerates unchecking a scalar', () => {
    expect(toggleMark([2], 2, false)).toEqual([]);
    expect(toggleMark('corrupt', 2, false)).toEqual([]);
  });
  it('unions into a sorted unique list', () => {
    expect(unionSortedMarks([5, 1], [1, 9])).toEqual([1, 5, 9]);
  });
});

describe('translateLaterRowMarks', () => {
  it('translates row-local keys to probe-local ids via the row map', () => {
    // Second row key 3 → probe id 19; key 0 → 16.
    expect(translateLaterRowMarks([0, 3], rowMap(16), probeElectrodeIdSet(MULTI))).toEqual([16, 19]);
  });
  it('drops untranslatable, out-of-range marks (no probe checkbox)', () => {
    // 999 has no map entry and is not a probe id → dropped (not fabricated onto row 1).
    expect(translateLaterRowMarks([999], {}, probeElectrodeIdSet(MULTI))).toEqual([]);
  });
  it('keeps a raw key with no map entry when it is itself a representable probe id', () => {
    // No map entry for 19, but 19 IS a probe electrode id → fall back to the raw key.
    expect(translateLaterRowMarks([19], {}, probeElectrodeIdSet(MULTI))).toEqual([19]);
  });
});

describe('invalidBadChannelMarks', () => {
  it('flags out-of-range ids and non-integers, leaving valid ids', () => {
    expect(invalidBadChannelMarks([0, 3, 99, 'abc'], [0, 1, 2, 3])).toEqual([99, 'abc']);
  });
  it('treats a scalar as empty (no marks to flag)', () => {
    expect(invalidBadChannelMarks('2.9', [0, 1, 2, 3])).toEqual([]);
  });
});

describe('buildProbeWideBadChannelMap (Day Editor map shape)', () => {
  it('unions the first-row toggle with translated later marks and clears later rows', () => {
    const rows = twoShankRows([2], [3]); // later row key 3 → probe 19
    const badChannels = { 1: [2], 2: [3] };
    const next = buildProbeWideBadChannelMap({
      badChannels,
      firstNtrodeId: 1,
      laterNtrodes: rows.slice(1),
      electrodeId: 5,
      isChecked: true,
      deviceType: MULTI,
    });
    expect(next).toEqual({ 1: [2, 5, 19], 2: [] });
  });

  it('unchecking removes only that id and still migrates later rows', () => {
    const rows = twoShankRows([2, 5], [3]);
    const next = buildProbeWideBadChannelMap({
      badChannels: { 1: [2, 5], 2: [3] },
      firstNtrodeId: 1,
      laterNtrodes: rows.slice(1),
      electrodeId: 5,
      isChecked: false,
      deviceType: MULTI,
    });
    expect(next).toEqual({ 1: [2, 19], 2: [] });
  });
});

describe('validBadChannelIds', () => {
  it('returns the whole probe range for a multi-shank first row', () => {
    expect(validBadChannelIds({ deviceType: MULTI, isMultiShankFirstRow: true, rowMap: rowMap(0) }))
      .toEqual(Array.from({ length: 32 }, (_, i) => i));
  });
  it('returns the row map keys otherwise (single-shank / later row)', () => {
    expect(validBadChannelIds({ deviceType: SINGLE, isMultiShankFirstRow: false, rowMap: { 0: 0, 1: 1, 2: 2, 3: 3 } }))
      .toEqual([0, 1, 2, 3]);
  });
  it('tolerates an undefined device type on the non-multi-shank path (DevicesStep group?.device_type)', () => {
    expect(validBadChannelIds({ deviceType: undefined, isMultiShankFirstRow: false, rowMap: { 0: 0, 1: 1 } }))
      .toEqual([0, 1]);
  });
});

// ── Files: trodes_to_nwb reads bad_channels from each group's FIRST row only, as probe electrode
// ids; a row's map takes its local channel (key) to a probe electrode id (value). ──

const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
/**
 * A channel map from the electrode ids in local channel order.
 *
 * @param {number[]} electrodeIds - [2, 0, 3, 1] is channel 0 → electrode 2, channel 1 → 0, ...
 * @returns {Record<string, number>} The map
 */
const mapOf = (electrodeIds) =>
  Object.fromEntries(electrodeIds.map((id, channel) => [String(channel), id]));
const row = (ntrodeId, groupId, map, badChannels = []) => ({
  ntrode_id: ntrodeId,
  electrode_group_id: groupId,
  bad_channels: badChannels,
  map,
});
const model = (...rows) => ({ session_id: 's1', ntrode_electrode_group_channel_map: rows });
const badChannelsOf = (m) => m.ntrode_electrode_group_channel_map.map((r) => r.bad_channels);

const IDENTITY_TETRODE = mapOf([0, 1, 2, 3]);
// The channel-mapping modal's example: channel 0 → electrode 2, 1 → 0, 2 → 3, 3 → 1.
const REMAPPED_TETRODE = mapOf([2, 0, 3, 1]);
// 128c-4s: four shanks of 32, electrode ids 0–31, 32–63, 64–95, 96–127.
const shanks128 = [range(0, 31), range(32, 63), range(64, 95), range(96, 127)].map(mapOf);
// 64c-3s: shanks of 21, 21 and 22, electrode ids 0–20, 21–41, 42–63.
const shanks64 = [range(0, 20), range(21, 41), range(42, 63)].map(mapOf);
const fourShankRows = (lists, groupId = 0, firstNtrodeId = 1) =>
  lists.map((list, i) => row(firstNtrodeId + i, groupId, shanks128[i], list));
const threeShankRows = (lists, groupId = 0, firstNtrodeId = 1) =>
  lists.map((list, i) => row(firstNtrodeId + i, groupId, shanks64[i], list));

describe('toFileBadChannels (legacy form download)', () => {
  it('leaves a group whose map is the identity as it is', () => {
    expect(badChannelsOf(toFileBadChannels(model(row(1, 0, IDENTITY_TETRODE, [1, 3]))))).toEqual([[1, 3]]);
  });

  it('writes the electrode a remapped channel maps to, not the channel number', () => {
    expect(badChannelsOf(toFileBadChannels(model(row(1, 0, REMAPPED_TETRODE, [0]))))).toEqual([[2]]);
    expect(badChannelsOf(toFileBadChannels(model(row(1, 0, REMAPPED_TETRODE, [0, 3]))))).toEqual([[2, 1]]);
  });

  it('collects every shank of a 128c-4s probe on the first row as electrode ids; later rows get []', () => {
    const form = model(...fourShankRows([[3], [5], [0], [31]]));
    expect(badChannelsOf(toFileBadChannels(form))).toEqual([[3, 37, 64, 127], [], [], []]);
  });

  it('uses each shank of a 64c-3s probe (21/21/22 channels) as mapped', () => {
    const form = model(...threeShankRows([[20], [0], [21]]));
    expect(badChannelsOf(toFileBadChannels(form))).toEqual([[20, 21, 63], [], []]);
  });

  it('keeps electrode groups apart, taking the first row of each group in file order', () => {
    const form = model(
      row(1, 0, shanks128[0], [1]),
      row(2, 1, REMAPPED_TETRODE, [3]),
      row(3, 0, shanks128[1], [2]),
      row(4, 0, shanks128[2], []),
      row(5, 0, shanks128[3], [])
    );
    expect(badChannelsOf(toFileBadChannels(form))).toEqual([[1, 34], [1], [], [], []]);
  });

  it('writes each electrode once', () => {
    const form = model(row(1, 0, mapOf([0, 0, 2, 3]), [0, 1]));
    expect(badChannelsOf(toFileBadChannels(form))).toEqual([[0]]);
  });

  it('never writes a channel with no electrode assigned as another electrode', () => {
    // -1 is the form's empty map option: channel 0 has no electrode, so its tick marks nothing
    // (the map value fails validation, so the download waits until it is assigned).
    const form = model(row(1, 0, { 0: -1, 1: 1, 2: 2, 3: 3 }, [0, 2]));
    expect(badChannelsOf(toFileBadChannels(form))).toEqual([[2]]);

    const later = model(row(1, 0, shanks128[0], []), row(2, 0, { ...shanks128[1], 5: -1 }, [5]));
    expect(badChannelsOf(toFileBadChannels(later))).toEqual([[], []]);
  });

  it('keeps a value that is not one of its row channels unchanged, as an electrode id', () => {
    const form = model(row(1, 0, IDENTITY_TETRODE, [1, 7]));
    expect(badChannelsOf(toFileBadChannels(form))).toEqual([[1, 7]]);
  });

  it('leaves a group alone when its first row has no bad-channel list, for validation to report', () => {
    const form = model(row(1, 0, shanks128[0], 'corrupt'), row(2, 0, shanks128[1], [5]));
    expect(badChannelsOf(toFileBadChannels(form))).toEqual(['corrupt', [5]]);
  });

  it('returns the same object when no row has a bad channel, and never changes its input', () => {
    const empty = model(...fourShankRows([[], [], [], []]));
    expect(toFileBadChannels(empty)).toBe(empty);
    expect(toFileBadChannels({ session_id: 's1' })).toEqual({ session_id: 's1' });

    const form = model(...fourShankRows([[3], [5], [], []]));
    const before = structuredClone(form);
    expect(toFileBadChannels(form)).not.toBe(form);
    expect(form).toEqual(before);
  });
});

describe('canonicalizeFileBadChannels (legacy form upload, before validation)', () => {
  it('leaves a file whose later rows have no bad channels exactly as it is', () => {
    const file = model(row(1, 0, REMAPPED_TETRODE, [0]), ...fourShankRows([[3, 37], [], [], []], 1, 2));
    expect(canonicalizeFileBadChannels(file)).toBe(file);
  });

  it("moves a later row's channels, as earlier versions wrote them, to the first row as electrode ids", () => {
    const file = model(...fourShankRows([[3], [5], [], [31]]));
    expect(badChannelsOf(canonicalizeFileBadChannels(file))).toEqual([[3, 37, 127], [], [], []]);
  });

  it('adds only electrode ids the first row does not already list', () => {
    const file = model(...fourShankRows([[37, 3], [5], [], []]));
    expect(badChannelsOf(canonicalizeFileBadChannels(file))).toEqual([[37, 3], [], [], []]);
  });

  it('never moves a later-row channel with no electrode assigned onto another electrode', () => {
    const file = model(row(1, 0, shanks128[0], [1]), row(2, 0, { ...shanks128[1], 5: -1 }, [5]));
    expect(badChannelsOf(canonicalizeFileBadChannels(file))).toEqual([[1], []]);
  });
});

describe('toFormBadChannels (legacy form upload, after validation)', () => {
  it('ticks the same channels when the map is the identity', () => {
    expect(badChannelsOf(toFormBadChannels(model(row(1, 0, IDENTITY_TETRODE, [1, 3]))))).toEqual([[1, 3]]);
  });

  it('ticks the channel that maps to each electrode of a remapped tetrode', () => {
    expect(badChannelsOf(toFormBadChannels(model(row(1, 0, REMAPPED_TETRODE, [0]))))).toEqual([[1]]);
    expect(badChannelsOf(toFormBadChannels(model(row(1, 0, REMAPPED_TETRODE, [2, 1]))))).toEqual([[0, 3]]);
  });

  it('ticks each electrode of a 128c-4s probe on its own shank', () => {
    const file = model(...fourShankRows([[3, 37, 64, 127], [], [], []]));
    expect(badChannelsOf(toFormBadChannels(file))).toEqual([[3], [5], [0], [31]]);
  });

  it('ticks each electrode of a 64c-3s probe on its own shank', () => {
    const file = model(...threeShankRows([[20, 21, 41, 42, 63], [], []]));
    expect(badChannelsOf(toFormBadChannels(file))).toEqual([[20], [0, 20], [0, 21]]);
  });

  it('keeps an electrode id that no channel maps to on the first row instead of dropping it', () => {
    const form = toFormBadChannels(model(row(1, 0, REMAPPED_TETRODE, [7, 2])));
    expect(badChannelsOf(form)).toEqual([[7, 0]]);
    expect(badChannelsOf(toFileBadChannels(form))).toEqual([[7, 2]]);
  });

  it('returns the same object when no row has a bad channel', () => {
    const file = model(...fourShankRows([[], [], [], []]));
    expect(toFormBadChannels(file)).toBe(file);
  });
});

describe('legacy form round trips', () => {
  const importFile = (file) => toFormBadChannels(canonicalizeFileBadChannels(file));

  it('import then export gives back a file this app wrote', () => {
    const form = model(
      row(1, 0, REMAPPED_TETRODE, [0, 3]),
      ...fourShankRows([[3], [5], [], [31]], 1, 2),
      ...threeShankRows([[], [0], [21]], 2, 6)
    );
    const file = toFileBadChannels(form);
    expect(badChannelsOf(file)).toEqual([[2, 1], [3, 37, 127], [], [], [], [21, 63], [], []]);
    expect(toFileBadChannels(importFile(file))).toEqual(file);
    expect(badChannelsOf(importFile(file))).toEqual(badChannelsOf(form));
  });

  it('an earlier version file without later-row marks comes back unchanged, list order included', () => {
    const file = model(row(1, 0, mapOf(range(0, 31)), [10, 2]), ...fourShankRows([[12, 3], [], [], []], 1, 2));
    expect(toFileBadChannels(importFile(file))).toEqual(file);
  });

  it('an earlier version file with later-row marks: the marks move to the first row as electrode ids', () => {
    const file = model(...fourShankRows([[3], [5], [], []]));
    const form = importFile(file);
    expect(badChannelsOf(form)).toEqual([[3], [5], [], []]);
    const fixed = toFileBadChannels(form);
    expect(badChannelsOf(fixed)).toEqual([[3, 37], [], [], []]);
    expect(toFileBadChannels(importFile(fixed))).toEqual(fixed);
  });
});
