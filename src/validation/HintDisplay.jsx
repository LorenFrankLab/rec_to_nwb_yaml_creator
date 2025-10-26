/**
 * HintDisplay - Subtle validation hint component
 *
 * Displays hints from useQuickChecks with aria-live for accessibility.
 * Uses "assertive" for required fields to announce immediately,
 * "polite" for optional fields to announce when user pauses.
 *
 * Always renders to prevent layout shift - shows non-breaking space when no hint.
 *
 * @example
 * const { hint, validate } = useQuickChecks('required');
 * return (
 *   <>
 *     <input onChange={(e) => validate('field', e.target.value)} />
 *     <HintDisplay hint={hint} isRequired={true} />
 *   </>
 * );
 */

import React from 'react';
import PropTypes from 'prop-types';

export function HintDisplay({ hint, isRequired = false, className = '' }) {
  // P0-1 Fix: Always render to prevent layout shift
  // P0-2 Fix: Add role="status" for accessibility
  // P0-3 Fix: Use assertive for required fields, polite for optional
  return (
    <div
      className={`validation-hint ${className}`}
      role="status"
      aria-live={isRequired ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {hint ? hint.message : '\u00A0'}
    </div>
  );
}

HintDisplay.propTypes = {
  hint: PropTypes.shape({
    severity: PropTypes.oneOf(['hint']).isRequired,
    message: PropTypes.string.isRequired
  }),
  isRequired: PropTypes.bool,
  className: PropTypes.string
};
