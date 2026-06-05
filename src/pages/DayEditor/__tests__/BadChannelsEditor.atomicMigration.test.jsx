import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BadChannelsEditor from '../BadChannelsEditor';
import { rulesValidation } from '../../../validation/rulesValidation';

/**
 * HIGH review findings 1 & 2 — atomic multi-shank migration + later-row TRANSLATION.
 *
 * The Day Editor bad-channel save path is non-atomic: firing N separate `onUpdate`
 * calls in one handler races because the stepper rebuilds the whole `deviceOverrides`
 * from a stale render closure and REPLACES it. So the multi-shank probe-wide toggle
 * must emit the migration as ONE atomic update of the ENTIRE bad_channels map via a
 * new `onBatchUpdate(badChannelsObject)` prop.
 *
 * Finding 2: when consolidating later rows onto the first row, a later row's
 * bad_channels entries are KEYS into that row's `map` (row-local indices); the
 * probe-local electrode id is `row.map[key]`. They must be TRANSLATED and UNIONed
 * onto the first row — never silently dropped.
 */
describe('BadChannelsEditor — atomic multi-shank migration (Finding 1)', () => {
  const DEVICE_TYPE = '64c-3s6mm6cm-20um-40um-sl';
  // shankMap(offset, len): row-local key -> probe-local electrode id.
  const shankMap = (offset, len) =>
    Object.fromEntries(Array.from({ length: len }, (_, i) => [i, offset + i]));

  let onUpdate;
  let onBatchUpdate;
  beforeEach(() => {
    onUpdate = vi.fn();
    onBatchUpdate = vi.fn();
  });

  it('emits ONE batched update (not N racing onUpdate calls) when the probe-wide selection is edited on a group with later-row marks', async () => {
    const user = userEvent.setup();
    const ntrodes = [
      { ntrode_id: 10, electrode_group_id: 2, bad_channels: [], map: shankMap(0, 21) },
      { ntrode_id: 11, electrode_group_id: 2, bad_channels: [3], map: shankMap(21, 21) },
      { ntrode_id: 12, electrode_group_id: 2, bad_channels: [7], map: shankMap(42, 22) },
    ];
    render(
      <BadChannelsEditor
        ntrodes={ntrodes}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [], '11': [3], '12': [7] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );

    await user.click(screen.getByLabelText('Electrode 5', { exact: true }));

    // Exactly one atomic write of the whole map — no per-ntrode onUpdate race.
    expect(onBatchUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does NOT lose the toggled first-row selection while migrating later rows (the bug)', async () => {
    const user = userEvent.setup();
    // First row already has a loaded selection (42); later rows carry marks.
    const ntrodes = [
      { ntrode_id: 10, electrode_group_id: 2, bad_channels: [42], map: shankMap(0, 21) },
      { ntrode_id: 11, electrode_group_id: 2, bad_channels: [3], map: shankMap(21, 21) },
      { ntrode_id: 12, electrode_group_id: 2, bad_channels: [7], map: shankMap(42, 22) },
    ];
    render(
      <BadChannelsEditor
        ntrodes={ntrodes}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [42], '11': [3], '12': [7] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );

    // Toggle a NEW first-row electrode (5).
    await user.click(screen.getByLabelText('Electrode 5', { exact: true }));

    const batched = onBatchUpdate.mock.calls[0][0];
    // 11.map[3] === 24, 12.map[7] === 49 → translated later-row ids.
    // First row = union(existing 42, new toggle 5, translated 24, 49).
    expect(batched['10']).toEqual([5, 24, 42, 49]);
    // The previously-loaded first-row selection (42) is NOT lost.
    expect(batched['10']).toContain(42);
    // Later rows cleared.
    expect(batched['11']).toEqual([]);
    expect(batched['12']).toEqual([]);
  });

  it('removing a first-row electrode still migrates and keeps the rest atomically', async () => {
    const user = userEvent.setup();
    const ntrodes = [
      { ntrode_id: 10, electrode_group_id: 2, bad_channels: [5, 42], map: shankMap(0, 21) },
      { ntrode_id: 11, electrode_group_id: 2, bad_channels: [3], map: shankMap(21, 21) },
      { ntrode_id: 12, electrode_group_id: 2, bad_channels: [], map: shankMap(42, 22) },
    ];
    render(
      <BadChannelsEditor
        ntrodes={ntrodes}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [5, 42], '11': [3], '12': [] }}
        onUpdate={onUpdate}
        onBatchUpdate={onBatchUpdate}
      />
    );

    // Uncheck electrode 5 (currently bad on first row).
    await user.click(screen.getByLabelText('Electrode 5', { exact: true }));

    const batched = onBatchUpdate.mock.calls[0][0];
    // 42 stays, 5 removed, 11.map[3]===24 migrated in.
    expect(batched['10']).toEqual([24, 42]);
    expect(batched['11']).toEqual([]);
    expect(batched['12']).toEqual([]);
  });
});

