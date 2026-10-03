/**
 * Tests for translating bad channels between the form and the file.
 *
 * trodes_to_nwb reads bad_channels only from each electrode group's FIRST
 * channel-map row, as probe electrode ids. The form keeps one list per row of
 * that row's local channel keys (the row's map takes a channel key to a probe
 * electrode id). A tick on a remapped channel, or on a later shank, must reach
 * the file as the electrode it maps to, on the first row.
 */

import { describe, it, expect } from 'vitest';
import {
  toFileBadChannels,
  canonicalizeFileBadChannels,
  toFormBadChannels,
} from '../badChannels';

const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
/** A map from the electrode ids in local channel order: [2, 0, 3, 1] is channel 0 → electrode 2, ... */
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
// The channel-mapping example: channel 0 → electrode 2, 1 → 0, 2 → 3, 3 → 1.
const REMAPPED_TETRODE = mapOf([2, 0, 3, 1]);
// 128c-4s: four shanks of 32, electrode ids 0–31, 32–63, 64–95, 96–127.
const shanks128 = [range(0, 31), range(32, 63), range(64, 95), range(96, 127)].map(mapOf);
// 64c-3s: shanks of 21, 21 and 22, electrode ids 0–20, 21–41, 42–63.
const shanks64 = [range(0, 20), range(21, 41), range(42, 63)].map(mapOf);

const fourShankRows = (lists, groupId = 0, firstNtrodeId = 1) =>
  lists.map((list, i) => row(firstNtrodeId + i, groupId, shanks128[i], list));
const threeShankRows = (lists, groupId = 0, firstNtrodeId = 1) =>
  lists.map((list, i) => row(firstNtrodeId + i, groupId, shanks64[i], list));

describe('toFileBadChannels (export)', () => {
  it('leaves a group whose map is the identity as it is', () => {
    const form = model(row(1, 0, IDENTITY_TETRODE, [1, 3]));
    expect(badChannelsOf(toFileBadChannels(form))).toEqual([[1, 3]]);
  });

  it('writes the electrode a remapped channel maps to, not the channel number', () => {
    expect(badChannelsOf(toFileBadChannels(model(row(1, 0, REMAPPED_TETRODE, [0]))))).toEqual([[2]]);
    expect(badChannelsOf(toFileBadChannels(model(row(1, 0, REMAPPED_TETRODE, [0, 3]))))).toEqual([
      [2, 1],
    ]);
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
    // Two ticks that map to one electrode can only come from a broken map, which validation
    // reports; the file still lists the electrode once.
    const form = model(row(1, 0, mapOf([0, 0, 2, 3]), [0, 1]));
    expect(badChannelsOf(toFileBadChannels(form))).toEqual([[0]]);
  });

  it('never writes a channel with no electrode assigned as another electrode', () => {
    // -1 is the form's empty map option. Channel 0 has no electrode, so its tick has nothing
    // to mark (the map value fails validation, so the download waits until it is assigned);
    // writing it as electrode 0 would mark a channel nobody ticked.
    const form = model(row(1, 0, { 0: -1, 1: 1, 2: 2, 3: 3 }, [0, 2]));
    expect(badChannelsOf(toFileBadChannels(form))).toEqual([[2]]);

    const later = model(row(1, 0, shanks128[0], []), row(2, 0, { ...shanks128[1], 5: -1 }, [5]));
    expect(badChannelsOf(toFileBadChannels(later))).toEqual([[], []]);
  });

  it('keeps a value that is not one of its row channels unchanged, as an electrode id', () => {
    // Only a file's first row can hold one (an electrode id no channel maps to, kept by the
    // import); writing it back unchanged lets validation report it instead of hiding it.
    const form = model(row(1, 0, IDENTITY_TETRODE, [1, 7]));
    expect(badChannelsOf(toFileBadChannels(form))).toEqual([[1, 7]]);
  });

  it('leaves a group alone when its first row has no bad-channel list, for validation to report', () => {
    const form = model(row(1, 0, shanks128[0], 'corrupt'), row(2, 0, shanks128[1], [5]));
    expect(badChannelsOf(toFileBadChannels(form))).toEqual(['corrupt', [5]]);
  });

  it('returns the same object when no row has a bad channel', () => {
    const form = model(...fourShankRows([[], [], [], []]));
    expect(toFileBadChannels(form)).toBe(form);
    expect(toFileBadChannels({ session_id: 's1' })).toEqual({ session_id: 's1' });
  });

  it('does not change the form it is given', () => {
    const form = model(...fourShankRows([[3], [5], [], []]));
    const before = structuredClone(form);
    const file = toFileBadChannels(form);
    expect(file).not.toBe(form);
    expect(form).toEqual(before);
    expect(file.session_id).toBe('s1');
  });
});

