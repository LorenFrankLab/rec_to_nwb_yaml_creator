interface ReadOnlyFieldProps {
  /** Field label. */
  label: string;
  /**
   * Field value (inherited from animal). When a corrupt record loses the field
   * (e.g. a malformed session's read-only session_id), this is `undefined`; it
   * renders as a controlled empty string so the input never flips uncontrolled→controlled.
   */
  value?: string;
  /** Optional help text to display below the field. */
  helpText?: string;
}

/**
 * Read-Only Field - Displays inherited field that cannot be edited
 *
 * Renders a standard form input that is both readOnly and disabled to
 * visually indicate it's inherited from the animal and cannot be modified
 * at the day level.
 *
 * @example
 * <ReadOnlyField label="Subject ID" value="remy" />
 */
export default function ReadOnlyField({ label, value = '', helpText }: ReadOnlyFieldProps) {
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
        value={value ?? ''}
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
