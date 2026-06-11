import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TasksEpochsStep from '../TasksEpochsStep';
import { makeAnimalWithCamerasAndDay } from './taskFixtures';

/**
 * Render TasksEpochsStep from a fresh fixture, overridable per test.
 * @param {object} [overrides] Fixture overrides ({ animal?, day? }).
 * @returns {{animal: object, day: object, onFieldUpdate: Function}} Fixture + spy.
 */
function renderStep(overrides = {}) {
  const { animal, day, mergedDay } = makeAnimalWithCamerasAndDay(overrides);
  const onFieldUpdate = vi.fn();
  render(
    <TasksEpochsStep
      animal={animal}
      day={day}
      mergedDay={mergedDay}
      onFieldUpdate={onFieldUpdate}
    />
  );
  return { animal, day, onFieldUpdate };
}

describe('TasksEpochsStep — FsGUI optogenetics gate', () => {
  it('hides the FsGUI section when the animal has no optogenetics', () => {
    renderStep(); // fixture default: optogenetics undefined
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
      // Seed an existing protocol so the DIO control renders (the spy harness doesn't
      // round-trip an Add through the store).
      day: {
        behavioral_events: [{ name: 'day_event', description: 'd' }],
        fs_gui_yamls: [{ name: 'p', epochs: [], power_in_mW: '', dio_output_name: '', camera_id: '' }],
      },
    });

    const dio = screen.getByLabelText(/dio output/i);
    // The exported source is day events, which the dangling_dio_output rule validates
    // against — so the select must offer the day event and NOT the inherited-only one.
    expect(within(dio).getByRole('option', { name: 'day_event' })).toBeInTheDocument();
    expect(within(dio).queryByRole('option', { name: 'inherited_only' })).not.toBeInTheDocument();
  });
});

describe('TasksEpochsStep', () => {
  it('shows a non-blocking camera info banner when the animal has no cameras', async () => {
    const user = userEvent.setup();
    const { onFieldUpdate } = renderStep({ animal: { cameras: [] } });

    const banner = screen.getByRole('status', { name: /cameras/i });
    expect(banner).toHaveAttribute('aria-live', 'polite');

    // The banner does not gate task creation.
    await user.click(screen.getByRole('button', { name: /add.*task/i }));
    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'newtask');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    await user.click(screen.getByRole('button', { name: /save task/i }));
    expect(onFieldUpdate).toHaveBeenCalledWith('tasks', expect.any(Array));
  });

  it('does not show the camera banner when cameras exist', () => {
    renderStep();
    expect(screen.queryByRole('status', { name: /cameras/i })).not.toBeInTheDocument();
  });

  describe('Boundary 1 — tolerates + repairs corrupt day collections', () => {
    it('does not crash when tasks / videos / files / behavioral_events are non-arrays', () => {
      expect(() =>
        renderStep({
          day: {
            tasks: {},
            associated_video_files: 'corrupt',
            associated_files: 42,
            behavioral_events: { 0: 'x' },
          },
        })
      ).not.toThrow();
    });

    it('renders a focusable reset control for each corrupt collection it owns', () => {
      renderStep({ day: { tasks: {}, associated_files: 'corrupt' } });
      const taskReset = screen.getByRole('button', { name: /reset corrupt tasks/i });
      expect(taskReset).toHaveAttribute('data-field-path', 'tasks');
      expect(screen.getByRole('button', { name: /reset corrupt associated files/i })).toBeInTheDocument();
    });

    it('clicking reset writes an empty array for that field', async () => {
      const user = userEvent.setup();
      const { onFieldUpdate } = renderStep({ day: { tasks: {} } });
      await user.click(screen.getByRole('button', { name: /reset corrupt tasks/i }));
      expect(onFieldUpdate).toHaveBeenCalledWith('tasks', []);
    });

    it('a task ADD does not crash when associated arrays are still corrupt (orphan helpers guarded)', async () => {
      const user = userEvent.setup();
      // tasks is a clean array, but the associated arrays are non-arrays — the orphan
      // helpers (findOrphanedReferences/clearOrphans) run on commit and must not throw.
      const { onFieldUpdate } = renderStep({
        day: { tasks: [], associated_video_files: {}, associated_files: 'corrupt' },
      });
      await user.click(screen.getByRole('button', { name: /add.*task/i }));
      await user.type(screen.getByRole('textbox', { name: /task name/i }), 'probe');
      await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
      await user.click(screen.getByRole('button', { name: /save task/i }));
      expect(onFieldUpdate).toHaveBeenCalledWith('tasks', expect.any(Array));
    });
  });

  it('dismisses the camera banner when Skip is clicked', async () => {
    const user = userEvent.setup();
    renderStep({ animal: { cameras: [] } });

    expect(screen.getByRole('status', { name: /cameras/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /dismiss camera/i }));
    expect(screen.queryByRole('status', { name: /cameras/i })).not.toBeInTheDocument();
  });

  it('appends a saved task through onFieldUpdate without mutating the input array', async () => {
    const user = userEvent.setup();
    const { day, onFieldUpdate } = renderStep();
    const originalLength = day.tasks.length;

    await user.click(screen.getByRole('button', { name: /add.*task/i }));
    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'wtrack');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'WTrack');
    await user.click(screen.getByRole('button', { name: /save task/i }));

    expect(onFieldUpdate).toHaveBeenCalledTimes(1);
    const [field, nextTasks] = onFieldUpdate.mock.calls[0];
    expect(field).toBe('tasks');
    expect(nextTasks).toHaveLength(originalLength + 1);
    expect(nextTasks[nextTasks.length - 1].task_name).toBe('wtrack');
    // Input array not mutated.
    expect(day.tasks).toHaveLength(originalLength);
    expect(nextTasks).not.toBe(day.tasks);
  });

  it('updates an edited task at its index through onFieldUpdate', async () => {
    const user = userEvent.setup();
    const { onFieldUpdate } = renderStep();

    await user.click(screen.getByRole('button', { name: /edit/i }));
    const nameInput = screen.getByRole('textbox', { name: /task name/i });
    await user.clear(nameInput);
    await user.type(nameInput, 'renamed');
    await user.click(screen.getByRole('button', { name: /save task/i }));

    const [field, nextTasks] = onFieldUpdate.mock.calls[0];
    expect(field).toBe('tasks');
    expect(nextTasks[0].task_name).toBe('renamed');
    expect(nextTasks).toHaveLength(1);
  });

  it('deletes a task through onFieldUpdate after confirmation', async () => {
    const user = userEvent.setup();
    const { onFieldUpdate } = renderStep();

    await user.click(screen.getByRole('button', { name: /delete task/i }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('tasks', []);
  });

  it('no longer renders the behavioral-events grid (it moved to its own Behavioral Events tab)', () => {
    renderStep();
    expect(screen.queryByLabelText('Event for Din1')).not.toBeInTheDocument();
  });
});
