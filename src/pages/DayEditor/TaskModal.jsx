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
 * Severity policy: Save is blocked by error-severity issues — a blank task_name or
 * task_environment, any epoch row with end <= start, a SELECTED camera id the
 * animal does not define (a dangling reference that would corrupt the export), and
 * a task_name that reuses a known dataset task_name with a DIFFERENT
 * task_description (the Spyglass task-identity guard: one description per name).
 * A duplicate name is allowed iff its description matches the known/sibling one.
 *
 * camera_id and task_epochs are persisted as integer arrays. Epoch start/end times
 * are editor-local and never reach the saved task.
 *
 * @param {object} props Component props.
 * @param {object|null} props.task Task being edited (edit mode).
 * @param {Array} props.existingTasks Sibling tasks in the day (identity check).
 * @param {Array} props.cameras Animal cameras (multi-select options).
 * @param {Array} props.inheritedEvents Animal behavioral events (read-only display).
 * @param {object} props.knownTaskDescriptions Map of task_name -> canonical
 *   task_description across the whole workspace/dataset, excluding the task being
 *   edited. Drives the Spyglass task-identity guard.
 * @param {string} [props.animalId] Parent animal id (for the Animal Editor link).
 * @param {Function} props.onSave Called with the saved task object.
 * @param {Function} props.onCancel Called on cancel / ESC / overlay close.
 * @returns {JSX.Element}
 */
