import { describe, it, expect } from 'vitest';
import { duplicateBehavioralEventDescriptions } from '../behavioralEvents';

describe('duplicateBehavioralEventDescriptions', () => {
  it('finds descriptions used by more than one event', () => {
    const events = [{ description: 'nose poke' }, { description: 'nose poke' }, { description: 'lick' }];
    expect([...duplicateBehavioralEventDescriptions(events)]).toEqual(['nose poke']);
  });

  it('compares RAW strings — trailing whitespace is a DIFFERENT description (matches the export gate)', () => {
    // The converter keys DIO channels by the raw description, so "x" and "x " are distinct and must
    // NOT be flagged as a collision (a prior false-positive when the inline gate trimmed).
    expect([...duplicateBehavioralEventDescriptions([{ description: 'nose poke' }, { description: 'nose poke ' }])]).toEqual([]);
  });

  it('treats a whitespace-only description as a real value (a duplicate IS flagged)', () => {
    expect([...duplicateBehavioralEventDescriptions([{ description: '  ' }, { description: '  ' }])]).toEqual(['  ']);
  });

  it('skips absent descriptions (undefined/null/"") and is shape-tolerant', () => {
    expect([...duplicateBehavioralEventDescriptions([{ description: '' }, { description: '' }, {}, { description: null }])]).toEqual([]);
    expect([...duplicateBehavioralEventDescriptions(null)]).toEqual([]);
  });
});
