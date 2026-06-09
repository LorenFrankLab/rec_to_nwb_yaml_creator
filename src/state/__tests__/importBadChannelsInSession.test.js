/**
 * Regression gate for the import→re-export seam after bad channels became
 * DAY-OWNED in the export merge (`resolveDayConfig` reads
 * `day.deviceOverrides.bad_channels` ONLY, never the config-snapshot base).
 *
 * The bug: the YAML importer placed an imported file's `bad_channels` on the
 * CONFIG-SNAPSHOT base (inside the snapshot's
 * `ntrode_electrode_group_channel_map`), not the day override. The base→day
 * migration (`migrateBadChannelsToDays`) only runs at hydrate/load/save — NOT
 * after an in-session store mutation. So an IN-SESSION import followed by an
 * immediate re-export (no reload) reads the override-only merge over a day with
 * NO override → the marks vanish silently.
 *
 * This drives the REAL production path:
 *   planImport([{ sourceName, flatModel: decodeYaml(yaml) }], emptyWorkspace)
 *   → applyImportPlan(plan, actions, { workspace }) against a live useStore()
 * then immediately re-exports the imported day via
 *   encodeYaml(mergeDayMetadata(importedAnimal, importedDay))
 * and asserts byte-identity with the source YAML — NO reload between the two.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { normalizeWorkspaceDevices } from '../../utils/deviceNormalization';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';

/**
 * A genuine merge-output YAML that CARRIES non-empty bad channels. The raw
 * builder places its bad-channel marks on the snapshot base, which the
 * day-only merge ignores; running it through the load-time migration first
 * moves those marks into the day override so the merge emits them. The result
 * is exactly what a previously-exported, on-disk YAML looks like.
 *
 * @returns {string} Source YAML carrying non-empty `bad_channels`.
 */
function buildSourceYamlWithBadChannels() {
  const { animal, day } = buildRealisticWorkspace();
  const loaded = normalizeWorkspaceDevices({
    animals: { [animal.id]: animal },
    days: { [day.id]: day },
  });
  return encodeYaml(
    mergeDayMetadata(loaded.animals[animal.id], loaded.days[day.id])
  );
}

describe('in-session YAML import preserves bad channels on immediate re-export', () => {
  it('re-exports byte-identically without a reload (no reliance on the load-time migration)', () => {
    const sourceYaml = buildSourceYamlWithBadChannels();

    // Sanity: the source genuinely carries bad channels (otherwise the test is vacuous).
    const sourceParsed = decodeYaml(sourceYaml);
    const sourceBad = sourceParsed.ntrode_electrode_group_channel_map
      .filter((n) => Array.isArray(n.bad_channels) && n.bad_channels.length > 0)
      .map((n) => [n.ntrode_id, n.bad_channels]);
    expect(sourceBad.length).toBeGreaterThan(0);

    const sourceName = '06222023_remy_metadata.yml';
    const decodedFiles = [{ sourceName, flatModel: decodeYaml(sourceYaml) }];

    const { result } = renderHook(() => useStore());

    const plan = planImport(decodedFiles, result.current.model.workspace);

    act(() => {
      applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
      });
    });

    // Read the IMPORTED animal + day straight out of the live store — NO reload,
    // NO re-hydrate, NO save. This is the production "import then export now" path.
    const ws = result.current.model.workspace;
    const animalKeys = Object.keys(ws.animals);
    expect(animalKeys).toHaveLength(1);
    const importedAnimal = ws.animals[animalKeys[0]];
    const dayKeys = Object.keys(ws.days);
    expect(dayKeys).toHaveLength(1);
    const importedDay = ws.days[dayKeys[0]];

    const reExported = encodeYaml(mergeDayMetadata(importedAnimal, importedDay));

    expect(reExported).toBe(sourceYaml);
  });
});
