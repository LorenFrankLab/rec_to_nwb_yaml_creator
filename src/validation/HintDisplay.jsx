/**
 * HintDisplay - Validation hint/error component with smart escalation
 *
 * Displays validation feedback from useQuickChecks with two severity levels:
 * - hint (gray): Shown while typing (debounced onChange)
 * - error (red): Shown after blur if field is invalid
 *
 * ARIA attributes escalate automatically:
 * - Hints: role="status", aria-live="polite" (or "assertive" if required)
 * - Errors: role="alert", aria-live="assertive" (always)
 *
 * Always renders to prevent layout shift - shows non-breaking space when no hint.
 *
 * @example
 * const { hint, validate, validateOnBlur } = useQuickChecks('required');
 * return (
 *   <>
 *     <input
 *       id="subject-weight"
 *       aria-describedby="subject-weight-hint"
 *       onInput={(e) => validate('field', e.target.value)}
 *       onBlur={(e) => validateOnBlur('field', e.target.value)}
 *     />
 *     <HintDisplay id="subject-weight-hint" hint={hint} isRequired={true} />
 *   </>
 * );
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 *
 * @param root0
 * @param root0.id
 * @param root0.hint
 * @param root0.isRequired
 * @param root0.className
 */
export function HintDisplay({ id, hint, isRequired = false, className = '' }) {
  const isError = hint?.severity === 'error';

  return (
    <div
      id={id}
      className={`validation-hint ${isError ? 'validation-error' : ''} ${className}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : (isRequired ? 'assertive' : 'polite')}
      aria-atomic="true"
    >
      {hint ? hint.message : '\u00A0'}
    </div>
  );
}

HintDisplay.propTypes = {
  id: PropTypes.string,
  hint: PropTypes.shape({
    severity: PropTypes.oneOf(['hint', 'error']),
    message: PropTypes.string
  }),
  isRequired: PropTypes.bool,
  className: PropTypes.string
};
