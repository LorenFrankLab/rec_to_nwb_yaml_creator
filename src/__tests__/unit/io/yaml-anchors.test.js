/**
 * @file Tests for YAML anchors and aliases in decodeYaml / encodeYaml
 *
 * Function location: src/io/yaml
 *
 * PyYAML writes an anchor (`&id001`) and aliases (`*id001`) when a lab script dumps one dict or
 * list in several places, e.g. one channel map shared by every ntrode. The `yaml` parser turns
 * those into ONE shared JS object, and an edit to one ntrode then changed all of them (ticking a
 * bad channel on tetrode 1 marked it bad on every tetrode). decodeYaml must return independent
 * copies, refuse a file whose alias points back into its own anchor, and encodeYaml must never
 * write anchors or aliases.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { decodeYaml, encodeYaml } from '../../../io/yaml';

/** A channel-map section the way PyYAML's safe_dump writes it when every ntrode shares the map. */
const ANCHORED_NTRODES = `ntrode_electrode_group_channel_map:
- ntrode_id: 1
  electrode_group_id: 0
  bad_channels: &id001 []
  map: &id002
    '0': 0
    '1': 1
    '2': 2
    '3': 3
- ntrode_id: 2
  electrode_group_id: 1
  bad_channels: *id001
  map: *id002
- ntrode_id: 3
  electrode_group_id: 2
  bad_channels: *id001
  map: *id002
`;

describe('decodeYaml() with anchors and aliases', () => {
  it('returns an independent copy for every alias', () => {
    const ntrodes = decodeYaml(ANCHORED_NTRODES).ntrode_electrode_group_channel_map;

    expect(ntrodes[1].map).not.toBe(ntrodes[0].map);
    expect(ntrodes[2].map).not.toBe(ntrodes[0].map);
    expect(ntrodes[1].bad_channels).not.toBe(ntrodes[0].bad_channels);
    expect(ntrodes[2].bad_channels).not.toBe(ntrodes[1].bad_channels);
  });

  it('keeps the values the aliases stand for', () => {
    const ntrodes = decodeYaml(ANCHORED_NTRODES).ntrode_electrode_group_channel_map;

    ntrodes.forEach((ntrode) => {
      expect(ntrode.map).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
      expect(ntrode.bad_channels).toEqual([]);
    });
    expect(decodeYaml('a: &v hello\nb: *v\n')).toEqual({ a: 'hello', b: 'hello' });
  });

  it('lets one ntrode change without changing the others', () => {
    const ntrodes = decodeYaml(ANCHORED_NTRODES).ntrode_electrode_group_channel_map;

    ntrodes[0].bad_channels.push(2);
    ntrodes[0].map[1] = -1;

    expect(ntrodes[0].bad_channels).toEqual([2]);
    expect(ntrodes[0].map).toEqual({ 0: 0, 1: -1, 2: 2, 3: 3 });
    [ntrodes[1], ntrodes[2]].forEach((ntrode) => {
      expect(ntrode.bad_channels).toEqual([]);
      expect(ntrode.map).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
    });
  });

  it('copies nested shared objects at every level', () => {
    const decoded = decodeYaml(`base: &base
  inner: &inner {list: [1, 2]}
  again: *inner
copy: *base
`);

    expect(decoded.copy).toEqual(decoded.base);
    expect(decoded.copy).not.toBe(decoded.base);
    expect(decoded.base.again).not.toBe(decoded.base.inner);
    expect(decoded.copy.inner.list).not.toBe(decoded.base.inner.list);
  });

  it('refuses a mapping whose alias points back into its own anchor', () => {
    expect(() => decodeYaml('subject: &s\n  self: *s\n')).toThrow(/refers to itself/);
  });

  it('refuses a list whose alias points back into its own anchor', () => {
    expect(() => decodeYaml('cameras: &c\n  - *c\n')).toThrow(/refers to itself/);
  });

  it("keeps the yaml library's limit on alias expansion", () => {
    const laughs = [
      'a: &a [lol, lol, lol, lol, lol, lol, lol, lol, lol]',
      'b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a]',
      'c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b]',
      'd: &d [*c, *c, *c, *c, *c, *c, *c, *c, *c]',
    ].join('\n');

    expect(() => decodeYaml(laughs)).toThrow(/Excessive alias count/);
  });

  it('keeps a "__proto__" key as plain data', () => {
    const decoded = decodeYaml('__proto__:\n  polluted: true\nlab: Frank\n');

    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    expect(Object.hasOwn(decoded, '__proto__')).toBe(true);
    expect(decoded.polluted).toBeUndefined();
    expect(decoded.lab).toBe('Frank');
  });

  it('decodes files without anchors exactly as before (golden fixtures re-encode byte for byte)', () => {
    const goldenDir = path.join(__dirname, '../../fixtures/golden');
    [
      '20230622_sample_metadata.yml',
      '20230622_sample_metadataProbeReconfig.yml',
      'minimal-valid.yml',
      'realistic-session.yml',
    ].forEach((name) => {
      const golden = fs.readFileSync(path.join(goldenDir, name), 'utf8');
      expect(encodeYaml(decodeYaml(golden))).toBe(golden);
    });
  });
});

describe('encodeYaml() never writes anchors or aliases', () => {
  it('writes a shared object out in full at every place it appears', () => {
    const sharedMap = { 0: 0, 1: 1, 2: 2, 3: 3 };
    const sharedBadChannels = [];
    const model = {
      ntrode_electrode_group_channel_map: [0, 1, 2].map((index) => ({
        ntrode_id: index + 1,
        electrode_group_id: index,
        bad_channels: sharedBadChannels,
        map: sharedMap,
      })),
    };

    const yaml = encodeYaml(model);

    expect(yaml).not.toMatch(/[&*]a\d/);
    // The same bytes as the same data with nothing shared (JSON has no references).
    expect(yaml).toBe(encodeYaml(JSON.parse(JSON.stringify(model))));
  });
});
