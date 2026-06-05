import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BadChannelsEditor from '../BadChannelsEditor';

/**
 * INVALID-MARK REMOVAL (HIGH review finding).
 *
 * A loaded/persisted `bad_channels` array can carry a value with NO corresponding
 * checkbox: an out-of-range probe-local id (e.g. 99 on a 4-channel tetrode whose
 * valid ids are 0..3), or a non-integer like 'abc'. The checkbox grid renders only
 * valid ids and the toggle handlers carry `currentBadChannels` forward unchanged, so
 * such a value can NEVER be cleared by the user — yet it blocks export
 * (`bad_channel_out_of_range`). That is an unrepairable DEAD-END. The editor must
 * render a visible, focusable removal control for every current bad-channel value
 * that is not in the rendered/valid id set, removing ONLY that value on click.
 */
describe('BadChannelsEditor — single-shank invalid-mark removal', () => {
  let onUpdate;
  beforeEach(() => {
    onUpdate = vi.fn();
  });

  const tetrode = {
    ntrode_id: 0,
    electrode_group_id: 0,
    bad_channels: [99],
    map: { 0: 0, 1: 1, 2: 2, 3: 3 }, // valid ids 0..3
  };

  it('renders a removal control for an out-of-range loaded mark (99 on a tetrode)', () => {
    render(
      <BadChannelsEditor
        ntrodes={[tetrode]}
        badChannels={{ '0': [99] }}
        onUpdate={onUpdate}
      />
    );

    expect(
      screen.getByRole('button', { name: /remove invalid failed channel 99 from ntrode 0/i })
    ).toBeInTheDocument();
  });

  it('removes ONLY the invalid value, leaving valid marks intact, on click', async () => {
    const user = userEvent.setup();
    render(
      <BadChannelsEditor
        ntrodes={[tetrode]}
        badChannels={{ '0': [2, 99] }}
        onUpdate={onUpdate}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /remove invalid failed channel 99 from ntrode 0/i })
    );

    // Strict !== filter: only 99 is removed; the valid 2 survives.
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('0', [2]);
  });

  it('renders a removal control for a non-integer loaded mark ("abc")', async () => {
    const user = userEvent.setup();
    render(
      <BadChannelsEditor
        ntrodes={[tetrode]}
        badChannels={{ '0': ['abc'] }}
        onUpdate={onUpdate}
      />
    );

    const removeBtn = screen.getByRole('button', {
      name: /remove invalid failed channel abc from ntrode 0/i,
    });
    await user.click(removeBtn);
    expect(onUpdate).toHaveBeenCalledWith('0', []);
  });

  it('renders NO removal control when all marks are valid', () => {
    render(
      <BadChannelsEditor
        ntrodes={[tetrode]}
        badChannels={{ '0': [2] }}
        onUpdate={onUpdate}
      />
    );

    expect(
      screen.queryByRole('button', { name: /remove invalid failed channel/i })
    ).toBeNull();
  });
});

describe('BadChannelsEditor — multi-shank invalid-mark removal', () => {
  // 64c-3s: probe-local ids 0..63 on the FIRST ntrode row only.
  const DEVICE_TYPE = '64c-3s6mm6cm-20um-40um-sl';
  const ntrodes = () => [
    { ntrode_id: 10, electrode_group_id: 2, bad_channels: [99], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, i])) },
    { ntrode_id: 11, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, 21 + i])) },
    { ntrode_id: 12, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [i, 42 + i])) },
  ];

  let onUpdate;
  let onBatchUpdate;
  beforeEach(() => {
    onUpdate = vi.fn();
    onBatchUpdate = vi.fn();
  });

  it('renders a removal control for a first-row out-of-range mark (99, valid 0..63)', () => {
    render(
      <BadChannelsEditor
        ntrodes={ntrodes()}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [99], '11': [], '12': [] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );

    expect(
      screen.getByRole('button', { name: /remove invalid failed channel 99 from ntrode 10/i })
    ).toBeInTheDocument();
  });

  it('removes the invalid mark via ONE atomic batch write (first row minus 99)', async () => {
    const user = userEvent.setup();
    render(
      <BadChannelsEditor
        ntrodes={ntrodes()}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [99], '11': [], '12': [] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /remove invalid failed channel 99 from ntrode 10/i })
    );

    expect(onBatchUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
    const next = onBatchUpdate.mock.calls[0][0];
    expect(next['10']).toEqual([]);
  });

  it('renders NO removal control when the first row holds only valid probe-local ids', () => {
    render(
      <BadChannelsEditor
        ntrodes={ntrodes().map((n) => (n.ntrode_id === 10 ? { ...n, bad_channels: [42] } : n))}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [42], '11': [], '12': [] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );

    expect(
      screen.queryByRole('button', { name: /remove invalid failed channel/i })
    ).toBeNull();
  });
});
