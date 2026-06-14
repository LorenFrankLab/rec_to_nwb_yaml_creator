import Button from '../../components/ui/Button';
import type { TaskType, TaskInstance, Camera } from '../../state/workspaceTypes';
import './TaskInstancesTable.scss';

interface TaskInstancesTableProps {
  /** The animal's task-type catalog (the resolution source). */
  taskTypes?: TaskType[];
  /** The day's ordered instances. */
  taskInstances?: TaskInstance[];
  /** The animal's cameras (for camera labels). */
  cameras?: Camera[];
  /** Open the add-task picker. */
  onAdd: () => void;
  /** Open the inline "define a new task type" flow. */
  onDefineNewType: () => void;
  /** Edit the instance at an index. */
  onEdit: (index: number) => void;
  /** Remove the instance at an index. */
  onRemove: (index: number) => void;
  /** Move an instance from one index to another. */
  onReorder: (from: number, to: number) => void;
}

/**
 * TaskInstancesTable — the day's chosen task types and their epochs (the "use per day" view).
 *
 * Each row resolves a `taskInstance` against the animal's `taskTypes`: the task name, environment,
 * and cameras come from the catalog (read-only here — they are edited once on the animal), and the
 * EPOCHS come from the day's instance (edited per day). Rows are ordered (the order is the exported
 * task order) with up/down controls. A dangling instance (its type was deleted on the animal) is
 * flagged so the user re-picks rather than silently dropping the task.
 */
export default function TaskInstancesTable({
  taskTypes = [],
  taskInstances = [],
  cameras = [],
  onAdd,
  onDefineNewType,
  onEdit,
  onRemove,
  onReorder,
}: TaskInstancesTableProps) {
  const typeById = new Map((Array.isArray(taskTypes) ? taskTypes : []).map((t) => [t?.id, t]));
  const instances = Array.isArray(taskInstances) ? taskInstances : [];

  const cameraLabel = (id: number | string) => {
    const camera = (Array.isArray(cameras) ? cameras : []).find((c) => String(c?.id) === String(id));
    return camera?.camera_name ? `${id} · ${camera.camera_name}` : String(id);
  };

  if (instances.length === 0) {
    return (
      <div className="task-instances empty-state">
        <div className="empty-state-icon">📋</div>
        <h3>No tasks recorded for this day</h3>
        <p>
          Pick the task types this day ran from the animal&apos;s catalog and assign each one&apos;s
          epochs. Defined the task once already? Just add it here.
        </p>
        <div className="task-instances-empty-actions">
          <Button variant="primary" onClick={onAdd}>
            Add Task
          </Button>
          <button type="button" className="button-small" onClick={onDefineNewType}>
            Define a new task type
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="task-instances">
      <div className="table-actions">
        <Button variant="primary" onClick={onAdd}>
          + Add Task
        </Button>
        <button type="button" className="button-small" onClick={onDefineNewType}>
          Define a new task type
        </button>
      </div>

      <div className="task-instances-table-scroll">
        <table className="task-instances-table" role="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Task</th>
              <th>Environment</th>
              <th>Cameras</th>
              <th>Epochs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((instance, index) => {
              const type = typeById.get(instance?.taskTypeId);
              const epochs = Array.isArray(instance?.task_epochs) ? instance.task_epochs : [];
              const cameraIds = Array.isArray(type?.camera_id) ? type.camera_id : [];
              const label = type?.task_name || 'Unknown task type';
              return (
                <tr key={`${instance?.taskTypeId ?? 'inst'}-${index}`} className={type ? '' : 'task-instance-dangling'}>
                  <td data-label="Order">
                    <div className="task-instance-order">
                      <Button
                        variant="neutral"
                        size="small"
                        className="order-button"
                        disabled={index === 0}
                        onClick={() => onReorder(index, index - 1)}
                        aria-label={`Move ${label} earlier`}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="neutral"
                        size="small"
                        className="order-button"
                        disabled={index === instances.length - 1}
                        onClick={() => onReorder(index, index + 1)}
                        aria-label={`Move ${label} later`}
                      >
                        ↓
                      </Button>
                    </div>
                  </td>
                  <td data-label="Task" title={label}>
                    {type ? (
                      label
                    ) : (
                      <span className="status-badge status-incomplete" role="img" aria-label="Unknown task type — re-pick">
                        {label}
                      </span>
                    )}
                  </td>
                  <td data-label="Environment" title={type?.task_environment || ''}>{type?.task_environment || '—'}</td>
                  <td data-label="Cameras">{cameraIds.length > 0 ? cameraIds.map(cameraLabel).join(', ') : '—'}</td>
                  <td data-label="Epochs">{epochs.length > 0 ? epochs.join(', ') : '—'}</td>
                  <td data-label="Actions">
                    <Button
                      variant="neutral"
                      size="small"
                      onClick={() => onEdit(index)}
                      aria-label={`Edit ${label} for this day`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="dangerSubtle"
                      size="small"
                      onClick={() => onRemove(index)}
                      aria-label={`Remove ${label} from this day`}
                    >
                      Remove
                    </Button>
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

