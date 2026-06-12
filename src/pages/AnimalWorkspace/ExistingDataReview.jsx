import PropTypes from 'prop-types';
import RawCorruptionBanner from '../../components/RawCorruptionBanner';

/**
 * The "Review existing data" state for a recovered/imported animal: it surfaces raw-shape
 * corruption, a corrupt day-index reference, and recovered / wrong-owner day records, with the
 * shipped {@link RawCorruptionBanner} executable resets. Extracted from
 * `pages/AnimalWorkspace/RecordingDaysTab.jsx` (Phase 9c-2) with no behavior change. The parent
 * decides WHETHER to render it (only when there is something to review); the `hasCorruption`
 * styling/message branch is preserved verbatim.
 *
 * @param {object} props
 * @param {string} props.animalId - The animal under review (for the Validation & Export links).
 * @param {object} props.animal - The animal record (passed to the corruption banner).
 * @param {number} props.dayCount - Recording-day records present (indexed + recovered).
 * @param {number} props.configCount - Hardware configurations in the animal's history.
 * @param {boolean} props.hasCorruption - Whether any saved data is corrupt (styling + lead copy).
 * @param {boolean} props.daysCorrupt - Whether the day-index reference itself is malformed.
 * @param {string[]} props.orphanDayIds - Recovered-unlinked day ids (not in the index).
 * @param {string[]} props.wrongOwnerDayIds - Day ids listed here but owned by another animal.
 * @param {Function} props.onRepair - Executor for a raw-shape repair command.
 * @returns {JSX.Element}
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
}) {
  return (
    <section
      className={`existing-data-review ${hasCorruption ? 'existing-data-review-corrupt' : ''}`}
      aria-label="Existing data review"
    >
      <h3 className="existing-data-review-heading">Review existing data</h3>
      <p className="existing-data-review-intro">
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
        <p className="existing-data-review-corrupt-note" role="alert">
          This animal&apos;s recording-day list is corrupt (expected a list), so
          its index can&apos;t be read.{' '}
          {orphanDayIds.length > 0
            ? 'The recovered day records below are shown from the day store directly.'
            : 'Re-import or recreate this animal’s data.'}
        </p>
      )}
      {orphanDayIds.length > 0 && (
        <p className="existing-data-review-corrupt-note" role="alert">
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
        <p className="existing-data-review-corrupt-note" role="alert">
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
        className="existing-data-review-link"
        href={`#/animal/${animalId}/export`}
      >
        Open this animal&apos;s Validation &amp; Export
      </a>
    </section>
  );
}

ExistingDataReview.propTypes = {
  animalId: PropTypes.string.isRequired,
  animal: PropTypes.object.isRequired,
  dayCount: PropTypes.number.isRequired,
  configCount: PropTypes.number.isRequired,
  hasCorruption: PropTypes.bool.isRequired,
  daysCorrupt: PropTypes.bool.isRequired,
  orphanDayIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  wrongOwnerDayIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  onRepair: PropTypes.func.isRequired,
};
