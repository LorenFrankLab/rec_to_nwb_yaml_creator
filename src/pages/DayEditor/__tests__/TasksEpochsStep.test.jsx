import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TasksEpochsStep from '../TasksEpochsStep';
import { makeAnimalWithCamerasAndDay } from './taskFixtures';

/**
 * The catalog shape the rewritten step edits: the animal defines task types; the day references them
 * via ordered instances. Layered onto the shared fixture so the step is NOT in the inline-derive path.
 */
const CATALOG = {
  animal: {
    taskTypes: [
      { id: 'tasktype-0', task_name: 'sleep', task_description: 'The animal rests in a box', task_environment: 'HomeBox', camera_id: [1] },
    ],
  },
  day: { tasks: undefined, taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1, 3] }] },
};

/**
 * Render TasksEpochsStep in catalog mode (overridable).
 * @param {object} [overrides] Fixture overrides ({ animal?, day? }) merged onto the catalog fixture.
 * @returns {{animal: object, day: object, onFieldUpdate: Function}}
 */
function renderStep(overrides = {}) {
  const { animal, day, mergedDay } = makeAnimalWithCamerasAndDay({
    animal: { ...CATALOG.animal, ...overrides.animal },
    day: { ...CATALOG.day, ...overrides.day },
  });
  const onFieldUpdate = vi.fn();
  render(<TasksEpochsStep animal={animal} day={day} mergedDay={mergedDay} onFieldUpdate={onFieldUpdate} />);
  return { animal, day, onFieldUpdate };
}

/**
 * Add a task instance via the picker: open, (default type), add one epoch, save.
 * @param user
 * @param epoch
 */
async function addInstanceWithEpoch(user, epoch) {
  await user.click(screen.getByRole('button', { name: /add task/i }));
  await user.click(screen.getByRole('button', { name: /add epoch/i }));
  // Number inputs are spinbuttons — disambiguates from the epoch list's aria-labelledby hint.
  const epochInputs = screen.getAllByRole('spinbutton', { name: /epoch number/i });
  await user.type(epochInputs[epochInputs.length - 1], String(epoch));
  await user.click(screen.getByRole('button', { name: /save task for this day/i }));
}

describe('TasksEpochsStep — FsGUI optogenetics gate', () => {
  it('hides the FsGUI section when the animal has no optogenetics', () => {
    renderStep();
    expect(screen.queryByRole('heading', { name: /optogenetics run this day/i })).not.toBeInTheDocument();
  });

  it('shows the FsGUI section only when optogenetics is enabled on the animal', () => {
    renderStep({ animal: { optogenetics: { opto_excitation_source: [{ name: 'LED' }] } } });
    expect(screen.getByRole('heading', { name: /optogenetics run this day/i })).toBeInTheDocument();
  });

  it('offers ONLY the day’s behavioral events as DIO outputs (not inherited animal events)', () => {
    renderStep({
      animal: {
        optogenetics: { opto_excitation_source: [{ name: 'LED' }] },
        behavioral_events: [{ name: 'inherited_only', description: 'd' }],
      },
      day: {
        behavioral_events: [{ name: 'day_event', description: 'd' }],
        fs_gui_yamls: [{ name: 'p', epochs: [], power_in_mW: '', dio_output_name: '', camera_id: '' }],
      },
    });

    const dio = screen.getByLabelText(/dio output/i);
    expect(within(dio).getByRole('option', { name: 'day_event' })).toBeInTheDocument();
    expect(within(dio).queryByRole('option', { name: 'inherited_only' })).not.toBeInTheDocument();
  });
});

