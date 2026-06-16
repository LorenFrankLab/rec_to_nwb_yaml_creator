import { DAY_LIFECYCLE, DAY_LIFECYCLE_LABEL } from '../../domain/dayLifecycle';
import styles from './StatusPill.module.css';

/** The day-lifecycle variant union (the values of {@link DAY_LIFECYCLE}). */
type DayLifecycleVariant = (typeof DAY_LIFECYCLE)[keyof typeof DAY_LIFECYCLE];

/** Token-driven color class per lifecycle variant. */
const VARIANT_CLASS: Record<DayLifecycleVariant, string> = {
  draft: styles.draft,
  ready: styles.ready,
  validated: styles.validated,
  exported: styles.exported,
  needs_fixing: styles.needsFixing,
};

interface StatusPillProps {
  /** A {@link DAY_LIFECYCLE} value (e.g. `'ready'`). */
  variant: DayLifecycleVariant;
  /** Optional short label override (e.g. `"Ready"` for `READY`). Defaults to the canonical label. */
  label?: string;
}

/**
 * StatusPill — the single visual wrapper over the shared {@link DAY_LIFECYCLE} vocabulary.
 *
 * It NEVER coins new status words: the label always comes from {@link DAY_LIFECYCLE_LABEL}
 * (or a caller-supplied short override of that same state). Colors are design tokens, one class
 * per variant. The epoch-row scope has its own component ({@link EpochStatusPill}) so the two
 * scopes can never share an instance — keeping the "no word across scopes" rule structural.
 */
const StatusPill = ({ variant, label }: StatusPillProps) => {
  const classes = [styles.pill, VARIANT_CLASS[variant] ?? styles.draft].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      <span className={styles.dot} aria-hidden="true" />
      {label ?? DAY_LIFECYCLE_LABEL[variant]}
    </span>
  );
};

export default StatusPill;

/** The epoch-row completeness scope — its own closed vocabulary, never a lifecycle word. */
type EpochStatus = 'complete' | 'incomplete' | 'needs_video';

const EPOCH_LABEL: Record<EpochStatus, string> = {
  complete: 'Complete',
  incomplete: 'Incomplete',
  needs_video: 'Needs video',
};

const EPOCH_CLASS: Record<EpochStatus, string> = {
  complete: styles.complete,
  incomplete: styles.incomplete,
  needs_video: styles.needsVideo,
};

interface EpochStatusPillProps {
  /** The epoch-row completeness state. */
  status: EpochStatus;
}

/**
 * EpochStatusPill — the epoch-grid row scope. A deliberately separate component from
 * {@link StatusPill}: its words (`Complete` / `Incomplete` / `Needs video`) belong only to an
 * epoch row and must never collide with the day-lifecycle words. `Needs video` is the row face of
 * the video-declaration readiness rule.
 */
export const EpochStatusPill = ({ status }: EpochStatusPillProps) => {
  const classes = [styles.pill, EPOCH_CLASS[status] ?? styles.incomplete].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      <span className={styles.dot} aria-hidden="true" />
      {EPOCH_LABEL[status]}
    </span>
  );
};
