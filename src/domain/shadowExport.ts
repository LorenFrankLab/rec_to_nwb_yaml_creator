/**
 * Pre-download encoder-stability check for the new workspace export path.
 *
 * @module domain/shadowExport
 */
import { encodeYaml } from '../io/yaml';
import { mergeDayMetadata } from '../state/workspaceUtils';
import { isFeatureEnabled } from '../featureFlags';
import type { Animal, Day } from '../state/workspaceTypes';

/** Result of {@link checkShadowExport}. */
interface ShadowExportResult {
  /** Whether the encoder is stable for this input (safe to download). */
  ok: boolean;
  /** The YAML about to be downloaded. */
  yaml: string;
  /** The YAML re-encoded from a pristine copy (must equal `yaml` when `ok`). */
  stableYaml: string;
  /** A first-difference report when unstable, else `null`. */
  diff: string | null;
}

/**
 * Cheap pre-download encoder-stability check. Recomputes the export YAML and
 * verifies that `encodeYaml` is safe to trust for this download, by checking two
 * things against the SAME `mergeDayMetadata` output:
 *   1. encoding does not mutate its input in place — a snapshot taken BEFORE the
 *      encode must still deep-equal the input afterwards. Snapshotting first is
 *      essential: it catches even an *idempotent* in-place mutation (e.g. key
 *      sorting or value coercion) that two successive re-encodes would not; and
 *   2. re-encoding an independent pristine copy reproduces identical bytes
 *      (determinism, no dependence on call order).
 *
 * What this proves: `encodeYaml` neither mutates its argument nor depends on
 * hidden state for this input.
 *
 * What this does NOT prove: byte-for-byte parity with the legacy export path.
 * The legacy path (`src/features/importExport.js` `exportAll`) encodes a
 * different, independently-built flat `formData` object, so comparing encodings
 * of the same merged object cannot establish legacy parity. The new path's
 * correctness is proven by the semantic deep-equal + new-path snapshot tests in
 * the validation slice, and the within-path encoder/format guard runs via the
 * golden baseline suite. A failure here is a data-integrity bug (encoder
 * instability), never a feature.
 *
 * @param animal - Animal record providing shared metadata.
 * @param day - Recording day providing session-specific data.
 * @returns
 */
export function checkShadowExport(animal: Animal, day: Day): ShadowExportResult {
  const merged = mergeDayMetadata(animal, day);

  // Snapshot the input BEFORE encoding so an in-place mutation is detectable
  // even when it is idempotent (re-encoding alone could not reveal it).
  const beforeEncode = stableStringify(merged);

  // First encode (what we are about to download).
  const yaml = encodeYaml(merged);

  const inputMutated = stableStringify(merged) !== beforeEncode;

  // Second encode of an independent pristine copy: must reproduce the same bytes.
  const stableYaml = encodeYaml(JSON.parse(beforeEncode));

  if (!inputMutated && yaml === stableYaml) {
    return { ok: true, yaml, stableYaml, diff: null };
  }

  const diff = inputMutated
    ? firstLineDiff(beforeEncode, stableStringify(merged))
    : firstLineDiff(yaml, stableYaml);

  if (isFeatureEnabled('shadowExportLog')) {
    console.error('[shadow-export] encoder instability — download blocked', {
      inputMutated,
      diff,
    });
  }

  return { ok: false, yaml, stableYaml, diff };
}

/**
 * Deterministic JSON serialization of a plain metadata object, used to detect
 * in-place mutation of the encoder's input. `mergeDayMetadata` returns a plain,
 * JSON-safe, insertion-ordered object, so a straight `JSON.stringify` is an
 * order-sensitive snapshot — reordering or value coercion both change it.
 *
 * @param value - Value to serialize.
 * @returns JSON string snapshot.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Produce a compact, human-readable first-difference report between two YAML
 * strings (line number + both sides). Used for the blocking UI notice.
 *
 * @param a - First YAML string.
 * @param b - Second YAML string.
 * @returns Human-readable description of the first difference.
 */
export function firstLineDiff(a: string, b: string): string {
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
