/**
 * Normalization Contract — export-gate integration.
 *
 * The export path is `corrupt source state` → `mergeDayMetadata` (which normalizes
 * via `src/utils/deviceNormalization`) → `computeStepStatus(...).export`. Strict,
 * lossless normalization must NOT launder corrupt persisted device state into
 * valid-looking YAML: a non-integer id, a non-integer channel value, or a missing
 * required `targeted_location` injected at the SOURCE must surface as
 * `export === 'error'` (the fail-closed gate), and the merged output must not
 * silently contain a synthesized/coerced value.
 *
 * The companion `golden-yaml.baseline.test.js` + `exportParity` / `legacyParity`
 * suites guarantee the OTHER half of the contract: clean inputs stay byte-identical.
 */
import { describe, it, expect } from 'vitest';
import { computeStepStatus } from '../validation';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

/**
 * Read the snapshot devices the realistic day is pinned to (configurationVersion 1).
 * @param animal
 */
function snapshotDevices(animal) {
  return animal.configurationHistory[0].devices;
}

describe('Normalization Contract: export gate sees un-laundered state', () => {
  it('baseline: a clean configured day exports', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    expect(computeStepStatus(day, merged).export).toBe('valid');
  });

  it('a non-integer ntrode_id blocks export and is NOT coerced to an integer', () => {
    const { animal, day } = buildRealisticWorkspace();
    snapshotDevices(animal).ntrode_electrode_group_channel_map[0].ntrode_id = 'abc';

    const merged = mergeDayMetadata(animal, day);

    // Normalization preserved the corrupt id (no synthesized fallback index).
    expect(merged.ntrode_electrode_group_channel_map[0].ntrode_id).toBe('abc');
    expect(merged.ntrode_electrode_group_channel_map[0].ntrode_id).not.toBe(0);
    // Schema integer type flags it → export blocked.
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('a non-integer electrode_group_id blocks export and is NOT coerced', () => {
    const { animal, day } = buildRealisticWorkspace();
    snapshotDevices(animal).electrode_groups[0].id = 'abc';

    const merged = mergeDayMetadata(animal, day);

    expect(merged.electrode_groups[0].id).toBe('abc');
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('a non-integer channel-map value blocks export and is NOT silently truncated', () => {
    const { animal, day } = buildRealisticWorkspace();
    // map { "0": "2.9" } must NOT become { 0: 2 } (lossy parseInt) and the channel
    // value-range rule must flag the non-integer.
    snapshotDevices(animal).ntrode_electrode_group_channel_map[0].map = { 0: '2.9' };

    const merged = mergeDayMetadata(animal, day);

    expect(merged.ntrode_electrode_group_channel_map[0].map[0]).toBe('2.9');
    expect(merged.ntrode_electrode_group_channel_map[0].map[0]).not.toBe(2);
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('a group missing targeted_location blocks export (not synthesized from location)', () => {
    const { animal, day } = buildRealisticWorkspace();
    delete snapshotDevices(animal).electrode_groups[0].targeted_location;

    const merged = mergeDayMetadata(animal, day);

    // Not invented from location — left empty so empty_targeted_location fires.
    expect(merged.electrode_groups[0].targeted_location).toBe('');
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('clean integer-string id migration exports with NO error and NO semantic change', () => {
    const { animal, day } = buildRealisticWorkspace();
    const groups = snapshotDevices(animal).electrode_groups;
    const ntrodes = snapshotDevices(animal).ntrode_electrode_group_channel_map;
    // Simulate legacy persisted state where ids were strings.
    groups.forEach((g) => { g.id = String(g.id); });
    ntrodes.forEach((n) => {
      n.ntrode_id = String(n.ntrode_id);
      n.electrode_group_id = String(n.electrode_group_id);
    });

    const merged = mergeDayMetadata(animal, day);

    // Migrated to integers, byte-equivalent to the clean numeric path.
    expect(merged.electrode_groups[0].id).toBe(0);
    expect(merged.ntrode_electrode_group_channel_map[0].ntrode_id).toBe(1);
    expect(merged.ntrode_electrode_group_channel_map[0].electrode_group_id).toBe(0);
    expect(computeStepStatus(day, merged).export).toBe('valid');
  });
});
