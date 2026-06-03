import { useState } from 'react';
import PropTypes from 'prop-types';
import TasksTable from './TasksTable';
import TaskModal from './TaskModal';
import BehavioralEventsDisplay from './BehavioralEventsDisplay';
import './TasksEpochsStep.scss';

/**
 * TasksEpochsStep - Day Editor step for per-day tasks and epochs.
 *
 * Tasks inherit the parent animal's cameras and behavioral events (read from the
 * `animal` prop, never `mergedDay`). All persistence flows through
 * `onFieldUpdate('tasks', …)` / `onFieldUpdate('behavioral_events', …)`, which the
 * stepper routes to the store's `updateDay`; this component never touches the
 * store directly.
 *
 * The stepper also passes `mergedDay`, but this step deliberately ignores it:
 * tasks and behavioral events are read from `animal`/`day` directly so inheritance
 * stays explicit.
 *
 * @param {object} props
 * @param {object} props.animal - Parent animal (source of cameras + behavioral events).
 * @param {object} props.day - The day being edited (tasks + day-specific events).
 * @param {Function} props.onFieldUpdate - `(fieldPath, value)` updater.
 * @returns {JSX.Element}
 */
export default function TasksEpochsStep({ animal, day, onFieldUpdate }) {
  const tasks = day.tasks || [];
  const cameras = animal.cameras || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editingIndex, setEditingIndex] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const showCameraBanner = cameras.length === 0 && !bannerDismissed;
  const editingTask = modalMode === 'edit' && editingIndex != null ? tasks[editingIndex] : null;

  /**
   * Open the modal to add a task.
   */
  function handleAddTask() {
    setModalMode('add');
    setEditingIndex(null);
    setModalOpen(true);
  }

  /**
   * Open the modal to edit the task at `index`.
   * @param {number} index Task index.
   */
  function handleEditTask(index) {
    setModalMode('edit');
    setEditingIndex(index);
    setModalOpen(true);
  }

  /**
   * Persist a saved task (append in add mode, replace at index in edit mode).
   * @param {object} taskData Saved task object.
   */
  function handleSaveTask(taskData) {
    if (modalMode === 'edit' && editingIndex != null) {
      onFieldUpdate('tasks', tasks.map((t, i) => (i === editingIndex ? taskData : t)));
    } else {
      onFieldUpdate('tasks', [...tasks, taskData]);
    }
    setModalOpen(false);
    setEditingIndex(null);
  }

  /**
   * Delete the task at `index`.
   * @param {number} index Task index.
   */
  function handleDeleteTask(index) {
    onFieldUpdate('tasks', tasks.filter((_, i) => i !== index));
  }

  /**
   * Close the modal without saving.
   */
  function handleCancel() {
    setModalOpen(false);
    setEditingIndex(null);
  }

  return (
    <div className="day-editor-section tasks-epochs-step">
      <h2>Tasks &amp; Epochs</h2>

      {showCameraBanner && (
        <div
          className="camera-info-banner"
          role="status"
          aria-live="polite"
          aria-label="Cameras recommended"
        >
          <span className="camera-info-icon" aria-hidden="true">📹</span>
          <div className="camera-info-text">
            This animal has no cameras configured. Cameras are optional, but they
            enable video linking and spatial tracking for your tasks.
          </div>
          <div className="camera-info-actions">
            <a href={`#/animal/${animal.id}/editor`} className="button-secondary">
              Add cameras
            </a>
            <button
              type="button"
              className="button-small"
              onClick={() => setBannerDismissed(true)}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      <TasksTable
        tasks={tasks}
        cameras={cameras}
        onAdd={handleAddTask}
        onEdit={handleEditTask}
        onDelete={handleDeleteTask}
      />

      <section className="behavioral-events-block">
        <BehavioralEventsDisplay
          inheritedEvents={animal.behavioral_events}
          dayEvents={day.behavioral_events}
          onDayEventsChange={(events) => onFieldUpdate('behavioral_events', events)}
        />
      </section>

      <TaskModal
        isOpen={modalOpen}
        mode={modalMode}
        task={editingTask}
        existingTasks={tasks}
        cameras={cameras}
        inheritedEvents={animal.behavioral_events}
        animalId={animal.id}
        onSave={handleSaveTask}
        onCancel={handleCancel}
      />
    </div>
  );
}

TasksEpochsStep.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string,
    cameras: PropTypes.array,
    behavioral_events: PropTypes.array,
  }).isRequired,
  day: PropTypes.shape({
    tasks: PropTypes.array,
    behavioral_events: PropTypes.array,
  }).isRequired,
  mergedDay: PropTypes.object,
  onFieldUpdate: PropTypes.func.isRequired,
};

TasksEpochsStep.defaultProps = {
  mergedDay: null,
};
