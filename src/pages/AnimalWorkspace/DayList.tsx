import type { DayRowViewModel } from '../../viewModels/types';
import styles from './AnimalWorkspace.module.css';

interface DayListProps {
  /** The per-day rows from `buildAnimalWorkspaceViewModel` (status, label, recovery, repair). */
  rows: DayRowViewModel[];
  /** Whether the day-index reference is malformed (empty-state copy). */
  daysCorrupt: boolean;
  /** The owning animal (for the dangling-row export link + the unlink dispatch). */
  animalId: string;
  /** `(animalId, dayId) => void` — unlink a wrong-owner day. */
  onUnlinkDayReference: (animalId: string, dayId: string) => void;
  /** `({ dayId, date }) => void` — open the duplicate picker. */
  onDuplicateDay: (arg: { dayId: string; date?: string }) => void;
  /** `(dayId) => void` — open the delete confirm (the parent assembles its descriptor). */
  onDeleteDay: (dayId: string) => void;
}

/**
 * The per-animal recording-day list: the empty state, and one row per classified day (ok /
 * dangling_reference / recovered_unlinked / wrong_owner) with its plain-language lifecycle status
 * and the per-row actions. Renders straight from the view-model's `dayRows` — the row status, label
 * (already humanized), recovery classification, owner description, and the orphan "Re-link to export"
 * override are all decided in `buildAnimalWorkspaceViewModel`, never re-derived here.
 */
export default function DayList({
  rows,
  daysCorrupt,
  animalId,
  onUnlinkDayReference,
  onDuplicateDay,
  onDeleteDay,
}: DayListProps) {
  if (rows.length === 0) {
    return daysCorrupt ? (
      /* Corrupt index AND no recoverable records — see the review state above. */
      <div className="empty-state">
        <p>This animal&apos;s recording-day list is corrupt and can&apos;t be shown.</p>
        <p>See &quot;Review existing data&quot; above to resolve it.</p>
      </div>
    ) : (
      /* Empty State: No Days */
      <div className="empty-state">
        <p>No recording days yet.</p>
        <p>Add your first recording day to get started.</p>
      </div>
    );
  }
  return (
    /* Day List. `role="list"` is NOT redundant here: `.day-list` sets `list-style: none`,
       which makes Safari + VoiceOver drop the implicit list role — the explicit role restores
       it. The jsx-a11y rule can't see the CSS, so it's suppressed deliberately. */
    // eslint-disable-next-line jsx-a11y/no-redundant-roles
    <ul className={styles.dayList} role="list">
      {rows.map((row) => {
        const dayId = row.dayId;
        const dateText = row.date || dayId;

        // A dangling reference (no record) is surfaced, not dropped — otherwise a
        // recovered day disappears. Consistent with the cross-day Validation summary.
        if (row.recovery === 'dangling_reference') {
          return (
            <li key={dayId} className={styles.dayItem}>
              <div className={`${styles.dayLink} ${styles.dayLinkMissing}`} role="alert">
                <div className={styles.dayInfo}>
                  <span className={styles.dayDate}>{dayId}</span>
                  <span className={styles.daySessionId}>
                    Saved record missing or corrupt —{' '}
                    <a href={`#/animal/${animalId}/export`}>
                      review in this animal&apos;s Validation &amp; Export
                    </a>
                    .
                  </span>
                </div>
                <div className={styles.dayStatus}>
                  <span className="status-chip error">{row.statusLabel}</span>
                </div>
              </div>
            </li>
          );
        }

        // Wrong owner: indexed here but the record belongs to another animal. Don't
        // render it as an ordinary recording day (that implies it's this animal's and
        // exportable). Surface a warning + an in-place unlink repair.
        if (row.recovery === 'wrong_owner') {
          const owner = row.recoveryDetail?.ownerDescription;
          return (
            <li key={dayId} className={styles.dayItem}>
              <div className={`${styles.dayLink} ${styles.dayLinkMissing}`} role="alert">
                <div className={styles.dayInfo}>
                  <span className={styles.dayDate}>{dateText}</span>
                  <span className={styles.daySessionId}>{row.statusLabel}</span>
                </div>
                <div className={styles.dayStatus}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onUnlinkDayReference(animalId, dayId)}
                    aria-label={`Remove ${dateText} from ${animalId} (belongs to ${owner})`}
                  >
                    Remove from this animal
                  </button>
                </div>
              </div>
            </li>
          );
        }

        // Ordinary (OK) or recovered-unlinked row: ONE plain-language status (already humanized + the
        // orphan "Re-link to export" override applied by the builder), read-only over the same export
        // gate the day editor uses.
        const isOrphan = row.recovery === 'recovered_unlinked';
        return (
          <li key={dayId} className={`${styles.dayItem} ${isOrphan ? styles.dayItemOrphan : ''}`}>
            <a href={row.href} className={styles.dayLink}>
              <div className={styles.dayInfo}>
                <span className={styles.dayDate}>
                  {row.date}
                  {isOrphan && (
                    <span className={styles.dayOrphanNote}> ⚠ not in day list</span>
                  )}
                </span>
                {row.sessionDescription && (
                  <span
                    className={styles.daySessionDesc}
                    data-testid="day-session-desc"
                    title={row.sessionDescription}
                  >
                    {row.sessionDescription}
                  </span>
                )}
              </div>
              <div className={styles.dayStatus}>
                {/* `day-row-status` (+ dynamic `-${chipVariant}` suffix) is kept GLOBAL in the module
                    so the runtime-built class name resolves; a day-row test also queries it. */}
                <span className={`day-row-status day-row-status-${row.chipVariant}`}>
                  {row.statusLabel}
                </span>
              </div>
            </a>
            {/* Lifecycle cleanup (Task 8): a secondary/destructive delete, OUTSIDE
                the navigation link (not nested in the <a>) so it can't be hit while
                opening the day. Only on ordinary (OK) rows — recovered/wrong-owner
                rows have their own repair paths above. */}
            {row.recovery === 'ok' && (
              <div className={styles.dayItemActions}>
                <button
                  type="button"
                  className={styles.btnSecondaryText}
                  onClick={() => onDuplicateDay({ dayId, date: row.date })}
                  aria-label={`Duplicate recording day ${dateText}…`}
                >
                  Duplicate day…
                </button>
                <button
                  type="button"
                  className={styles.btnDangerText}
                  onClick={() => onDeleteDay(dayId)}
                  aria-label={`Delete recording day ${dateText}…`}
                >
                  Delete day…
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
