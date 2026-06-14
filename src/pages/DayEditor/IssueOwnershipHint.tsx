import { ownershipForIssue } from '../../domain/workflowOwnership';
import type { RepairableIssue } from '../../domain/repairRouting';
import styles from './IssueOwnershipHint.module.css';

interface IssueOwnershipHintProps {
  /** Issue to describe; forwarded verbatim to `ownershipForIssue` (which is total). */
  issue?: RepairableIssue | null;
}

/**
 * A compact, understated ownership-pattern hint rendered next to a validation/export issue
 * (Phase 8.7 Task 9). It names the ownership pattern's safe next action — "Fix shared animal
 * setup", "Select the item used on this day", "Override this day's technical value", "Pin or fix
 * the configuration version", "Repair recovered data", etc. — so a scientist reads what KIND of
 * fix this is, and it flags when correcting the issue reaches beyond the day in front of them (the
 * phase's blast-radius transparency promise).
 *
 * It is purely additive vocabulary: it does NOT route or re-decide the repair (the route + label
 * stay on {@link RepairActionButton}, owned by `repairTargetForIssue`), and it does NOT regroup
 * issues (grouping stays on the workflow category). The copy is read verbatim from the single
 * ownership descriptor (`ownershipForIssue`), so it cannot drift from the matrix.
 */
export default function IssueOwnershipHint({ issue }: IssueOwnershipHintProps) {
  const descriptor = ownershipForIssue(issue);
  return (
    <span className={styles.hint} data-ownership-pattern={descriptor.pattern}>
      <span className={styles.action}>{descriptor.primaryAction}</span>
      {descriptor.reachesBeyondDay && (
        <span className={styles.reach}>Affects more than this day</span>
      )}
    </span>
  );
}
