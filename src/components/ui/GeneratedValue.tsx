import styles from './GeneratedValue.module.css';

export interface GeneratedValueProps {
  /**
   * The value to show: the derived name when generated, or the seed for the manual field when
   * overridden. The manual field is uncontrolled, so this only sets its initial text — later edits
   * are owned by the input (surfaced via `onChange`).
   */
  value: string;
  /** True when the value is derived (read-only generated chip); false for a manual override. */
  derived: boolean;
  /** Flip to a manual override (the caller sets `derived=false`). */
  onOverride: () => void;
  /** Restore the derived value (the caller sets `derived=true`). */
  onRevert: () => void;
  /** Override action label (e.g. "Rename" for a video, "Override path" for a statescript). */
  overrideLabel: string;
  /** Edit handler for the manual field (wired by the consuming surface). */
  onChange?: (value: string) => void;
  /** Accessible label for the manual input. */
  ariaLabel?: string;
}

/**
 * GeneratedValue — disambiguates a derived (generated) file value from a manual override. A derived
 * value renders as a quiet, read-only grey-monospace chip + `generated` tag with an explicit
 * Override action — never an editable-looking input. Once overridden it becomes an editable field +
 * `manual` tag with a Revert action. The MODE is prop-driven (the consumer flips `derived`); the
 * manual field itself is uncontrolled — `value` seeds its initial text and edits flow through
 * `onChange`, so a later `value` prop change does not overwrite what the user has typed.
 */
const GeneratedValue = ({
  value,
  derived,
  onOverride,
  onRevert,
  overrideLabel,
  onChange,
  ariaLabel = 'File name',
}: GeneratedValueProps) => {
  if (derived) {
    return (
      <span className={styles.root}>
        <code className={styles.generated}>{value}</code>
        <span className={`${styles.tag} ${styles.tagGenerated}`}>generated</span>
        <button type="button" className={styles.action} onClick={onOverride}>
          {overrideLabel}
        </button>
      </span>
    );
  }

  return (
    <span className={styles.root}>
      <input
        type="text"
        className={styles.input}
        defaultValue={value}
        aria-label={ariaLabel}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
      <span className={`${styles.tag} ${styles.tagManual}`}>manual</span>
      <button type="button" className={styles.action} onClick={onRevert}>
        Revert to generated
      </button>
    </span>
  );
};

export default GeneratedValue;