function TaskForm({
  task,
  existingTasks,
  cameras,
  inheritedEvents,
  knownTaskDescriptions,
  animalId,
  onSave,
  onCancel,
}) {
  const [taskName, setTaskName] = useState(() => task?.task_name ?? '');
  const [taskDescription, setTaskDescription] = useState(() => task?.task_description ?? '');
  const [taskEnvironment, setTaskEnvironment] = useState(() => task?.task_environment ?? '');
  const [cameraIds, setCameraIds] = useState(() => (task?.camera_id ?? []).map(Number));
  const [epochs, setEpochs] = useState(() => (task?.task_epochs ?? []).map(Number));
  const [epochsHaveError, setEpochsHaveError] = useState(false);
  // Required-field errors are surfaced only after the field has been blurred, so
  // a freshly opened form is not littered with "required" messages.
  const [touched, setTouched] = useState({ name: false, environment: false });
  const baseId = useId();

  const availableCameraIds = new Set((cameras || []).map((c) => Number(c.id)));
  const missingCameraIds = cameraIds.filter((id) => !availableCameraIds.has(id));
  // A dangling SELECTED camera reference is an ERROR — it would corrupt the export
  // (Spyglass links camera_id to a real camera). It blocks Save until removed or the
  // camera is restored in the Animal Editor.
  const hasDanglingCamera = missingCameraIds.length > 0;

  const otherTasks = existingTasks.filter((t) => t !== task);
  const trimmedName = taskName.trim();
  const trimmedDescription = taskDescription.trim();

  // ----- Spyglass task-name identity guard -----
  // task_name is an identity across the dataset; a given name must carry ONE
  // description. The canonical description for this name (from sibling tasks in the
  // day OR any other day in the workspace) is compared with what the user typed.
  // Sibling tasks take precedence over the cross-workspace map so an in-day rename
  // is checked against the freshest data.
  const siblingWithName = otherTasks.find((t) => t.task_name === trimmedName);
  const knownDescription =
    trimmedName !== ''
      ? siblingWithName
        ? (siblingWithName.task_description ?? '')
        : Object.prototype.hasOwnProperty.call(knownTaskDescriptions || {}, trimmedName)
          ? (knownTaskDescriptions[trimmedName] ?? '')
          : null
      : null;
  // Reuse with a DIFFERENT description is blocked. Same name + same description is
  // allowed (this supersedes the old unconditional within-day duplicate-name block).
  const descriptionConflict =
    knownDescription != null && knownDescription.trim() !== trimmedDescription;

  const nameBlank = trimmedName === '';
  const environmentBlank = taskEnvironment.trim() === '';
  const saveDisabled =
    nameBlank || environmentBlank || epochsHaveError || hasDanglingCamera || descriptionConflict;

  const danglingCameraErrorId = `${baseId}-dangling-camera-error`;
  const nameBlankErrorId = `${baseId}-name-blank-error`;
  const environmentErrorId = `${baseId}-environment-error`;
  const descriptionHintId = `${baseId}-description-hint`;
  const descriptionConflictId = `${baseId}-description-conflict`;
  const saveHintId = `${baseId}-save-hint`;

  // Human-readable reasons Save is blocked, announced to assistive tech so a
  // disabled Save button is never an unexplained dead-end. Each reason is a
  // complete, self-contained sentence so the combined hint reads grammatically
  // for any mix of reasons (the old shared "To save, add ${reasons}" template was
  // ungrammatical for the dangling-camera and description-conflict cases).
  const blockingReasons = [];
  if (nameBlank) blockingReasons.push('Enter a task name.');
  if (environmentBlank) blockingReasons.push('Enter a task environment.');
  if (epochsHaveError) blockingReasons.push('Make each epoch end after it starts.');
  if (hasDanglingCamera) {
    blockingReasons.push(
      `Remove camera reference${missingCameraIds.length > 1 ? 's' : ''} not defined for this animal (ids: ${missingCameraIds.join(', ')}) in the Cameras section.`
    );
  }
  if (descriptionConflict) {
    blockingReasons.push('Rename this task or match the existing description.');
  }
  const saveHint = blockingReasons.length ? `To save: ${blockingReasons.join(' ')}` : '';

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
   * Drop all dangling (animal-undefined) camera references from the selection.
   */
  function removeDanglingCameras() {
    setCameraIds((prev) => prev.filter((id) => availableCameraIds.has(id)));
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
      task_description: trimmedDescription,
      task_environment: taskEnvironment.trim(),
      camera_id: cameraIds,
      task_epochs: epochs,
    });
  }

  const showNameBlankError = touched.name && nameBlank;
  const showEnvironmentError = touched.environment && environmentBlank;
  const nameDescribedBy = descriptionConflict
    ? descriptionConflictId
    : showNameBlankError
      ? nameBlankErrorId
      : undefined;
  // The textarea always references its help hint; while a description conflict is
  // active it also references the conflict message so a screen-reader user hears
  // the conflict while focused on the description field.
  const descriptionDescribedBy = descriptionConflict
    ? `${descriptionHintId} ${descriptionConflictId}`
    : descriptionHintId;
  // Save announces its blocking reasons (the hint) and, when active, the specific
  // dangling-camera error so the reference id is reachable from the button itself.
  const saveDescribedBy =
    [saveHint ? saveHintId : null, hasDanglingCamera ? danglingCameraErrorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <form className="task-modal-form" onSubmit={(e) => e.preventDefault()}>
      <details open>
        <summary>Task details</summary>
        <div className="task-modal-section-body">
          <div className="form-group">
            <label htmlFor={`${baseId}-name`}>Task name (required)</label>
            <input
              id={`${baseId}-name`}
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
              required
              aria-required="true"
              aria-invalid={descriptionConflict || showNameBlankError}
              aria-describedby={nameDescribedBy}
            />
            {showNameBlankError && (
              <div id={nameBlankErrorId} className="inline-error" role="alert">
                Task name is required
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor={`${baseId}-environment`}>Task environment (required)</label>
            <input
              id={`${baseId}-environment`}
              type="text"
              value={taskEnvironment}
              onChange={(e) => setTaskEnvironment(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, environment: true }))}
              placeholder="e.g., HomeBox"
              required
              aria-required="true"
              aria-invalid={showEnvironmentError}
              aria-describedby={showEnvironmentError ? environmentErrorId : undefined}
            />
            {showEnvironmentError && (
              <div id={environmentErrorId} className="inline-error" role="alert">
                Task environment is required
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor={`${baseId}-description`}>Task description</label>
            <textarea
              id={`${baseId}-description`}
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              rows={2}
              aria-invalid={descriptionConflict}
              aria-describedby={descriptionDescribedBy}
            />
            <span id={descriptionHintId} className="help-text">
              Optional to save, but required before the day can be exported.
            </span>
            {descriptionConflict && (
              <div id={descriptionConflictId} className="inline-error" role="alert">
                <p className="task-identity-conflict-lead">
                  Task name &quot;{trimmedName}&quot; is already used in this dataset with a
                  different description. Spyglass treats the task name as an identity, so
                  one name must have one description. Use a new name or match the existing
                  description.
                </p>
                <dl className="task-identity-conflict-compare">
                  <div>
                    <dt>Existing description</dt>
                    <dd>{knownDescription || <em>(empty)</em>}</dd>
                  </div>
                  <div>
                    <dt>Your description</dt>
                    <dd>{trimmedDescription || <em>(empty)</em>}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </details>

      <details open={hasDanglingCamera}>
        <summary>Cameras</summary>
        <div className="task-modal-section-body">
          {(cameras || []).length === 0 ? (
            <div className="inline-info" role="status">
              No cameras are defined for this animal. Cameras are optional, but they
              link video and spatial tracking. You can add them in the Animal Editor;
              this task will still save without them.
            </div>
          ) : (
            <fieldset className="camera-checkboxes">
              <legend>Cameras used in this task</legend>
              {cameras.map((camera) => {
                const id = Number(camera.id);
                const details = [];
                if (camera.meters_per_pixel != null && camera.meters_per_pixel !== '') {
                  details.push(`${camera.meters_per_pixel} m/px`);
                }
                if (camera.lens) {
                  details.push(camera.lens);
                }
                return (
                  <label key={id} className="camera-checkbox">
                    <input
                      type="checkbox"
                      checked={cameraIds.includes(id)}
                      onChange={() => toggleCamera(id)}
                    />
                    {id} – {camera.camera_name || 'unnamed'}
                    {details.length > 0 ? ` (${details.join(', ')})` : ''}
                  </label>
                );
              })}
            </fieldset>
          )}

          {hasDanglingCamera && (
            <div id={danglingCameraErrorId} className="inline-error" role="alert">
              <p>
                This task references camera id{missingCameraIds.length > 1 ? 's' : ''}{' '}
                {missingCameraIds.join(', ')} not defined for this animal. Remove the
                reference{missingCameraIds.length > 1 ? 's' : ''} or restore the camera in
                the Animal Editor before saving.
              </p>
              <button
                type="button"
                className="button-small button-danger"
                onClick={removeDanglingCameras}
                aria-label={`Remove camera reference${missingCameraIds.length > 1 ? 's' : ''} ${missingCameraIds.join(', ')}`}
              >
                Remove camera reference{missingCameraIds.length > 1 ? 's' : ''}
              </button>
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
        {saveHint && (
          <p id={saveHintId} className="save-hint" role="status">
            {saveHint}
          </p>
        )}
        <button type="button" className="btn-cancel" onClick={onCancel} aria-label="Cancel">
          Cancel
        </button>
        <button
          type="button"
          className="btn-save"
          onClick={handleSave}
          disabled={saveDisabled}
          aria-label="Save task"
          aria-describedby={saveDescribedBy}
        >
          Save
        </button>
      </div>
    </form>
  );
}

TaskForm.propTypes = {
  task: PropTypes.object,
  existingTasks: PropTypes.array.isRequired,
  cameras: PropTypes.array,
  inheritedEvents: PropTypes.array,
  knownTaskDescriptions: PropTypes.object,
  animalId: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

TaskForm.defaultProps = {
  task: null,
  cameras: [],
  inheritedEvents: [],
  knownTaskDescriptions: {},
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
 * @param {Array} props.existingTasks Sibling tasks in the day (identity check).
 * @param {Array} props.cameras Animal cameras (multi-select options).
 * @param {Array} props.inheritedEvents Animal behavioral events (read-only display).
 * @param {object} [props.knownTaskDescriptions] Map of task_name -> canonical
 *   task_description across the workspace/dataset (excluding the task being edited).
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
  knownTaskDescriptions = {},
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
      task={task}
      existingTasks={existingTasks}
      cameras={cameras}
      inheritedEvents={inheritedEvents}
      knownTaskDescriptions={knownTaskDescriptions}
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
  knownTaskDescriptions: PropTypes.object,
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
  knownTaskDescriptions: {},
  animalId: undefined,
};

export default TaskModal;
