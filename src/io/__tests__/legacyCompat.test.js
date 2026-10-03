/**
 * Exported files must convert with the trodes_to_nwb version the lab is
 * running today, which reads virus_injection[].volume_in_uL, as well as with
 * versions that read the schema key volume_in_ul.
 */

import { describe, it, expect } from 'vitest';
import { withLegacyConverterKeys } from '../legacyCompat';

describe('withLegacyConverterKeys', () => {
  it('mirrors volume_in_ul into the legacy volume_in_uL spelling', () => {
    const form = { virus_injection: [{ name: 'Injection 1', volume_in_ul: 0.6 }] };
    expect(withLegacyConverterKeys(form).virus_injection[0]).toEqual({
      name: 'Injection 1',
      volume_in_ul: 0.6,
      volume_in_uL: 0.6,
    });
  });

  it('overwrites a stale legacy value so both spellings agree', () => {
    const form = { virus_injection: [{ volume_in_ul: 450, volume_in_uL: 0.45 }] };
    const result = withLegacyConverterKeys(form);
    expect(result.virus_injection[0].volume_in_uL).toBe(450);
    expect(result.virus_injection[0].volume_in_ul).toBe(450);
  });

  it('mirrors every injection', () => {
    const form = {
      virus_injection: [{ volume_in_ul: 1 }, { volume_in_ul: 2 }],
    };
    expect(withLegacyConverterKeys(form).virus_injection.map((v) => v.volume_in_uL)).toEqual([1, 2]);
  });

  it('leaves an injection without a volume alone', () => {
    const form = { virus_injection: [{ name: 'no volume' }] };
    expect(withLegacyConverterKeys(form)).toBe(form);
  });

  it('returns the same object when there are no virus injections', () => {
    const form = { virus_injection: [], tasks: [] };
    expect(withLegacyConverterKeys(form)).toBe(form);
  });

  it('tolerates a missing virus_injection section', () => {
    const form = { tasks: [] };
    expect(withLegacyConverterKeys(form)).toBe(form);
  });

  it('does not mutate its input', () => {
    const form = { virus_injection: [{ volume_in_ul: 0.6 }] };
    const snapshot = structuredClone(form);
    withLegacyConverterKeys(form);
    expect(form).toEqual(snapshot);
  });
});