describe('BadChannelsEditor — later-row marks are TRANSLATED not dropped (Finding 2)', () => {
  const DEVICE_TYPE = '64c-3s6mm6cm-20um-40um-sl';
  const shankMap = (offset, len) =>
    Object.fromEntries(Array.from({ length: len }, (_, i) => [i, offset + i]));

  let onBatchUpdate;
  beforeEach(() => {
    onBatchUpdate = vi.fn();
  });

  it('translates a later-row bad_channels:[3] via map[3]===24 onto the first row', async () => {
    const user = userEvent.setup();
    const ntrodes = [
      { ntrode_id: 10, electrode_group_id: 2, bad_channels: [], map: shankMap(0, 21) },
      { ntrode_id: 11, electrode_group_id: 2, bad_channels: [3], map: shankMap(21, 21) },
      { ntrode_id: 12, electrode_group_id: 2, bad_channels: [], map: shankMap(42, 22) },
    ];
    render(
      <BadChannelsEditor
        ntrodes={ntrodes}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [], '11': [3], '12': [] }}
        onUpdate={vi.fn()}
        onBatchUpdate={onBatchUpdate}
      />
    );

    // Touch any selection to trigger migration.
    await user.click(screen.getByLabelText('Electrode 0', { exact: true }));

    const batched = onBatchUpdate.mock.calls[0][0];
    // map[3] === 24 → 24 must appear on the first row, never silently lost.
    expect(batched['10']).toContain(24);
    expect(batched['10']).toContain(0);
    expect(batched['11']).toEqual([]);
  });

  it('falls back to the raw key when row.map[key] is undefined', async () => {
    const user = userEvent.setup();
    // Later row whose map lacks key 99 → fall back to 99 itself.
    const ntrodes = [
      { ntrode_id: 10, electrode_group_id: 2, bad_channels: [], map: shankMap(0, 21) },
      { ntrode_id: 11, electrode_group_id: 2, bad_channels: [99], map: shankMap(21, 21) },
      { ntrode_id: 12, electrode_group_id: 2, bad_channels: [], map: shankMap(42, 22) },
    ];
    render(
      <BadChannelsEditor
        ntrodes={ntrodes}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [], '11': [99], '12': [] }}
        onUpdate={vi.fn()}
        onBatchUpdate={onBatchUpdate}
      />
    );

    await user.click(screen.getByLabelText('Electrode 0', { exact: true }));

    const batched = onBatchUpdate.mock.calls[0][0];
    expect(batched['10']).toContain(99);
  });

  it('after the atomic migration the model passes multishank_bad_channels_ignored', async () => {
    const user = userEvent.setup();
    const ntrodes = [
      { ntrode_id: 10, electrode_group_id: 2, bad_channels: [], map: shankMap(0, 21) },
      { ntrode_id: 11, electrode_group_id: 2, bad_channels: [3], map: shankMap(21, 21) },
      { ntrode_id: 12, electrode_group_id: 2, bad_channels: [7], map: shankMap(42, 22) },
    ];
    render(
      <BadChannelsEditor
        ntrodes={ntrodes}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [], '11': [3], '12': [7] }}
        onUpdate={vi.fn()}
        onBatchUpdate={onBatchUpdate}
      />
    );

    await user.click(screen.getByLabelText('Electrode 42', { exact: true }));
    const batched = onBatchUpdate.mock.calls[0][0];

    const model = {
      electrode_groups: [
        { id: 2, location: 'CA1', device_type: DEVICE_TYPE, targeted_location: 'CA1' },
      ],
      ntrode_electrode_group_channel_map: ntrodes.map((n) => ({
        ...n,
        bad_channels: batched[String(n.ntrode_id)],
      })),
    };
    const issues = rulesValidation(model);
    expect(issues.some((i) => i.code === 'multishank_bad_channels_ignored')).toBe(false);
  });
});
