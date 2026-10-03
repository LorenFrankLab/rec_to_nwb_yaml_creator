/**
 * Bad channels through the legacy form: an uploaded file's first-row electrode ids
 * show as ticks on the shank and channel they belong to, and the download writes
 * every tick as the electrode it maps to, on the group's first row (the only row
 * trodes_to_nwb reads).
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import { triggerExport } from '../helpers/integration-test-helpers';
import { getFileInput } from '../helpers/test-selectors';
import { renderLegacyApp } from '../helpers/render-legacy-app';

const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const mapOf = (electrodeIds) =>
  Object.fromEntries(electrodeIds.map((id, channel) => [String(channel), id]));

/**
 * The sample session with a tetrode wired 2, 0, 3, 1 (group 0) and a 2-shank 32c probe
 * (group 1; shanks of electrode ids 0–15 and 16–31).
 *
 * @param {number[][]} lists - bad_channels of the tetrode row, then of the two shank rows
 * @returns {File} The session as an uploadable YAML file
 */
function sessionFile(lists) {
  const model = YAML.parse(
    fs.readFileSync(path.join(__dirname, '../fixtures/valid/20230622_sample_metadata.yml'), 'utf8')
  );
  // The sample's placeholder subject id and relative associated-file paths are flagged on export.
  model.subject.subject_id = 'sample-rat';
  model.associated_files.forEach((file, index) => {
    file.path = `/data/sample/associated${index + 1}.txt`;
  });
  const group = model.electrode_groups[0];
  model.electrode_groups = [
    { ...group, id: 0, device_type: 'tetrode_12.5' },
    { ...group, id: 1, device_type: '32c-2s8mm6cm-20um-40um-dl' },
  ];
  const maps = [mapOf([2, 0, 3, 1]), mapOf(range(0, 15)), mapOf(range(16, 31))];
  model.ntrode_electrode_group_channel_map = maps.map((map, i) => ({
    ntrode_id: i + 1,
    electrode_group_id: i === 0 ? 0 : 1,
    bad_channels: lists[i],
    map,
  }));
  return new File([YAML.stringify(model)], 'session.yml', { type: 'text/yaml' });
}

/**
 * The bad-channel checkbox for `channel` on shank `shank` of electrode group `groupId`.
 *
 * @param {number} groupId - Electrode group id
 * @param {number} shank - Shank number as labelled (1-based)
 * @param {number} channel - Channel key
 * @returns {HTMLElement} The checkbox
 */
function badChannelBox(groupId, shank, channel) {
  const group = document.getElementById(`electrode_group_item_${groupId}-area`);
  const shankFieldset = within(group).getByText(`Shank #${shank}`).closest('fieldset');
  const list = within(shankFieldset).getByText('Bad Channels').closest('fieldset');
  return within(list).getByLabelText(String(channel));
}

describe('bad channels: upload, tick, download', () => {
  let downloaded;

  // Load the lazily-routed legacy form once up front, so the first render does not wait on it.
  beforeAll(async () => {
    await import('../../pages/LegacyFormView');
  });

  beforeEach(() => {
    downloaded = null;
    global.Blob = class {
      constructor(content) {
        downloaded = content[0];
      }
    };
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows ticks on the channels the file marks and downloads them as electrode ids', { timeout: 60000 }, async () => {
    const user = userEvent.setup();
    await renderLegacyApp();

    // The file marks electrode 2 of the tetrode and electrode 21 of the probe.
    await user.upload(getFileInput(), sessionFile([[2], [21], []]));

    // Electrode 2 of the tetrode is its channel 0; electrode 21 is channel 5 of shank 2.
    await waitFor(() => expect(badChannelBox(0, 1, 0)).toBeChecked());
    expect(badChannelBox(0, 1, 2)).not.toBeChecked();
    expect(badChannelBox(1, 2, 5)).toBeChecked();
    expect(badChannelBox(1, 1, 5)).not.toBeChecked();

    // Mark channel 3 of shank 2 (electrode 19) and download
    await user.click(badChannelBox(1, 2, 3));
    await triggerExport();
    await waitFor(() => expect(downloaded).not.toBeNull());

    const rows = YAML.parse(downloaded).ntrode_electrode_group_channel_map;
    expect(rows.map((row) => row.bad_channels)).toEqual([[2], [19, 21], []]);
  });
});
