import PropTypes from 'prop-types';

/**
 * Save Indicator - Truthful visual feedback for workspace persistence status.
 *
 * Takes the WHOLE workspace `persistence` slice (`useStoreContext().persistence`) and derives
 * its display state internally, so the persistence→indicator field mapping lives in exactly ONE
 * place (a field rename only edits this component, never the call sites). Status is derived from
 * real persistence state, never from an optimistic local timestamp:
 * - `enabled === false`: persistence is off, so the indicator must NOT claim "Saved";
 *   it shows a muted "Not saved (in memory)".
 * - `saveError`: a write failed; shows the error.
 * - `hasPendingWrite`: a debounced write is in flight; shows "Saving…".
 * - `lastSaved`: a write succeeded; shows "Saved <time ago>".
 *
 * @param {object} props
 * @param {object} props.persistence - The workspace persistence slice, with fields
 *   `enabled` (boolean — localStorage persistence active), `lastSaved` (ISO string|null — last
 *   confirmed write), `saveError` (string|null — last write's failure message), and
 *   `hasPendingWrite` (boolean — a debounced write is in flight).
 * @returns {JSX.Element|null}
 */
export default function SaveIndicator({ persistence }) {
  const {
    enabled = true,
    lastSaved = null,
    saveError = null,
    hasPendingWrite = false,
  } = persistence ?? {};
  const error = saveError;
  const pending = hasPendingWrite;

  // Persistence off: never claim "Saved" for in-memory-only state.
  if (!enabled) {
    return (
      <div
        className="save-indicator not-persisted"
        role="status"
        aria-live="polite"
        aria-label="Not saved — changes are in memory only"
      >
        <span>Not saved (in memory)</span>
      </div>
    );
  }

  // A failed write takes precedence over any earlier success.
  if (error) {
    return (
      <div className="save-indicator error" role="alert" aria-live="assertive">
        <span className="icon" aria-hidden="true">✗</span>
        <span>{error}</span>
      </div>
    );
  }

  if (pending) {
    return (
      <div
        className="save-indicator saving"
        role="status"
        aria-live="polite"
        aria-label="Saving changes"
      >
        <span className="spinner" aria-hidden="true">⟳</span>
        <span>Saving…</span>
      </div>
    );
  }

  // Nothing written yet this session.
  if (!lastSaved) return null;

  const timeAgo = formatTimeAgo(lastSaved);

  return (
    <div
      className="save-indicator saved"
      role="status"
      aria-live="polite"
      aria-label={`Saved ${timeAgo}`}
    >
      <span className="checkmark" aria-hidden="true">✓</span>
      <span>Saved {timeAgo}</span>
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
  persistence: PropTypes.shape({
    enabled: PropTypes.bool,
    lastSaved: PropTypes.string,
    saveError: PropTypes.string,
    hasPendingWrite: PropTypes.bool,
  }),
};

SaveIndicator.defaultProps = {
  persistence: null,
};
