import { behavioralEventsDescription } from '../valueList';

/**
 * Parse/join helpers for a behavioral-event (DIO) `description` string.
 *
 * The exported `description` (e.g. `"Din1"`) is the hardware DIO line name: a recognized digital
 * I/O type (`Din`/`Dout`) immediately followed by a line index. The workspace editor collects it
 * through a Type dropdown + a numeric line-index control rather than free text (recognition over
 * recall; prevents a silently malformed line name).
 *
 * This logic is COPIED from the legacy, frozen `SelectInputPairElement.splitTextNumber` and its
 * inline join (`` `${type}${index}` ``) — duplicated here on purpose so the legacy file stays
 * untouched and the parse/join round-trip is byte-identical, keeping the exported YAML unchanged
 * (contract C1).
 */

/**
 * Split a DIO `description` into its Type and line index.
 *
 * @param description - The stored DIO line name, e.g. `"Din1"`.
 * @returns The recognized type (or `''` when the text
 *   is not a known DIO type) and the numeric index (or `''` when there is no single number). An
 *   empty/whitespace description defaults to `{ type: 'Din', index: 1 }`.
 */
export const splitDioDescription = (
  description: string
): { type: string; index: number | string } => {
  if (!description || description.trim() === '') {
    return { type: 'Din', index: 1 };
  }

  const numericPart = description.match(/\d+/g);
  const textPart = description.match(/[a-zA-Z]+/g);
  const knownTypes = behavioralEventsDescription();

  let index: number | string = '';
  let type = '';

  if (textPart && textPart.length === 1 && knownTypes.includes(textPart[0])) {
    [type] = textPart;
  }

  if (numericPart && numericPart.length === 1) {
    const parsedInt = parseInt(numericPart[0], 10);
    index = Number.isNaN(parsedInt) ? 1 : parsedInt;
  }

  return { type, index };
};

/**
 * Join a Type and line index back into the stored `description` string.
 *
 * @param type - The DIO type (e.g. `"Din"`).
 * @param index - The DIO line index (e.g. `1`).
 * @returns The concatenated line name (e.g. `"Din1"`).
 */
export const joinDioDescription = (type: string, index: number | string): string =>
  `${type}${index}`;
