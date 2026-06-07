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
 * @param {Function} props.onCreateNew - Commit as a new camera (keeps the affected days unchanged).
 * @param {Function} props.onCorrect - Overwrite in place (updates the affected days).
 * @param {Function} props.onCancel - Dismiss without changing anything.
 * @returns {JSX.Element|null}
 */
export default function CameraReferenceDialog({ isOpen, camera, affectedDays, onCreateNew, onCorrect, onCancel }) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const msgId = `${baseId}-msg`;
  if (!isOpen) return null;

  const count = affectedDays.length;
  const dayWord = count === 1 ? 'day' : 'days';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={`Camera ${camera?.id} is used by ${count} recording ${dayWord}`}
      titleId={titleId}
      role="alertdialog"
      closeOnOverlayClick={false}
      describedById={msgId}
      className="camera-reference-dialog"
    >
      <p id={msgId}>
        Camera {camera?.id} (&ldquo;{camera?.camera_name}&rdquo;) is referenced by {count} recording{' '}
        {dayWord}. Changing its calibration, lens, model, or name is a <strong>different camera
        identity</strong> — so by default it becomes a new camera and these {dayWord} keep what they
        recorded. Correcting it in place instead updates all {count} {dayWord}, including any already
        exported.
      </p>
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
          Correct this camera (updates {count} {dayWord})
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
  onCreateNew: PropTypes.func.isRequired,
  onCorrect: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

CameraReferenceDialog.defaultProps = {
  camera: null,
  affectedDays: [],
};
