import { useState, useId } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import TaskEpochsEditor from './TaskEpochsEditor';
import BehavioralEventsDisplay from './BehavioralEventsDisplay';
import './TaskModal.scss';

/**
 * Inner task form. Rendered as Modal children, so it mounts fresh on each open
 * (and remounts when its `key` changes), letting these lazy useState initializers
 * read from props once per edit — no array-keyed init effect.
 *
 * Severity policy: Save is blocked only by error-severity issues — a blank
 * task_name or task_environment, a task name that duplicates another task in the
 * day, or any epoch row with end <= start. task_description, camera selection, and
 * empty/missing-camera references are non-blocking.
 *
 * camera_id and task_epochs are persisted as integer arrays. Epoch start/end times
 * are editor-local and never reach the saved task.
 *
 * @param {object} props Component props.
 * @param {'add'|'edit'} props.mode Add or edit.
 * @param {object|null} props.task Task being edited (edit mode).
 * @param {Array} props.existingTasks Sibling tasks in the day (unique-name check).
 * @param {Array} props.cameras Animal cameras (multi-select options).
 * @param {Array} props.inheritedEvents Animal behavioral events (read-only display).
 * @param {string} [props.animalId] Parent animal id (for the Animal Editor link).
 * @param {Function} props.onSave Called with the saved task object.
 * @param {Function} props.onCancel Called on cancel / ESC / overlay close.
 * @returns {JSX.Element}
 */
function TaskForm({ mode, task, existingTasks, cameras, inheritedEvents, animalId, onSave, onCancel }) {
  const [taskName, setTaskName] = useState(() => task?.task_name ?? '');
  const [taskDescription, setTaskDescription] = useState(() => task?.task_description ?? '');
  const [taskEnvironment, setTaskEnvironment] = useState(() => task?.task_environment ?? '');
  const [cameraIds, setCameraIds] = useState(() => (task?.camera_id ?? []).map(Number));
  const [epochs, setEpochs] = useState(() => (task?.task_epochs ?? []).map(Number));
  const [epochsHaveError, setEpochsHaveError] = useState(false);
  const baseId = useId();

  const availableCameraIds = new Set((cameras || []).map((c) => Number(c.id)));
  const missingCameraIds = cameraIds.filter((id) => !availableCameraIds.has(id));

  const otherTasks = existingTasks.filter((t) => t !== task);
  const trimmedName = taskName.trim();
  const isDuplicateName =
    trimmedName !== '' && otherTasks.some((t) => t.task_name === trimmedName);

  const hasBlankRequired = trimmedName === '' || taskEnvironment.trim() === '';
  const saveDisabled = hasBlankRequired || isDuplicateName || epochsHaveError;

  /**
   * Toggle a camera id in the selection.
   * @param {number} id Camera id.
   */
  function toggleCamera(id) {
    setCameraIds((prev) =>
      prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]
    );
  }

  /**
   * Receive the epoch editor's derived state.
   * @param {{epochs: number[], hasError: boolean}} next Editor payload.
   */
  function handleEpochsChange(next) {
    setEpochs(next.epochs);
    setEpochsHaveError(next.hasError);
  }

  /**
   * Build and emit the saved task object.
   */
  function handleSave() {
    if (saveDisabled) return;
    onSave({
      task_name: trimmedName,
      task_description: taskDescription.trim(),
      task_environment: taskEnvironment.trim(),
      camera_id: cameraIds,
      task_epochs: epochs,
    });
  }

  const nameErrorId = `${baseId}-name-error`;

  return (
    <form className="task-modal-form" onSubmit={(e) => e.preventDefault()}>
      <details open>
        <summary>Task details</summary>
        <div className="task-modal-section-body">
          <div className="form-group">
            <label htmlFor={`${baseId}-name`}>Task name</label>
            <input
              id={`${baseId}-name`}
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              required
              aria-invalid={isDuplicateName}
              aria-describedby={isDuplicateName ? nameErrorId : undefined}
            />
            {isDuplicateName && (
              <div id={nameErrorId} className="inline-error" role="alert">
                Task name must be unique within this day
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor={`${baseId}-environment`}>Task environment</label>
            <input
              id={`${baseId}-environment`}
              type="text"
              value={taskEnvironment}
              onChange={(e) => setTaskEnvironment(e.target.value)}
              placeholder="e.g., HomeBox"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${baseId}-description`}>Task description</label>
            <textarea
              id={`${baseId}-description`}
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </details>

      <details>
        <summary>Cameras</summary>
        <div className="task-modal-section-body">
          {(cameras || []).length === 0 ? (
            <div className="inline-info" role="status">
              No cameras are defined for this animal. Cameras are optional, but link
              video and spatial tracking.{' '}
              {animalId && (
                <a href={`#/animal/${animalId}/editor`}>Add cameras in the Animal Editor</a>
              )}
            </div>
          ) : (
            <fieldset className="camera-checkboxes">
              <legend>Cameras used in this task</legend>
              {cameras.map((camera) => {
                const id = Number(camera.id);
                return (
                  <label key={id} className="camera-checkbox">
                    <input
                      type="checkbox"
                      checked={cameraIds.includes(id)}
                      onChange={() => toggleCamera(id)}
                    />
                    {id} – {camera.camera_name || 'unnamed'}
                  </label>
                );
              })}
            </fieldset>
          )}

          {missingCameraIds.length > 0 && (
            <div className="inline-info" role="status">
              This task references camera id{missingCameraIds.length > 1 ? 's' : ''}{' '}
              {missingCameraIds.join(', ')} not defined for this animal. The
              reference is kept; add the camera in the Animal Editor or remove it.
            </div>
          )}
        </div>
      </details>

      <details>
        <summary>Behavioral events (inherited)</summary>
        <div className="task-modal-section-body">
          <BehavioralEventsDisplay inheritedEvents={inheritedEvents} readOnly />
        </div>
      </details>

      <details open>
        <summary>Task epochs</summary>
        <div className="task-modal-section-body">
          <TaskEpochsEditor initialEpochs={epochs} onChange={handleEpochsChange} />
        </div>
      </details>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel} aria-label="Cancel">
          Cancel
        </button>
        <button
          type="button"
          className="btn-save"
          onClick={handleSave}
          disabled={saveDisabled}
          aria-label="Save task"
        >
          Save
        </button>
      </div>
    </form>
  );
}

