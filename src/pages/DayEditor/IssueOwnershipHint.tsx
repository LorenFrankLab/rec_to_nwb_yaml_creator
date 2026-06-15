import type { IssueViewModel } from '../../viewModels/types';
import styles from './IssueOwnershipHint.module.css';

interface IssueOwnershipHintProps {
  /** The classified issue view-model whose ownership pattern/action/reach this hint renders. */
  issue: IssueViewModel;
}

/**
 * A compact, understated ownership-pattern hint rendered next to a validation/export issue
 * (Phase 8.7 Task 9). It names the ownership pattern's safe next action — "Fix shared animal
 * setup", "Select the item used on this day", "Override this day's technical value", "Pin or fix
 * the configuration version", "Repair recovered data", etc. — so a scientist reads what KIND of
 * fix this is, and it flags when correcting the issue reaches beyond the day in front of them (the
 * phase's blast-radius transparency promise).
 *
 * It renders the classification straight off the {@link IssueViewModel} (Phase 3-f): the
 * `ownership` pattern + `ownershipAction` + `reachesBeyondDay` the builder resolved from
 * `ownershipForIssue`, so the hint re-decides nothing. It does NOT route the repair (that stays on
 * {@link RepairActionButton}) and does NOT regroup issues (grouping is the workflow category).
 */
export default function IssueOwnershipHint({ issue }: IssueOwnershipHintProps) {
  return (
    <span className={styles.hint} data-ownership-pattern={issue.ownership}>
      <span className={styles.action}>{issue.ownershipAction}</span>
      {issue.reachesBeyondDay && (
        <span className={styles.reach}>Affects more than this day</span>
      )}
    </span>
  );
}
