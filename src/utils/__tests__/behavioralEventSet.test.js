import { describe, it, expect } from 'vitest';
import {
  nextInstanceNumber,
  mergeTemplateRows,
  isStandardEventName,
} from '../behavioralEventSet';
import { duplicateBehavioralEventDescriptions } from '../../validation/behavioralEvents';

/**
 * Pure authoring helpers for a day's behavioral-event (DIO) set:
 *  - `nextInstanceNumber` picks the next per-label instance number for auto-numbering a picked name
 *    (`Poke` → `Poke1`/`Poke2`/…), independent per label and never derived from the channel.
 *  - `mergeTemplateRows` merges a standard-set template into the day set, skipping any row whose
 *    name OR description already exists, so it can never introduce a Rule 14 (duplicate name) or
 *    Rule 17 (duplicate description) collision.
 */
describe('nextInstanceNumber', () => {
  it('is 1 for a label with no existing instances', () => {
    expect(nextInstanceNumber('Poke', [])).toBe(1);
  });

  it('is 2 when one numbered instance already exists', () => {
    expect(nextInstanceNumber('Poke', [{ name: 'Poke1', description: 'Din1' }])).toBe(2);
  });

  it('counts per label independently (Light is unaffected by existing Pokes)', () => {
    const events = [
      { name: 'Poke1', description: 'Din1' },
      { name: 'Poke2', description: 'Din2' },
    ];
    expect(nextInstanceNumber('Light', events)).toBe(1);
  });

  it('is derived from the name, NEVER the DIO channel index', () => {
    // A pump wired to Dout7 with no prior Pump-named event is still Pump1, not Pump7.
    expect(nextInstanceNumber('Pump', [{ name: 'Foo', description: 'Dout7' }])).toBe(1);
  });

  it('stays collision-safe past a gap (one beyond the max instance, not the count)', () => {
    // count would give 3 (collides with the existing Poke3); max+1 gives 4 (safe).
    const events = [
      { name: 'Poke1', description: 'Din1' },
      { name: 'Poke3', description: 'Din3' },
    ];
    expect(nextInstanceNumber('Poke', events)).toBe(4);
  });

  it('does not treat an unnumbered exact-label name as an instance', () => {
    // "Poke" (no digits) is a distinct name; the first numbered instance is still Poke1.
    expect(nextInstanceNumber('Poke', [{ name: 'Poke', description: 'Din1' }])).toBe(1);
  });

  it('escapes regex metacharacters in the label', () => {
    expect(nextInstanceNumber('A+B', [{ name: 'A+B2', description: 'Din2' }])).toBe(3);
  });

  it('tolerates a non-array / missing names', () => {
    expect(nextInstanceNumber('Poke', undefined)).toBe(1);
    expect(nextInstanceNumber('Poke', [{ description: 'Din1' }])).toBe(1);
  });
});

describe('mergeTemplateRows', () => {
  const pokes = [
    { name: 'Poke1', description: 'Din1' },
    { name: 'Poke2', description: 'Din2' },
    { name: 'Poke3', description: 'Din3' },
  ];

  it('adds every row when the day set is empty', () => {
    const { merged, added, skipped } = mergeTemplateRows([], pokes);
    expect(merged).toEqual(pokes);
    expect(added).toEqual(pokes);
    expect(skipped).toEqual([]);
  });

  it('appends to a non-empty set without disturbing existing rows', () => {
    const existing = [{ name: 'Pump1', description: 'Dout7' }];
    const { merged } = mergeTemplateRows(existing, pokes);
    expect(merged).toEqual([{ name: 'Pump1', description: 'Dout7' }, ...pokes]);
  });

  it('is idempotent: re-applying skips rows whose name AND description already exist', () => {
    const { merged, added, skipped } = mergeTemplateRows(pokes, pokes);
    expect(merged).toEqual(pokes);
    expect(added).toEqual([]);
    expect(skipped).toEqual(pokes);
  });

  it('skips a row whose description collides even when its name is new (Rule 17 safe)', () => {
    const existing = [{ name: 'Other', description: 'Din1' }];
    const { merged, added, skipped } = mergeTemplateRows(existing, [
      { name: 'Poke1', description: 'Din1' },
    ]);
    expect(added).toEqual([]);
    expect(skipped).toEqual([{ name: 'Poke1', description: 'Din1' }]);
    expect(merged).toEqual(existing);
  });

  it('skips a row whose name collides even when its description is new (Rule 14 safe)', () => {
    const existing = [{ name: 'Poke1', description: 'Dout9' }];
    const { added, skipped } = mergeTemplateRows(existing, [
      { name: 'Poke1', description: 'Din1' },
    ]);
    expect(added).toEqual([]);
    expect(skipped).toEqual([{ name: 'Poke1', description: 'Din1' }]);
  });

  it('dedups within the applied batch (a second row reusing a description is skipped)', () => {
    const { added } = mergeTemplateRows([], [
      { name: 'A', description: 'Din1' },
      { name: 'B', description: 'Din1' },
    ]);
    expect(added).toEqual([{ name: 'A', description: 'Din1' }]);
  });

  it('produces a set with NO duplicate name or description after a partial-overlap merge', () => {
    const existing = [{ name: 'Poke1', description: 'Din1' }];
    const { merged } = mergeTemplateRows(existing, pokes);
    const names = merged.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    expect(duplicateBehavioralEventDescriptions(merged).size).toBe(0);
  });
});

describe('isStandardEventName', () => {
  const SUGGESTIONS = ['Home box camera', 'Poke', 'Light', 'Pump', 'Run Camera Ticks', 'Sleep'];

  it('accepts an exact (case-insensitive) suggestion match', () => {
    expect(isStandardEventName('Poke', SUGGESTIONS)).toBe(true);
    expect(isStandardEventName('poke', SUGGESTIONS)).toBe(true);
  });

  it('accepts a numbered variant of a suggestion (the auto-numbering/template output)', () => {
    // The app generates these, so they must not be flagged as "not a standard event name".
    expect(isStandardEventName('Poke1', SUGGESTIONS)).toBe(true);
    expect(isStandardEventName('Light12', SUGGESTIONS)).toBe(true);
    expect(isStandardEventName('Home box camera1', SUGGESTIONS)).toBe(true);
  });

  it('rejects a free-typed name that is neither a suggestion nor a numbered variant', () => {
    expect(isStandardEventName('beam_break', SUGGESTIONS)).toBe(false);
    expect(isStandardEventName('reward_left', SUGGESTIONS)).toBe(false);
  });

  it('does not accept a numbered string for a label that is not a suggestion', () => {
    expect(isStandardEventName('Widget3', SUGGESTIONS)).toBe(false);
  });

  it('treats an empty / whitespace name as standard (gated elsewhere as required, not nudged)', () => {
    expect(isStandardEventName('', SUGGESTIONS)).toBe(true);
    expect(isStandardEventName('   ', SUGGESTIONS)).toBe(true);
  });
});
