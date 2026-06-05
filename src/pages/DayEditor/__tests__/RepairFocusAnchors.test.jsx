/**
 * @vitest-environment jsdom
 *
 * MEDIUM review finding — repair-focus anchors.
 *
 * The Day Editor stepper focuses a repaired control by searching for the element
 * whose `data-field-path` equals the validation issue's `path`. The Epochs/Devices
 * repair-target controls were missing that anchor, so repair buttons landed on the
 * broad step instead of the offending row/control.
 *
 * These tests pin the anchors to the EXACT path strings the validation issues emit
 * (read-only from rulesValidation.js):
 *   - orphaned_file                 → `associated_files[${i}].task_epochs`
 *   - bad_channel_out_of_range /    → `ntrode_electrode_group_channel_map[${ntrode_id}]`
 *     multishank_bad_channels_ignored
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AssociatedFilesEditor from '../AssociatedFilesEditor';
import BadChannelsEditor from '../BadChannelsEditor';

describe('AssociatedFilesEditor — orphaned_file repair-focus anchor', () => {
  const tasks = [{ task_epochs: [1, 3] }];

  it('puts a data-field-path matching `associated_files[i].task_epochs` on each row epoch select', () => {
    render(
      <AssociatedFilesEditor
        files={[
          { name: 'a', task_epochs: 1 },
          { name: 'b', task_epochs: 3 },
        ]}
        tasks={tasks}
        onChange={() => {}}
      />
    );

    const anchor0 = document.querySelector(
      '[data-field-path="associated_files[0].task_epochs"]'
    );
    const anchor1 = document.querySelector(
      '[data-field-path="associated_files[1].task_epochs"]'
    );
    expect(anchor0).toBeInTheDocument();
    expect(anchor1).toBeInTheDocument();
    // The anchor must be the epoch SELECT (the control to repair).
    expect(anchor0.tagName).toBe('SELECT');
    expect(anchor1.tagName).toBe('SELECT');
  });
});

describe('BadChannelsEditor — bad-channel repair-focus anchor', () => {
  const SINGLE_NTRODES = [
    { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
  ];

  it('puts a data-field-path matching `ntrode_electrode_group_channel_map[ntrode_id]` on the single-shank bad-channel control', () => {
    render(
      <BadChannelsEditor
        ntrodes={SINGLE_NTRODES}
        badChannels={{ '0': [] }}
        onUpdate={() => {}}
      />
    );

    const anchor = document.querySelector(
      '[data-field-path="ntrode_electrode_group_channel_map[0]"]'
    );
    expect(anchor).toBeInTheDocument();
  });

  const MULTISHANK_NTRODES = [
    { ntrode_id: 10, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, i])) },
    { ntrode_id: 11, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, 21 + i])) },
    { ntrode_id: 12, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [i, 42 + i])) },
  ];

  it('puts a data-field-path keyed to the FIRST ntrode row id on the multi-shank probe-wide control', () => {
    render(
      <BadChannelsEditor
        ntrodes={MULTISHANK_NTRODES}
        deviceType="64c-3s6mm6cm-20um-40um-sl"
        badChannels={{ '10': [], '11': [], '12': [] }}
        onUpdate={() => {}}
      />
    );

    // The multishank_bad_channels_ignored / bad_channel_out_of_range issue path for
    // this group is keyed by the FIRST row id (10) — the row the converter honors.
    const anchor = document.querySelector(
      '[data-field-path="ntrode_electrode_group_channel_map[10]"]'
    );
    expect(anchor).toBeInTheDocument();
  });

  it('also anchors the group\'s other ntrode ids (11, 12) so a non-first-row issue path still lands in the probe-wide control', () => {
    render(
      <BadChannelsEditor
        ntrodes={MULTISHANK_NTRODES}
        deviceType="64c-3s6mm6cm-20um-40um-sl"
        badChannels={{ '10': [], '11': [], '12': [] }}
        onUpdate={() => {}}
      />
    );

    expect(
      document.querySelector('[data-field-path="ntrode_electrode_group_channel_map[11]"]')
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-field-path="ntrode_electrode_group_channel_map[12]"]')
    ).toBeInTheDocument();
  });
});
