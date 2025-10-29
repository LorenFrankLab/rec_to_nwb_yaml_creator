import PropTypes from 'prop-types';

/**
 * Read-Only Field - Displays inherited field that cannot be edited
 *
 * Renders a standard form input that is both readOnly and disabled to
 * visually indicate it's inherited from the animal and cannot be modified
 * at the day level.
 *
 * @param {object} props
 * @param {string} props.label - Field label
 * @param {string} props.value - Field value (inherited from animal)
 * @param {string} [props.helpText] - Optional help text to display below the field
 * @returns {JSX.Element}
 *
 * @example
 * <ReadOnlyField label="Subject ID" value="remy" />
 */
export default function ReadOnlyField({ label, value, helpText }) {
  // Generate HTML-safe ID from label
  const id = `readonly-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        <span className="sr-only"> (inherited from animal, read-only)</span>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        readOnly
        disabled
        className="read-only-field"
      />
      {helpText && (
        <span className="field-help-text">{helpText}</span>
      )}
    </div>
  );
}

ReadOnlyField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  helpText: PropTypes.string,
};
