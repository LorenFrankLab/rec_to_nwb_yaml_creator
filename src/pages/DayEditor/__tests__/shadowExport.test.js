import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkShadowExport, firstLineDiff } from '../shadowExport';
import * as yaml from '../../../io/yaml';
import { makeAnimalWithCamerasAndDay } from './taskFixtures';

describe('firstLineDiff', () => {
  it('reports the first differing line number and both sides', () => {
    const result = firstLineDiff('a\nb', 'a\nc');
    expect(result).toContain('line 2');
    expect(result).toContain('"b"');
    expect(result).toContain('"c"');
  });

  it('reports a difference when the two strings differ in length', () => {
    const result = firstLineDiff('a\nb', 'a');
    expect(result).toContain('line 2');
  });
});

describe('checkShadowExport', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns ok with a null diff when the encoder is stable', () => {
    const { animal, day } = makeAnimalWithCamerasAndDay();

    const result = checkShadowExport(animal, day);

    expect(result.ok).toBe(true);
    expect(result.diff).toBeNull();
    expect(typeof result.yaml).toBe('string');
    expect(result.yaml.length).toBeGreaterThan(0);
  });

  it('returns not-ok with a diff when the two encodes diverge', () => {
    const { animal, day } = makeAnimalWithCamerasAndDay();
    let calls = 0;
    vi.spyOn(yaml, 'encodeYaml').mockImplementation(() => {
      calls += 1;
      return calls === 1 ? 'line1\nA\n' : 'line1\nB\n';
    });

    const result = checkShadowExport(animal, day);

    expect(result.ok).toBe(false);
    expect(result.diff).toContain('line 2');
    expect(result.diff).toContain('"A"');
    expect(result.diff).toContain('"B"');
  });
});
