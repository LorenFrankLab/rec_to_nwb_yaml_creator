/**
 * Export-parity integration tests for the new workspace export path.
 *
 * Proves the build → merge → encode chain is lossless and deterministic:
 *   - semantic parity: the encoded output parses back to the same metadata as
 *     the hand-authored `realistic-session.yml` golden fixture (order-independent,
 *     key-set-exact), augmented with the always-on keys the merge adds;
 *   - new-path snapshot: byte-identical to a checked-in snapshot captured from
 *     this path (the new path's own regression guard, distinct from the legacy
 *     fixtures — byte-for-byte legacy parity is a later phase);
 *   - determinism: repeated encodes are byte-stable.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { encodeYaml, decodeYaml, formatDeterministicFilename } from '../../../io/yaml';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { validate } from '../../../validation';
import {
  buildRealisticWorkspace,
  REALISTIC_ALWAYS_ON_KEYS,
} from '../../../__tests__/fixtures/workspaceBuilders';

const goldenDir = path.join(__dirname, '../../../__tests__/fixtures/golden');
const realisticFixture = fs.readFileSync(path.join(goldenDir, 'realistic-session.yml'), 'utf8');
const newPathSnapshot = fs.readFileSync(
  path.join(goldenDir, 'workspace-export.realistic.yml'),
  'utf8'
);

describe('export parity (new workspace path)', () => {
  it('builds → merges → encodes to metadata that parses back to the expected object (semantic)', () => {
    const { animal, day } = buildRealisticWorkspace();

    const roundTripped = decodeYaml(encodeYaml(mergeDayMetadata(animal, day)));

    const expected = {
      ...decodeYaml(realisticFixture),
      ...REALISTIC_ALWAYS_ON_KEYS,
    };

    // Full key-set-exact deep-equal: a dropped or renamed key must fail.
    expect(roundTripped).toEqual(expected);
  });

  it('builds → exports byte-identical to the checked-in new-path snapshot', () => {
    const { animal, day } = buildRealisticWorkspace();

    const yaml = encodeYaml(mergeDayMetadata(animal, day));

    expect(yaml).toBe(newPathSnapshot);
  });

  it('produces a schema-valid export for a complete day (export is reachable)', () => {
    const { animal, day } = buildRealisticWorkspace();

    // A complete day must validate with zero issues — otherwise the validation
    // step would stay in error and the Export gate would never unlock.
    expect(validate(mergeDayMetadata(animal, day))).toEqual([]);
  });

  it('produces byte-stable output across repeated encodes (determinism)', () => {
    const { animal, day } = buildRealisticWorkspace();

    const first = encodeYaml(mergeDayMetadata(animal, day));
    const second = encodeYaml(mergeDayMetadata(animal, day));

    expect(first).toBe(second);
  });

  it('computes a filename matching the legacy format with the experiment date injected', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);

    const fileName = formatDeterministicFilename({
      ...merged,
      EXPERIMENT_DATE_in_format_mmddYYYY: day.experimentDate,
    });

    expect(fileName).toBe(`${day.experimentDate}_${merged.subject.subject_id.toLowerCase()}_metadata.yml`);
    expect(fileName).toBe('06222023_remy_metadata.yml');
    // Guard: the date is injected, not left as the literal placeholder.
    expect(fileName).not.toContain('{EXPERIMENT_DATE_in_format_mmddYYYY}');
  });
});
