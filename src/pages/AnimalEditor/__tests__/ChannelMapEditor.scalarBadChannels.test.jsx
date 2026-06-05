/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelMapEditor from '../ChannelMapEditor';

/**
 * SCALAR bad_channels (HIGH review finding) — Animal Editor.
 *
 * The normalizer (src/utils/deviceNormalization.js) intentionally PRESERVES a
 * non-array `bad_channels` (e.g. a scalar "2.9") from corrupt persisted state so
 * validation can flag it — it does NOT launder it to []. ChannelMapEditor must
 * therefore TOLERATE a scalar without throwing (no `.filter` / `.includes` /
 * `.forEach` on a non-array), AND make the scalar REPAIRABLE: a distinct whole-value
 * reset control that sets THAT row's bad_channels back to [].
 */
describe('ChannelMapEditor — scalar bad_channels (single-shank)', () => {
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
  // bad_channels is a SCALAR (corrupt persisted state preserved by the normalizer).
  const mapsWithScalar = (scalar) => [
    { electrode_group_id: 1, ntrode_id: 0, bad_channels: scalar, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
  ];

  it('does not throw when a row loads with a scalar bad_channels ("2.9")', () => {
    expect(() =>
      render(
        <ChannelMapEditor
          electrodeGroup={singleShankGroup}
          channelMaps={mapsWithScalar('2.9')}
          onSave={() => {}}
          onCancel={() => {}}
        />
      )
    ).not.toThrow();
  });

  it('renders a whole-value reset control for the scalar', () => {
    render(
      <ChannelMapEditor
        electrodeGroup={singleShankGroup}
        channelMaps={mapsWithScalar('2.9')}
        onSave={() => {}}
        onCancel={() => {}}
      />
    );

    expect(
      screen.getByRole('button', { name: /remove corrupt failed-channels value from ntrode 0/i })
    ).toBeInTheDocument();
  });

  it('resets the scalar to [] on click, then saves the cleaned row', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ChannelMapEditor
        electrodeGroup={singleShankGroup}
        channelMaps={mapsWithScalar('2.9')}
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /remove corrupt failed-channels value from ntrode 0/i })
    );
    await user.click(screen.getByTestId('editor-save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0][0].bad_channels).toEqual([]);
  });
});

describe('ChannelMapEditor — scalar bad_channels (multi-shank)', () => {
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
  // First row carries a SCALAR bad_channels (the only row the converter reads).
  const maps = () => [
    { electrode_group_id: 2, ntrode_id: 10, bad_channels: '2.9', map: shankMap(0, 21) },
    { electrode_group_id: 2, ntrode_id: 11, bad_channels: [], map: shankMap(21, 21) },
    { electrode_group_id: 2, ntrode_id: 12, bad_channels: [], map: shankMap(42, 22) },
  ];

  it('does not throw and renders a whole-value reset for the first-row scalar', () => {
    expect(() =>
      render(
        <ChannelMapEditor
          electrodeGroup={group64c3s}
          channelMaps={maps()}
          onSave={() => {}}
          onCancel={() => {}}
        />
      )
    ).not.toThrow();

    expect(
      screen.getByRole('button', { name: /remove corrupt failed-channels value from ntrode 10/i })
    ).toBeInTheDocument();
  });

  it('resets the first-row scalar to [] on click, then saves the cleaned group', async () => {
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
      screen.getByRole('button', { name: /remove corrupt failed-channels value from ntrode 10/i })
    );
    await user.click(screen.getByTestId('editor-save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.find((m) => m.ntrode_id === 10).bad_channels).toEqual([]);
  });
});