describe('TasksEpochsStep — pick/order catalog model', () => {
  it('renders the day’s task instances resolved against the animal catalog', () => {
    renderStep();
    // The instance resolves to the catalog type name + environment + its epochs.
    expect(screen.getByText('sleep')).toBeInTheDocument();
    expect(screen.getByText('1, 3')).toBeInTheDocument(); // the day's epochs for this instance
  });

  it('shows a non-blocking camera info banner that does NOT gate adding a task', async () => {
    const user = userEvent.setup();
    const { onFieldUpdate } = renderStep({ animal: { cameras: [] }, day: { taskInstances: [] } });

    const banner = screen.getByRole('status', { name: /cameras/i });
    expect(banner).toHaveAttribute('aria-live', 'polite');

    await addInstanceWithEpoch(user, 5);
    expect(onFieldUpdate).toHaveBeenCalledWith('taskInstances', [{ taskTypeId: 'tasktype-0', task_epochs: [5] }]);
  });

  it('does not show the camera banner when cameras exist', () => {
    renderStep();
    expect(screen.queryByRole('status', { name: /cameras/i })).not.toBeInTheDocument();
  });

  it('appends a picked task instance through onFieldUpdate (taskInstances) without mutating input', async () => {
    const user = userEvent.setup();
    const { day, onFieldUpdate } = renderStep();
    const original = day.taskInstances;

    await addInstanceWithEpoch(user, 7);

    expect(onFieldUpdate).toHaveBeenCalledWith('taskInstances', [
      { taskTypeId: 'tasktype-0', task_epochs: [1, 3] },
      { taskTypeId: 'tasktype-0', task_epochs: [7] },
    ]);
    expect(day.taskInstances).toBe(original); // input not mutated
  });

  it('edits an instance’s epochs at its index through onFieldUpdate', async () => {
    const user = userEvent.setup();
    // A single-epoch instance so the edit is a clean retype of one row.
    const { onFieldUpdate } = renderStep({ day: { taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1] }] } });

    await user.click(screen.getByRole('button', { name: /edit sleep for this day/i }));
    const epochInput = screen.getByRole('spinbutton', { name: /epoch number, row 1/i });
    await user.clear(epochInput);
    await user.type(epochInput, '9');
    await user.click(screen.getByRole('button', { name: /save task for this day/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('taskInstances', [{ taskTypeId: 'tasktype-0', task_epochs: [9] }]);
  });

  it('removes an instance through onFieldUpdate (no orphans → no confirm)', async () => {
    const user = userEvent.setup();
    const { onFieldUpdate } = renderStep();

    await user.click(screen.getByRole('button', { name: /remove sleep from this day/i }));
    expect(onFieldUpdate).toHaveBeenCalledWith('taskInstances', []);
  });

  it('defining a new task type ADDS it to the day (no separate Add Task step)', async () => {
    const user = userEvent.setup();
    // Empty catalog + empty day so the new type takes id tasktype-0 and is the only instance.
    const { onFieldUpdate } = renderStep({ animal: { taskTypes: [] }, day: { taskInstances: [] } });

    await user.click(screen.getByRole('button', { name: /define a new task type/i }));
    await user.type(screen.getByLabelText(/task name/i), 'w-track');
    await user.type(screen.getByLabelText('Description'), 'Alternation');
    await user.type(screen.getByLabelText('Environment'), 'W-track');
    await user.click(screen.getByRole('button', { name: /save task type/i }));

    // The day gets a task instance for the new type immediately (epochs empty, set next) — defining
    // it is the act of adding it, not a precursor to a separate "Add Task".
    expect(onFieldUpdate).toHaveBeenCalledWith('taskInstances', [{ taskTypeId: 'tasktype-0', task_epochs: [] }]);
  });

  it('reorders instances through onFieldUpdate', async () => {
    const user = userEvent.setup();
    const { onFieldUpdate } = renderStep({
      animal: {
        taskTypes: [
          { id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest', task_environment: 'HomeBox', camera_id: [1] },
          { id: 'tasktype-1', task_name: 'w-track', task_description: 'Alt', task_environment: 'WTrack', camera_id: [0] },
        ],
      },
      day: {
        taskInstances: [
          { taskTypeId: 'tasktype-0', task_epochs: [1] },
          { taskTypeId: 'tasktype-1', task_epochs: [2] },
        ],
      },
    });

    await user.click(screen.getByRole('button', { name: /move w-track earlier/i }));
    expect(onFieldUpdate).toHaveBeenCalledWith('taskInstances', [
      { taskTypeId: 'tasktype-1', task_epochs: [2] },
      { taskTypeId: 'tasktype-0', task_epochs: [1] },
    ]);
  });

  describe('Boundary 1 — tolerates + repairs corrupt day collections', () => {
    it('does not crash when tasks / videos / files / behavioral_events are non-arrays', () => {
      expect(() =>
        renderStep({
          day: {
            tasks: {},
            taskInstances: undefined,
            associated_video_files: 'corrupt',
            associated_files: 42,
            behavioral_events: { 0: 'x' },
          },
        })
      ).not.toThrow();
    });

    it('renders a focusable reset control for each corrupt collection it owns', () => {
      renderStep({ day: { tasks: {}, taskInstances: undefined, associated_files: 'corrupt' } });
      const taskReset = screen.getByRole('button', { name: /reset corrupt tasks/i });
      expect(taskReset).toHaveAttribute('data-field-path', 'tasks');
      expect(screen.getByRole('button', { name: /reset corrupt associated files/i })).toBeInTheDocument();
    });

    it('a task ADD does not crash when associated arrays are still corrupt (orphan helpers guarded)', async () => {
      const user = userEvent.setup();
      const { onFieldUpdate } = renderStep({
        day: { taskInstances: [], associated_video_files: {}, associated_files: 'corrupt' },
      });
      await addInstanceWithEpoch(user, 2);
      expect(onFieldUpdate).toHaveBeenCalledWith('taskInstances', expect.any(Array));
    });
  });

  it('dismisses the camera banner when Skip is clicked', async () => {
    const user = userEvent.setup();
    renderStep({ animal: { cameras: [] } });

    expect(screen.getByRole('status', { name: /cameras/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /dismiss camera/i }));
    expect(screen.queryByRole('status', { name: /cameras/i })).not.toBeInTheDocument();
  });

  it('no longer renders the behavioral-events grid (it moved to its own Behavioral Events tab)', () => {
    renderStep();
    expect(screen.queryByLabelText('Event for Din1')).not.toBeInTheDocument();
  });
});
