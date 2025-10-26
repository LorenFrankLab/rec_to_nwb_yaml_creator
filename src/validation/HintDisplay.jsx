/**
 * HintDisplay - Subtle validation hint component
 *
 * Displays hints from useQuickChecks WITHOUT role="alert" or ARIA announcements.
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
    <div className={`validation-hint ${className}`} style={{
      fontSize: '0.875rem',
      color: '#666',
      marginTop: '0.25rem',
      fontStyle: 'italic'
    }}>
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
