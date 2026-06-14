import styles from './ValidationSummary.module.css';

/** One affected day in an {@link ExportReport}. */
interface ExportReportItem {
  dayId: string;
  subjectId: string;
  date: string;
  /** Rendered in a labelled `<pre>` when present (the parity diff or the abort error). */
  detail?: string;
}

interface ExportReportProps {
  /** Lead sentence describing what happened. */
  message: string;
  /** The affected days. */
  items: ExportReportItem[];
  /** Accessible name prefix for each `<pre>` block. */
  detailLabel: string;
  /** Region styling hook. */
  className: string;
}

/**
 * An assertive (`role="alert"`) report of days that were NOT exported normally, with
 * a per-day detail block (the parity diff, or the error that aborted the export).
 *
 * Extracted from `pages/ValidationSummary/index.jsx` (Phase 9c) with no behavior change.
 */
export default function ExportReport({ message, items, detailLabel, className }: ExportReportProps) {
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
                className={styles.diff}
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

