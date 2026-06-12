import PropTypes from 'prop-types';
import { describeOwner } from '../../domain/dayRecovery';
import EffectiveDayReview from './EffectiveDayReview';
import {
  subjectLabel,
  dayChipDisplay,
  describeConfigVersionLabel,
} from './validationSummaryRows';

/**
 * The cross-day status table: one row per recording day across the workspace (or, when `scoped`,
 * one animal's days), with the per-day scan summary, the lifecycle status chip, and the editor /
 * repair cell. Extracted from `pages/ValidationSummary/index.jsx` (Phase 9c) with no behavior
 * change — it renders the rows {@link buildRows} produced and dispatches the day-reference repairs
 * back to the parent's store actions.
 *
 * @param {object} props
 * @param {object[]} props.rows - The table-ordered rows from `buildRows` / `buildAnimalRows`.
 * @param {boolean} props.scoped - Per-animal mode: the scan cell becomes an effective-setup expander.
 * @param {Function} props.onRemoveDayReference - `(animalKey, dayId) => void` — drop a dangling reference.
 * @param {Function} props.onUnlinkDayReference - `(animalKey, dayId) => void` — unlink a wrong-owner day.
 * @param {Function} props.onRelinkDayReference - `(animalKey, dayId) => void` — re-link a recovered day.
 * @returns {JSX.Element}
 */
