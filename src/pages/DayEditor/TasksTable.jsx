import { useState } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from '../../components/Modal';
import './TasksTable.scss';

const REQUIRED_STRING_FIELDS = ['task_name', 'task_description', 'task_environment'];

/**
 * Per-task status, conveyed beyond color by the badge glyph:
 *   ❌ a required string field is blank (schema would reject the task);
 *   ⚠ the task has no epochs, or references a camera the animal lacks;
 *   ✓ otherwise.
 *
 * Overlapping-epoch warnings are surfaced live in the epoch editor only — epoch
 * start/end times are not persisted, so they cannot be derived from a saved task.
 *
 * @param {object} task Task record.
 * @param {Array} cameras Animal cameras.
 * @returns {'✓'|'⚠'|'❌'}
 */
function getStatus(task, cameras) {
  const hasBlankRequired = REQUIRED_STRING_FIELDS.some((field) => {
    const value = task[field];
    return value === undefined || value === null || String(value).trim() === '';
  });
  if (hasBlankRequired) return '❌';

  const availableIds = new Set((cameras || []).map((c) => Number(c.id)));
  const referencesMissingCamera = (task.camera_id || []).some(
    (id) => !availableIds.has(Number(id))
  );
  const hasNoEpochs = (task.task_epochs || []).length === 0;
  if (hasNoEpochs || referencesMissingCamera) return '⚠';

  return '✓';
}

/**
 * TasksTable - CRUD table for a day's tasks, mirroring CamerasSection's table /
 * empty-state / status-badge conventions. Delete is confirmed via the shared
 * ConfirmDialog (no raw window.confirm). Add/Edit/Delete are delegated to the
 * parent, which owns task persistence through onFieldUpdate.
 *
 * @param {object} props
 * @param {Array} props.tasks Day tasks.
 * @param {Array} props.cameras Animal cameras (for status + display).
 * @param {Function} props.onAdd Add-task handler.
 * @param {Function} props.onEdit Edit handler, called with the task index.
 * @param {Function} props.onDelete Delete handler, called with the task index.
 * @returns {JSX.Element}
 */
export default function TasksTable({ tasks, cameras, onAdd, onEdit, onDelete }) {
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
        <button className="button-primary" onClick={onAdd}>
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
        <button className="button-primary" onClick={onAdd}>
          + Add Task
        </button>
      </div>

      <table className="tasks-table" role="table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Cameras</th>
            <th>Epochs</th>
            <th>Status</th>
            <th>Actions</th>
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
                  <span className={`status-badge status-${status}`}>{status}</span>
                </td>
                <td data-label="Actions">
                  <button className="button-small" onClick={() => onEdit(index)}>
                    Edit
                  </button>
                  <button
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
        message={
          pendingDeleteIndex != null && tasks[pendingDeleteIndex]
            ? `Delete task "${tasks[pendingDeleteIndex].task_name || '(unnamed task)'}"? This removes it from this day.`
            : ''
        }
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
};

TasksTable.defaultProps = {
  cameras: [],
};
