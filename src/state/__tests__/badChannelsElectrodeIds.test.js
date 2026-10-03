/**
 * Failed channels in the workspace export and YAML import.
 *
 * The Day Editor stores a single-shank group's failed channels as each row's channel keys (the
 * "Channel 0" … checkboxes) and a multi-shank group's as probe electrode ids on its first row (the
 * probe-wide selector). trodes_to_nwb reads electrode ids from each group's first row, so the export
 * translates a single-shank row's keys through its map (channel → electrode), and the YAML import
 * translates them back. Repro: a tetrode wired 2, 0, 3, 1 with "Channel 0" ticked (electrode 2)
 * used to export `bad_channels: [0]`, so the converter flagged electrode 0 instead.
 */
import { describe, it, expect } from 'vitest';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { decomposeYaml, recomposeDayModel } from '../yamlImport';
import { validate } from '../../validation';
import { blockingIssues } from '../../validation/issueTypes';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const mapOf = (electrodeIds) =>
  Object.fromEntries(electrodeIds.map((id, channel) => [String(channel), id]));

/**
 * The realistic workspace with tetrode group 2 (ntrode 3) wired 2, 0, 3, 1 and electrode group 0
 * turned into a 2-shank 32c probe (ntrode 1: electrodes 0–15, new ntrode 9: 16–31), carrying
 * `badChannels` as the day's stored failed channels.
 *
 * @param {Record<string, number[]>} badChannels - `day.deviceOverrides.bad_channels`
 * @returns {{ animal: object, day: object }}
 */
function workspaceWith(badChannels) {
  const { animal, day } = buildRealisticWorkspace();
  const devices = animal.configurationHistory[0].devices;
  devices.electrode_groups[0].device_type = '32c-2s8mm6cm-20um-40um-dl';
  const rows = devices.ntrode_electrode_group_channel_map;
  rows.forEach((row) => {
    row.bad_channels = [];
  });
  rows[0].map = mapOf(range(0, 15));
  rows.splice(1, 0, { ntrode_id: 9, electrode_group_id: 0, bad_channels: [], map: mapOf(range(16, 31)) });
  rows.find((row) => row.ntrode_id === 3).map = mapOf([2, 0, 3, 1]);
  day.deviceOverrides = { bad_channels: badChannels };
  return { animal, day };
}

const exportedBadChannels = (merged) =>
  Object.fromEntries(
    merged.ntrode_electrode_group_channel_map.map((row) => [row.ntrode_id, row.bad_channels])
  );

describe('workspace export: failed channels as trodes_to_nwb reads them', () => {
  it('writes a remapped tetrode channel as the electrode it maps to', () => {
    const { animal, day } = workspaceWith({ 3: [0] });
    const merged = mergeDayMetadata(animal, day);

    expect(exportedBadChannels(merged)[3]).toEqual([2]);
    expect(blockingIssues(validate(merged))).toEqual([]);
  });

  it('writes an identity-mapped tetrode and a multi-shank first row as stored', () => {
    const { animal, day } = workspaceWith({ 6: [3], 1: [3, 20] });
    const bad = exportedBadChannels(mergeDayMetadata(animal, day));

    expect(bad[6]).toEqual([3]);
    expect(bad[1]).toEqual([3, 20]);
    expect(bad[9]).toEqual([]);
  });

  it('leaves the stored channel keys of the day untouched', () => {
    const { animal, day } = workspaceWith({ 3: [0] });
    mergeDayMetadata(animal, day);
    expect(day.deviceOverrides.bad_channels).toEqual({ 3: [0] });
  });
});

describe('workspace YAML import: electrode ids back to the stored channels', () => {
  it('stores the channel a file electrode maps to for a remapped tetrode', () => {
    // A file marking electrode 2 of the remapped tetrode: the Day Editor shows it as Channel 0.
    const { animal, day } = workspaceWith({});
    const file = mergeDayMetadata(animal, day);
    file.ntrode_electrode_group_channel_map.find((row) => row.ntrode_id === 3).bad_channels = [2];

    const result = decomposeYaml(decodeYaml(encodeYaml(file)));

    expect(result.ok).toBe(true);
    expect(result.dayFacts.deviceOverrides).toEqual({ bad_channels: { 3: [0] } });
  });

  it('keeps a multi-shank first row as electrode ids', () => {
    const { animal, day } = workspaceWith({});
    const file = mergeDayMetadata(animal, day);
    file.ntrode_electrode_group_channel_map[0].bad_channels = [3, 20];

    const result = decomposeYaml(decodeYaml(encodeYaml(file)));

    expect(result.dayFacts.deviceOverrides).toEqual({ bad_channels: { 1: [3, 20] } });
  });

  it.each([
    ['a remapped single-shank group', { 3: [0, 3] }],
    ['a multi-shank group', { 1: [3, 20] }],
    ['both', { 1: [3, 20], 3: [0, 3], 6: [3] }],
  ])('import then export reproduces the exported file (%s)', (_label, badChannels) => {
    const { animal, day } = workspaceWith(badChannels);
    const yaml = encodeYaml(mergeDayMetadata(animal, day));

    const decomposed = decomposeYaml(decodeYaml(yaml));
    expect(decomposed.ok).toBe(true);
    expect(decomposed.dayFacts.deviceOverrides.bad_channels).toEqual(badChannels);

    const { animal: a2, day: d2 } = recomposeDayModel(decomposed);
    expect(encodeYaml(mergeDayMetadata(a2, d2))).toBe(yaml);
  });
});
