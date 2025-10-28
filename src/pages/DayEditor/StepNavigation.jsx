import PropTypes from 'prop-types';

/**
 * Step Navigation - Breadcrumb with validation status indicators
 *
 * Renders a horizontal navigation bar showing all steps in the day editor
 * with visual status indicators (✓ valid, ⚠ incomplete, ✗ error).
 * Export step is disabled until all prerequisite steps are valid.
 *
 * @param {object} props
 * @param {Array} props.steps - Step configuration array
 * @param {string} props.currentStep - Currently active step ID
 * @param {object} props.stepStatus - Status map: { stepId: 'valid'|'incomplete'|'error'|'pending' }
 * @param {Function} props.onNavigate - Navigation callback: (stepId) => void
 * @returns {JSX.Element}
 *
 * @example
 * <StepNavigation
 *   steps={[{ id: 'overview', label: 'Overview' }, ...]}
 *   currentStep="overview"
 *   stepStatus={{ overview: 'valid', devices: 'incomplete' }}
 *   onNavigate={(stepId) => console.log(stepId)}
 * />
 */
export default function StepNavigation({ steps, currentStep, stepStatus, onNavigate }) {
  const handleNavigate = (stepId) => {
    // Check if step is disabled (Export step until valid)
    if (stepId === 'export' && !isExportEnabled(stepStatus)) {
      return;
    }

    onNavigate(stepId);

    // Move focus to main content after navigation
    requestAnimationFrame(() => {
      const main = document.getElementById('main-content');
      if (main) {
        main.focus();
        main.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  return (
    <nav aria-label="Day editor steps" className="step-navigation">
      <ol className="step-list">
        {steps.map((step, index) => {
          const status = stepStatus[step.id];
          const isCurrent = currentStep === step.id;
          const isDisabled = step.id === 'export' && !isExportEnabled(stepStatus);

          return (
            <li
              key={step.id}
              className={`step-item step-${status} ${isCurrent ? 'current' : ''}`}
            >
              <button
                onClick={() => handleNavigate(step.id)}
                disabled={isDisabled}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${step.label} - ${getStatusLabel(status)}`}
                className="step-button"
              >
                <span className="step-number">{index + 1}</span>
                <span className="step-label">{step.label}</span>
                <span className="step-status-icon" aria-hidden="true">
                  {getStatusIcon(status)}
                </span>
                <span className="sr-only">{getStatusLabel(status)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Get status icon for visual indicator
 *
 * @private
 * @param {string} status - Step status
 * @returns {string} Unicode icon
 */
function getStatusIcon(status) {
  switch (status) {
    case 'valid': return '✓';
    case 'incomplete': return '⚠';
    case 'error': return '✗';
    default: return '○';
  }
}

/**
 * Get status label for screen readers
 *
 * @private
 * @param {string} status - Step status
 * @returns {string} Human-readable status
 */
function getStatusLabel(status) {
  switch (status) {
    case 'valid': return 'Complete';
    case 'incomplete': return 'Incomplete';
    case 'error': return 'Has errors';
    default: return 'Not started';
  }
}

/**
 * Check if all required steps are valid (export enabled)
 *
 * @private
 * @param {object} stepStatus - Status map
 * @returns {boolean} True if export should be enabled
 */
function isExportEnabled(stepStatus) {
  return ['overview', 'devices', 'epochs', 'validation'].every(
    stepId => stepStatus[stepId] === 'valid'
  );
}

StepNavigation.propTypes = {
  steps: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  })).isRequired,
  currentStep: PropTypes.string.isRequired,
  stepStatus: PropTypes.objectOf(
    PropTypes.oneOf(['valid', 'incomplete', 'error', 'pending'])
  ).isRequired,
  onNavigate: PropTypes.func.isRequired,
};
