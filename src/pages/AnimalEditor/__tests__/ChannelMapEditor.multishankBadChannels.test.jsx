/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelMapEditor from '../ChannelMapEditor';

/**
 * HIGH review finding — Animal Editor multi-shank bad-channel editing.
 *
 * trodes_to_nwb reads bad_channels ONLY from a group's FIRST ntrode row and
 * interprets them as PROBE-LOCAL electrode indices 0..N-1 across ALL shanks. The
 * old per-row checkbox UI keyed bad channels by row-local index and rejected a
 * valid first-row probe-local value like 42 (outside a 21-channel shank's local
 * range). So for a MULTI-shank group the editor must present ONE probe-wide
 * bad-channel selector spanning 0..N-1, write the whole selection to the group's
 * FIRST ntrode row, and NOT reject 42 on save. Single-shank groups keep the
 * per-row checkbox behavior (row-local == probe-local for one shank).
 */
describe('ChannelMapEditor — multi-shank bad-channel editing (probe-local, first row)', () => {
  beforeEach(() => {
    vi.stubGlobal('alert', vi.fn());
  });

  // 64c-3s: three ntrode rows (shanks of 21/21/22), probe-local ids 0..63.
  const group64c3s = {
    id: 2,
    device_type: '64c-3s6mm6cm-20um-40um-sl',
    location: 'CA1',
    targeted_x: 1.0,
    targeted_y: 2.0,
    targeted_z: 3.0,
    units: 'mm',
  };
  const shankMap = (offset, len) =>
    Object.fromEntries(Array.from({ length: len }, (_, i) => [i, offset + i]));
  const maps64c3s = () => [
    { electrode_group_id: 2, ntrode_id: 10, bad_channels: [], map: shankMap(0, 21) },
    { electrode_group_id: 2, ntrode_id: 11, bad_channels: [], map: shankMap(21, 21) },
    { electrode_group_id: 2, ntrode_id: 12, bad_channels: [], map: shankMap(42, 22) },
  ];

  it('renders a probe-wide bad-channel selector spanning electrode ids 0..63', () => {
    render(
      <ChannelMapEditor
        electrodeGroup={group64c3s}
        channelMaps={maps64c3s()}
        onSave={() => {}}
        onCancel={() => {}}
      />
    );

    // Probe-wide electrodes 42 and 63 (unreachable in the old row-local UI) exist.
    expect(screen.getByLabelText(/electrode 42/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/electrode 63/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/electrode 0/i)).toBeInTheDocument();
  });

  it('writes a marked probe-local electrode (42) to the FIRST ntrode row on save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ChannelMapEditor
        electrodeGroup={group64c3s}
        channelMaps={maps64c3s()}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await user.click(screen.getByLabelText(/electrode 42/i));
    await user.click(screen.getByTestId('editor-save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    const firstRow = saved.find((m) => m.ntrode_id === 10);
    expect(firstRow.bad_channels).toEqual([42]);
    // Later rows must stay empty — the converter ignores them.
    expect(saved.find((m) => m.ntrode_id === 11).bad_channels).toEqual([]);
    expect(saved.find((m) => m.ntrode_id === 12).bad_channels).toEqual([]);
  });

  it('can mark the highest probe-local electrode (63) and save without rejecting it', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ChannelMapEditor
        electrodeGroup={group64c3s}
        channelMaps={maps64c3s()}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await user.click(screen.getByLabelText(/electrode 63/i));
    await user.click(screen.getByTestId('editor-save'));

    // 42 (and 63) must NOT be rejected as out of range — save succeeds.
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    const saved = onSave.mock.calls[0][0];
    expect(saved.find((m) => m.ntrode_id === 10).bad_channels).toEqual([63]);
  });

  it('does NOT reject probe-local 42 on the first row (no out-of-range validation error)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    // First row pre-loaded with probe-local 42 (valid converter-truth value).
    const preloaded = maps64c3s();
    preloaded[0].bad_channels = [42];
    render(
      <ChannelMapEditor
        electrodeGroup={group64c3s}
        channelMaps={preloaded}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await user.click(screen.getByTestId('editor-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reflects an existing first-row bad channel as checked', () => {
    const preloaded = maps64c3s();
    preloaded[0].bad_channels = [42];
    render(
      <ChannelMapEditor
        electrodeGroup={group64c3s}
        channelMaps={preloaded}
        onSave={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByLabelText(/electrode 42/i)).toBeChecked();
  });
});

describe('ChannelMapEditor — single-shank bad-channel editing unchanged', () => {
  beforeEach(() => {
    vi.stubGlobal('alert', vi.fn());
  });

  const singleShankGroup = {
    id: 1,
    device_type: 'tetrode_12.5',
    location: 'CA1',
    targeted_x: 1.0,
    targeted_y: 2.0,
    targeted_z: 3.0,
    units: 'mm',
  };
  const singleShankMaps = [
    {
      electrode_group_id: 1,
      ntrode_id: 0,
      bad_channels: [],
      map: { 0: 0, 1: 1, 2: 2, 3: 3 },
    },
  ];

  it('keeps the per-row "Mark channel N as bad" checkbox UI for a single-shank group', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ChannelMapEditor
        electrodeGroup={singleShankGroup}
        channelMaps={singleShankMaps}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    // The legacy per-row label is still present (NOT the probe-wide "Electrode N").
    const checkbox = screen.getByLabelText('Mark channel 2 as bad for ntrode 0');
    await user.click(checkbox);
    await user.click(screen.getByTestId('editor-save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0][0].bad_channels).toEqual([2]);
  });
});
