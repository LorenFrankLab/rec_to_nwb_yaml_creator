import styles from './WarningAcknowledgement.module.css';

interface WarningAcknowledgementItem {
  key: string;
  label: string;
  // `message` is optional: the validation issues that flow here (RepairableIssue) type it optional,
  // and the render (`{warning.message}`) tolerates an absent message.
  warnings: Array<{ message?: string }>;
}

interface WarningAcknowledgementProps {
  /** One entry per day that carries outstanding warnings (days with none are omitted by the caller). */
  items: WarningAcknowledgementItem[];
  /** Whether the user has checked the acknowledgement. */
  acknowledged: boolean;
  /** Called with the new checkbox state. */
  onChange: (next: boolean) => void;
}

/**
 * WarningAcknowledgement — a checkbox-gated review of outstanding non-blocking warnings before a
 * batch / valid-only export (Phase 3-6).
 *
 * The export gate keys on error severity only, so warnings (e.g. an imported
 * `inconsistent_location_case`, an orphaned video/file) don't block and can ride an export across N
 * days unnoticed. This lists each affected day → its warning messages (content-explicit, not a bare
 * count) and requires an explicit "I've reviewed these warnings" acknowledgement before the caller
 * lets the download proceed. Reusable by every export surface (the per-animal Validation & Export
 * tab now; the chrome-level batch screen in Phase 4) so the acknowledgement can't drift.
 */
export default function WarningAcknowledgement({
  items,
  acknowledged,
  onChange,
}: WarningAcknowledgementProps) {
  if (!items || items.length === 0) return null;

  const dayCount = items.length;

  return (
    <section className={styles.banner} role="group" aria-label="Outstanding warnings to review">
      <p className={styles.lead}>
        {dayCount} {dayCount === 1 ? 'day has' : 'days have'} non-blocking warnings. They won&apos;t
        stop export, but review them first — a silent issue can multiply across days:
      </p>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.key} className={styles.day}>
            <strong>{item.label}</strong>
            <ul>
              {item.warnings.map((warning, index) => (
                <li key={index}>{warning.message}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <label className={styles.confirm}>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => onChange(event.target.checked)}
        />
        I&apos;ve reviewed these warnings
      </label>
    </section>
  );
}
