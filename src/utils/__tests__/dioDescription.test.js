import { describe, it, expect } from 'vitest';
import { splitDioDescription, joinDioDescription } from '../dioDescription';
import { behavioralEventsDescription } from '../../valueList';

/**
 * The DIO `description` string (e.g. "Din1") is the hardware DIO line name. The workspace
 * editor enters it through a Type dropdown + a line-index control; these pure helpers parse a
 * stored string into those two fields and join them back. The parse/join logic is COPIED from
 * the legacy `SelectInputPairElement.splitTextNumber` so the round-trip stays identical and the
 * exported `description` is unchanged (YAML byte-identity, contract C1).
 */
describe('behavioralEventsDescription (DIO type list)', () => {
  it('offers only Din/Dout — the valid digital I/O types', () => {
    // `description` is looked up against the .rec `ECU_digital` stream
    // (trodes_to_nwb get_digitalsignal("ECU_digital", …)), so it must be a real
    // ECU *digital* channel. Accel/Gyro/Mag are analog IMU channels — they are not
    // digital I/O and would fail that lookup, so they must not be offered as DIO types.
    expect(behavioralEventsDescription()).toEqual(['Din', 'Dout']);
  });
});

describe('joinDioDescription', () => {
  it('concatenates the type and the line index into the stored string', () => {
    expect(joinDioDescription('Din', 1)).toBe('Din1');
    expect(joinDioDescription('Dout', 3)).toBe('Dout3');
  });

  it('does not validate its type — concatenates any string (imported/legacy descriptions round-trip)', () => {
    // join is intentionally permissive so an imported prose/analog description is
    // preserved verbatim on re-export; only the authoring dropdown is constrained.
    expect(joinDioDescription('Accel', 0)).toBe('Accel0');
  });

  it('omits the index when it is empty (matches legacy join)', () => {
    expect(joinDioDescription('Din', '')).toBe('Din');
  });
});

describe('splitDioDescription', () => {
  it('splits a recognized type and its numeric index', () => {
    expect(splitDioDescription('Dout03')).toEqual({ type: 'Dout', index: 3 });
    expect(splitDioDescription('Din1')).toEqual({ type: 'Din', index: 1 });
  });

  it('does not recognize analog channels as a DIO type (number is still parsed)', () => {
    // Accel/Gyro/Mag are analog, not valid DIO types — an existing analog description
    // renders with an empty (unrecognized) type so the editor falls back gracefully
    // without crashing (real-data impact is zero; the raw stored string is preserved).
    expect(splitDioDescription('Accel2')).toEqual({ type: '', index: 2 });
    expect(splitDioDescription('Gyro12')).toEqual({ type: '', index: 12 });
  });

  it('defaults an empty/whitespace description to Din / index 1 (legacy default)', () => {
    expect(splitDioDescription('')).toEqual({ type: 'Din', index: 1 });
    expect(splitDioDescription('   ')).toEqual({ type: 'Din', index: 1 });
    expect(splitDioDescription(undefined)).toEqual({ type: 'Din', index: 1 });
  });

  it('leaves the type empty when the text is not a recognized DIO type', () => {
    // Free text like a legacy "Left reward port" has multiple words and no known type.
    expect(splitDioDescription('Left reward port')).toEqual({ type: '', index: '' });
    // Unknown single token is also not recognized.
    expect(splitDioDescription('Foo7')).toEqual({ type: '', index: 7 });
  });

  it('round-trips a canonical description back to the identical string (C1)', () => {
    // Only the valid DIO types round-trip through the guided Type + index controls.
    for (const desc of ['Din1', 'Dout3', 'Din18', 'Dout7']) {
      const { type, index } = splitDioDescription(desc);
      expect(joinDioDescription(type, index)).toBe(desc);
    }
  });
});
