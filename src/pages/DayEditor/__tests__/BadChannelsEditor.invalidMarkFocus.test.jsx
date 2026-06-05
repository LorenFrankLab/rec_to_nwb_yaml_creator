/**
 * @vitest-environment jsdom
 *
 * MEDIUM review finding — invalid-mark repair focus must land on the REMOVAL BUTTON,
 * not the checkbox grid.
 *
 * The `bad_channel_out_of_range` validation issue is keyed at the ntrode level with
 * `path = ntrode_electrode_group_channel_map[<ntrode_id>]`. BOTH the checkbox grid AND
 * the "remove invalid failed channel" button carry that SAME `data-field-path`. The Day
 * Editor stepper's repair-focus search (DayEditorStepper.jsx) focuses the FIRST DOM
 * element whose `data-field-path` equals the issue path. When an out-of-range value
 * (e.g. 99 on a tetrode) blocks export, that first match MUST be the removal button —
 * the only control that can actually clear the value — and NOT the grid, which has no
 * checkbox for 99 and so cannot perform the repair.
 *
 * These tests pin the DOM ORDER: for an ntrode WITH invalid marks, the FIRST element
 * carrying the ntrode's anchor is the removal button; with NO invalid marks the first
 * (and only) anchored element is the checkbox grid (so normal repair focus — marking a
 * valid channel — is unchanged).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BadChannelsEditor from '../BadChannelsEditor';

describe('BadChannelsEditor — single-shank invalid-mark repair focus', () => {
  const tetrode = {
    ntrode_id: 0,
    electrode_group_id: 0,
    bad_channels: [99],
    map: { 0: 0, 1: 1, 2: 2, 3: 3 }, // valid ids 0..3
  };

  it('makes the removal button the FIRST anchored element when an out-of-range mark exists', () => {
    const { container } = render(
      <BadChannelsEditor
        ntrodes={[tetrode]}
        badChannels={{ '0': [99] }}
        onUpdate={() => {}}
      />
    );

    const anchored = container.querySelectorAll(
      '[data-field-path="ntrode_electrode_group_channel_map[0]"]'
    );
    expect(anchored.length).toBeGreaterThan(0);
    // The control the stepper focuses (first match) must be the removal button —
    // the only control that can clear the out-of-range value.
    const first = anchored[0];
    expect(first.tagName).toBe('BUTTON');
    expect(first.getAttribute('aria-label')).toMatch(/remove invalid/i);
  });

  it('keeps the checkbox grid as the (first) anchored element when all marks are valid', () => {
    const { container } = render(
      <BadChannelsEditor
        ntrodes={[tetrode]}
        badChannels={{ '0': [2] }}
        onUpdate={() => {}}
      />
    );

    const anchored = container.querySelectorAll(
      '[data-field-path="ntrode_electrode_group_channel_map[0]"]'
    );
    expect(anchored.length).toBe(1);
    // Normal repair focus (marking a valid channel) must still land on the grid.
    expect(anchored[0].tagName).not.toBe('BUTTON');
    expect(anchored[0].getAttribute('role')).toBe('group');
  });
});

describe('BadChannelsEditor — multi-shank invalid-mark repair focus', () => {
  // 64c-3s: probe-local ids 0..63 on the FIRST ntrode row only. Keep maps minimal —
  // the 64-checkbox render is slow, and we only assert DOM order, not interaction.
  const DEVICE_TYPE = '64c-3s6mm6cm-20um-40um-sl';
  const ntrodes = () => [
    { ntrode_id: 10, electrode_group_id: 2, bad_channels: [99], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, i])) },
    { ntrode_id: 11, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, 21 + i])) },
    { ntrode_id: 12, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [i, 42 + i])) },
  ];

  it('makes the removal button the FIRST first-row-anchored element when an out-of-range mark exists', () => {
    const { container } = render(
      <BadChannelsEditor
        ntrodes={ntrodes()}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [99], '11': [], '12': [] }}
        onUpdate={() => {}}
        onBatchUpdate={() => {}}
      />
    );

    // The first-row issue path is keyed by id 10 (the row the converter honors).
    const anchored = container.querySelectorAll(
      '[data-field-path="ntrode_electrode_group_channel_map[10]"]'
    );
    expect(anchored.length).toBeGreaterThan(0);
    const first = anchored[0];
    expect(first.tagName).toBe('BUTTON');
    expect(first.getAttribute('aria-label')).toMatch(/remove invalid/i);
  });

  it('keeps the probe-wide grid as the (first) first-row-anchored element when all marks are valid', () => {
    const { container } = render(
      <BadChannelsEditor
        ntrodes={ntrodes().map((n) => (n.ntrode_id === 10 ? { ...n, bad_channels: [42] } : n))}
        deviceType={DEVICE_TYPE}
        badChannels={{ '10': [42], '11': [], '12': [] }}
        onUpdate={() => {}}
        onBatchUpdate={() => {}}
      />
    );

    const anchored = container.querySelectorAll(
      '[data-field-path="ntrode_electrode_group_channel_map[10]"]'
    );
    expect(anchored.length).toBe(1);
    expect(anchored[0].tagName).not.toBe('BUTTON');
    expect(anchored[0].getAttribute('role')).toBe('group');
  });
});
