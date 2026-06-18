import { useState } from 'react';
import { humanizeValidationMessage } from '../domain/humanizeValidationMessage';
import { repairTargetForIssue } from '../domain/repairRouting';
import type { RepairableIssue } from '../domain/repairRouting';
import WarningAcknowledgement from './WarningAcknowledgement';
import styles from './ReadinessBar.module.css';

export interface ReadinessBarProps {
  /** The day's validation issues, pre-computed by the page (from `validateDay`). */
  issues: RepairableIssue[];
  /** Route a blocking issue to the field that fixes it. */
  onFix: (issue: RepairableIssue) => void;
  /**
   * Whether an issue has an actionable in-app fix (so the "Fix" button is worth rendering). The page
   * passes a predicate mirroring its `onFix` routing — an issue with no editable target (e.g. a
   * read-only derived `session_id` slash, or a catch-all issue no tab owns) shows its message WITHOUT
   * a dead button, matching the old `RepairActionButton`'s null-on-no-target behavior. Omitted →
   * every blocking issue gets a button (back-compat).
   */
  canFix?: (issue: RepairableIssue) => boolean;
}

/** A blocking issue is an error; warnings never block export. */
const isBlocking = (issue: RepairableIssue) => issue.severity === 'error';
const isWarning = (issue: RepairableIssue) => issue.severity === 'warning';
const MAX_VISIBLE_ERROR_GROUPS = 3;
const MAX_VISIBLE_ERRORS_PER_GROUP = 3;

interface IssueGroup {
  key: string;
  label: string;
  issues: RepairableIssue[];
}

