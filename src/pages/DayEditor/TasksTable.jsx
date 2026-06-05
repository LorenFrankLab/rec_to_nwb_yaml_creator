import { useState } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from '../../components/Modal';
import './TasksTable.scss';

const REQUIRED_STRING_FIELDS = [
  { key: 'task_name', label: 'task name' },
  { key: 'task_description', label: 'task description' },
  { key: 'task_environment', label: 'task environment' },
];

/**
 * Per-task status, conveyed beyond color by the badge glyph AND an explanatory
 * label (used as the badge's accessible name and tooltip):
 *   ❌ a required string field is blank (schema would reject the task);
 *   ⚠ the task has no epochs, or references a camera the animal lacks;
 *   ✓ otherwise.
 *
 * Overlapping-epoch warnings are surfaced live in the epoch editor only — epoch
 * start/end times are not persisted, so they cannot be derived from a saved task.
 *
 * @param {object} task Task record.
 * @param {Array} cameras Animal cameras.
 * @returns {{glyph: '✓'|'⚠'|'❌', label: string}}
 */
function getStatus(task, cameras) {
  const blankFields = REQUIRED_STRING_FIELDS.filter(({ key }) => {
    const value = task[key];
    return value === undefined || value === null || String(value).trim() === '';
  });
  if (blankFields.length > 0) {
    return {
      glyph: '❌',
      label: `Missing required ${blankFields.map((f) => f.label).join(', ')}`,
    };
  }

  const availableIds = new Set((cameras || []).map((c) => Number(c.id)));
  const referencesMissingCamera = (task.camera_id || []).some(
    (id) => !availableIds.has(Number(id))
  );
  const hasNoEpochs = (task.task_epochs || []).length === 0;
  const warnings = [];
  if (hasNoEpochs) warnings.push('no epochs assigned');
  if (referencesMissingCamera) warnings.push('references a camera this animal no longer has');
  if (warnings.length > 0) {
    return { glyph: '⚠', label: `Warning: ${warnings.join('; ')}` };
  }

  return { glyph: '✓', label: 'Complete' };
}

/**
 * TasksTable - CRUD table for a day's tasks, mirroring CamerasSection's table /
 * empty-state / status-badge conventions. Delete is confirmed via the shared
 * ConfirmDialog (no raw window.confirm). Add/Edit/Delete are delegated to the
 * parent, which owns task persistence through onFieldUpdate.
 *
 * Repair-before-orphaning (Phase 6 Task 0c): when deleting a task would orphan
 * `associated_video_files` (their epoch would vanish), the confirmation names the
 * affected videos so the user is not blindsided. The parent's delete handler then
 * clears those references deterministically.
 *
 * @param {object} props
 * @param {Array} props.tasks Day tasks.
 * @param {Array} props.cameras Animal cameras (for status + display).
 * @param {Function} props.onAdd Add-task handler.
 * @param {Function} props.onEdit Edit handler, called with the task index.
 * @param {Function} props.onDelete Delete handler, called with the task index.
 * @param {Function} [props.affectedVideosForDelete] `(index) => Array` of videos
 *   that deleting task `index` would orphan, for the confirmation notice.
 * @returns {JSX.Element}
 */
export default function TasksTable({
  tasks,
  cameras,
  onAdd,
  onEdit,
  onDelete,
  affectedVideosForDelete,
}) {
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState(null);

  /**
   * Confirm and execute the pending delete.
   */
  function confirmDelete() {
    const index = pendingDeleteIndex;
    setPendingDeleteIndex(null);
    if (index == null) return;
    onDelete(index);
  }

  /**
   * Build the delete-confirmation message, appending an affected-video notice when
   * deleting this task would orphan associated videos.
   * @param {number} index Task index slated for deletion.
   * @returns {string}
   */
  function deleteMessage(index) {
    if (index == null || !tasks[index]) return '';
    const base = `Delete task "${tasks[index].task_name || '(unnamed task)'}"? This removes it from this day.`;
    const affected = affectedVideosForDelete ? affectedVideosForDelete(index) : [];
    if (affected.length === 0) return base;
    const names = affected.map((v) => v.name || '(unnamed)').join(', ');
    return `${base} This will also unset the epoch reference on associated video file${affected.length > 1 ? 's' : ''}: ${names}.`;
  }

  if (tasks.length === 0) {
    return (
      <div className="tasks-table-section empty-state">
        <div className="empty-state-icon">🧩</div>
        <h3>No Tasks Configured</h3>
        <p>
          Tasks describe what the animal did during the session — the environment,
          the cameras that recorded it, and the epochs it spanned.
        </p>
        <p className="empty-state-hint">
          Each task inherits this animal&apos;s cameras and behavioral events.
        </p>
        <button type="button" className="button-primary" onClick={onAdd}>
          Add First Task
        </button>
      </div>
    );
  }

  return (
    <div className="tasks-table-section">
      <header className="section-header">
        <h2>Tasks</h2>
        <p>Define the behavioral tasks recorded on this day.</p>
      </header>

      <div className="table-actions">
        <button type="button" className="button-primary" onClick={onAdd}>
          + Add Task
        </button>
      </div>

      <table className="tasks-table" role="table">
        <thead>
          <tr>
            <th scope="col">Task</th>
            <th scope="col">Cameras</th>
            <th scope="col">Epochs</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, index) => {
            const status = getStatus(task, cameras);
            const cameraIds = task.camera_id || [];
            return (
              <tr key={index}>
                <td data-label="Task">{task.task_name || <em>unnamed</em>}</td>
                <td data-label="Cameras">
                  {cameraIds.length === 0 ? '—' : cameraIds.join(', ')}
                </td>
                <td data-label="Epochs">{(task.task_epochs || []).length}</td>
                <td data-label="Status">
                  <span
                    className={`status-badge status-${status.glyph}`}
                    title={status.label}
                  >
                    <span aria-hidden="true">{status.glyph}</span>
                    <span className="sr-only">{status.label}</span>
                  </span>
                </td>
                <td data-label="Actions">
                  <button type="button" className="button-small" onClick={() => onEdit(index)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button-small button-danger"
                    onClick={() => setPendingDeleteIndex(index)}
                    aria-label={`Delete task ${task.task_name || index + 1}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmDialog
        isOpen={pendingDeleteIndex != null}
        title="Delete task?"
        message={deleteMessage(pendingDeleteIndex)}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteIndex(null)}
      />
    </div>
  );
}

TasksTable.propTypes = {
  tasks: PropTypes.arrayOf(PropTypes.object).isRequired,
  cameras: PropTypes.arrayOf(PropTypes.object),
  onAdd: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  affectedVideosForDelete: PropTypes.func,
};

TasksTable.defaultProps = {
  cameras: [],
  affectedVideosForDelete: undefined,
};
