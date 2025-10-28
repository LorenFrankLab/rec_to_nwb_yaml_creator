import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Save Indicator - Visual feedback for auto-save status
 *
 * Shows a status indicator that transitions from "Saving..." to "Saved X ago"
 * after auto-save completes. Displays error messages if save fails.
 *
 * @param {object} props
 * @param {string|null} props.lastSaved - ISO timestamp of last save
 * @param {string|null} props.error - Error message if save failed
 * @returns {JSX.Element|null}
 *
 * @example
 * <SaveIndicator
 *   lastSaved="2023-06-22T14:30:00.000Z"
 *   error={null}
 * />
 */
export default function SaveIndicator({ lastSaved, error }) {
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!lastSaved) return;

    // Show "Saving..." briefly, then "Saved ✓"
    setStatus('saving');
    const timer = setTimeout(() => setStatus('saved'), 500);

    return () => clearTimeout(timer);
  }, [lastSaved]);

  // Error takes precedence
  if (error) {
    return (
      <div
        className="save-indicator error"
        role="alert"
        aria-live="assertive"
      >
        <span className="icon" aria-hidden="true">✗</span>
        <span>{error}</span>
      </div>
    );
  }

  // No save yet
  if (!lastSaved) return null;

  const timeAgo = formatTimeAgo(lastSaved);

  return (
    <div
      className={`save-indicator ${status}`}
      role="status"
      aria-live="polite"
      aria-label={status === 'saving' ? 'Saving changes' : `Saved ${timeAgo}`}
    >
      {status === 'saving' && (
        <>
          <span className="spinner" aria-hidden="true">⟳</span>
          <span>Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <span className="checkmark" aria-hidden="true">✓</span>
          <span>Saved {timeAgo}</span>
        </>
      )}
    </div>
  );
}

/**
 * Format timestamp as "just now", "2 min ago", etc.
 *
 * @private
 * @param {string} isoTimestamp - ISO timestamp
 * @returns {string} Human-readable time ago string
 */
function formatTimeAgo(isoTimestamp) {
  const seconds = Math.floor((Date.now() - new Date(isoTimestamp)) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

SaveIndicator.propTypes = {
  lastSaved: PropTypes.string,
  error: PropTypes.string,
};

SaveIndicator.defaultProps = {
  lastSaved: null,
  error: null,
};
