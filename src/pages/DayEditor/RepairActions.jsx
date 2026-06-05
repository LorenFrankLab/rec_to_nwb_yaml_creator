import PropTypes from 'prop-types';
import { stepIdForIssue } from './validation';

/**
 * Issue codes with no editable in-app target — the affected field is a read-only
 * identity (the animal's `subject_id`, or the `session_id` derived from it). Routing
 * them to a step would dead-end on a disabled control, so we show the explanatory
 * message (which states the remedy) without a misleading "Fix in …" button.
 *
 * @type {Set<string>}
 */
const NON_REPAIRABLE_CODES = new Set(['subject_id_slash', 'session_id_slash']);

/**
 * Whether an issue has an editable in-app target worth routing to. Slash-id identity
 * errors (`subject_id_slash` / `session_id_slash`) point at read-only fields, so a
 * "Fix in …" button would dead-end on a disabled control — their explanatory message
 * states the remedy instead. Both repair surfaces (Export's blocked list and the
 * Validation summary) gate their buttons on this so they cannot drift.
 *
 * @param {{code?: string}} issue - A validation issue.
 * @returns {boolean} True when a repair button should be offered.
 */
export function isRepairable(issue) {
  return !NON_REPAIRABLE_CODES.has(issue?.code);
}

/**
 * Shared repair-action list for export-blocking validation issues.
 *
 * Each issue is rendered with its user-facing message and (when {@link isRepairable})
 * a button that routes to the step that owns the fix. Both the Export step (blocked
 * download) and the Validation summary render this list, so the two surfaces always
 * agree on where a given error is repaired — and on which errors have no repair.
 *
 * Routing uses the issue metadata available today: {@link stepIdForIssue} maps the
 * issue path to its owning step, and the issue path is passed as the field target
 * so the destination can focus/highlight the control when an anchor exists. When no
 * precise field target is available the destination degrades to the step itself.
 *
 * @param {object} props
 * @param {Array} props.issues - Error-severity validation issues to offer repairs for.
 * @param {(stepId: string, fieldPath?: string) => void} props.onNavigate - Routes to
 *   the owning step, optionally with a field target to focus.
 * @returns {JSX.Element|null}
 */
export default function RepairActions({ issues, onNavigate }) {
  if (!issues || issues.length === 0) return null;

  return (
    <ul className="repair-action-list">
      {issues.map((issue, index) => (
        <li key={`${issue.path}-${issue.code}-${index}`} className="repair-action-item">
          <span className="repair-action-message">{issue.message}</span>
          {isRepairable(issue) && (
            <RepairActionButton issue={issue} onNavigate={onNavigate} />
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The single repair button for one validation issue, shared by the Export step's
 * blocked list and the Validation summary so both route identically. Navigates to
 * the issue's owning step, passing the issue path as the field target.
 *
 * @param {object} props
 * @param {{path?: string, code?: string, message?: string}} props.issue - The issue to repair.
 * @param {(stepId: string, fieldPath?: string) => void} props.onNavigate - Routing callback.
 * @returns {JSX.Element}
 */
export function RepairActionButton({ issue, onNavigate }) {
  const stepId = stepIdForIssue(issue);
  const stepLabel = STEP_LABELS[stepId] || stepId;
  return (
    <button
      type="button"
      className="repair-action-button"
      onClick={() => onNavigate(stepId, issue.path || undefined)}
    >
      Fix in {stepLabel}
    </button>
  );
}

RepairActionButton.propTypes = {
  issue: PropTypes.shape({
    path: PropTypes.string,
    code: PropTypes.string,
    message: PropTypes.string,
  }).isRequired,
  onNavigate: PropTypes.func.isRequired,
};

/**
 * User-facing step names, shared by the repair-action buttons and the Validation
 * summary's step-group headings so the two surfaces cannot drift. The catch-all
 * `validation` step reads as "Other required fields".
 *
 * @type {Record<string, string>}
 */
export const STEP_LABELS = {
  overview: 'Overview',
  devices: 'Devices',
  epochs: 'Epochs',
  validation: 'Other required fields',
  export: 'Export',
};

RepairActions.propTypes = {
  issues: PropTypes.arrayOf(
    PropTypes.shape({
      path: PropTypes.string,
      code: PropTypes.string,
      message: PropTypes.string,
    })
  ).isRequired,
  onNavigate: PropTypes.func.isRequired,
};