export default function DayStatusTable({
  rows,
  scoped,
  onRemoveDayReference,
  onUnlinkDayReference,
  onRelinkDayReference,
}) {
  return (
    // The table can be wider than a phone viewport (6 columns of dense scan/session text), so
    // it scrolls horizontally WITHIN this container instead of forcing the whole page to
    // overflow — the page stays at the viewport width at ~390px and no cell is clipped off.
    <div className="validation-summary-table-scroll">
      <table className="validation-summary-table">
        <caption className="visually-hidden">
          Recording days across all animals with validation status
        </caption>
        <thead>
          <tr>
            <th scope="col">Animal</th>
            <th scope="col">Date</th>
            <th scope="col">Session</th>
            <th scope="col">Setup</th>
            <th scope="col">Status</th>
            <th scope="col">Editor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ animal, animalKey, day, chip, scan, unreadable, missingRecord, orphaned, ownerMissing, wrongOwner }, index) => (
            <tr key={`${day.id ?? 'unknown'}-${index}`} data-testid={`day-row-${day.id}`}>
              <td>
                {subjectLabel(animal)}
                {orphaned && (
                  <span
                    className="validation-summary-orphan-note"
                    title="This day record is not listed in its animal's recording-day index (the index is corrupt, missing, or doesn't reference it). It is shown here so it isn't lost; open it to review or re-link it."
                  >
                    {' '}⚠ not in day list
                  </span>
                )}
                {wrongOwner && (
                  <span
                    className="validation-summary-orphan-note"
                    title={`This day is listed under ${subjectLabel(animal)} but its record belongs to ${describeOwner(day.animalId)}. It is NOT exported with this animal's metadata; remove it from this animal so it returns to its real owner.`}
                  >
                    {' '}⚠ belongs to {describeOwner(day.animalId)}
                  </span>
                )}
              </td>
              <td>{day.date || '—'}</td>
              <td>
                {day.session?.session_id || '—'}
                {scan?.sessionDescription && (
                  <span
                    className="validation-summary-session-description"
                    data-testid={`session-description-${day.id}`}
                  >
                    {scan.sessionDescription}
                  </span>
                )}
              </td>
              <td>
                {/* Scan fields: pinned configuration version (via describeConfigVersionLabel),
                    camera count + calibration, and the day-protocol opto state — so days can be
                    compared at a glance. Absent for unreadable/missing/wrong-owner rows (no
                    trustworthy merge), shown as "—". In the SCOPED per-animal tab, the cell
                    becomes an expander whose summary reads the same unified config-version label
                    and whose body is the read-only effective-setup-for-this-day review. */}
                {scan ? (
                  scoped ? (
                    <details className="validation-summary-effective" data-testid={`effective-${day.id}`}>
                      <summary className="validation-summary-scan">
                        {describeConfigVersionLabel(scan.version, scan.historical)}
                        {' · '}
                        {scan.cameras} {scan.cameras === 1 ? 'camera' : 'cameras'}
                        {scan.cameraCalibration && (
                          <span className="validation-summary-scan-cameras">
                            {' ('}
                            {scan.cameraCalibration}
                            {')'}
                          </span>
                        )}
                        {' · '}
                        {scan.opto}
                      </summary>
                      <EffectiveDayReview animal={animal} day={day} />
                    </details>
                  ) : (
                    <span className="validation-summary-scan">
                      {describeConfigVersionLabel(scan.version, scan.historical)}
                      {' · '}
                      {scan.cameras} {scan.cameras === 1 ? 'camera' : 'cameras'}
                      {scan.cameraCalibration && (
                        <span className="validation-summary-scan-cameras">
                          {' ('}
                          {scan.cameraCalibration}
                          {')'}
                        </span>
                      )}
                      {' · '}
                      {scan.opto}
                    </span>
                  )
                ) : (
                  '—'
                )}
              </td>
              <td>
                {/* The per-day chip uses the shared DAY_LIFECYCLE vocabulary: a live-valid day
                    is refined by its persisted state ("Validated"/"Exported") so saved
                    validation is distinct from a merely live-valid "Ready to export". An
                    unreadable day (its config could not be resolved) OR a reference that
                    resolves to no day record is shown as an error chip with an honest label,
                    so it is flagged for repair and counted — never silently dropped or
                    mistaken for a normal validation error. */}
                {(() => {
                  const { variant, label } = dayChipDisplay(chip, day?.state, {
                    unreadable,
                    missingRecord,
                    orphaned,
                  });
                  return (
                    <span
                      className={`status-chip status-chip--${variant}`}
                      title={
                        unreadable
                          ? 'This day could not be read — its device configuration is missing or corrupt. Open the editor to repair it.'
                          : missingRecord
                            ? 'This day’s saved record is missing or corrupt. Open the editor to repair or recreate it.'
                            : undefined
                      }
                    >
                      {label}
                    </span>
                  );
                })()}
              </td>
              <td>
                {missingRecord ? (
                  // A missing/non-record day has nothing to open (the Day Editor would
                  // dead-end on "Day not found"). Offer an executable repair that drops
                  // the dangling reference from the owning animal instead.
                  <button
                    type="button"
                    className="validation-summary-repair"
                    onClick={() => onRemoveDayReference(animalKey, day.id)}
                    aria-label={`Remove dangling day reference ${day.id} from ${subjectLabel(animal)}`}
                  >
                    Remove day reference
                  </button>
                ) : wrongOwner ? (
                  // Listed under the wrong animal. The repair unlinks it from THIS animal
                  // (keeping the record), so it returns to its real owner to be re-linked.
                  <button
                    type="button"
                    className="validation-summary-repair"
                    onClick={() => onUnlinkDayReference(animalKey, day.id)}
                    aria-label={`Remove ${day.date || day.id} from ${subjectLabel(animal)} (it belongs to ${describeOwner(day.animalId)})`}
                  >
                    Remove from this animal
                  </button>
                ) : orphaned && ownerMissing ? (
                  // The record exists but its owning animal is gone — "Open editor" would
                  // dead-end (the Day Editor needs the animal). There is no in-app relink
                  // target; state the recovery path instead of a dead control.
                  <span className="validation-summary-orphan-detail">
                    No owning animal — re-create the animal or re-import its data.
                  </span>
                ) : (
                  <>
                    <a
                      href={`#/day/${day.id}`}
                      aria-label={`Open editor for ${subjectLabel(animal)} ${day.date || day.id}`}
                    >
                      Open editor
                    </a>
                    {orphaned && (
                      // The record exists and its owner is present — re-link it into the
                      // animal's day index so it rejoins the normal workflow.
                      <button
                        type="button"
                        className="validation-summary-repair"
                        onClick={() => onRelinkDayReference(animalKey, day.id)}
                        aria-label={`Add ${day.date || day.id} back to ${subjectLabel(animal)}'s day list`}
                      >
                        Add to day list
                      </button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

DayStatusTable.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  scoped: PropTypes.bool.isRequired,
  onRemoveDayReference: PropTypes.func.isRequired,
  onUnlinkDayReference: PropTypes.func.isRequired,
  onRelinkDayReference: PropTypes.func.isRequired,
};
