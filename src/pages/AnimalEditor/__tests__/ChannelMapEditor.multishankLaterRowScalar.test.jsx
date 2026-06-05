/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelMapEditor from '../ChannelMapEditor';

/**
 * MULTI-SHANK LATER-ROW SCALAR bad_channels (HIGH review finding) — Animal Editor.
 *
 * For a multi-shank group the editor shows ONE probe-wide bad-channel selector
 * (written to the first row, the only row the converter reads) and HIDES the
 * later rows' bad-channel grids. A prior fix made a FIRST-row scalar repairable
 * via a whole-value reset, but a LATER row (e.g. ntrode 11/12) whose bad_channels
 * loaded as a SCALAR was a repair dead-end: its grid is hidden (no reset button),
 * and the probe-wide migration only CLEARED later rows whose value was a non-empty
 * ARRAY — a scalar slipped through untouched. A hidden, converter-ignored scalar
 * still blocks schema validation on export, so it MUST be clearable.
 */
describe('ChannelMapEditor — multi-shank later-row scalar bad_channels', () => {
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
  // A LATER row (ntrode 11) carries a SCALAR bad_channels — converter-ignored
  // corruption that the hidden later-row grid cannot reach.
  const mapsLaterScalar = () => [
    { electrode_group_id: 2, ntrode_id: 10, bad_channels: [], map: shankMap(0, 21) },
    { electrode_group_id: 2, ntrode_id: 11, bad_channels: '2.9', map: shankMap(21, 21) },
    { electrode_group_id: 2, ntrode_id: 12, bad_channels: [], map: shankMap(42, 22) },
  ];

  it('does not throw when a later row loads with a scalar bad_channels', () => {
    expect(() =>
      render(
        <ChannelMapEditor
          electrodeGroup={group64c3s}
          channelMaps={mapsLaterScalar()}
          onSave={() => {}}
          onCancel={() => {}}
        />
      )
    ).not.toThrow();
  });

  it('toggling the probe-wide selector clears the later-row scalar to [] on save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ChannelMapEditor
        electrodeGroup={group64c3s}
        channelMaps={mapsLaterScalar()}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    // Toggle one probe-wide electrode to trigger the consolidation/migration.
    await user.click(
      screen.getByRole('checkbox', { name: /mark electrode 0 as bad for this probe/i })
    );
    await user.click(screen.getByTestId('editor-save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    // The hidden later-row scalar must be cleared to [] so schema validation passes.
    expect(saved.find((m) => m.ntrode_id === 11).bad_channels).toEqual([]);
    // First row carries the user's probe-wide selection.
    expect(saved.find((m) => m.ntrode_id === 10).bad_channels).toEqual([0]);
  });

  it('shows the consolidation notice when a later row loaded with a scalar', () => {
    render(
      <ChannelMapEditor
        electrodeGroup={group64c3s}
        channelMaps={mapsLaterScalar()}
        onSave={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(/later shank row/i);
  });
});
