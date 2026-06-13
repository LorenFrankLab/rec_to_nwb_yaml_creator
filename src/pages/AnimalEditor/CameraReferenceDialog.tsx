import { useId } from 'react';
import Modal from '../../components/Modal/Modal';

interface CameraReferenceDialogProps {
  isOpen: boolean;
  /** The original camera being edited (`id`, `camera_name`). */
  camera?: { id?: number; camera_name?: string } | null;
  /** The recording days that reference it. */
  affectedDays?: Array<{ id: number | string; date?: string }>;
  /** Whether some of the animal's recording days could not be loaded (references uncheckable). */
  hasUnresolvableDays?: boolean;
  /** Commit as a new camera (keeps the affected days unchanged). */
  onCreateNew: () => void;
  /** Overwrite in place (updates the affected days). */
  onCorrect: () => void;
  /** Dismiss without changing anything. */
  onCancel: () => void;
}

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
 */
export default function CameraReferenceDialog({ isOpen, camera = null, affectedDays = [], hasUnresolvableDays = false, onCreateNew, onCorrect, onCancel }: CameraReferenceDialogProps) {
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
