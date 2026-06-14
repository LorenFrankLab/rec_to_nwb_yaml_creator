import PropTypes from 'prop-types';

/**
 * @fileoverview Tolerant PropTypes for RAW (possibly-corrupt) fields at repair destinations.
 *
 * Components that render corrupt persisted state (so the user can repair it) read those
 * fields through shape-safe selectors and MUST NOT emit a dev console warning when the field
 * is the very corruption they exist to surface — a `cameras` that is a string, a `session`
 * that is a scalar. A plain `PropTypes.arrayOf`/`shape` warns on exactly that, contradicting
 * the "corrupt state is first-class" contract. These validators check the WELL-FORMED shape
 * (so a genuinely malformed item is still caught) but stay silent on a present-but-wrong-type
 * value and on an absent value.
 */

/**
 * A tolerant custom PropTypes validator. Matches the prop-types validator call shape (the
 * trailing `componentName` / `location` / `propFullName` / secret are absorbed by `...rest`
 * and forwarded so the delegate is treated as a `checkPropTypes`-driven call).
 */
type RawValidator = (
  props: Record<string, unknown>,
  propName: string,
  ...rest: unknown[]
) => Error | null;

/**
 * A PropType for a raw ARRAY field a repair destination tolerates. Delegates to
 * `PropTypes.arrayOf(itemType)` only when the value is actually an array; a corrupt
 * non-array (or absent) value passes silently.
 */
export function rawArray(itemType: PropTypes.Validator<unknown>): RawValidator {
  const arrayValidator = PropTypes.arrayOf(itemType) as unknown as RawValidator;
  // Forward ALL args (including the trailing ReactPropTypesSecret) so the delegate is treated
  // as a checkPropTypes-driven call, not a manual one.
  return function rawArrayValidator(props, propName, ...rest) {
    if (!Array.isArray(props[propName])) return null; // absent or corrupt — tolerated
    return arrayValidator(props, propName, ...rest);
  };
}

/**
 * A PropType for a raw RECORD field a repair destination tolerates. Delegates to
 * `PropTypes.shape(shape)` only when the value is a plain object record; a corrupt
 * scalar/array (or absent) value passes silently.
 */
export function rawRecord(shape: PropTypes.ValidationMap<Record<string, unknown>>): RawValidator {
  const shapeValidator = PropTypes.shape(shape) as unknown as RawValidator;
  return function rawRecordValidator(props, propName, ...rest) {
    const value = props[propName];
    const isRecord = value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!isRecord) return null; // absent or corrupt — tolerated
    return shapeValidator(props, propName, ...rest);
  };
}
