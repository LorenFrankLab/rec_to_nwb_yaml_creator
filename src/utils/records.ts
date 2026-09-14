/**
 * @fileoverview The record guard, in one place.
 *
 * "Is this a usable object record?" is the guard every layer applies at the corrupt-persisted-state
 * boundary — decoded YAML, a hydrated localStorage blob, a raw day shape. It was previously
 * redefined, byte-identically, in twenty modules; a single definition means "what counts as a
 * record" cannot drift between the layer that validates a shape and the layer that reads it.
 */

/**
 * Whether `value` is a plain object record: non-null, an object, and not an array.
 *
 * @param value - The candidate value.
 * @returns True for a non-null, non-array object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
