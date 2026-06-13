import { useMemo } from 'react';
import { validateDay, computeStepStatus } from '../../domain/validation';
import { isExportEnabled, exportBlockReason } from '../../domain/stepGate';
import { DAY_LIFECYCLE, DAY_LIFECYCLE_LABEL, lifecycleForValidDay } from '../../domain/dayLifecycle';
import { groupIssuesByWorkflowCategory } from '../../domain/workflowCategories';
import { humanizeValidationMessage } from '../../domain/humanizeValidationMessage';
import { RepairActionButton, isRepairable, repairButtonKey } from './RepairActions';
import IssueOwnershipHint from './IssueOwnershipHint';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import type { RepairableIssue } from '../../domain/repairRouting';
import './DayEditor.scss';

interface ValidationStepProps extends DayEditorBundle {
  /** Routes a repair action to the step that owns the fix (and an optional field target). */
  onNavigate?: (stepId: string, fieldPath?: string) => void;
  /** Executes an issue's `repairCommand` in place (threaded from DayEditorStepper). */
  onRepair?: (issue: unknown) => void;
}

/**
 * ValidationStep - per-day validation summary (Step 4 of Day Editor).
 *
 * Runs the shared {@link validate} routine against the merged animal + day
 * metadata and presents every issue grouped first by severity (errors, then
 * warnings, then info) and, within each severity, by editor step. A top-line
 * summary and an export-readiness indicator are keyed on whether any
 * error-severity issue exists — matching the Export gate, which only unlocks
 * when no errors remain.
 */
