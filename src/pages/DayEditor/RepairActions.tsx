import { repairTargetForIssue, STEP_LABELS } from '../../domain/validation';
import { groupIssuesByWorkflowCategory } from '../../domain/workflowCategories';
import { humanizeValidationMessage } from '../../domain/humanizeValidationMessage';
import type { RepairableIssue } from '../../domain/repairRouting';
import IssueOwnershipHint from './IssueOwnershipHint';

// Re-export STEP_LABELS so existing importers (ValidationStep) keep working while the
// source of truth lives in domain/validation.js (alongside the routing it labels).
export { STEP_LABELS };

/** The serializable repair command an issue can carry (the UI dispatches it). */
interface RepairCommand {
  type: string;
  key?: string;
  field?: string;
}

/**
 * Whether an issue has an editable in-app target worth routing to. The
 * {@link repairTargetForIssue} contract is the single source of truth: an issue whose
 * repair surface is `none` (read-only identity — `subject_id_slash` / `session_id_slash`)
 * points at a disabled control, so a "Fix in …" button would dead-end. Both repair
 * surfaces (Export's blocked list and the Validation summary) gate their buttons on this
 * so they cannot drift.
 */
export function isRepairable(issue: RepairableIssue): boolean {
  return repairTargetForIssue(issue).surface !== 'none';
}

/**
 * The dedup key for an issue's repair BUTTON. Several issues can share one underlying fix
 * (e.g. a corrupt day geometry override produces both the retagged base schema errors AND a
 * `shadowed_geometry_override`, all routing to the same remove-override control). Collapsing
 * by this key shows every message but only one button per unique (surface, step, focus,
 * command). The executable command is part of the key so two issues sharing a destination
 * but carrying DIFFERENT repairCommands (a per-ntrode removal vs a whole-overrides reset) are
 * not collapsed. Shared by the Export step (via {@link RepairActions}) and the Validation
 * summary so both surfaces dedup identically.
 */
export function repairButtonKey(issue: RepairableIssue): string {
  const { surface, step } = repairTargetForIssue(issue);
  const cmd = issue.repairCommand as RepairCommand | undefined;
  const command = cmd
    ? `${cmd.type}:${cmd.key ?? cmd.field ?? ''}`
    : '';
  return `${surface}:${step ?? ''}:${issue.focusPath || issue.path || ''}:${command}`;
}

interface RepairActionsProps {
  /** Error-severity validation issues to offer repairs for. */
  issues: RepairableIssue[];
  /**
   * Routes to the owning surface. `target` is a Day-Editor step id for `day`-surface issues,
   * or the sentinel `'animal'`; the optional `fieldPath` is a focus target.
   */
  onNavigate: (target: string, fieldPath?: string) => void;
  /** The owning animal's id (for Animal Editor deep-links). */
  animalId?: string;
  /** Executes an issue's `repairCommand` in place (the issue→fix half of the contract). */
  onRepair?: (issue: RepairableIssue) => void;
  /** When true, issues are grouped under user workflow-category headings. */
  groupByCategory?: boolean;
}

/**
 * Shared repair-action list for export-blocking validation issues.
 *
 * Each issue is rendered with its user-facing message and (when {@link isRepairable})
 * a button that routes to the editable OWNER of the fix — not merely the step that
 * displays it. Both the Export step (blocked download) and the Validation summary render
 * this list, so the two surfaces always agree on where a given error is repaired — and
 * on which errors have no repair.
 *
 * Routing uses the {@link repairTargetForIssue} contract: device geometry, channel maps,
 * cameras, data-acquisition devices, and subject identity route to the Animal Editor
 * (where they are editable); session, task/video, day bad-channel overrides, and
 * catch-all issues route to the owning Day-Editor step. The issue path is passed as the
 * field target so the destination can focus/highlight the control when an anchor exists.
 */
