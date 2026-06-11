/**
 * Unit tests for the shared device-override merge primitives.
 *
 * This module is the single home of the override > snapshot resolution and the matching
 * shape-classification ("can the merge honor this override cleanly?"). `resolveDayConfig`
 * (the export path) and `dayOverrideIssues` (the validator) both build on it, so the two
 * cannot drift in how they read a `day.deviceOverrides`. The behavior pinned here is the
 * exact behavior the prior inline copies had — proven by the characterization net.
 */
import { describe, it, expect } from 'vitest';
import {
  isPlainRecord,
  classifyGeometryOverride,
  classifyBadChannelsContainer,
  resolveEffectiveDevices,
} from '../deviceOverrideMerge';

describe('isPlainRecord', () => {
  it('is true only for a non-null, non-array object', () => {
    expect(isPlainRecord({})).toBe(true);
    expect(isPlainRecord({ a: 1 })).toBe(true);
  });

  it('is false for null, undefined, arrays, and scalars', () => {
    expect(isPlainRecord(null)).toBe(false);
    expect(isPlainRecord(undefined)).toBe(false);
    expect(isPlainRecord([])).toBe(false);
    expect(isPlainRecord('x')).toBe(false);
    expect(isPlainRecord(3)).toBe(false);
  });
});

describe('classifyGeometryOverride', () => {
  it('absent for null/undefined (merge uses the snapshot, no issue)', () => {
    expect(classifyGeometryOverride(undefined)).toBe('absent');
    expect(classifyGeometryOverride(null)).toBe('absent');
  });

  it('array for any array (merge honors it / it shadows the snapshot)', () => {
    expect(classifyGeometryOverride([])).toBe('array');
    expect(classifyGeometryOverride([{ id: 0 }])).toBe('array');
  });

  it('malformed for a present non-array (merge falls back to the snapshot, hidden corruption)', () => {
    expect(classifyGeometryOverride('corrupt')).toBe('malformed');
    expect(classifyGeometryOverride(42)).toBe('malformed');
    expect(classifyGeometryOverride({})).toBe('malformed');
  });
});

describe('classifyBadChannelsContainer', () => {
  it('absent for null/undefined', () => {
    expect(classifyBadChannelsContainer(undefined)).toBe('absent');
    expect(classifyBadChannelsContainer(null)).toBe('absent');
  });

  it('record for an ntrode_id → list map (incl. empty)', () => {
    expect(classifyBadChannelsContainer({})).toBe('record');
    expect(classifyBadChannelsContainer({ 1: [0] })).toBe('record');
  });

  it('malformed for a present non-record (scalar/array)', () => {
    expect(classifyBadChannelsContainer('2.9')).toBe('malformed');
    expect(classifyBadChannelsContainer([])).toBe('malformed');
    expect(classifyBadChannelsContainer(42)).toBe('malformed');
  });
});

describe('resolveEffectiveDevices', () => {
  const snapshotElectrodeGroups = [{ id: 0, location: 'CA1' }];
  const snapshotNtrodes = [
    { ntrode_id: 1, electrode_group_id: 0, map: { 0: 0 } },
    { ntrode_id: 2, electrode_group_id: 0, map: { 0: 1 } },
  ];

  it('uses the snapshot geometry when there is no override', () => {
    const { electrodeGroups, ntrodes } = resolveEffectiveDevices({
      deviceOverrides: undefined,
      snapshotElectrodeGroups,
      snapshotNtrodes,
    });
    expect(electrodeGroups).toBe(snapshotElectrodeGroups);
    expect(ntrodes.map((n) => n.ntrode_id)).toEqual([1, 2]);
    expect(ntrodes.every((n) => Array.isArray(n.bad_channels) && n.bad_channels.length === 0)).toBe(true);
  });

  it('honors a well-formed array geometry override (shadows the snapshot)', () => {
    const override = [{ id: 9, location: 'PFC' }];
    const { electrodeGroups } = resolveEffectiveDevices({
      deviceOverrides: { electrode_groups: override },
      snapshotElectrodeGroups,
      snapshotNtrodes,
    });
    expect(electrodeGroups).toBe(override);
  });

  it('falls back to the snapshot geometry for a malformed (non-array) override', () => {
    const { electrodeGroups } = resolveEffectiveDevices({
      deviceOverrides: { electrode_groups: 'corrupt' },
      snapshotElectrodeGroups,
      snapshotNtrodes,
    });
    expect(electrodeGroups).toBe(snapshotElectrodeGroups);
  });

  it('uses an array ntrode override over the snapshot ntrodes', () => {
    const override = [{ ntrode_id: 7, electrode_group_id: 0, map: { 0: 0 } }];
    const { ntrodes } = resolveEffectiveDevices({
      deviceOverrides: { ntrode_electrode_group_channel_map: override },
      snapshotElectrodeGroups,
      snapshotNtrodes,
    });
    expect(ntrodes.map((n) => n.ntrode_id)).toEqual([7]);
  });

  it('applies a bad-channel override to the matching ntrode only', () => {
    const { ntrodes } = resolveEffectiveDevices({
      deviceOverrides: { bad_channels: { 1: [2, 3] } },
      snapshotElectrodeGroups,
      snapshotNtrodes,
    });
    expect(ntrodes.find((n) => n.ntrode_id === 1).bad_channels).toEqual([2, 3]);
    expect(ntrodes.find((n) => n.ntrode_id === 2).bad_channels).toEqual([]);
  });

  it('resolves a non-array bad-channel value to [] (never smears the raw value)', () => {
    const { ntrodes } = resolveEffectiveDevices({
      deviceOverrides: { bad_channels: { 1: '23' } },
      snapshotElectrodeGroups,
      snapshotNtrodes,
    });
    expect(ntrodes.find((n) => n.ntrode_id === 1).bad_channels).toEqual([]);
  });

  it('resolves every ntrode to [] when the bad-channels container is not a record', () => {
    const { ntrodes } = resolveEffectiveDevices({
      deviceOverrides: { bad_channels: '2.9' },
      snapshotElectrodeGroups,
      snapshotNtrodes,
    });
    expect(ntrodes.every((n) => n.bad_channels.length === 0)).toBe(true);
  });

  it('copies the override list rather than aliasing it', () => {
    const list = [2];
    const { ntrodes } = resolveEffectiveDevices({
      deviceOverrides: { bad_channels: { 1: list } },
      snapshotElectrodeGroups,
      snapshotNtrodes,
    });
    expect(ntrodes.find((n) => n.ntrode_id === 1).bad_channels).toEqual([2]);
    expect(ntrodes.find((n) => n.ntrode_id === 1).bad_channels).not.toBe(list);
  });

  it('matches a string-keyed override against an integer ntrode_id', () => {
    const { ntrodes } = resolveEffectiveDevices({
      deviceOverrides: { bad_channels: { 1: [3] } },
      snapshotElectrodeGroups,
      snapshotNtrodes,
    });
    expect(ntrodes.find((n) => n.ntrode_id === 1).bad_channels).toEqual([3]);
  });

  it('tolerates a non-array snapshot ntrode list (resolves to no ntrodes)', () => {
    const { ntrodes } = resolveEffectiveDevices({
      deviceOverrides: undefined,
      snapshotElectrodeGroups,
      snapshotNtrodes: undefined,
    });
    expect(ntrodes).toEqual([]);
  });
});