export default function ValidationStep(props: ValidationStepProps) {
  // The shared day bundle comes from DayEditorContext in the Day Editor (an isolated render
  // passes the same fields as props). `onNavigate`/`onRepair` are section-specific, so they stay
  // direct props.
  const { day, mergedDay, animal, animalDays = [], animalKey = undefined } = useDayEditorContext(props);
  const { onNavigate = () => {}, onRepair } = props;
  // The store OWNER KEY (resolved by DayEditorStepper); a stale/missing `animal.id` record field
  // must not misroute an animal-surface repair deep-link. Falls back to `animal.id` for isolated
  // renders that don't pass it.
  const ownerKey = animalKey ?? animal?.id;
  // `animalDays` MUST be threaded so this summary reflects the SAME export gate the Export step
  // and the nav badge enforce — without it the cross-day bad-channel monotonicity block is invisible
  // here and the day can falsely read "ready to export" while Export blocks the download.
  const issues = useMemo(
    () => validateDay(day || {}, mergedDay || {}, animal, animalDays),
    [day, mergedDay, animal, animalDays]
  );

  const bySeverity = useMemo(() => groupBySeverity(issues), [issues]);

  const errorCount = bySeverity.error.length;
  const warningCount = bySeverity.warning.length;
  const infoCount = bySeverity.info.length;
  // Readiness reflects the REAL export gate, not just "no errors": isExportEnabled also requires
  // every prerequisite step (overview/devices/epochs) to be complete. A day with zero validation
  // errors but an incomplete step is NOT ready — saying "Ready to export" there is exactly the
  // confusion this phase removes.
  const stepStatus = useMemo(
    () => computeStepStatus(day || {}, mergedDay || {}, animal, animalDays),
    [day, mergedDay, animal, animalDays]
  );
  const ready = isExportEnabled(stepStatus);
  const blockReason = exportBlockReason(stepStatus);
  // When the day is live-ready, refine the readiness message by its persisted state (saved
  // "Validated" / "Exported" vs merely live "Ready to export") from the SHARED vocabulary, so
  // this surface agrees with Animal Days and the Validation Summary and the user can tell whether
  // the validation is just-passing or actually saved. The phrase is built from the lifecycle
  // label so it can never drift from the other surfaces.
  const readyMessage = useMemo(() => {
    if (!ready) return null;
    switch (lifecycleForValidDay(day?.state)) {
      case DAY_LIFECYCLE.EXPORTED:
        return `${DAY_LIFECYCLE_LABEL.exported} — all checks still pass. This day’s YAML has been downloaded.`;
      case DAY_LIFECYCLE.VALIDATED:
        return `${DAY_LIFECYCLE_LABEL.validated} — all checks pass. This validation has been saved.`;
      default:
        return `${DAY_LIFECYCLE_LABEL.ready} — all checks pass.`;
    }
  }, [ready, day]);

  return (
    <div className="day-editor-section validation-step">
      <h2>Validation Summary</h2>

      <p className="validation-summary-counts">
        {errorCount} {errorCount === 1 ? 'error' : 'errors'},{' '}
        {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
        {infoCount > 0 && `, ${infoCount} ${infoCount === 1 ? 'note' : 'notes'}`}
      </p>

      <p
        className={`validation-readiness validation-readiness-${ready ? 'ready' : 'blocked'}`}
        role="status"
      >
        <span aria-hidden="true">{ready ? '✓' : '✗'}</span>{' '}
        {ready
          ? readyMessage
          : blockReason === 'incomplete-steps' && errorCount === 0
            ? 'Export blocked — complete the required steps (shown in the step indicators) before exporting.'
            : 'Export blocked — resolve all errors below before exporting.'}
      </p>

      {issues.length > 0 && (
        <>
          <SeveritySection title="Errors" severity="error" issues={bySeverity.error} onNavigate={onNavigate} animalId={ownerKey} onRepair={onRepair} />
          <SeveritySection title="Warnings" severity="warning" issues={bySeverity.warning} />
          <SeveritySection title="Info" severity="info" issues={bySeverity.info} />
        </>
      )}
    </div>
  );
}

interface SeveritySectionProps {
  /** Visible heading for the severity group. */
  title: string;
  /** Severity key (for styling/keys). */
  severity: string;
  /** Issues of this severity. */
  issues: RepairableIssue[];
  /** Repair routing callback. Repair actions are offered only for export-blocking errors. */
  onNavigate?: (stepId: string, fieldPath?: string) => void;
  /** The owning animal's id (threaded to animal-surface repair buttons for Animal Editor deep-links). */
  animalId?: string;
  /** Executes an issue's `repairCommand`. */
  onRepair?: (issue: unknown) => void;
}

/**
 * Renders one severity group, with its issues bucketed by user WORKFLOW CATEGORY (Animal
 * setup, Day metadata, Day-specific failed channels, Existing data repair) so the user reads
 * the same buckets as the Animal Workspace setup checklist. Repair routing is unchanged — each
 * button still routes through the canonical `repairTargetForIssue` via `RepairActionButton`.
 * Renders nothing when the group has no issues.
 *
 * @private
 */
function SeveritySection({ title, severity, issues, onNavigate, animalId, onRepair }: SeveritySectionProps) {
  if (issues.length === 0) return null;

  const byCategory = groupIssuesByWorkflowCategory(issues);
  // Only error-severity issues block export, so only they get a repair action.
  const repairable = severity === 'error' && typeof onNavigate === 'function';
  // Collapse duplicate repair BUTTONS across the whole section (every message still shows),
  // matching the Export step's RepairActions so the two surfaces behave identically when
  // several issues share one underlying fix.
  const seenRepairKeys = new Set<string>();

  return (
    <section className={`validation-group validation-group-${severity}`}>
      <h3>{title} ({issues.length})</h3>
      {byCategory.map(({ category, label, issues: categoryIssues }) => (
        <div key={category} className="validation-step-group validation-category-group">
          <h4>{label}</h4>
          <ul>
            {categoryIssues.map((issue, index) => {
              let showButton = repairable && isRepairable(issue);
              if (showButton) {
                const key = repairButtonKey(issue);
                if (seenRepairKeys.has(key)) showButton = false;
                else seenRepairKeys.add(key);
              }
              return (
                <li key={`${issue.path}-${issue.code}-${index}`} className="validation-issue">
                  {/* Display-only humanization; issue.message stays raw for parsers. */}
                  <span className="validation-issue-message">{humanizeValidationMessage(issue.message)}</span>
                  {issue.path && <code className="validation-issue-path">{issue.path}</code>}
                  {/* Ownership hint only on export-blocking errors — the same gate as the repair
                      button. A non-blocking warning/info already carries its own specific advice;
                      adding a generic pattern action + the emphasized cross-day cue there would be
                      noise (and can read as contradicting the advisory's own actionLabel). */}
                  {severity === 'error' && <IssueOwnershipHint issue={issue} />}
                  {showButton && (
                    // `showButton` implies `repairable`, which requires `onNavigate` to be a
                    // function — the non-null assertion is sound (TS won't narrow it across the const).
                    <RepairActionButton issue={issue} onNavigate={onNavigate!} animalId={animalId} onRepair={onRepair} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * Partition issues into error / warning / info buckets. Any severity other than
 * error or warning (or absent) is treated as info, so unexpected severities are
 * surfaced rather than dropped.
 *
 * @private
 */
function groupBySeverity(issues: RepairableIssue[]): {
  error: RepairableIssue[];
  warning: RepairableIssue[];
  info: RepairableIssue[];
} {
  const buckets: {
    error: RepairableIssue[];
    warning: RepairableIssue[];
    info: RepairableIssue[];
  } = { error: [], warning: [], info: [] };
  for (const issue of issues) {
    if (issue.severity === 'error') buckets.error.push(issue);
    else if (issue.severity === 'warning') buckets.warning.push(issue);
    else buckets.info.push(issue);
  }
  return buckets;
}
