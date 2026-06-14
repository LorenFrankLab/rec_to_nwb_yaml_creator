import RawCorruptionBanner from '../../components/RawCorruptionBanner';
import type { Animal } from '../../state/workspaceTypes';
import type { RawShapeIssue } from '../../validation/rawShape';
import styles from './AnimalWorkspace.module.css';

interface ExistingDataReviewProps {
  /** The animal under review (for the Validation & Export links). */
  animalId: string;
  /** The animal record (passed to the corruption banner). */
  animal: Animal;
  /** Recording-day records present (indexed + recovered). */
  dayCount: number;
  /** Hardware configurations in the animal's history. */
  configCount: number;
  /** Whether any saved data is corrupt (styling + lead copy). */
  hasCorruption: boolean;
  /** Whether the day-index reference itself is malformed. */
  daysCorrupt: boolean;
  /** Recovered-unlinked day ids (not in the index). */
  orphanDayIds: string[];
  /** Day ids listed here but owned by another animal. */
  wrongOwnerDayIds: string[];
  /** Executor for a raw-shape repair command. */
  onRepair: (issue: RawShapeIssue) => void;
}

/**
 * The "Review existing data" state for a recovered/imported animal: it surfaces raw-shape
 * corruption, a corrupt day-index reference, and recovered / wrong-owner day records, with the
 * shipped {@link RawCorruptionBanner} executable resets. Extracted from
 * `pages/AnimalWorkspace/RecordingDaysTab.jsx` (Phase 9c-2) with no behavior change. The parent
 * decides WHETHER to render it (only when there is something to review); the `hasCorruption`
 * styling/message branch is preserved verbatim.
 */
export default function ExistingDataReview({
  animalId,
  animal,
  dayCount,
  configCount,
  hasCorruption,
  daysCorrupt,
  orphanDayIds,
  wrongOwnerDayIds,
  onRepair,
}: ExistingDataReviewProps) {
  return (
    <section
      className={`${styles.existingDataReview} ${hasCorruption ? styles.existingDataReviewCorrupt : ''}`}
      aria-label="Existing data review"
    >
      <h3 className={styles.existingDataReviewHeading}>Review existing data</h3>
      <p className={styles.existingDataReviewIntro}>
        Found {dayCount} recording {dayCount === 1 ? 'day' : 'days'} and{' '}
        {configCount} hardware {configCount === 1 ? 'configuration' : 'configurations'} for{' '}
        {animal.id}.{' '}
        {hasCorruption
          ? 'Some saved data is corrupt — resolve it before exporting.'
          : 'Review electrodes and cameras before exporting to confirm they match this animal.'}
      </p>
      {/* Corrupt recording-day reference: the list isn't an array, so the days
          can't be shown. Not folded into the day export gate (the day RECORDS
          are fine; only the animal's index is corrupt) — surfaced here for
          re-import/recreation. */}
      {daysCorrupt && (
        <p className={styles.existingDataReviewCorruptNote} role="alert">
          This animal&apos;s recording-day list is corrupt (expected a list), so
          its index can&apos;t be read.{' '}
          {orphanDayIds.length > 0
            ? 'The recovered day records below are shown from the day store directly.'
            : 'Re-import or recreate this animal’s data.'}
        </p>
      )}
      {orphanDayIds.length > 0 && (
        <p className={styles.existingDataReviewCorruptNote} role="alert">
          {orphanDayIds.length} recovered recording{' '}
          {orphanDayIds.length === 1 ? 'day is' : 'days are'} not listed in
          this animal&apos;s day index (shown below as &quot;not in day list&quot;).{' '}
          <a href={`#/animal/${animalId}/export`}>
            Open this animal&apos;s Validation &amp; Export
          </a>{' '}
          to re-link {orphanDayIds.length === 1 ? 'it' : 'them'}.
        </p>
      )}
      {wrongOwnerDayIds.length > 0 && (
        <p className={styles.existingDataReviewCorruptNote} role="alert">
          {wrongOwnerDayIds.length} day{' '}
          {wrongOwnerDayIds.length === 1 ? 'is' : 'are'} listed here but
          belong to a different animal (shown below as &quot;belongs to …&quot;).
          They are not exported with this animal — remove them from this
          animal&apos;s list.
        </p>
      )}
      {/* Reuse the shipped recovery surface: executable resets for corrupt
          animal-owned collections. Self-hides when there is no corruption. */}
      <RawCorruptionBanner
        animal={animal}
        fields={['cameras', 'data_acq_device', 'configurationHistory']}
        onRepair={onRepair}
      />
      <a
        className={styles.existingDataReviewLink}
        href={`#/animal/${animalId}/export`}
      >
        Open this animal&apos;s Validation &amp; Export
      </a>
    </section>
  );
}