TaskForm.propTypes = {
  mode: PropTypes.oneOf(['add', 'edit']).isRequired,
  task: PropTypes.object,
  existingTasks: PropTypes.array.isRequired,
  cameras: PropTypes.array,
  inheritedEvents: PropTypes.array,
  animalId: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

TaskForm.defaultProps = {
  task: null,
  cameras: [],
  inheritedEvents: [],
  animalId: undefined,
};

/**
 * TaskModal - add/edit a day's task. Dialog accessibility (focus trap, focus
 * return, ESC/overlay close, scroll lock) comes from the shared Modal primitive;
 * the form initializes from the edited task via a stable remount key.
 *
 * @param {object} props
 * @param {boolean} props.isOpen Whether the modal is shown.
 * @param {'add'|'edit'} props.mode Add or edit.
 * @param {object|null} props.task Task being edited (edit mode).
 * @param {Array} props.existingTasks Sibling tasks in the day (unique-name check).
 * @param {Array} props.cameras Animal cameras (multi-select options).
 * @param {Array} props.inheritedEvents Animal behavioral events (read-only display).
 * @param {string} [props.animalId] Parent animal id (for the Animal Editor link).
 * @param {Function} props.onSave Called with the saved task object.
 * @param {Function} props.onCancel Called on cancel / ESC / overlay close.
 * @returns {JSX.Element}
 */
const TaskModal = ({
  isOpen,
  mode = 'add',
  task = null,
  existingTasks = [],
  cameras = [],
  inheritedEvents = [],
  animalId,
  onSave,
  onCancel,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onCancel}
    title={mode === 'edit' ? 'Edit Task' : 'Add Task'}
    titleId="task-modal-title"
    className="task-modal-content"
  >
    <TaskForm
      key={`${mode}-${task?.task_name ?? '__new__'}`}
      mode={mode}
      task={task}
      existingTasks={existingTasks}
      cameras={cameras}
      inheritedEvents={inheritedEvents}
      animalId={animalId}
      onSave={onSave}
      onCancel={onCancel}
    />
  </Modal>
);

TaskModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(['add', 'edit']),
  task: PropTypes.object,
  existingTasks: PropTypes.array,
  cameras: PropTypes.array,
  inheritedEvents: PropTypes.array,
  animalId: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

TaskModal.defaultProps = {
  mode: 'add',
  task: null,
  existingTasks: [],
  cameras: [],
  inheritedEvents: [],
  animalId: undefined,
};

export default TaskModal;
