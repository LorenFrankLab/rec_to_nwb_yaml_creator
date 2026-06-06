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
  migrateProbeWideChannelMaps,
  validBadChannelIds,
  probeElectrodeIdSet,
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

describe('migrateProbeWideChannelMaps (Animal Editor row shape)', () => {
  it('unions onto the first row and clears later rows (array marks)', () => {
    const next = migrateProbeWideChannelMaps(twoShankRows([2], [3]), 5, true, MULTI);
    expect(next[0].bad_channels).toEqual([2, 5, 19]);
    expect(next[1].bad_channels).toEqual([]);
  });
  it('clears a later-row corrupt scalar during migration', () => {
    const next = migrateProbeWideChannelMaps(twoShankRows([], 'corrupt'), 1, true, MULTI);
    expect(next[0].bad_channels).toEqual([1]);
    expect(next[1].bad_channels).toEqual([]);
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
