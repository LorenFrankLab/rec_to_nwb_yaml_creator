import PropTypes from 'prop-types';

/**
 * Day Editor Section Nav — a tabbed, free-navigation section nav for the Day Editor.
 *
 * Structurally mirrors AnimalView's grouped `section-nav` (a navigation landmark whose
 * active item carries `aria-current="page"`), but the Day Editor is a SINGLE route
 * (`#/day/:id`) whose active section is LOCAL STATE — so each item is a `<button>` that
 * calls `onNavigate(id)`, NOT an `<a href>` link.
 *
 * There is no nav-level gating: EVERY section (including Export) is freely reachable. The
 * export gate survives as a blocked DOWNLOAD ACTION inside ExportStep (which self-checks
 * `isExportEnabled`/`exportBlocked`), not as a nav lock. Each item still shows its
 * `computeStepStatus` glyph (✓ valid / ⚠ incomplete / ✗ error / ○ pending), so a blocked
 * Export remains visible (its ✗/⚠ glyph) while staying clickable.
 *
 * @param {object} props
 * @param {Array<{ label: string, items: Array<{ id: string, label: string }> }>} props.groups
 *   Grouped section descriptors, in display order. Each `item.id` must be a step id.
 * @param {string} props.currentStep - The active section id.
 * @param {object} props.stepStatus - Status map: { stepId: 'valid'|'incomplete'|'error'|'pending' }.
 * @param {Function} props.onNavigate - Section-switch callback: (stepId) => void.
 * @param {number} [props.toFixCount] - Issues remaining to fix; shown on the Validation item if > 0.
 * @returns {JSX.Element}
 */
export default function DayEditorSectionNav({ groups, currentStep, stepStatus, onNavigate, toFixCount }) {
  return (
    <nav className="section-nav" aria-label="Day editor sections">
      {groups.map((group) => (
        <div className="section-nav-group" key={group.label}>
          <div className="section-nav-group-label">{group.label}</div>
          {group.items.map((item) => {
            const status = stepStatus[item.id];
            const active = currentStep === item.id;
            // The to-fix count is information scent on the Validation item only, and only when
            // there is something to fix. The status glyph carries the meaning everywhere else.
            const showCount = item.id === 'validation' && typeof toFixCount === 'number' && toFixCount > 0;
            const countLabel = showCount
              ? `${toFixCount} to fix`
              : null;
            return (
              <button
                key={item.id}
                type="button"
                className={`section-nav-item ${active ? 'is-active' : ''} step-${status}`}
                aria-current={active ? 'page' : undefined}
                aria-label={`${item.label} — ${getStatusLabel(status)}${countLabel ? `, ${countLabel}` : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <span className="section-nav-item-name">{item.label}</span>
                {countLabel && (
                  <span className="section-nav-count" aria-hidden="true">{countLabel}</span>
                )}
                <span className="section-nav-status-icon" aria-hidden="true">
                  {getStatusIcon(status)}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * Visual status glyph for a section.
 *
 * @private
 * @param {string} status - Section status.
 * @returns {string} Unicode glyph.
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
 * Accessible status label for a section (folded into the button's accessible name).
 *
 * @private
 * @param {string} status - Section status.
 * @returns {string} Human-readable status.
 */
function getStatusLabel(status) {
  switch (status) {
    case 'valid': return 'Complete';
    case 'incomplete': return 'Incomplete';
    case 'error': return 'Has errors';
    default: return 'Not started';
  }
}

DayEditorSectionNav.propTypes = {
  groups: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      items: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired,
        })
      ).isRequired,
    })
  ).isRequired,
  currentStep: PropTypes.string.isRequired,
  stepStatus: PropTypes.objectOf(
    PropTypes.oneOf(['valid', 'incomplete', 'error', 'pending'])
  ).isRequired,
  onNavigate: PropTypes.func.isRequired,
  toFixCount: PropTypes.number,
};

DayEditorSectionNav.defaultProps = {
  toFixCount: undefined,
};
