import PropTypes from 'prop-types';

/**
 * An assertive (`role="alert"`) report of days that were NOT exported normally, with
 * a per-day detail block (the parity diff, or the error that aborted the export).
 *
 * Extracted from `pages/ValidationSummary/index.jsx` (Phase 9c) with no behavior change.
 *
 * @param {object} props
 * @param {string} props.message - Lead sentence describing what happened.
 * @param {Array<{ dayId: string, subjectId: string, date: string, detail?: string }>} props.items
 *   - The affected days; `detail` is rendered in a labelled `<pre>` when present.
 * @param {string} props.detailLabel - Accessible name prefix for each `<pre>` block.
 * @param {string} props.className - Region styling hook.
 * @returns {JSX.Element|null}
 */
export default function ExportReport({ message, items, detailLabel, className }) {
  if (items.length === 0) return null;
  return (
    <div role="alert" className={className}>
      <p>{message}</p>
      <ul>
        {items.map((item) => (
          <li key={item.dayId}>
            <strong>
              {item.subjectId} — {item.date}
            </strong>{' '}
            ({item.dayId})
            {item.detail && (
              <pre
                className="validation-summary-diff"
                aria-label={`${detailLabel} for ${item.subjectId} ${item.date}`}
              >
                {item.detail}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

ExportReport.propTypes = {
  message: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  detailLabel: PropTypes.string.isRequired,
  className: PropTypes.string.isRequired,
};