function sectionForIssue(issue: RepairableIssue): { key: string; label: string } {
  const target = repairTargetForIssue(issue);
  if (target.surface === 'animal') return { key: 'animal', label: 'Animal setup' };
  const path = String(issue.focusPath || issue.path || issue.instancePath || '').replace(/^\//, '').replace(/\//g, '.');
  if (
    path.startsWith('associated_files') ||
    path.startsWith('associated_video_files') ||
    path.includes('fs_gui') ||
    path.includes('task') ||
    path.includes('epoch')
  ) {
    return { key: 'tasks', label: 'Tasks & Files' };
  }
  if (path.includes('behavioral_events') || path.includes('dio_output_name')) {
    return { key: 'dio', label: 'DIO Wiring' };
  }
  if (
    path.includes('ntrode_electrode_group_channel_map') ||
    path.includes('bad_channels') ||
    path.includes('deviceOverrides.bad_channels')
  ) {
    return { key: 'channels', label: 'Failed Channels' };
  }
  if (
    path.includes('data_acq') ||
    path.includes('cameras_used') ||
    path.includes('technical') ||
    path.includes('configurationVersion') ||
    path.includes('deviceOverrides')
  ) {
    return { key: 'recording', label: 'Recording Setup' };
  }
  if (
    path.includes('session') ||
    path.includes('subject.weight') ||
    path.includes('experiment_description') ||
    path.includes('keywords') ||
    path.includes('dataFolder')
  ) {
    return { key: 'daily', label: 'Daily Setup' };
  }
  switch (target.step) {
    case 'epochs':
      return { key: 'tasks', label: 'Tasks & Files' };
    case 'devices':
      return { key: 'recording', label: 'Recording Setup' };
    case 'behavioral':
      return { key: 'dio', label: 'DIO Wiring' };
    case 'overview':
    case 'validation':
    default:
      return { key: 'daily', label: 'Daily Setup' };
  }
}

function groupIssues(issues: RepairableIssue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  issues.forEach((issue) => {
    const section = sectionForIssue(issue);
    const group = groups.get(section.key) ?? { ...section, issues: [] };
    group.issues.push(issue);
    groups.set(section.key, group);
  });
  return [...groups.values()];
}

function issueKey(issue: RepairableIssue, index: number): string {
  return `${issue.code ?? ''}:${issue.path ?? issue.instancePath ?? issue.focusPath ?? ''}:${index}`;
}

function displayMessage(issue: RepairableIssue): string {
  return humanizeValidationMessage(issue.message, issue.path ?? issue.instancePath);
}

/**
 * ReadinessBar — the issue-driven export-readiness line. Quiet one-line "Ready to export" when no
 * errors block; a loud bar listing each blocking error with a per-issue "Fix in …" action when
 * something blocks. It is a pure renderer: it has NO validation logic and reads only the issue list
 * it is handed (the page computes it from the authoritative `validateDay`). Warnings alone stay quiet.
 */
const ReadinessBar = ({ issues, onFix, canFix }: ReadinessBarProps) => {
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const blocking = issues.filter(isBlocking);
  const warnings = issues.filter(isWarning);
  const warningGroups = groupIssues(warnings);
  const warningItems = warningGroups.map((group) => ({
    key: group.key,
    label: group.label,
    warnings: group.issues.map((issue) => ({ message: displayMessage(issue) })),
  }));

  const warningsDisclosure = warnings.length > 0 ? (
    <details className={styles.warnings}>
      <summary>
        {warnings.length} warning{warnings.length === 1 ? '' : 's'} to review
        {warningsAcknowledged ? ' — reviewed' : ''}
      </summary>
      <WarningAcknowledgement
        items={warningItems}
        acknowledged={warningsAcknowledged}
        onChange={setWarningsAcknowledged}
        itemSingular="section"
        itemPlural="sections"
      />
    </details>
  ) : null;

  if (blocking.length === 0) {
    return (
      <div className={`${styles.bar} ${styles.ready}`} role="status" aria-live="polite">
        <div className={styles.readyLine}>
          <span className={styles.icon} aria-hidden="true">
            ✓
          </span>
          Ready to export
        </div>
        {warningsDisclosure}
      </div>
    );
  }

  const count = blocking.length;
  const heading = count === 1 ? '1 issue blocks export' : `${count} issues block export`;
  const groups = groupIssues(blocking);
  const visibleGroups = groups.slice(0, MAX_VISIBLE_ERROR_GROUPS);
  const hiddenGroupCount = groups.length - visibleGroups.length;
  const summary = visibleGroups
    .map((group) => `${group.issues.length} in ${group.label}`)
    .join(' · ');

  return (
    <div className={`${styles.bar} ${styles.blocked}`} role="alert">
      <p className={styles.heading}>
        <span className={styles.icon} aria-hidden="true">
          ⚠
        </span>
        {heading}
      </p>
      <p className={styles.summary}>{summary}</p>
      <ul className={styles.issues}>
        {visibleGroups.map((group) => (
          <li key={group.key} className={styles.group} data-testid="readiness-error-group">
            <div className={styles.groupHeader}>
              <strong>{group.label}</strong>
              <span>
                {group.issues.length} thing{group.issues.length === 1 ? '' : 's'} to fix
              </span>
            </div>
            <ul className={styles.groupIssues}>
              {group.issues.slice(0, MAX_VISIBLE_ERRORS_PER_GROUP).map((issue, index) => (
                // Several issues can share a `code` (e.g. multiple `required`/`pattern` errors), so the key
                // folds in the path + a positional tiebreaker — `code` alone collides (React duplicate-key
                // warning, and the wrong row could keep stale identity after a fix).
                <li key={issueKey(issue, index)} className={styles.issue}>
                  <span className={styles.message}>{displayMessage(issue)}</span>
                  {/* Render the Fix button only when the issue has an actionable in-app target — an issue
                      with no fixable destination shows its message alone (no dead control). */}
                  {(canFix ? canFix(issue) : true) && (
                    <button type="button" className={styles.fix} onClick={() => onFix(issue)}>
                      {issue.actionLabel ?? 'Fix'}
                    </button>
                  )}
                </li>
              ))}
              {group.issues.length > MAX_VISIBLE_ERRORS_PER_GROUP && (
                <li className={styles.more}>
                  +{group.issues.length - MAX_VISIBLE_ERRORS_PER_GROUP} more in {group.label}
                </li>
              )}
            </ul>
          </li>
        ))}
      </ul>
      {hiddenGroupCount > 0 && (
        <p className={styles.moreGroups}>
          +{hiddenGroupCount} more section{hiddenGroupCount === 1 ? '' : 's'} with fixes
        </p>
      )}
      {warningsDisclosure}
    </div>
  );
};

export default ReadinessBar;
