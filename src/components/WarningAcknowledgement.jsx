import PropTypes from 'prop-types';
import './WarningAcknowledgement.css';

/**
 * WarningAcknowledgement — a checkbox-gated review of outstanding non-blocking warnings before a
 * batch / valid-only export (Phase 3-6).
 *
 * The export gate keys on error severity only, so warnings (e.g. an imported
 * `inconsistent_location_case`, an orphaned video/file) don't block and can ride an export across N
 * days unnoticed. This lists each affected day → its warning messages (content-explicit, not a bare
 * count) and requires an explicit "I've reviewed these warnings" acknowledgement before the caller
 * lets the download proceed. Reusable by every export surface (the per-animal Validation & Export
 * tab now; the chrome-level batch screen in Phase 4) so the acknowledgement can't drift.
 *
 * @param {object} props
 * @param {Array<{ key: string, label: string, warnings: Array<{ message: string }> }>} props.items
 *   - One entry per day that carries outstanding warnings (days with none are omitted by the caller).
 * @param {boolean} props.acknowledged - Whether the user has checked the acknowledgement.
 * @param {(next: boolean) => void} props.onChange - Called with the new checkbox state.
 * @returns {JSX.Element|null}
 */
export default function WarningAcknowledgement({ items, acknowledged, onChange }) {
  if (!items || items.length === 0) return null;

  const dayCount = items.length;

  return (
    <section className="export-warning-ack" role="group" aria-label="Outstanding warnings to review">
      <p className="export-warning-ack-lead">
        {dayCount} {dayCount === 1 ? 'day has' : 'days have'} non-blocking warnings. They won&apos;t
        stop export, but review them first — a silent issue can multiply across days:
      </p>
      <ul className="export-warning-ack-list">
        {items.map((item) => (
          <li key={item.key} className="export-warning-ack-day">
            <strong>{item.label}</strong>
            <ul>
              {item.warnings.map((warning, index) => (
                <li key={index}>{warning.message}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <label className="export-warning-ack-confirm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => onChange(event.target.checked)}
        />
        I&apos;ve reviewed these warnings
      </label>
    </section>
  );
}

WarningAcknowledgement.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      warnings: PropTypes.arrayOf(PropTypes.shape({ message: PropTypes.string })).isRequired,
    })
  ).isRequired,
  acknowledged: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
};
