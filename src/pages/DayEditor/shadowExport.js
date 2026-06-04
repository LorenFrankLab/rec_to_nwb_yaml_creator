/**
 * Pre-download encoder-stability check for the new workspace export path.
 *
 * @module pages/DayEditor/shadowExport
 */
import { encodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { isFeatureEnabled } from '../../featureFlags';

/**
 * Cheap pre-download encoder-stability check. Recomputes the export YAML and
 * verifies that `encodeYaml` does NOT mutate its input in place, by comparing
 * `encodeYaml(merged)` against `encodeYaml(structuredClone(merged))` — both
 * derived from the SAME `mergeDayMetadata` output.
 *
 * What this proves: `encodeYaml` is stable / has no in-place-mutation side
 * effect on its argument.
 *
 * What this does NOT prove: byte-for-byte parity with the legacy export path.
 * The legacy path (`src/features/importExport.js` `exportAll`) encodes a
 * different, independently-built flat `formData` object, so comparing two
 * encodings of the same merged object cannot establish legacy parity. The new
 * path's correctness is proven by the semantic deep-equal + new-path snapshot
 * tests in the validation slice, and the within-path encoder/format guard runs
 * via the golden baseline suite. A failure here is a data-integrity bug
 * (encoder instability), never a feature.
 *
 * @param {object} animal - Animal record providing shared metadata.
 * @param {object} day - Recording day providing session-specific data.
 * @returns {{ ok: boolean, yaml: string, stableYaml: string, diff: string|null }}
 */
export function checkShadowExport(animal, day) {
  const merged = mergeDayMetadata(animal, day);

  // First encode (what we are about to download).
  const yaml = encodeYaml(merged);

  // Second encode of an independent clone: if encodeYaml mutated `merged` in
  // place, these two strings diverge. (Stability check, NOT legacy parity.)
  const stableYaml = encodeYaml(structuredClone(merged));

  if (yaml === stableYaml) {
    return { ok: true, yaml, stableYaml, diff: null };
  }

  const diff = firstLineDiff(yaml, stableYaml);

  if (isFeatureEnabled('shadowExportLog')) {
    console.error('[shadow-export] encoder instability — download blocked', { diff });
  }

  return { ok: false, yaml, stableYaml, diff };
}

/**
 * Produce a compact, human-readable first-difference report between two YAML
 * strings (line number + both sides). Used for the blocking UI notice.
 *
 * @param {string} a - First YAML string.
 * @param {string} b - Second YAML string.
 * @returns {string} Human-readable description of the first difference.
 */
export function firstLineDiff(a, b) {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const max = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < max; i += 1) {
    if (aLines[i] !== bLines[i]) {
      return [
        `First difference at line ${i + 1}:`,
        `  encode A: ${JSON.stringify(aLines[i] ?? '<missing>')}`,
        `  encode B: ${JSON.stringify(bLines[i] ?? '<missing>')}`,
      ].join('\n');
    }
  }
  return 'Strings differ in length but share all compared lines.';
}
