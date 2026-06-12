import PropTypes from 'prop-types';
import { getAnimalTaskTypes, getAnimalCameras } from '../../state/workspaceSelectors';
import { duplicateTaskTypeNames } from '../../validation/taskCatalogValidation';
import { rawArray } from '../../components/rawPropTypes';
import Button from '../../components/ui/Button';
import './TaskTypesSection.scss';

/**
 * TaskTypesSection — the animal-level task-type catalog (define once, reuse per day).
 *
 * A *task type* (e.g. "sleep", "w-track") is defined ONCE on the animal; each recording day selects
 * which types it ran and orders their epochs (the Day Editor's Tasks & Epochs step). This section is
 * the catalog editor: it lists the defined types with their Spyglass-identity fields (name,
 * description, environment, cameras) and a status badge, and delegates add/edit/delete to the parent
 * container (mirrors {@link module:pages/AnimalEditor/CamerasSection}). The dedup key is `task_name`
 * — a duplicate name is the Spyglass identity collision, flagged here and by `duplicate_task_type_name`.
 *
 * @param {object} props
 * @param {object} props.animal - Animal record with `taskTypes` (and `cameras` for camera labels).
 * @param {Function} props.onFieldUpdate - Field-update callback (parent's responsibility to persist).
 * @param {Function} [props.onAdd] - Add button handler.
 * @param {Function} [props.onEdit] - Edit handler (task type id).
 * @param {Function} [props.onDelete] - Delete handler (task type object).
 * @returns {JSX.Element}
 */
export default function TaskTypesSection({ animal, onFieldUpdate, onAdd, onEdit, onDelete }) {
  // Tolerant reads (this is a repair destination): a corrupt non-array degrades to the empty state.
  const taskTypes = getAnimalTaskTypes(animal);
  const cameras = getAnimalCameras(animal);
  const duplicateNames = new Set(duplicateTaskTypeNames(taskTypes));

  /**
   * Map a camera id to a short human label ("0 · box") for the Cameras column.
   * @param id
   */
  const cameraLabel = (id) => {
    const camera = cameras.find((c) => String(c?.id) === String(id));
    const name = camera?.camera_name;
    return name ? `${id} · ${name}` : String(id);
  };

  /**
   * Status for a task type: duplicate name (Spyglass identity collision) > incomplete (a required
   * identity field missing) > complete.
   *
   * @param {object} type
   * @returns {'duplicate'|'incomplete'|'complete'}
   */
  function getStatus(type) {
    if (typeof type?.task_name === 'string' && duplicateNames.has(type.task_name)) return 'duplicate';
    const required = ['task_name', 'task_description', 'task_environment'];
    const complete = required.every((field) => {
      const value = type?.[field];
      return typeof value === 'string' && value.trim() !== '';
    });
    return complete ? 'complete' : 'incomplete';
  }

  /** @param {string} status @returns {string} Human-readable status (a11y + colorblind). */
  function getStatusText(status) {
    if (status === 'duplicate') return 'Duplicate task name — must be unique';
    if (status === 'incomplete') return 'Incomplete: name, description, and environment are required';
    return 'Complete';
  }

  /** @param {string} status @returns {string} Status glyph. */
  function getStatusSymbol(status) {
    if (status === 'complete') return '✓';
    if (status === 'duplicate') return '❌';
    return '⚠';
  }

  if (taskTypes.length === 0) {
    return (
      <div className="task-types-section empty-state">
        <div className="empty-state-icon">📋</div>
        <h3>No Task Types Defined</h3>
        <p>
          Define each behavioral task once here (e.g. <em>sleep</em>, <em>w-track</em>). Each recording
          day then picks which task types it ran and assigns their epochs — you never retype a task.
        </p>
        <p className="empty-state-hint">
          A task type carries its name, description, environment, and the cameras it uses. The name is
          a Spyglass identity, so two task types can&apos;t share a name.
        </p>
        <Button variant="primary" onClick={() => onAdd?.()}>
          Add First Task Type
        </Button>
      </div>
    );
  }

  return (
    <div className="task-types-section">
      <header className="section-header">
        <h2>Task Types</h2>
        <p>
          Define each task once; recording days select and order them. Defined on the animal — the
          epochs that ran each day are set per day in the Day Editor.
        </p>
      </header>

      <div className="table-actions">
        <Button variant="primary" onClick={() => onAdd?.()}>
          + Add Task Type
        </Button>
      </div>

      <div className="task-types-table-scroll">
        <table className="task-types-table" role="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Environment</th>
              <th>Cameras</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {taskTypes.map((type, index) => {
              const status = getStatus(type);
              const statusText = getStatusText(status);
              const cameraIds = Array.isArray(type?.camera_id) ? type.camera_id : [];
              return (
                <tr key={`${type?.id ?? 'type'}-${index}`}>
                  <td data-label="Name" title={type?.task_name || ''}>{type?.task_name || ''}</td>
                  <td data-label="Description" title={type?.task_description || ''}>{type?.task_description || ''}</td>
                  <td data-label="Environment" title={type?.task_environment || ''}>{type?.task_environment || ''}</td>
                  <td data-label="Cameras">{cameraIds.length > 0 ? cameraIds.map(cameraLabel).join(', ') : '—'}</td>
                  <td data-label="Status">
                    <span
                      className={`status-badge status-${status}`}
                      role="img"
                      aria-label={statusText}
                      title={statusText}
                    >
                      {getStatusSymbol(status)}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <button
                      className="button-small"
                      onClick={() => onEdit?.(type?.id)}
                      aria-label={`Edit task type ${type?.task_name || ''}`}
                    >
                      Edit
                    </button>
                    <button
                      className="button-small button-danger"
                      onClick={() => onDelete?.(type)}
                      aria-label={`Delete task type ${type?.task_name || ''}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

TaskTypesSection.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    // Tolerant: this is a repair destination — a corrupt non-array `taskTypes` is the very state it
    // surfaces (read through getAnimalTaskTypes), so it must not warn on it.
    taskTypes: rawArray(PropTypes.object),
    cameras: rawArray(PropTypes.object),
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
  onAdd: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
};

TaskTypesSection.defaultProps = {
  onAdd: null,
  onEdit: null,
  onDelete: null,
};
