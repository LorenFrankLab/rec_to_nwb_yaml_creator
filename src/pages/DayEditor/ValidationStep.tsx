import { WORKFLOW_CATEGORY_ORDER } from '../../domain/workflowCategories';
import { RepairActionButton } from './RepairActions';
import type { RepairDispatch } from './RepairActions';
import IssueOwnershipHint from './IssueOwnershipHint';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import type { IssueViewModel, ExportGateViewModel } from '../../viewModels/types';
import './DayEditor.scss';

interface ValidationStepProps extends DayEditorBundle {
  /** Routes a repair action to the step that owns the fix (and an optional field target). */
  onNavigate?: (stepId: string, fieldPath?: string) => void;
  /** Executes an issue's repair command in place (reconstructed from the view-model). */
  onRepair?: (dispatch: RepairDispatch) => void;
  /** The classified issue list from the day-editor view-model (`vm.issues`). */
  issues?: IssueViewModel[];
  /** The export gate from the view-model (`vm.export`) — readiness + the blocking reason. */
  exportGate?: ExportGateViewModel;
}

/**
 * ValidationStep - per-day validation summary (the Day Editor's Validation section).
 *
 * Renders the day-editor view-model's classified issue list (`vm.issues`) grouped first by severity
 * (errors, then warnings) and, within each severity, by user workflow category — so a scientist
 * reads the same buckets as the Animal Workspace setup checklist. The top-line readiness reflects the
 * authoritative export gate (`vm.export`): "Ready to export" / "Validated" / "Exported" when open
 * (the persisted-history phrase), or the blocking reason otherwise. All of this is read from the
 * view-model (Phase 3-f) — the step re-derives no validation, gate, or lifecycle state itself.
 */
export default function ValidationStep(props: ValidationStepProps) {
  // Only the owner key is read from the shared bundle (for the repair buttons' Animal-Editor
  // deep-links); the issue list + gate come from the view-model section props.
  const { animal, animalKey = undefined } = useDayEditorContext(props);
  const { onNavigate = () => {}, onRepair, issues = [], exportGate } = props;
  const ownerKey = animalKey ?? animal?.id;

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const errorCount = errors.length;
  const warningCount = warnings.length;

  // Readiness is the authoritative gate (`vm.export.open` folds in errors, prerequisite steps, the
  // day-in-index policy, and merge state), with the persisted-history phrase from `readyMessage`.
  const ready = exportGate?.open ?? false;

  return (
    <div className="day-editor-section validation-step">
      <h2>Validation Summary</h2>

      <p className="validation-summary-counts">
        {errorCount} {errorCount === 1 ? 'error' : 'errors'},{' '}
        {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
      </p>

      <p
        className={`validation-readiness validation-readiness-${ready ? 'ready' : 'blocked'}`}
        role="status"
      >
        <span aria-hidden="true">{ready ? '✓' : '✗'}</span>{' '}
        {ready
          ? exportGate?.readyMessage
          : errorCount === 0
            ? 'Export blocked — complete the required steps (shown in the step indicators) before exporting.'
            : 'Export blocked — resolve all errors below before exporting.'}
      </p>

      {issues.length > 0 && (
        <>
          <SeveritySection title="Errors" severity="error" issues={errors} onNavigate={onNavigate} animalId={ownerKey} onRepair={onRepair} />
          <SeveritySection title="Warnings" severity="warning" issues={warnings} />
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
  /** Issues of this severity (already classified by the view-model). */
  issues: IssueViewModel[];
  /** Repair routing callback. Repair actions are offered only for export-blocking errors. */
  onNavigate?: (stepId: string, fieldPath?: string) => void;
  /** The owning animal's id (threaded to animal-surface repair buttons for Animal Editor deep-links). */
  animalId?: string;
  /** Executes an issue's repair command. */
  onRepair?: (dispatch: RepairDispatch) => void;
}

/**
 * Renders one severity group, with its issues bucketed by user WORKFLOW CATEGORY (Animal setup, Day
 * metadata, Day-specific failed channels, Existing data repair) in the canonical category order, so
 * the user reads the same buckets as the Animal Workspace setup checklist. Each bucket reads its
 * issues' view-model fields (category/label, ownership, repair surface/kind/route, dedup key) — no
 * re-derivation. Repair affordances are offered only for export-blocking errors. Renders nothing
 * when the group has no issues.
 *
 * @private
 */
function SeveritySection({ title, severity, issues, onNavigate, animalId, onRepair }: SeveritySectionProps) {
  if (issues.length === 0) return null;

  // Only error-severity issues block export, so only they get a repair action.
  const repairable = severity === 'error' && typeof onNavigate === 'function';
  // Collapse duplicate repair BUTTONS across the whole section (every message still shows), via the
  // view-model's dedup key — matching the Export step's RepairActions so the two surfaces behave
  // identically when several issues share one underlying fix.
  const seenRepairKeys = new Set<string>();

  // Bucket by the view-model's workflow category, rendered in the canonical order; heading from the
  // issue's own category label (so labels can't drift).
  const byCategory = new Map<string, IssueViewModel[]>();
  for (const issue of issues) {
    const category = issue.category ?? 'day_metadata';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(issue);
  }

  return (
    <section className={`validation-group validation-group-${severity}`}>
      <h3>{title} ({issues.length})</h3>
      {WORKFLOW_CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => {
        const categoryIssues = byCategory.get(category)!;
        return (
          <div key={category} className="validation-step-group validation-category-group">
            <h4>{categoryIssues[0].categoryLabel}</h4>
            <ul>
              {categoryIssues.map((issue, index) => {
                let showButton = repairable && issue.repair != null;
                if (showButton && issue.repairDedupKey != null) {
                  if (seenRepairKeys.has(issue.repairDedupKey)) showButton = false;
                  else seenRepairKeys.add(issue.repairDedupKey);
                }
                return (
                  <li key={`${issue.fieldPath ?? ''}-${index}`} className="validation-issue">
                    {/* The message is already humanized by the view-model. */}
                    <span className="validation-issue-message">{issue.message}</span>
                    {issue.fieldPath && <code className="validation-issue-path">{issue.fieldPath}</code>}
                    {/* Ownership hint only on export-blocking errors — the same gate as the repair
                        button. A non-blocking warning already carries its own advice. */}
                    {severity === 'error' && <IssueOwnershipHint issue={issue} />}
                    {showButton && (
                      // `showButton` implies `repairable`, which requires `onNavigate` to be a function.
                      <RepairActionButton issue={issue} onNavigate={onNavigate!} animalId={animalId} onRepair={onRepair} />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
