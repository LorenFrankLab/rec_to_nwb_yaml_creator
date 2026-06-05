/**
 * Export-parity integration tests for the new workspace export path.
 *
 * Proves the build → merge → encode chain is lossless and deterministic:
 *   - semantic parity (everything EXCEPT the channel map): the encoded output
 *     parses back to the same metadata as the hand-authored `realistic-session.yml`
 *     golden fixture, augmented with the always-on keys the merge adds;
 *   - new-path snapshot: byte-identical to a checked-in snapshot captured from
 *     this path (the new path's own regression guard, distinct from the legacy
 *     fixtures);
 *   - validity: the corrected builder validates clean and exports are reachable;
 *   - determinism: repeated encodes are byte-stable.
 *
 * INTENTIONAL SEMANTIC SPLIT (Phase 6): the legacy `realistic-session.yml` golden
 * encodes a globally-incrementing tetrode channel map (`0..3, 4..7, … 28..31`)
 * that is a KNOWN-INVALID workspace — separate tetrode groups are independent
 * probes whose electrode ids reset to 0..3 per group (see
 * designs.md#channel-map-semantics). That golden file stays frozen and
 * byte-baselined (it is never validated). The new-path builder is the corrected
 * source of truth, so this suite deliberately stops asserting channel-map semantic
 * parity with the legacy fixture: it compares everything *except* the channel map,
 * and separately asserts the corrected map is bounded/valid.
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
  it('builds → merges → encodes to metadata matching the golden fixture, except the channel map (semantic)', () => {
    const { animal, day } = buildRealisticWorkspace();

    const roundTripped = decodeYaml(encodeYaml(mergeDayMetadata(animal, day)));

    const expected = {
      ...decodeYaml(realisticFixture),
      ...REALISTIC_ALWAYS_ON_KEYS,
    };
    // The legacy golden gives the two 'sleep' tasks epoch-specific descriptions
    // (Pre-/Post-task), a known-invalid Spyglass divergence. The corrected builder
    // uses one canonical description per task_name, so normalize the expectation.
    expected.tasks = expected.tasks.map((t) =>
      t.task_name === 'sleep' ? { ...t, task_description: 'Rest in home cage' } : t
    );

    // The channel map intentionally diverges from the legacy golden (see header):
    // the legacy fixture's incrementing map is a known-invalid workspace, so we
    // exclude it from the semantic deep-equal and assert its validity separately.
    const stripChannelMap = (m) => {
      const { ntrode_electrode_group_channel_map: _drop, ...rest } = m;
      return rest;
    };
    expect(stripChannelMap(roundTripped)).toEqual(stripChannelMap(expected));
  });

  it('emits a corrected channel map that resets electrode ids 0..3 per tetrode group (validates clean)', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);

    // Every tetrode group is its own probe → values reset to 0..3, unlike the
    // legacy golden's incrementing 0..31.
    merged.ntrode_electrode_group_channel_map.forEach((ntrode) => {
      expect(Object.values(ntrode.map)).toEqual([0, 1, 2, 3]);
    });
    // And the corrected map carries no channel-bound validation errors.
    const channelIssues = validate(merged).filter((i) =>
      i.code?.startsWith('channel_') || i.code === 'bad_channel_out_of_range'
    );
    expect(channelIssues).toEqual([]);
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

  it('rejects the legacy globally-incrementing channel map (second tetrode 4..7 is invalid)', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);

    // Reintroduce the legacy bug on the second tetrode group: 0..3 → 4..7.
    merged.ntrode_electrode_group_channel_map[1].map = { 0: 4, 1: 5, 2: 6, 3: 7 };

    const issues = validate(merged);
    expect(issues.map((i) => i.code)).toContain('channel_value_out_of_range');
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
