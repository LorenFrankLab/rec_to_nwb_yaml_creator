/**
 * Import round-trip byte-identity gate for the Import & Repair path.
 *
 * The non-negotiable contract (shared-contracts §1): a CLEAN metadata file imported then exported is
 * byte-for-byte identical. This proves the repair spine adds nothing to a clean file — it reports no
 * repairs and no benign normalizations, `applyImportRepairs` returns the model untouched, and the
 * decompose→recompose→merge→encode round-trip reproduces the original bytes.
 *
 * The corpus is a GENUINE merge output (`workspace-export.realistic.yml`), the same kind the
 * decompose round-trip gate uses — NOT a golden fixture (those check only encoder determinism, and
 * one is a known-invalid workspace the merge does not reproduce).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { normalizeWorkspaceDevices } from '../../utils/deviceNormalization';
import { decomposeYaml, recomposeDayModel } from '../yamlImport';
import { buildImportRepairPlan, applyImportRepairs } from '../importRepair';

const cleanYaml = fs.readFileSync(
  path.join(__dirname, '../../__tests__/fixtures/golden/workspace-export.realistic.yml'),
  'utf8'
);

/**
 * Re-export a recomposed animal+day through the real LOAD path (the bad-channel migration moves
 * imported snapshot-base marks down to the day override, exactly as production hydration does), then
 * encode — mirroring the decompose round-trip gate's helper.
 *
 * @param animal - Recomposed animal.
 * @param day - Recomposed day.
 * @returns The encoded YAML of the loaded merge.
 */
function reExport(animal: Record<string, unknown>, day: Record<string, unknown>): string {
  const loaded = normalizeWorkspaceDevices({
    animals: { [animal.id as string]: animal },
    days: { [day.id as string]: day },
  }) as {
    animals: Record<string, Parameters<typeof mergeDayMetadata>[0]>;
    days: Record<string, Parameters<typeof mergeDayMetadata>[1]>;
  };
  return encodeYaml(
    mergeDayMetadata(loaded.animals[animal.id as string], loaded.days[day.id as string])
  );
}

describe('Import round-trip — a clean file imports and re-exports byte-identical', () => {
  it('reports no repairs, no blockers, and no benign normalizations for a clean file', () => {
    const decoded = decodeYaml(cleanYaml);
    const plan = buildImportRepairPlan(decoded, 'workspace-export.realistic.yml', { animals: {} });
    expect(plan.hasErrors).toBe(false);
    expect(plan.items).toEqual([]);
    expect(plan.blockers).toEqual([]);
    expect(plan.benign).toEqual([]);
    expect(plan.decision).toEqual({ kind: 'new', subjectId: 'remy' });
  });

  it('applyImportRepairs with no resolutions leaves a clean model unchanged', () => {
    const decoded = decodeYaml(cleanYaml) as Record<string, unknown>;
    const repaired = applyImportRepairs(decoded, {});
    expect(repaired).toEqual(decoded);
  });

  it('decode → model → merge → encode is byte-identical', () => {
    const decoded = decodeYaml(cleanYaml);
    const repaired = applyImportRepairs(decoded, {});
    const result = decomposeYaml(repaired as never);
    expect(result.ok).toBe(true);
    const { animal, day } = recomposeDayModel(result);
    expect(reExport(animal, day)).toBe(cleanYaml);
  });
});
