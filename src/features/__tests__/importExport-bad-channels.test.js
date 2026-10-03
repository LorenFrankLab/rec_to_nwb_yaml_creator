/**
 * Bad channels in the downloaded file must be what trodes_to_nwb reads: the
 * probe electrode ids, all on each electrode group's first channel-map row
 * (the converter ignores later rows). The form keeps each row's ticked local
 * channels, so the download translates them through the row's map, and an
 * upload translates them back.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import { importFiles, exportAll } from '../importExport';

const SAMPLE = path.join(__dirname, '../../__tests__/fixtures/valid/20230622_sample_metadata.yml');

const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const mapOf = (electrodeIds) =>
  Object.fromEntries(electrodeIds.map((id, channel) => [String(channel), id]));

/**
 * The sample session with two electrode groups: a tetrode wired 2, 0, 3, 1 (channel 0 is
 * electrode 2) and a 128c-4s probe (shanks of electrode ids 0–31, 32–63, 64–95, 96–127).
 *
 * @param {number[][]} lists - bad_channels of the tetrode row, then of the four shank rows
 * @returns {object} The session model
 */
function session(lists) {
  const model = YAML.parse(fs.readFileSync(SAMPLE, 'utf8'));
  const group = model.electrode_groups[0];
  model.electrode_groups = [
    { ...group, id: 0, device_type: 'tetrode_12.5' },
    { ...group, id: 1, device_type: '128c-4s6mm6cm-15um-26um-sl' },
  ];
  const maps = [
    mapOf([2, 0, 3, 1]),
    ...[range(0, 31), range(32, 63), range(64, 95), range(96, 127)].map(mapOf),
  ];
  model.ntrode_electrode_group_channel_map = maps.map((map, i) => ({
    ntrode_id: i + 1,
    electrode_group_id: i === 0 ? 0 : 1,
    bad_channels: lists[i],
    map,
  }));
  return model;
}

const badChannelsOf = (model) =>
  model.ntrode_electrode_group_channel_map.map((row) => row.bad_channels);
const yamlFile = (model) => new File([YAML.stringify(model)], 'session.yml', { type: 'text/yaml' });

describe('bad channels in the downloaded file', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes electrode ids on each group's first row and [] on its later rows", () => {
    // Ticked: tetrode channel 0; shank 1 channel 3, shank 2 channel 5, shank 4 channel 31.
    const form = session([[0], [3], [5], [], [31]]);
    const result = exportAll(form);

    expect(result.validationIssues).toEqual([]);
    expect(result.success).toBe(true);
    expect(badChannelsOf(YAML.parse(result.yaml))).toEqual([[2], [3, 37, 127], [], [], []]);
    expect(result.yaml.match(/^ {4}bad_channels: \[\]$/gm)).toHaveLength(3);
    // The form keeps the ticks as they were made
    expect(badChannelsOf(form)).toEqual([[0], [3], [5], [], [31]]);
  });

  it('shows each electrode of an uploaded file on the row and channel that map to it', async () => {
    const result = await importFiles(yamlFile(session([[2], [3, 37, 127], [], [], []])));

    expect(result.importSummary.excludedFields).toEqual([]);
    expect(badChannelsOf(result.formData)).toEqual([[0], [3], [5], [], [31]]);
  });

  it('downloads an uploaded file unchanged', async () => {
    const file = session([[2, 1], [3, 37, 127], [], [], []]);
    const result = await importFiles(yamlFile(file));
    const exported = YAML.parse(exportAll(result.formData).yaml);

    expect(exported.ntrode_electrode_group_channel_map).toEqual(file.ntrode_electrode_group_channel_map);
  });

  it('moves the later-row marks of a file from an earlier version to the first row', async () => {
    // Earlier versions wrote each shank's ticked channels on that shank's row, where the
    // converter never reads them: here electrode 37 (shank 2, channel 5) was marked good.
    const result = await importFiles(yamlFile(session([[], [3], [5], [], []])));

    expect(result.importSummary.excludedFields).toEqual([]);
    expect(badChannelsOf(result.formData)).toEqual([[], [3], [5], [], []]);
    expect(badChannelsOf(YAML.parse(exportAll(result.formData).yaml))).toEqual([
      [], [3, 37], [], [], [],
    ]);
  });

  it('keeps an electrode id that no channel maps to', async () => {
    // A tetrode has no electrode 7. The id is kept and written back as it was, not dropped.
    const result = await importFiles(yamlFile(session([[7], [], [], [], []])));

    expect(badChannelsOf(result.formData)).toEqual([[7], [], [], [], []]);
    expect(badChannelsOf(YAML.parse(exportAll(result.formData).yaml))[0]).toEqual([7]);
  });
});
