/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelMapEditor from '../ChannelMapEditor';

/**
 * INVALID-MARK REMOVAL (HIGH review finding) — Animal Editor.
 *
 * A loaded `bad_channels` array can carry a value with NO corresponding checkbox: an
 * out-of-range index, or a non-integer like 'abc'. The checkbox grid renders only the
 * valid ids and the toggle handlers preserve invisible current values, so such a mark
 * can never be cleared — yet it blocks export. The editor must render a visible,
 * focusable removal control for every current bad-channel value not in the valid id
 * set, removing ONLY that value (immutably) from the right row's bad_channels.
 */
describe('ChannelMapEditor — single-shank invalid-mark removal', () => {
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
  const mapsWith = (badChannels) => [
    { electrode_group_id: 1, ntrode_id: 0, bad_channels: badChannels, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
  ];

  it('renders a removal control for an out-of-range loaded mark (99 on a tetrode)', () => {
    render(
      <ChannelMapEditor
        electrodeGroup={singleShankGroup}
        channelMaps={mapsWith([99])}
        onSave={() => {}}
        onCancel={() => {}}
      />
    );

    expect(
      screen.getByRole('button', { name: /remove invalid failed channel 99 from ntrode 0/i })
    ).toBeInTheDocument();
  });

  it('removes ONLY the invalid value on click, then saves the cleaned row', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ChannelMapEditor
        electrodeGroup={singleShankGroup}
        channelMaps={mapsWith([2, 99])}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /remove invalid failed channel 99 from ntrode 0/i })
    );
    await user.click(screen.getByTestId('editor-save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    // Only 99 removed; the valid 2 survives, so the save passes validation.
    expect(onSave.mock.calls[0][0][0].bad_channels).toEqual([2]);
  });

  it('renders a removal control for a non-integer loaded mark ("abc")', () => {
    render(
      <ChannelMapEditor
        electrodeGroup={singleShankGroup}
        channelMaps={mapsWith(['abc'])}
        onSave={() => {}}
        onCancel={() => {}}
      />
    );

    expect(
      screen.getByRole('button', { name: /remove invalid failed channel abc from ntrode 0/i })
    ).toBeInTheDocument();
  });

  it('renders NO removal control when all marks are valid', () => {
    render(
      <ChannelMapEditor
        electrodeGroup={singleShankGroup}
        channelMaps={mapsWith([2])}
        onSave={() => {}}
        onCancel={() => {}}
      />
    );

    expect(
      screen.queryByRole('button', { name: /remove invalid failed channel/i })
    ).toBeNull();
  });
});

describe('ChannelMapEditor — multi-shank invalid-mark removal', () => {
  beforeEach(() => {
    vi.stubGlobal('alert', vi.fn());
  });

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
  // First row carries an out-of-range probe-local id (99, valid 0..63).
  const maps = () => [
    { electrode_group_id: 2, ntrode_id: 10, bad_channels: [99], map: shankMap(0, 21) },
    { electrode_group_id: 2, ntrode_id: 11, bad_channels: [], map: shankMap(21, 21) },
    { electrode_group_id: 2, ntrode_id: 12, bad_channels: [], map: shankMap(42, 22) },
  ];

  it('renders a removal control for a first-row out-of-range probe-local mark (99)', () => {
    render(
      <ChannelMapEditor
        electrodeGroup={group64c3s}
        channelMaps={maps()}
        onSave={() => {}}
        onCancel={() => {}}
      />
    );

    expect(
      screen.getByRole('button', { name: /remove invalid failed channel 99 from ntrode 10/i })
    ).toBeInTheDocument();
  });

  it('removes the invalid first-row mark and saves the cleaned group', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ChannelMapEditor
        electrodeGroup={group64c3s}
        channelMaps={maps()}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /remove invalid failed channel 99 from ntrode 10/i })
    );
    await user.click(screen.getByTestId('editor-save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.find((m) => m.ntrode_id === 10).bad_channels).toEqual([]);
  });
});
