import { useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import TaskEpochsEditor from './TaskEpochsEditor';
import './TaskInstanceModal.scss';

/**
 * TaskInstanceModal — pick which animal task type this day ran and assign its epochs.
 *
 * This is the "use per day" half of the task-type catalog: the user SELECTS a task type the animal
 * already defines (recognition, not recall) and assigns the epochs that ran this day — they never
 * retype the task's name/description/environment/cameras (those live on the animal). A "Define a new
 * task type" action lets the user add a missing type to the animal catalog inline (handled by the
 * parent) without leaving day entry. Produces a `{ taskTypeId, task_epochs }` instance.
 *
 * @param {object} props
 * @param {string} props.mode - 'add' or 'edit'.
 * @param {object|null} props.instance - The instance being edited (edit mode).
 * @param {Array} props.taskTypes - The animal's task types (the pick list).
 * @param {Function} props.onSave - Called with the cleaned `{ taskTypeId, task_epochs }`.
 * @param {Function} props.onCancel - Cancel/close callback.
 * @param {Function} props.onDefineNewType - Open the inline "define a new task type" flow.
 * @returns {JSX.Element}
 */
function TaskInstanceForm({ mode, instance, taskTypes, onSave, onCancel, onDefineNewType }) {
  // Default the selection to the edited instance's type, else the first available type.
  const [taskTypeId, setTaskTypeId] = useState(
    () => instance?.taskTypeId ?? (taskTypes[0]?.id ?? '')
  );
  const [epochs, setEpochs] = useState(() =>
    Array.isArray(instance?.task_epochs) ? instance.task_epochs : []
  );
  const [epochsHaveError, setEpochsHaveError] = useState(false);

  const selectedExists = taskTypes.some((t) => t.id === taskTypeId);
  const canSave = taskTypeId !== '' && selectedExists && !epochsHaveError;

  const handleEpochsChange = ({ epochs: nextEpochs, hasError }) => {
    setEpochs(nextEpochs);
    setEpochsHaveError(hasError);
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({ taskTypeId, task_epochs: epochs });
  };

  if (taskTypes.length === 0) {
    return (
      <div className="task-instance-form task-instance-empty">
        <p>
          This animal has no task types yet. Define a task once on the animal, then pick it here for
          each day that ran it.
        </p>
        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-save" onClick={onDefineNewType}>
            Define a new task type
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="task-instance-form">
      <div className="form-group">
        <label htmlFor="task-instance-type">Task type</label>
        <select
          id="task-instance-type"
          value={taskTypeId}
          onChange={(e) => setTaskTypeId(e.target.value)}
        >
          {taskTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.task_name}
              {type.task_environment ? ` — ${type.task_environment}` : ''}
            </option>
          ))}
        </select>
        <button type="button" className="task-instance-define-new" onClick={onDefineNewType}>
          + Define a new task type
        </button>
      </div>

      <div className="form-group">
        <span className="task-instance-epochs-label" id="task-instance-epochs-label">
          Epochs that ran this day
        </span>
        <TaskEpochsEditor initialEpochs={epochs} onChange={handleEpochsChange} />
      </div>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel} aria-label="Cancel and close modal">
          Cancel
        </button>
        <button
          type="button"
          className="btn-save"
          onClick={handleSave}
          disabled={!canSave}
          aria-label="Save task for this day"
        >
          Save
        </button>
      </div>
    </form>
  );
}

TaskInstanceForm.propTypes = {
  mode: PropTypes.oneOf(['add', 'edit']).isRequired,
  instance: PropTypes.object,
  taskTypes: PropTypes.array.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onDefineNewType: PropTypes.func.isRequired,
};

TaskInstanceForm.defaultProps = { instance: null };

/**
 * TaskInstanceModal — modal wrapper around {@link TaskInstanceForm}. Dialog a11y comes from Modal.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is open.
 * @param {string} [props.mode] - 'add' or 'edit'.
 * @param {object|null} [props.instance] - The instance being edited (edit mode).
 * @param {Array} props.taskTypes - The animal's task types (the pick list).
 * @param {Function} props.onSave - Save callback with `{ taskTypeId, task_epochs }`.
 * @param {Function} props.onCancel - Cancel/close callback.
 * @param {Function} props.onDefineNewType - Open the inline "define a new task type" flow.
 * @returns {JSX.Element}
 */
const TaskInstanceModal = ({ isOpen, mode = 'add', instance = null, taskTypes, onSave, onCancel, onDefineNewType }) => (
  <Modal
    isOpen={isOpen}
    onClose={onCancel}
    title={mode === 'edit' ? 'Edit task for this day' : 'Add task to this day'}
    titleId="task-instance-modal-title"
    className="task-instance-modal-content"
  >
    <TaskInstanceForm
      mode={mode}
      instance={instance}
      taskTypes={taskTypes}
      onSave={onSave}
      onCancel={onCancel}
      onDefineNewType={onDefineNewType}
    />
  </Modal>
);

TaskInstanceModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(['add', 'edit']),
  instance: PropTypes.object,
  taskTypes: PropTypes.array.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onDefineNewType: PropTypes.func.isRequired,
};

TaskInstanceModal.defaultProps = { mode: 'add', instance: null };

export default TaskInstanceModal;
