import { humanizeValidationMessage } from '../domain/humanizeValidationMessage';
import { isIncompleteEntryIssue } from '../domain/validationPresentation';
import type { RepairableIssue } from '../domain/repairRouting';
import { isBlockingIssue, isAdvisoryIssue } from '../validation/issueTypes';
import { pluralize } from '../utils/pluralize';
import styles from './ReadinessBar.module.css';

export interface ReadinessBarProps {
  /** The authoritative issues; presentation never changes download eligibility. */
  issues: RepairableIssue[];
  onFix: (issue: RepairableIssue) => void;
  canFix?: (issue: RepairableIssue) => boolean;
  exportGate?: { open: boolean; message: string };
  onReview?: () => void;
}

/** A compact list of the scientist's remaining entry tasks. */
function entrySummary(issues: RepairableIssue[]): string {
  const labels = new Set<string>();
  const videos = issues.filter((issue) => issue.code === 'epoch_video_undeclared').length;
  for (const issue of issues) {
    if (issue.code === 'epoch_video_undeclared') continue;
    if (issue.code === 'copied_task_context_review') labels.add('task context');
    else labels.add(humanizeValidationMessage(issue.message, issue.path ?? issue.instancePath)
      .replace(/ is required\.?$/i, '').replace(/ must have required property /i, ''));
  }
  if (videos) labels.add(`${videos} ${pluralize(videos, 'epoch')} need video files`);
  return [...labels].join(' · ');
}

/** Calm entry guidance; invalid values still have a distinct, actionable error state. */
export default function ReadinessBar({ issues, onFix, canFix, exportGate, onReview }: ReadinessBarProps) {
  const blocking = issues.filter(isBlockingIssue);
  const warnings = issues.filter(isAdvisoryIssue);
  const invalid = blocking.filter((issue) => !isIncompleteEntryIssue(issue));
  const incomplete = blocking.length > 0 || exportGate?.open === false;
  const message = invalid.length > 0
    ? `${invalid.length} ${pluralize(invalid.length, 'issue')} to correct`
    : incomplete ? 'To finish' : 'Ready to export';
  return (
    <div className={`${styles.bar} ${invalid.length ? styles.blocked : incomplete ? styles.incomplete : styles.ready}`}
      role={invalid.length ? 'alert' : 'status'}>
      <div className={styles.summaryLine}>
        <strong>{message}</strong>
        {invalid.length === 0 && incomplete && <span>{blocking.length ? entrySummary(blocking) : exportGate?.message}</span>}
        {onReview && <button type="button" className={styles.reviewLink} onClick={onReview}>Review &amp; export</button>}
      </div>
      {(!onReview || invalid.length > 0) && blocking.length > 0 && (
        <details className={styles.disclosure}>
          <summary>Show required corrections</summary>
          <ul>{blocking.map((issue, index) => <li key={`${issue.code}-${issue.path}-${index}`}>
            <span>{humanizeValidationMessage(issue.message, issue.path ?? issue.instancePath)}</span>
            {(!canFix || canFix(issue)) && <button type="button" className={styles.reviewLink} onClick={() => onFix(issue)}>{issue.actionLabel ?? 'Review entry'}</button>}
          </li>)}</ul>
        </details>
      )}
      {warnings.length > 0 && <details className={styles.disclosure}>
        <summary>{warnings.length} {pluralize(warnings.length, 'warning')} to review</summary>
        <ul>{warnings.map((issue, index) => <li key={index}>{humanizeValidationMessage(issue.message, issue.path ?? issue.instancePath)}</li>)}</ul>
      </details>}
    </div>
  );
}
