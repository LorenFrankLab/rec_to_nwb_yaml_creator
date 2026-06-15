import { WORKFLOW_CATEGORY_ORDER } from '../../domain/workflowCategories';
import IssueOwnershipHint from './IssueOwnershipHint';
import type { IssueViewModel } from '../../viewModels/types';

/**
 * The reconstructed-from-view-model repair payload handed to `onRepair`: the day editor's
 * `handleRepair` reads `repairCommand` (dispatched via `applyRepairCommand`) + `repairSurface`. The
 * view-model carries the command as `repair.command` (`id` = the repair type, `payload` = key/field);
 * this rebuilds the `{ type, key?, field? }` shape `applyRepairCommand` expects.
 */
export interface RepairDispatch {
  repairCommand: { type?: string } & Record<string, unknown>;
  repairSurface?: string;
}

interface RepairActionsProps {
  /** Error-severity issues, already classified by the view-model, to offer repairs for. */
  issues: IssueViewModel[];
  /**
   * Routes to the owning surface. `target` is a Day-Editor step id for `day`-surface issues, or the
   * sentinel `'animal'`; the optional `fieldPath` is the focus target.
   */
  onNavigate: (target: string, fieldPath?: string) => void;
  /** The owning animal's id (for Animal Editor deep-links / the button's `data-animal-id`). */
  animalId?: string;
  /** Executes an issue's repair command in place (reconstructed from the view-model). */
  onRepair?: (dispatch: RepairDispatch) => void;
  /** When true, issues are grouped under user workflow-category headings. */
  groupByCategory?: boolean;
}

/**
 * Shared repair-action list for export-blocking validation issues.
 *
 * Each issue is rendered with its (already-humanized) message, its {@link IssueOwnershipHint}, and
 * (when the view-model resolved a repair) a {@link RepairActionButton} that routes to the editable
 * OWNER of the fix. Both the Export step (blocked download) and the Validation summary render this
 * list, so the two surfaces always agree on where a given error is repaired — and on which errors
 * have none.
 *
 * Phase 3-f: this renders straight from the {@link IssueViewModel} list the day-editor view-model
 * produced — the classification (ownership, category, repair surface/kind/route, dedup key) is read,
 * not re-derived. Several issues sharing one underlying fix collapse to a single button via
 * `repairDedupKey` (every message still shows).
 */
export default function RepairActions({
  issues,
  onNavigate,
  animalId,
  onRepair,
  groupByCategory = false,
}: RepairActionsProps) {
  if (!issues || issues.length === 0) return null;

  // Collapse the repair BUTTON to one per unique fix (the view-model's `repairDedupKey`), shared
  // across category groups so a fix shown in one group isn't re-buttoned in another. Every message
  // still renders.
  const seenTargets = new Set<string>();

  const renderItem = (issue: IssueViewModel, index: number, keyPrefix: string) => {
    let showButton = issue.repair != null;
    if (showButton && issue.repairDedupKey != null) {
      if (seenTargets.has(issue.repairDedupKey)) showButton = false;
      else seenTargets.add(issue.repairDedupKey);
    }
    return (
      <li key={`${keyPrefix}${issue.fieldPath ?? ''}-${index}`} className="repair-action-item">
        <span className="repair-action-message">{issue.message}</span>
        <IssueOwnershipHint issue={issue} />
        {showButton && (
          <RepairActionButton issue={issue} onNavigate={onNavigate} animalId={animalId} onRepair={onRepair} />
        )}
      </li>
    );
  };

  if (groupByCategory) {
    // Group by the view-model's category, ordered by the canonical workflow order; the heading is the
    // issue's `categoryLabel` (so the labels can't drift). Matches groupIssuesByWorkflowCategory.
    const byCategory = new Map<string, IssueViewModel[]>();
    for (const issue of issues) {
      const category = issue.category ?? 'day_metadata';
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category)!.push(issue);
    }
    return (
      <div className="repair-action-groups">
        {WORKFLOW_CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => {
          const categoryIssues = byCategory.get(category)!;
          return (
            <div key={category} className="repair-action-group">
              <h4 className="repair-action-group-heading">{categoryIssues[0].categoryLabel}</h4>
              <ul className="repair-action-list">
                {categoryIssues.map((issue, index) => renderItem(issue, index, `${category}-`))}
              </ul>
            </div>
          );
        })}
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
  /** The classified issue view-model this button repairs. */
  issue: IssueViewModel;
  /** Routing callback. */
  onNavigate: (target: string, fieldPath?: string) => void;
  /** The owning animal's id (for Animal Editor deep-links). */
  animalId?: string;
  /** Executes the issue's repair command (reconstructed from the view-model). */
  onRepair?: (dispatch: RepairDispatch) => void;
}

/**
 * The single repair button for one validation issue, shared by the Export step's blocked list and
 * the Validation summary so both behave identically. Rendered straight from the
 * {@link IssueViewModel} repair affordance the day-editor view-model resolved (Phase 3-f):
 *
 * - `repairKind: 'execute'` → PERFORMS the documented reset in place (the view-model command, with an
 *   executor wired) instead of navigating to a destination that may render a blank empty state.
 * - otherwise → navigates to the editable owner: an `animal`-surface issue hands off to the Animal
 *   Editor (the `'animal'` sentinel); a `day`-surface issue navigates to its owning step. The focus
 *   path is passed so the destination can highlight the control.
 */
export function RepairActionButton({ issue, onNavigate, animalId, onRepair }: RepairActionButtonProps) {
  const repair = issue.repair;
  // No resolved repair (a `none`-surface, read-only identity dead-end): render no button (the caller
  // shows the explanatory message + ownership hint).
  if (!repair) return null;

  // Executable repair: the view-model committed this commandable issue to an in-place reset (it
  // carries a repairCommand). Run the command on click — the command id IS the repairCommand type;
  // its payload carries any key/field, reconstructed into the `{ type, key?, field? }` the executor
  // expects. The Day Editor always wires `onRepair`; the optional-call guard keeps an executor-less
  // isolated render from throwing.
  if (issue.repairKind === 'execute') {
    const command = repair.command;
    return (
      <button
        type="button"
        className="repair-action-button repair-action-button-execute"
        data-repair-surface={issue.repairSurface}
        data-repair-command={command?.id}
        onClick={() =>
          onRepair?.({
            repairCommand: { type: command?.id, ...(command?.payload ?? {}) },
            repairSurface: issue.repairSurface,
          })
        }
      >
        {repair.label}
      </button>
    );
  }

  // Navigate to the owning surface. A `day`-surface repair carries the owning step in its
  // navigate-day-section command target; an `animal`-surface repair uses the `'animal'` sentinel.
  const navTarget = issue.repairSurface === 'animal' ? 'animal' : (repair.command?.target?.section as string);
  return (
    <button
      type="button"
      className="repair-action-button"
      data-repair-surface={issue.repairSurface}
      data-animal-id={issue.repairSurface === 'animal' ? animalId : undefined}
      onClick={() => onNavigate(navTarget, issue.repairFocusPath)}
    >
      {repair.label}
    </button>
  );
}
