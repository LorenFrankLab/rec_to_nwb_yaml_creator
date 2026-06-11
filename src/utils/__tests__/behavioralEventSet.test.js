import { describe, it, expect } from 'vitest';
import {
  nextInstanceNumber,
  isStandardEventName,
  setChannelName,
} from '../behavioralEventSet';

/**
 * Pure authoring helpers for a day's behavioral-event (DIO) set:
 *  - `nextInstanceNumber` picks the next per-label instance number for auto-numbering a picked name
 *    (`Poke` → `Poke1`/`Poke2`/…), independent per label and never derived from the channel.
 *  - `isStandardEventName` decides whether a name is a standard label or a numbered variant.
 *  - `setChannelName` names a hardware channel in the day set: add, update, or (blank) remove.
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

describe('setChannelName', () => {
  it('adds an event when naming a channel that has none', () => {
    expect(setChannelName([], 'Din1', 'Poke1')).toEqual([{ description: 'Din1', name: 'Poke1' }]);
  });

  it('updates the name of an existing channel in place, preserving position and other fields', () => {
    const events = [
      { description: 'Din1', name: 'Poke1', comments: 'left' },
      { description: 'Dout7', name: 'Pump1' },
    ];
    expect(setChannelName(events, 'Din1', 'Beam1')).toEqual([
      { description: 'Din1', name: 'Beam1', comments: 'left' },
      { description: 'Dout7', name: 'Pump1' },
    ]);
  });

  it('removes the channel from the set when the name is blanked (unused → not exported)', () => {
    const events = [
      { description: 'Din1', name: 'Poke1' },
      { description: 'Dout7', name: 'Pump1' },
    ];
    expect(setChannelName(events, 'Din1', '')).toEqual([{ description: 'Dout7', name: 'Pump1' }]);
    expect(setChannelName(events, 'Din1', '   ')).toEqual([{ description: 'Dout7', name: 'Pump1' }]);
  });

  it('blanking a channel that is not in the set is a no-op', () => {
    const events = [{ description: 'Din1', name: 'Poke1' }];
    expect(setChannelName(events, 'Din5', '')).toEqual(events);
  });

  it('renaming a channel to a name another channel already holds preserves the collision (so the gate can flag it)', () => {
    const events = [
      { description: 'Din1', name: 'Poke1' },
      { description: 'Din2', name: 'Light1' },
    ];
    expect(setChannelName(events, 'Din2', 'Poke1')).toEqual([
      { description: 'Din1', name: 'Poke1' },
      { description: 'Din2', name: 'Poke1' },
    ]);
  });

  it('operates on a SINGLE event: blanking a corrupt duplicate-description channel removes only the first, not its hidden sibling', () => {
    const events = [
      { description: 'Din1', name: 'PokeA' },
      { description: 'Din1', name: 'PokeB' },
      { description: 'Dout7', name: 'Pump1' },
    ];
    // Only the first Din1 is removed; the hidden sibling survives (and now surfaces in the row).
    expect(setChannelName(events, 'Din1', '')).toEqual([
      { description: 'Din1', name: 'PokeB' },
      { description: 'Dout7', name: 'Pump1' },
    ]);
  });

  it('operates on a SINGLE event: updating a corrupt duplicate-description channel updates only the first', () => {
    const events = [
      { description: 'Din1', name: 'PokeA' },
      { description: 'Din1', name: 'PokeB' },
    ];
    expect(setChannelName(events, 'Din1', 'Renamed')).toEqual([
      { description: 'Din1', name: 'Renamed' },
      { description: 'Din1', name: 'PokeB' },
    ]);
  });

  it('does not mutate the input array', () => {
    const events = [{ description: 'Din1', name: 'Poke1' }];
    const next = setChannelName(events, 'Din2', 'Light1');
    expect(events).toEqual([{ description: 'Din1', name: 'Poke1' }]);
    expect(next).not.toBe(events);
  });
});

describe('isStandardEventName', () => {
  const SUGGESTIONS = ['Home box camera', 'Poke', 'Light', 'Pump', 'Run Camera Ticks', 'Sleep'];

  it('accepts an exact (case-insensitive) suggestion match', () => {
    expect(isStandardEventName('Poke', SUGGESTIONS)).toBe(true);
    expect(isStandardEventName('poke', SUGGESTIONS)).toBe(true);
  });

  it('accepts a numbered variant of a suggestion (the auto-numbering output)', () => {
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
