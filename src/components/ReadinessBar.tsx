import type { RepairableIssue } from '../domain/repairRouting';
import styles from './ReadinessBar.module.css';

export interface ReadinessBarProps {
  /** The day's validation issues, pre-computed by the page (from `validateDay`). */
  issues: RepairableIssue[];
  /** Route a blocking issue to the field that fixes it. */
  onFix: (issue: RepairableIssue) => void;
}

/** A blocking issue is an error; warnings never block export. */
const isBlocking = (issue: RepairableIssue) => issue.severity === 'error';

/**
 * ReadinessBar — the issue-driven export-readiness line. Quiet one-line "Ready to export" when no
 * errors block; a loud bar listing each blocking error with a per-issue "Fix in …" action when
 * something blocks. It is a pure renderer: it has NO validation logic and reads only the issue list
 * it is handed (the page computes it from the authoritative `validateDay`). Warnings alone stay quiet.
 */
const ReadinessBar = ({ issues, onFix }: ReadinessBarProps) => {
  const blocking = issues.filter(isBlocking);

  if (blocking.length === 0) {
    return (
      <div className={`${styles.bar} ${styles.ready}`} role="status" aria-live="polite">
        <span className={styles.icon} aria-hidden="true">
          ✓
        </span>
        Ready to export
      </div>
    );
  }

  const count = blocking.length;
  const heading = count === 1 ? '1 issue blocks export' : `${count} issues block export`;

  return (
    <div className={`${styles.bar} ${styles.blocked}`} role="alert">
      <p className={styles.heading}>
        <span className={styles.icon} aria-hidden="true">
          ⚠
        </span>
        {heading}
      </p>
      <ul className={styles.issues}>
        {blocking.map((issue, index) => (
          <li key={issue.code ?? issue.path ?? issue.message ?? index} className={styles.issue}>
            <span className={styles.message}>{issue.message}</span>
            <button type="button" className={styles.fix} onClick={() => onFix(issue)}>
              {issue.actionLabel ?? 'Fix'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ReadinessBar;
