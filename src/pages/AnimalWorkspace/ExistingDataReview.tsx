import type {
  ExistingDataReviewViewModel,
} from '../../viewModels/animalWorkspaceViewModel';
import type { RecoveryNoticeViewModel } from '../../viewModels/types';
import styles from './AnimalWorkspace.module.css';

interface ExistingDataReviewProps {
  /** The existing-data review state from `buildAnimalWorkspaceViewModel` (notes + repair notices). */
  review: ExistingDataReviewViewModel;
  /** Executes a raw-shape repair notice's command. */
  onRepair: (notice: RecoveryNoticeViewModel) => void;
}

/**
 * The "Review existing data" state for a recovered/imported animal: it surfaces raw-shape
 * corruption, a corrupt day-index reference, and recovered / wrong-owner day records, with executable
 * resets. Renders straight from the view-model's `review` — the detection (which notices to show, the
 * corrupt-index / recovered / wrong-owner copy, and the raw-collection repair notices) is decided in
 * `buildAnimalWorkspaceViewModel`, so this no longer mounts a self-detecting corruption banner. The
 * parent decides WHETHER to render it (only when there is something to review).
 */
export default function ExistingDataReview({ review, onRepair }: ExistingDataReviewProps) {
  return (
    <section
      className={`${styles.existingDataReview} ${review.hasCorruption ? styles.existingDataReviewCorrupt : ''}`}
      aria-label="Existing data review"
    >
      <h3 className={styles.existingDataReviewHeading}>Review existing data</h3>
      <p className={styles.existingDataReviewIntro}>{review.summary}</p>
      {/* Corrupt recording-day reference: the list isn't an array, so the days
          can't be shown. Not folded into the day export gate (the day RECORDS
          are fine; only the animal's index is corrupt) — surfaced here for
          re-import/recreation. */}
      {review.corruptIndexNote && (
        <p className={styles.existingDataReviewCorruptNote} role="alert">
          {review.corruptIndexNote}
        </p>
      )}
      {review.recoveredNote && (
        <p className={styles.existingDataReviewCorruptNote} role="alert">
          {review.recoveredNote}{' '}
          <a href={review.reviewLink.href}>{review.reviewLink.label}</a>{' '}
          to re-link {review.recoveredCount === 1 ? 'it' : 'them'}.
        </p>
      )}
      {review.wrongOwnerNote && (
        <p className={styles.existingDataReviewCorruptNote} role="alert">
          {review.wrongOwnerNote}
        </p>
      )}
      {/* Executable resets for corrupt animal-owned collections — rendered from the view-model's
          detected notices (no self-detecting banner). Self-hides when there is no corruption. */}
      {review.rawCorruptionNotices.length > 0 && (
        <section className="raw-corruption-banner" role="alert" aria-label="Corrupt saved data">
          <p className="field-help-text">
            Some saved data here is corrupt and blocks export. Reset it to a clean state:
          </p>
          <ul className="raw-corruption-list">
            {review.rawCorruptionNotices.map((notice) => (
              <li key={notice.repair.target?.fieldPath} className="raw-corruption-item">
                <span className="raw-corruption-message">{notice.message}</span>
                <button
                  type="button"
                  className="repair-action-button repair-action-button-execute"
                  data-repair-command={notice.repair.id}
                  data-field-path={notice.repair.target?.fieldPath}
                  onClick={() => onRepair(notice)}
                >
                  {notice.actionLabel}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <a className={styles.existingDataReviewLink} href={review.reviewLink.href}>
        {review.reviewLink.label}
      </a>
    </section>
  );
}
