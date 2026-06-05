import { describe, it, expect, vi } from 'vitest';
import PropTypes from 'prop-types';
import { rawArray, rawRecord } from './rawPropTypes';

/**
 * Repair-destination components intentionally accept RAW (possibly corrupt) props — the
 * corruption is first-class state they exist to surface and repair, read through shape-safe
 * selectors. These PropTypes must therefore validate the well-formed shape but stay SILENT
 * on the corrupt shape (no dev console warning that contradicts "corruption is first-class").
 */
// PropTypes.checkPropTypes dedupes identical warnings via an internal cache keyed on the
// message (which includes the component name), so each check uses a unique component name to
// avoid a real warning being swallowed as a duplicate.
let checkCounter = 0;
/**
 *
 * @param validator
 * @param value
 */
function checkPropType(validator, value) {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  checkCounter += 1;
  PropTypes.checkPropTypes({ field: validator }, { field: value }, 'prop', `TestComponent${checkCounter}`);
  const called = errorSpy.mock.calls.length > 0;
  errorSpy.mockRestore();
  return called; // true => a warning was emitted
}

describe('rawArray', () => {
  const validator = rawArray(PropTypes.shape({ id: PropTypes.number.isRequired }));

  it('validates a well-formed array (warns on a bad item)', () => {
    expect(checkPropType(validator, [{ id: 1 }])).toBe(false);
    expect(checkPropType(validator, [{ id: 'oops' }])).toBe(true);
  });

  it('stays silent on a corrupt non-array value (string / object / number)', () => {
    expect(checkPropType(validator, 'nope')).toBe(false);
    expect(checkPropType(validator, {})).toBe(false);
    expect(checkPropType(validator, 42)).toBe(false);
  });

  it('stays silent on an absent value', () => {
    expect(checkPropType(validator, undefined)).toBe(false);
    expect(checkPropType(validator, null)).toBe(false);
  });
});

describe('rawRecord', () => {
  const validator = rawRecord({ session_id: PropTypes.string });

  it('validates a well-formed record (warns on a bad field)', () => {
    expect(checkPropType(validator, { session_id: 's' })).toBe(false);
    expect(checkPropType(validator, { session_id: 5 })).toBe(true);
  });

  it('stays silent on a corrupt non-record value (string / array)', () => {
    expect(checkPropType(validator, 'corrupt')).toBe(false);
    expect(checkPropType(validator, [1, 2])).toBe(false);
  });

  it('stays silent on an absent value', () => {
    expect(checkPropType(validator, undefined)).toBe(false);
    expect(checkPropType(validator, null)).toBe(false);
  });
});
