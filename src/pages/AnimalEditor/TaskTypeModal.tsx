import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import Modal from '../../components/Modal/Modal';
import { getAnimalCameras } from '../../state/workspaceSelectors';
import type { Camera, TaskType } from '../../state/workspaceTypes';
import type { TaskTypeDefinitionInput } from '../../state/taskCatalogActions';
import './TaskTypeModal.scss';

/** Local form state for the task-type editor (scalars as strings, cameras as string keys). */
interface TaskTypeFormData {
  task_name: string;
  task_description: string;
  task_environment: string;
  camera_id: string[];
}

/**
 * Initial form state, computed once at mount (the Modal only renders this form while open, so it
 * remounts per open and this runs fresh).
 *
 * @param mode - 'add' or 'edit'.
 * @param taskType - The task type being edited (edit mode).
 * @returns Initial form values.
 */
function getInitialFormData(mode: string, taskType: TaskType | null): TaskTypeFormData {
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

interface TaskTypeFormProps {
  /** 'add' or 'edit'. */
  mode: 'add' | 'edit';
  /** Task type for edit mode. */
  taskType?: TaskType | null;
  /** The animal's cameras (for the camera multi-select). */
  cameras: Camera[];
  /** A name-collision message from the parent (kept open on clash). */
  nameError?: string | null;
  /** Save callback with the cleaned task-type definition. */
  onSave: (definition: TaskTypeDefinitionInput) => void;
  /** Cancel callback. */
  onCancel: () => void;
}

/**
 * Task-type add/edit form. Owns field state + validation; the parent persists the cleaned object.
 */
function TaskTypeForm({ mode, taskType = null, cameras, nameError = null, onSave, onCancel }: TaskTypeFormProps) {
  const [formData, setFormData] = useState<TaskTypeFormData>(() => getInitialFormData(mode, taskType));
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isFormValid = () =>
    formData.task_name.trim() !== '' &&
    formData.task_description.trim() !== '' &&
    formData.task_environment.trim() !== '';

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }) as TaskTypeFormData);
  };

  const toggleCamera = (cameraId: number | string) => {
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
    <Modal
      isOpen
      onClose={onCancel}
      title={mode === 'edit' ? 'Edit Task Type' : 'Add Task Type'}
      titleId="task-type-modal-title"
      className="task-type-modal-content"
      footer={
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
      }
    >
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

      </form>
    </Modal>
  );
}

interface TaskTypeModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** 'add' or 'edit'. */
  mode?: 'add' | 'edit';
  /** Task type for edit mode. */
  taskType?: TaskType | null;
  /** The owning animal (for the camera multi-select); read through the tolerant selector. */
  animal: unknown;
  /** Name-collision message (keeps the modal open on a clash). */
  nameError?: string | null;
  /** Save callback with the cleaned definition. */
  onSave: (definition: TaskTypeDefinitionInput) => void;
  /** Cancel/close callback. */
  onCancel: () => void;
}

/**
 * TaskTypeModal — add/edit an animal task type. Dialog a11y (focus trap/return, ESC/overlay close,
 * scroll lock) comes from the shared Modal primitive, which TaskTypeForm renders directly so the
 * Save/Cancel actions ride in the sticky footer while sharing the form's state. The form mounts
 * only while open, so its state initializes fresh on each open.
 */
const TaskTypeModal = ({ isOpen, mode = 'add', taskType = null, animal, nameError = null, onSave, onCancel }: TaskTypeModalProps) =>
  isOpen ? (
    <TaskTypeForm
      mode={mode}
      taskType={taskType}
      cameras={getAnimalCameras(animal)}
      nameError={nameError}
      onSave={onSave}
      onCancel={onCancel}
    />
  ) : null;

export default TaskTypeModal;
