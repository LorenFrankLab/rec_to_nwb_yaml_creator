import PropTypes from 'prop-types';
import { Modal } from '../../components/Modal';

/**
 * The single-date "Duplicate recording day" picker. Extracted from
 * `pages/AnimalWorkspace/RecordingDaysTab.jsx` (Phase 9c-2) with no behavior change — the pending
 * source, chosen date, and error state stay owned by the parent; this renders the modal form and
 * dispatches submit / cancel / date-change back to it.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the picker is shown.
 * @param {{ dayId: string, date?: string }|null} props.source - The row being cloned (for the copy).
 * @param {string} props.date - The chosen new date (controlled input value).
 * @param {string} props.error - A collision / store-throw message to show inline, or ''.
 * @param {Function} props.onClose - Close without duplicating.
 * @param {Function} props.onSubmit - Commit the duplication.
 * @param {Function} props.onDateChange - `(date: string) => void` from the date input.
 * @returns {JSX.Element}
 */
export default function DuplicateDayModal({ isOpen, source, date, error, onClose, onSubmit, onDateChange }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Duplicate recording day"
      titleId="duplicate-day-title"
      describedById="duplicate-day-desc"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <p id="duplicate-day-desc">
          Clone{' '}
          <strong>{source?.date || source?.dayId}</strong> to a new
          date. The new day reproduces this day&apos;s tasks, behavioral events, keywords,
          technical settings, configuration version, and bad-channel overrides.
        </p>
        <label htmlFor="duplicate-day-date">
          New date
          <input
            id="duplicate-day-date"
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Duplicate day
          </button>
        </div>
      </form>
    </Modal>
  );
}

DuplicateDayModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  source: PropTypes.object,
  date: PropTypes.string.isRequired,
  error: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onDateChange: PropTypes.func.isRequired,
};

DuplicateDayModal.defaultProps = {
  source: null,
};
