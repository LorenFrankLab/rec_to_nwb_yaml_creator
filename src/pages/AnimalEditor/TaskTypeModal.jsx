import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import { getAnimalCameras } from '../../state/workspaceSelectors';
import './TaskTypeModal.scss';

/**
 * Initial form state, computed once at mount (the Modal only renders this form while open, so it
 * remounts per open and this runs fresh).
 *
 * @param {string} mode - 'add' or 'edit'.
 * @param {object|null} taskType - The task type being edited (edit mode).
 * @returns {object} Initial form values.
 */
function getInitialFormData(mode, taskType) {
  if (mode === 'edit' && taskType) {
    return {
      task_name: taskType.task_name || '',
      task_description: taskType.task_description || '',
      task_environment: taskType.task_environment || '',
      camera_id: Array.isArray(taskType.camera_id) ? taskType.camera_id.map((id) => String(id)) : [],
    };
  }
  return { task_name: '', task_description: '', task_environment: '', camera_id: [] };
}

/**
 * Task-type add/edit form. Owns field state + validation; the parent persists the cleaned object.
 *
 * @param {object} props
 * @param {string} props.mode - 'add' or 'edit'.
 * @param {object|null} props.taskType - Task type for edit mode.
 * @param {Array} props.cameras - The animal's cameras (for the camera multi-select).
 * @param {string|null} props.nameError - A name-collision message from the parent (kept open on clash).
 * @param {Function} props.onSave - Save callback with the cleaned task-type definition.
 * @param {Function} props.onCancel - Cancel callback.
 * @returns {JSX.Element}
 */
function TaskTypeForm({ mode, taskType, cameras, nameError, onSave, onCancel }) {
  const [formData, setFormData] = useState(() => getInitialFormData(mode, taskType));
  const nameInputRef = useRef(null);

  const isFormValid = () =>
    formData.task_name.trim() !== '' &&
    formData.task_description.trim() !== '' &&
    formData.task_environment.trim() !== '';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleCamera = (cameraId) => {
    const key = String(cameraId);
    setFormData((prev) => ({
      ...prev,
      camera_id: prev.camera_id.includes(key)
        ? prev.camera_id.filter((id) => id !== key)
        : [...prev.camera_id, key],
    }));
  };

  const handleSave = () => {
    if (!isFormValid()) return;
    onSave({
      task_name: formData.task_name.trim(),
      task_description: formData.task_description.trim(),
      task_environment: formData.task_environment.trim(),
      // Camera ids are integers downstream; keep only those that parse (the checklist only offers
      // real animal cameras, so this is a safety net).
      camera_id: formData.camera_id
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id)),
    });
  };

  return (
    <form className="task-type-modal-form">
      <div className="form-group">
        <label htmlFor="task_name">Task name</label>
        <input
          id="task_name"
          type="text"
          name="task_name"
          ref={nameInputRef}
          placeholder="e.g., w-track"
          value={formData.task_name}
          onChange={handleInputChange}
          aria-describedby="task_name_help"
          required
        />
        <span id="task_name_help" className="help-text">
          The task&apos;s identity in Spyglass — same name means the same task. Two task types can&apos;t
          share a name with different details.
        </span>
        {nameError && (
          <span className="error-text" role="alert">
            {nameError}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="task_description">Description</label>
        <input
          id="task_description"
          type="text"
          name="task_description"
          placeholder="e.g., Continuous alternation for water reward"
          value={formData.task_description}
          onChange={handleInputChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="task_environment">Environment</label>
        <input
          id="task_environment"
          type="text"
          name="task_environment"
          placeholder="e.g., elevated W-track"
          value={formData.task_environment}
          onChange={handleInputChange}
          required
        />
      </div>

      <fieldset className="form-group task-type-cameras">
        <legend>Cameras used</legend>
        {cameras.length === 0 ? (
          <span className="help-text">No cameras defined on this animal yet (optional).</span>
        ) : (
          <div className="task-type-camera-list">
            {cameras.map((camera) => {
              const key = String(camera.id);
              const label = camera.camera_name ? `${camera.id} · ${camera.camera_name}` : `Camera ${camera.id}`;
              return (
                <label key={key} className="task-type-camera-option">
                  <input
                    type="checkbox"
                    checked={formData.camera_id.includes(key)}
                    onChange={() => toggleCamera(camera.id)}
                  />
                  {label}
                </label>
              );
            })}
          </div>
        )}
        <span className="help-text">
          Which cameras recorded this task. Each day still confirms the cameras it actually used.
        </span>
      </fieldset>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel} aria-label="Cancel and close modal">
          Cancel
        </button>
        <button
          type="button"
          className="btn-save"
          onClick={handleSave}
          disabled={!isFormValid()}
          aria-label="Save task type"
        >
          Save
        </button>
      </div>
    </form>
  );
}

TaskTypeForm.propTypes = {
  mode: PropTypes.oneOf(['add', 'edit']).isRequired,
  taskType: PropTypes.object,
  cameras: PropTypes.array.isRequired,
  nameError: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

TaskTypeForm.defaultProps = { taskType: null, nameError: null };

/**
 * TaskTypeModal — add/edit an animal task type. Dialog a11y (focus trap/return, ESC/overlay close,
 * scroll lock) comes from the shared Modal primitive.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is open.
 * @param {string} props.mode - 'add' or 'edit'.
 * @param {object|null} props.taskType - Task type for edit mode.
 * @param {object} props.animal - The owning animal (for the camera multi-select).
 * @param {string|null} props.nameError - Name-collision message (keeps the modal open on a clash).
 * @param {Function} props.onSave - Save callback with the cleaned definition.
 * @param {Function} props.onCancel - Cancel/close callback.
 * @returns {JSX.Element}
 */
const TaskTypeModal = ({ isOpen, mode = 'add', taskType = null, animal, nameError = null, onSave, onCancel }) => (
  <Modal
    isOpen={isOpen}
    onClose={onCancel}
    title={mode === 'edit' ? 'Edit Task Type' : 'Add Task Type'}
    titleId="task-type-modal-title"
    className="task-type-modal-content"
  >
    <TaskTypeForm
      mode={mode}
      taskType={taskType}
      cameras={getAnimalCameras(animal)}
      nameError={nameError}
      onSave={onSave}
      onCancel={onCancel}
    />
  </Modal>
);

TaskTypeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(['add', 'edit']),
  taskType: PropTypes.object,
  animal: PropTypes.object.isRequired,
  nameError: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

TaskTypeModal.defaultProps = { mode: 'add', taskType: null, nameError: null };

export default TaskTypeModal;
