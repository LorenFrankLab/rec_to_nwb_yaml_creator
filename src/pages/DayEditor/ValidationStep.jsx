import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { validate } from '../../validation';
import { groupErrorsByStep } from './validation';
import './DayEditor.scss';

/**
 * ValidationStep - per-day validation summary (Step 4 of Day Editor).
 *
 * Runs the shared {@link validate} routine against the merged animal + day
 * metadata and presents every issue grouped first by severity (errors, then
 * warnings, then info) and, within each severity, by editor step. A top-line
 * summary and an export-readiness indicator are keyed on whether any
 * error-severity issue exists — matching the Export gate, which only unlocks
 * when no errors remain.
 *
 * @param {object} props
 * @param {object} props.mergedDay - Merged animal + day metadata to validate.
 * @returns {JSX.Element}
 */
export default function ValidationStep({ mergedDay }) {
  const issues = useMemo(() => validate(mergedDay || {}), [mergedDay]);

  const bySeverity = useMemo(() => groupBySeverity(issues), [issues]);

  const errorCount = bySeverity.error.length;
  const warningCount = bySeverity.warning.length;
  const infoCount = bySeverity.info.length;
  const ready = errorCount === 0;

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
          ? 'Ready to export — no errors found.'
          : 'Export blocked — resolve all errors below before exporting.'}
      </p>

      {issues.length > 0 && (
        <>
          <SeveritySection title="Errors" severity="error" issues={bySeverity.error} />
          <SeveritySection title="Warnings" severity="warning" issues={bySeverity.warning} />
          <SeveritySection title="Info" severity="info" issues={bySeverity.info} />
        </>
      )}
    </div>
  );
}

ValidationStep.propTypes = {
  mergedDay: PropTypes.object,
};

/**
 * Renders one severity group, with its issues bucketed by editor step.
 * Renders nothing when the group has no issues.
 *
 * @private
 * @param {object} props
 * @param {string} props.title - Visible heading for the severity group.
 * @param {string} props.severity - Severity key (for styling/keys).
 * @param {Array} props.issues - Issues of this severity.
 * @returns {JSX.Element|null}
 */
function SeveritySection({ title, severity, issues }) {
  if (issues.length === 0) return null;

  const byStep = groupErrorsByStep(issues);
  const stepOrder = ['overview', 'devices', 'epochs', 'validation', 'export'];

  return (
    <section className={`validation-group validation-group-${severity}`}>
      <h3>{title} ({issues.length})</h3>
      {stepOrder
        .filter((stepId) => byStep[stepId].length > 0)
        .map((stepId) => (
          <div key={stepId} className="validation-step-group">
            <h4>{STEP_LABELS[stepId]}</h4>
            <ul>
              {byStep[stepId].map((issue, index) => (
                <li key={`${issue.path}-${issue.code}-${index}`} className="validation-issue">
                  <span className="validation-issue-message">{issue.message}</span>
                  {issue.path && <code className="validation-issue-path">{issue.path}</code>}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}

SeveritySection.propTypes = {
  title: PropTypes.string.isRequired,
  severity: PropTypes.string.isRequired,
  issues: PropTypes.arrayOf(PropTypes.object).isRequired,
};

const STEP_LABELS = {
  overview: 'Overview',
  devices: 'Devices',
  epochs: 'Epochs',
  validation: 'Other required fields',
  export: 'Export',
};

/**
 * Partition issues into error / warning / info buckets. Any severity other than
 * error or warning (or absent) is treated as info, so unexpected severities are
 * surfaced rather than dropped.
 *
 * @private
 * @param {Array} issues - Validation issues.
 * @returns {{ error: Array, warning: Array, info: Array }}
 */
function groupBySeverity(issues) {
  const buckets = { error: [], warning: [], info: [] };
  for (const issue of issues) {
    if (issue.severity === 'error') buckets.error.push(issue);
    else if (issue.severity === 'warning') buckets.warning.push(issue);
    else buckets.info.push(issue);
  }
  return buckets;
}
