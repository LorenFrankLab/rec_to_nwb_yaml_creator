import { useId } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';

/**
 * CameraReferenceDialog — Phase 8.7 Task 5b (immutable-once-referenced cameras).
 *
 * When the user changes the IDENTITY of a camera that recording days already reference, this app
 * must not silently rewrite those days' exports (the day-used export binding means each referencing
 * day now emits this camera). So the change is presented as a choice that NAMES the affected days
 * first:
 *  - **Create a new camera** (default / recommended): the edited values become a new catalog camera;
 *    the original is untouched, so the referencing days keep exactly what they recorded.
 *  - **Correct this camera**: overwrite the camera in place — explicitly updating all N referencing
 *    days, including any already exported.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {object} props.camera - The original camera being edited (`id`, `camera_name`).
 * @param {Array<{id: *, date: string}>} props.affectedDays - The recording days that reference it.
 * @param {boolean} [props.hasUnresolvableDays] - Whether some of the animal's recording days could
 *   not be loaded (their camera references can't be checked) — surfaced so the decision is never
 *   silently skipped for a day we couldn't read.
 * @param {Function} props.onCreateNew - Commit as a new camera (keeps the affected days unchanged).
 * @param {Function} props.onCorrect - Overwrite in place (updates the affected days).
 * @param {Function} props.onCancel - Dismiss without changing anything.
 * @returns {JSX.Element|null}
 */
export default function CameraReferenceDialog({ isOpen, camera, affectedDays, hasUnresolvableDays = false, onCreateNew, onCorrect, onCancel }) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const msgId = `${baseId}-msg`;
  if (!isOpen) return null;

  const count = affectedDays.length;
  const dayWord = count === 1 ? 'day' : 'days';
  const title =
    count > 0
      ? `Camera ${camera?.id} is used by ${count} recording ${dayWord}`
      : `Camera ${camera?.id} may be used by recording days that couldn't be loaded`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      titleId={titleId}
      role="alertdialog"
      closeOnOverlayClick={false}
      describedById={msgId}
      className="camera-reference-dialog"
    >
      <p id={msgId}>
        {count > 0 ? (
          <>
            Camera {camera?.id} (&ldquo;{camera?.camera_name}&rdquo;) is referenced by {count}{' '}
            recording {dayWord}. Changing its calibration, lens, model, or name is a{' '}
            <strong>different camera identity</strong> — so by default it becomes a new camera and
            these {dayWord} keep what they recorded. Correcting it in place instead updates all{' '}
            {count} {dayWord}, including any already exported.
          </>
        ) : (
          <>
            Some of this animal&apos;s recording days couldn&apos;t be loaded, so we can&apos;t check
            whether they use camera {camera?.id} (&ldquo;{camera?.camera_name}&rdquo;). Changing its
            calibration, lens, model, or name is a <strong>different camera identity</strong> — by
            default it becomes a new camera so any day that used it keeps what it recorded.
          </>
        )}
      </p>
      {hasUnresolvableDays && count > 0 && (
        <p className="camera-reference-uncheckable">
          Plus recording days that couldn&apos;t be loaded and may also use this camera.
        </p>
      )}
      <ul className="camera-reference-affected">
        {affectedDays.map((d) => (
          <li key={d.id}>{d.date || d.id}</li>
        ))}
      </ul>
      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="button-secondary" onClick={onCorrect}>
          {count > 0 ? `Correct this camera (updates ${count} ${dayWord})` : 'Correct this camera'}
        </button>
        <button type="button" className="button-primary" onClick={onCreateNew}>
          Create a new camera (recommended)
        </button>
      </div>
    </Modal>
  );
}

CameraReferenceDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  camera: PropTypes.shape({ id: PropTypes.number, camera_name: PropTypes.string }),
  affectedDays: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.any, date: PropTypes.string })
  ),
  hasUnresolvableDays: PropTypes.bool,
  onCreateNew: PropTypes.func.isRequired,
  onCorrect: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

CameraReferenceDialog.defaultProps = {
  camera: null,
  affectedDays: [],
};
