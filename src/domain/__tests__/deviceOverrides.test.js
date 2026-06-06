/**
 * Device-override cleanup classifier — corresponds shape-for-shape with the validator's
 * `dayOverrideIssues`. The Devices step renders a removal control (keyed by `data-field-path`)
 * for each shape this classifier flags; the validator surfaces each as an export-blocking
 * issue (keyed by `path`/`focusPath`). They must agree so every blocking override is
 * repairable on the Devices step — never gated-but-invisible or dead-ended.
 */
import { describe, it, expect } from 'vitest';
import { classifyDeviceOverrides } from '../deviceOverrides';
import { dayOverrideIssues } from '../validation';

// Merged day with a known resolved ntrode map (ids 1 and 2). resolvedNtrodeIds = {'1','2'}.
const mergedDay = {
  ntrode_electrode_group_channel_map: [{ ntrode_id: 1 }, { ntrode_id: 2 }],
};
const resolvedNtrodeIds = new Set(['1', '2']);

/**
 * The set of `data-field-path` anchors the Devices step would render from the classifier.
 * @param day
 */
const controlPaths = (day) => {
  const c = classifyDeviceOverrides(day, resolvedNtrodeIds);
  const paths = [];
  if (c.wholeOverridesMalformed) paths.push('deviceOverrides');
  c.staleOverrideKeys.forEach((k) => paths.push(`deviceOverrides.bad_channels.${k}`));
  c.corruptValueKeys.forEach((k) => paths.push(`deviceOverrides.bad_channels.${k}`));
  if (c.badChannelContainerMalformed) paths.push('deviceOverrides.bad_channels');
  c.presentGeometryKeys.forEach((k) => paths.push(`deviceOverrides.${k}`));
  return paths.sort();
};

/**
 * The set of `path`s the validator emits for the same day.
 * @param day
 */
const issuePaths = (day) =>
  dayOverrideIssues(day, mergedDay).map((i) => i.path).sort();

describe('override classifier corresponds to dayOverrideIssues', () => {
  it('whole-container scalar: same path + reset command', () => {
    const day = { deviceOverrides: 'corrupt' };
    expect(controlPaths(day)).toEqual(['deviceOverrides']);
    expect(issuePaths(day)).toEqual(['deviceOverrides']);
    const [issue] = dayOverrideIssues(day, mergedDay);
    expect(issue.code).toBe('malformed_device_override');
    expect(issue.repairCommand).toEqual({ type: 'resetDeviceOverrides' });
  });

  it('bad_channels container scalar: same path + reset command', () => {
    const day = { deviceOverrides: { bad_channels: '2.9' } };
    expect(controlPaths(day)).toEqual(['deviceOverrides.bad_channels']);
    expect(issuePaths(day)).toEqual(['deviceOverrides.bad_channels']);
    const [issue] = dayOverrideIssues(day, mergedDay);
    expect(issue.code).toBe('malformed_bad_channel_override');
    expect(issue.repairCommand).toEqual({ type: 'resetBadChannelOverrides' });
  });

  it('stale bad_channels key: same key-specific path + removal command', () => {
    const day = { deviceOverrides: { bad_channels: { 999: [0] } } };
    expect(controlPaths(day)).toEqual(['deviceOverrides.bad_channels.999']);
    expect(issuePaths(day)).toEqual(['deviceOverrides.bad_channels.999']);
    const [issue] = dayOverrideIssues(day, mergedDay);
    expect(issue.code).toBe('stale_bad_channel_override');
    expect(issue.repairCommand).toEqual({ type: 'removeBadChannelOverrideKey', key: '999' });
  });

  it('corrupt value under a resolved key: same key-specific path', () => {
    const day = { deviceOverrides: { bad_channels: { 1: 'x' } } };
    expect(controlPaths(day)).toEqual(['deviceOverrides.bad_channels.1']);
    expect(issuePaths(day)).toEqual(['deviceOverrides.bad_channels.1']);
    const [issue] = dayOverrideIssues(day, mergedDay);
    expect(issue.code).toBe('malformed_bad_channel_override');
    expect(issue.repairCommand).toEqual({ type: 'removeBadChannelOverrideKey', key: '1' });
  });

  it('non-array geometry override: same path + key removal command', () => {
    const day = { deviceOverrides: { electrode_groups: 'x' } };
    expect(controlPaths(day)).toEqual(['deviceOverrides.electrode_groups']);
    expect(issuePaths(day)).toEqual(['deviceOverrides.electrode_groups']);
    const [issue] = dayOverrideIssues(day, mergedDay);
    expect(issue.code).toBe('malformed_device_override');
    expect(issue.repairCommand).toEqual({ type: 'removeDeviceOverrideKey', key: 'electrode_groups' });
  });

  it('a clean day produces neither controls nor issues', () => {
    const day = { deviceOverrides: { bad_channels: { 1: [0], 2: [] } } };
    expect(controlPaths(day)).toEqual([]);
    expect(issuePaths(day)).toEqual([]);
  });

  // A VALID-shaped (array) geometry override SHADOWS the snapshot. The Devices step always
  // offers a removal control for it (revert to saved config), but the validator only ERRORS
  // when the override's CONTENTS error — so it needs the base issues to fire. This documents
  // that intentional asymmetry (control always; export-blocking issue only when erroring).
  it('array geometry override: control always offered; issue only when its contents error', () => {
    const day = { deviceOverrides: { electrode_groups: [{ id: 0 }] } };
    // Control is offered (the user can revert the shadow)…
    expect(controlPaths(day)).toEqual(['deviceOverrides.electrode_groups']);
    // …but a CLEAN array override is not an export error on its own.
    expect(issuePaths(day)).toEqual([]);
    // When its contents error, the validator raises a day-routed shadow escape at the same path.
    const baseErrors = [{ severity: 'error', code: 'empty_location', path: 'electrode_groups[0].location' }];
    const shadow = dayOverrideIssues(day, mergedDay, baseErrors);
    expect(shadow.map((i) => ({ code: i.code, path: i.path }))).toEqual([
      { code: 'shadowed_geometry_override', path: 'deviceOverrides.electrode_groups' },
    ]);
  });
});