export default function RepairActions({ issues, onNavigate, animalId, onRepair, groupByCategory = false }: RepairActionsProps) {
  if (!issues || issues.length === 0) return null;

  // Several issues can share ONE underlying fix — e.g. a corrupt day geometry override
  // produces both the retagged base schema errors AND a `shadowed_geometry_override`, all
  // routing to the same remove-override control. Render every message (each explains a
  // distinct symptom) but COLLAPSE the repair button to one per unique (surface, target),
  // so the user isn't shown a stack of identical "Fix in …" buttons for a single repair.
  // The dedup set is shared across category groups so a fix shown in one group isn't
  // re-buttoned in another.
  const seenTargets = new Set<string>();

  const renderItem = (issue: RepairableIssue, index: number, keyPrefix: string) => {
    let showButton = isRepairable(issue);
    if (showButton) {
      const key = repairButtonKey(issue);
      if (seenTargets.has(key)) showButton = false;
      else seenTargets.add(key);
    }
    return (
      <li key={`${keyPrefix}${issue.path}-${issue.code}-${index}`} className="repair-action-item">
        {/* Humanize for display only — the underlying issue.message stays raw so message-parsing
            consumers (e.g. ImportYamlDialog remediationHint) are unaffected. */}
        <span className="repair-action-message">{humanizeValidationMessage(issue.message)}</span>
        <IssueOwnershipHint issue={issue} />
        {showButton && (
          <RepairActionButton issue={issue} onNavigate={onNavigate} animalId={animalId} onRepair={onRepair} />
        )}
      </li>
    );
  };

  if (groupByCategory) {
    return (
      <div className="repair-action-groups">
        {groupIssuesByWorkflowCategory(issues).map(({ category, label, issues: categoryIssues }) => (
          <div key={category} className="repair-action-group">
            <h4 className="repair-action-group-heading">{label}</h4>
            <ul className="repair-action-list">
              {categoryIssues.map((issue, index) => renderItem(issue, index, `${category}-`))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ul className="repair-action-list">
      {issues.map((issue, index) => renderItem(issue, index, ''))}
    </ul>
  );
}

interface RepairActionButtonProps {
  /** The validation issue this button repairs. */
  issue: RepairableIssue;
  /** Routing callback. */
  onNavigate: (target: string, fieldPath?: string) => void;
  /** The owning animal's id (for Animal Editor deep-links). */
  animalId?: string;
  /** Executes the issue's `repairCommand`. */
  onRepair?: (issue: RepairableIssue) => void;
}

/**
 * The single repair button for one validation issue, shared by the Export step's blocked
 * list and the Validation summary so both route identically. Routes to the editable owner
 * of the issue per the {@link repairTargetForIssue} contract: a `day`-surface issue
 * navigates to its owning Day-Editor step; an `animal`-surface issue hands off to the
 * Animal Editor (via the `'animal'` sentinel). The issue path is passed as the field
 * target so the destination can focus the control.
 */
export function RepairActionButton({ issue, onNavigate, animalId, onRepair }: RepairActionButtonProps) {
  const target = repairTargetForIssue(issue);
  // `none`-surface issues have no editable target; render no button (the caller shows
  // the explanatory message). isRepairable already suppresses these upstream, but guard
  // here too so this component can never produce a dead-end button on its own.
  if (target.surface === 'none') return null;

  // Executable repair: when the issue carries a serializable repairCommand and an executor
  // is wired, the button PERFORMS the documented reset in place instead of navigating to a
  // destination that may render a blank empty state. The label names exactly what is reset
  // (the issue's actionLabel), so a destructive reset is never ambiguous.
  if (issue.repairCommand && typeof onRepair === 'function') {
    return (
      <button
        type="button"
        className="repair-action-button repair-action-button-execute"
        data-repair-surface={target.surface}
        data-repair-command={(issue.repairCommand as RepairCommand).type}
        onClick={() => onRepair(issue)}
      >
        {issue.actionLabel || target.label}
      </button>
    );
  }

  const navTarget = target.surface === 'animal' ? 'animal' : target.step;
  // Prefer an explicit focusPath (the control that PERFORMS the fix) over the raw schema
  // path (which may point at a field with no editable control on the owning surface — e.g.
  // a provenance-retagged geometry error routes to Devices but should focus the day's
  // remove-override control, not the read-only electrode-group field).
  const focusTarget = issue.focusPath || issue.path || undefined;
  return (
    <button
      type="button"
      className="repair-action-button"
      data-repair-surface={target.surface}
      data-animal-id={target.surface === 'animal' ? animalId : undefined}
      onClick={() => onNavigate(navTarget as string, focusTarget)}
    >
      {target.label}
    </button>
  );
}

