/**
 * Bad channels in the downloaded file must be what trodes_to_nwb reads: the
 * probe electrode ids, all on each electrode group's first channel-map row
 * (the converter ignores later rows). The legacy form keeps each row's ticked
 * local channels, so the download translates them through the row's map, and
 * an upload translates them back. Validation runs on the file's shape, so the
 * multi-shank rule (bad channels on a later row are ignored) never blocks marks
 * the form made on a later shank.
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
  // The sample's placeholder subject id and relative associated-file paths are flagged on export.
  model.subject.subject_id = 'sample-rat';
  model.associated_files.forEach((file, index) => {
    file.path = `/data/sample/associated${index + 1}.txt`;
  });
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
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes electrode ids on each group's first row and [] on its later rows", () => {
    // Ticked: tetrode channel 0; shank 1 channel 3, shank 2 channel 5, shank 4 channel 31.
    const form = session([[0], [3], [5], [], [31]]);
    const result = exportAll(form);

    // Marks made on shanks 2 and 4 no longer block the download (multishank_bad_channels_ignored)
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

  it('imports a file from an earlier version with later-row marks and moves them to the first row', async () => {
    // Earlier versions wrote each shank's ticked channels on that shank's row, where the
    // converter never reads them: here electrode 37 (shank 2, channel 5) was marked good.
    const result = await importFiles(yamlFile(session([[], [3], [5], [], []])));

    expect(result.importSummary.excludedFields).toEqual([]);
    expect(badChannelsOf(result.formData)).toEqual([[], [3], [5], [], []]);
    const exported = exportAll(result.formData);
    expect(exported.success).toBe(true);
    expect(badChannelsOf(YAML.parse(exported.yaml))).toEqual([[], [3, 37], [], [], []]);
  });

  it('leaves out the channel map of a file with an electrode id no channel maps to, saying why', async () => {
    // A tetrode has no electrode 7: validation reports it instead of the id silently vanishing.
    const result = await importFiles(yamlFile(session([[7], [], [], [], []])));

    const excluded = result.importSummary.excludedFields.find(
      (field) => field.field === 'ntrode_electrode_group_channel_map'
    );
    expect(excluded.reason).toMatch(/bad channel\(s\) 7/);
  });
});
