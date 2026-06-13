import { Modal } from '../../components/Modal';

interface DuplicateDayModalProps {
  /** Whether the picker is shown. */
  isOpen: boolean;
  /** The row being cloned (for the copy). */
  source?: { dayId: string; date?: string } | null;
  /** The chosen new date (controlled input value). */
  date: string;
  /** A collision / store-throw message to show inline, or ''. */
  error: string;
  /** Close without duplicating. */
  onClose: () => void;
  /** Commit the duplication. */
  onSubmit: () => void;
  /** `(date: string) => void` from the date input. */
  onDateChange: (date: string) => void;
}

/**
 * The single-date "Duplicate recording day" picker. Extracted from
 * `pages/AnimalWorkspace/RecordingDaysTab.jsx` (Phase 9c-2) with no behavior change — the pending
 * source, chosen date, and error state stay owned by the parent; this renders the modal form and
 * dispatches submit / cancel / date-change back to it.
 */
export default function DuplicateDayModal({ isOpen, source = null, date, error, onClose, onSubmit, onDateChange }: DuplicateDayModalProps) {
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

