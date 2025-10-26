/**
 * HintDisplay - Subtle validation hint component
 *
 * Displays hints from useQuickChecks with aria-live for accessibility.
 * Uses "polite" to announce hints when user pauses, not immediately.
 * Hints are meant to be subtle, non-intrusive feedback while typing.
 *
 * @example
 * const { hint, validate } = useQuickChecks('required');
 * return (
 *   <>
 *     <input onChange={(e) => validate('field', e.target.value)} />
 *     <HintDisplay hint={hint} />
 *   </>
 * );
 */

import React from 'react';
import PropTypes from 'prop-types';

export function HintDisplay({ hint, className = '' }) {
  if (!hint) {
    return null;
  }

  return (
    <div
      className={`validation-hint ${className}`}
      aria-live="polite"  // UX-1: Accessible to screen readers (announces when user pauses)
      aria-atomic="true"
    >
      {hint.message}
    </div>
  );
}

HintDisplay.propTypes = {
  hint: PropTypes.shape({
    severity: PropTypes.oneOf(['hint']).isRequired,
    message: PropTypes.string.isRequired
  }),
  className: PropTypes.string
};
