import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BadChannelsEditor from '../BadChannelsEditor';
import { rulesValidation } from '../../../validation/rulesValidation';

/**
 * Multi-shank bad-channels: HIGH review finding.
 *
 * trodes_to_nwb reads bad_channels ONLY from a group's FIRST ntrode row and
 * interprets them as PROBE-LOCAL electrode indices 0..N-1 across ALL shanks. The
 * per-shank (row-local) checkbox UI could not reach an id like 42 on shank 3 of a
 * 64c-3s probe. For a MULTI-shank group we now present ONE probe-wide selector
 * spanning 0..N-1 and write the whole selection to the FIRST ntrode row's id.
 */
describe('BadChannelsEditor — multi-shank probe-wide selector', () => {
  // A 64c-3s group: three ntrode rows (shanks of 21/21/22), probe-local ids 0..63.
  const MULTISHANK_NTRODES = [
    { ntrode_id: 10, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, i])) },
    { ntrode_id: 11, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, 21 + i])) },
    { ntrode_id: 12, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [i, 42 + i])) },
  ];
  const DEVICE_TYPE = '64c-3s6mm6cm-20um-40um-sl';

  let onUpdate;
  let onBatchUpdate;
  beforeEach(() => {
    onUpdate = vi.fn();
    onBatchUpdate = vi.fn();
  });

  it('renders one probe-wide selector spanning electrode ids 0..63 (not per-shank rows)', () => {
    render(
      <BadChannelsEditor
        ntrodes={MULTISHANK_NTRODES}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [], '11': [], '12': [] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );

    // The probe-wide electrodes 42 and 63 (unreachable in the old row-local UI) exist.
    expect(screen.getByLabelText(/electrode 42/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/electrode 63/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/electrode 0/i)).toBeInTheDocument();
    // No per-shank "Shank #2 (Ntrode ID: 11)" legend in multi-shank mode.
    expect(screen.queryByText(/Ntrode ID: 11/i)).not.toBeInTheDocument();
  });

  it('writes a marked probe-local electrode (42) to the FIRST ntrode row id via a batched update', async () => {
    const user = userEvent.setup();
    render(
      <BadChannelsEditor
        ntrodes={MULTISHANK_NTRODES}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [], '11': [], '12': [] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );

    await user.click(screen.getByLabelText(/electrode 42/i));
    // First ntrode row's id is 10 — converter honors bad_channels from this row only.
    // The probe-wide selector writes the whole map atomically (no per-row race).
    expect(onBatchUpdate).toHaveBeenCalledTimes(1);
    expect(onBatchUpdate.mock.calls[0][0]['10']).toEqual([42]);
  });

  it('can mark the highest probe-local electrode (63)', async () => {
    const user = userEvent.setup();
    render(
      <BadChannelsEditor
        ntrodes={MULTISHANK_NTRODES}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [], '11': [], '12': [] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );

    await user.click(screen.getByLabelText(/electrode 63/i));
    expect(onBatchUpdate.mock.calls[0][0]['10']).toEqual([63]);
  });

  it('reflects existing first-row bad_channels as checked and appends in sorted order', async () => {
    const user = userEvent.setup();
    render(
      <BadChannelsEditor
        ntrodes={MULTISHANK_NTRODES}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [42], '11': [], '12': [] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );

    expect(screen.getByLabelText(/electrode 42/i)).toBeChecked();
    await user.click(screen.getByLabelText('Electrode 5', { exact: true }));
    expect(onBatchUpdate.mock.calls[0][0]['10']).toEqual([5, 42]);
  });
});