describe('canonicalizeFileBadChannels (import, before validation)', () => {
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

  it('does not change the file it is given', () => {
    const file = model(...fourShankRows([[3], [5], [], []]));
    const before = structuredClone(file);
    canonicalizeFileBadChannels(file);
    expect(file).toEqual(before);
  });
});

describe('toFormBadChannels (import, after validation)', () => {
  it('ticks the same channels when the map is the identity', () => {
    expect(badChannelsOf(toFormBadChannels(model(row(1, 0, IDENTITY_TETRODE, [1, 3]))))).toEqual([
      [1, 3],
    ]);
  });

  it('ticks the channel that maps to each electrode of a remapped tetrode', () => {
    expect(badChannelsOf(toFormBadChannels(model(row(1, 0, REMAPPED_TETRODE, [0]))))).toEqual([[1]]);
    expect(badChannelsOf(toFormBadChannels(model(row(1, 0, REMAPPED_TETRODE, [2, 1]))))).toEqual([
      [0, 3],
    ]);
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
    // 7 is not an electrode of a tetrode: the id stays visible to validation and is written
    // back unchanged.
    const file = model(row(1, 0, REMAPPED_TETRODE, [7, 2]));
    const form = toFormBadChannels(file);
    expect(badChannelsOf(form)).toEqual([[7, 0]]);
    expect(badChannelsOf(toFileBadChannels(form))).toEqual([[7, 2]]);
  });

  it('returns the same object when no row has a bad channel', () => {
    const file = model(...fourShankRows([[], [], [], []]));
    expect(toFormBadChannels(file)).toBe(file);
  });

  it('does not change the file it is given', () => {
    const file = model(...fourShankRows([[3, 37], [], [], []]));
    const before = structuredClone(file);
    toFormBadChannels(file);
    expect(file).toEqual(before);
  });
});

describe('round trips', () => {
  const importFile = (file) => toFormBadChannels(canonicalizeFileBadChannels(file));

  it('import then export gives back a file this app wrote', () => {
    const form = model(
      row(1, 0, REMAPPED_TETRODE, [0, 3]),
      row(2, 1, shanks128[0], [3]),
      row(3, 1, shanks128[1], [5]),
      row(4, 1, shanks128[2], []),
      row(5, 1, shanks128[3], [31]),
      row(6, 2, shanks64[0], []),
      row(7, 2, shanks64[1], [0]),
      row(8, 2, shanks64[2], [21])
    );
    const file = toFileBadChannels(form);
    expect(badChannelsOf(file)).toEqual([[2, 1], [3, 37, 127], [], [], [], [21, 63], [], []]);
    expect(toFileBadChannels(importFile(file))).toEqual(file);
  });

  it('import shows each tick on the row and channel it was made on', () => {
    const form = model(row(1, 0, REMAPPED_TETRODE, [0, 3]), ...fourShankRows([[3], [5], [], [31]], 1, 2));
    expect(badChannelsOf(importFile(toFileBadChannels(form)))).toEqual(badChannelsOf(form));
  });

  it('an earlier version file without later-row marks comes back unchanged, list order included', () => {
    // Earlier versions kept each list in text order ([10, 2]).
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
