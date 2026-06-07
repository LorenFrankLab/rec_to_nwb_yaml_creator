import PropTypes from 'prop-types';
import { ownershipForIssue } from '../../domain/workflowOwnership';
import './IssueOwnershipHint.css';

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
 *
 * @param {object} props
 * @param {{code?: string, path?: string, instancePath?: string}} [props.issue] - Issue to describe.
 * @returns {JSX.Element} The ownership hint (always renders — `ownershipForIssue` is total).
 */
export default function IssueOwnershipHint({ issue }) {
  const descriptor = ownershipForIssue(issue);
  return (
    <span className="issue-ownership-hint" data-ownership-pattern={descriptor.pattern}>
      <span className="issue-ownership-action">{descriptor.primaryAction}</span>
      {descriptor.reachesBeyondDay && (
        <span className="issue-ownership-reach">Affects more than this day</span>
      )}
    </span>
  );
}

IssueOwnershipHint.propTypes = {
  issue: PropTypes.shape({
    code: PropTypes.string,
    path: PropTypes.string,
    instancePath: PropTypes.string,
  }),
};

IssueOwnershipHint.defaultProps = {
  issue: null,
};