describe('multishank_bad_channels_ignored does not fire for first-row probe-local bad channels', () => {
  // The probe-wide selector writes the WHOLE bad-channel set to the FIRST ntrode row
  // (id 10). With later rows empty, the converter-truth rule must NOT flag the group.
  const DEVICE_TYPE = '64c-3s6mm6cm-20um-40um-sl';
  const model = {
    electrode_groups: [
      { id: 2, location: 'CA1', device_type: DEVICE_TYPE, targeted_location: 'CA1' },
    ],
    ntrode_electrode_group_channel_map: [
      { ntrode_id: 10, electrode_group_id: 2, bad_channels: [42], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, i])) },
      { ntrode_id: 11, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, 21 + i])) },
      { ntrode_id: 12, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [i, 42 + i])) },
    ],
  };

  it('does not report multishank_bad_channels_ignored when only the first row has bad channels', () => {
    const issues = rulesValidation(model);
    expect(issues.some((i) => i.code === 'multishank_bad_channels_ignored')).toBe(false);
  });

  it('does report it when a LATER row carries bad channels (regression guard)', () => {
    const broken = structuredClone(model);
    broken.ntrode_electrode_group_channel_map[2].bad_channels = [3];
    const issues = rulesValidation(broken);
    expect(issues.some((i) => i.code === 'multishank_bad_channels_ignored')).toBe(true);
  });
});

describe('BadChannelsEditor — multi-shank later-row corruption MIGRATION (HIGH)', () => {
  // A multi-shank group LOADED with bad_channels on a LATER ntrode row (persisted
  // corruption / migration). The converter ignores later rows, so the
  // multishank_bad_channels_ignored rule fires and blocks export. The probe-wide
  // selector HIDES later-row controls, so the ONLY repair path is: editing the
  // probe-wide selection must MIGRATE the later rows' marks (translated to probe-local
  // ids) onto the first row and clear the later rows — emitted as ONE atomic batch.
  const DEVICE_TYPE = '64c-3s6mm6cm-20um-40um-sl';
  const corruptedNtrodes = () => [
    { ntrode_id: 10, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, i])) },
    { ntrode_id: 11, electrode_group_id: 2, bad_channels: [3], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, 21 + i])) },
    { ntrode_id: 12, electrode_group_id: 2, bad_channels: [7], map: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [i, 42 + i])) },
  ];

  let onUpdate;
  let onBatchUpdate;
  beforeEach(() => {
    onUpdate = vi.fn();
    onBatchUpdate = vi.fn();
  });

  it('surfaces a load-time notice that later-row marks will be consolidated to the first row', () => {
    render(
      <BadChannelsEditor
        ntrodes={corruptedNtrodes()}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [], '11': [3], '12': [7] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(/consolidat|first row/i);
  });

  it('does NOT render the notice when no later row carries bad channels', () => {
    render(
      <BadChannelsEditor
        ntrodes={corruptedNtrodes().map((n) => ({ ...n, bad_channels: [] }))}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [], '11': [], '12': [] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('MIGRATES (translated) later-row marks onto the first row and clears them in ONE batch', async () => {
    const user = userEvent.setup();
    render(
      <BadChannelsEditor
        ntrodes={corruptedNtrodes()}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [], '11': [3], '12': [7] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );

    await user.click(screen.getByLabelText(/electrode 42/i));

    // Exactly one atomic write of the whole map (no racing per-ntrode onUpdate).
    expect(onBatchUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
    const batched = onBatchUpdate.mock.calls[0][0];
    // First row = union(new toggle 42, translated 11.map[3]===24, 12.map[7]===49).
    expect(batched['10']).toEqual([24, 42, 49]);
    // Both later rows that carried bad channels are cleared to [].
    expect(batched['11']).toEqual([]);
    expect(batched['12']).toEqual([]);
  });

  it('after migration the model passes the multishank_bad_channels_ignored rule', () => {
    // Simulate applying the editor's migration (first row set, later rows cleared).
    const migrated = {
      electrode_groups: [
        { id: 2, location: 'CA1', device_type: DEVICE_TYPE, targeted_location: 'CA1' },
      ],
      ntrode_electrode_group_channel_map: corruptedNtrodes().map((n) =>
        n.ntrode_id === 10
          ? { ...n, bad_channels: [24, 42, 49] }
          : { ...n, bad_channels: [] }
      ),
    };
    const issues = rulesValidation(migrated);
    expect(issues.some((i) => i.code === 'multishank_bad_channels_ignored')).toBe(false);
  });
});
