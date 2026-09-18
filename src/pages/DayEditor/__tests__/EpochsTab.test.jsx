/**
 * Component tests for the Phase-4 Epochs grid (EpochsTab).
 *
 * The grid is a thin renderer over the TDD'd pure layers (buildEpochGrid / epochOperations /
 * fileNaming); these tests pin the WIRING: collapsed file-state cells, the task disclosure, write-back
 * patches (each edit → the expected updateDay patch over the existing arrays), the video 3-state +
 * its off-export videolessEpochs writer, confirm-before-orphan (never auto-scrubbing), and a11y.
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import EpochsTab from '../EpochsTab';
import { mergeDayMetadata } from '../../../state/workspaceUtils';

/**
 * An opto animal + catalog day: Sleep owns epochs 1,3 (no video); Run owns epoch 2 (one video).
 * @param {object} [overrides] - Day field overrides merged into the base day.
 * @param {object} [animalOverrides] - Animal field overrides merged into the base animal.
 * @returns {object} The DayEditor bundle props EpochsTab consumes.
 */
function makeBundle(overrides = {}, animalOverrides = {}) {
  const animal = {
    id: 'r',
    subject: { subject_id: 'r' },
    optogenetics: { opto_excitation_source: [{ name: 'laser' }] },
    cameras: [
      { id: 0, camera_name: 'cam0' },
      { id: 1, camera_name: 'cam1' },
    ],
    taskTypes: [
      { id: 'tasktype-0', task_name: 'Sleep', task_description: 'sleep', camera_id: [0] },
      { id: 'tasktype-1', task_name: 'Run', task_description: 'run', camera_id: [1] },
    ],
    ...animalOverrides,
  };
  const day = {
    id: 'r-2023-06-22',
    animalId: 'r',
    date: '2023-06-22',
    experimentDate: '06222023',
    dataFolder: '/data/r/20230622',
    taskInstances: [
      { taskTypeId: 'tasktype-0', task_epochs: [1, 3] },
      { taskTypeId: 'tasktype-1', task_epochs: [2] },
    ],
    associated_files: [],
    associated_video_files: [{ name: 'run_video', camera_id: 1, task_epochs: 2 }],
    fs_gui_yamls: [],
    state: {},
    ...overrides,
  };
  const onFieldUpdate = vi.fn();
  const updateAnimal = vi.fn();
  return {
    animal,
    day,
    mergedDay: {},
    animalDays: [day],
    onFieldUpdate,
    actions: { updateAnimal },
    animalKey: 'r',
  };
}

/**
 * A prior day of the same animal and probe configuration that linked a statescript to its sleep
 * epoch — the precedent that makes this animal's later sleep epochs expect one.
 */
const PRIOR_SLEEP_DAY = {
  id: 'r-2023-06-21',
  animalId: 'r',
  date: '2023-06-21',
  taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1] }],
  associated_files: [
    {
      name: 'statescript_s1',
      description: 'Statescript Log',
      path: '/data/r/20230621/20230621_r_01_s1.stateScriptLog',
      task_epochs: 1,
    },
  ],
  associated_video_files: [],
  fs_gui_yamls: [],
  state: {},
};

/**
 * Stateful wrapper for tests that need the day patch to be applied and rendered back into EpochsTab.
 *
 * @param {{ bundle: ReturnType<typeof makeBundle> }} props - Test bundle to render.
 * @returns {JSX.Element} The stateful EpochsTab.
 */
function StatefulEpochsTab({ bundle }) {
  const [day, setDay] = useState(bundle.day);
  const onFieldUpdate = (field, value) => {
    bundle.onFieldUpdate(field, value);
    setDay((prev) => ({ ...prev, [field]: value }));
  };
  const onFieldsUpdate = (changes) => {
    changes.forEach(([field, value]) => bundle.onFieldUpdate(field, value));
    setDay((prev) => ({ ...prev, ...Object.fromEntries(changes) }));
  };

  return <EpochsTab {...bundle} day={day} animalDays={[day]} onFieldUpdate={onFieldUpdate} onFieldsUpdate={onFieldsUpdate} />;
}

/** A legacy inline day whose `Run` task collides with the animal's existing `Run` task type. */
function makeDivergentInlineBundle() {
  return makeBundle(
    {
      taskInstances: undefined,
      tasks: [
        {
          task_name: 'Run',
          task_description: 'Day-specific run definition',
          task_environment: 'maze B',
          camera_id: [1],
          task_epochs: [1],
        },
      ],
      associated_video_files: [],
      associated_files: [],
    },
    {
      taskTypes: [
        {
          id: 'tasktype-0',
          task_name: 'Run',
          task_description: 'Catalog run definition',
          task_environment: 'maze A',
          camera_id: [0],
        },
      ],
    }
  );
}

/**
 * Find the last onFieldUpdate call for a given field path.
 * @param {import('vitest').Mock} onFieldUpdate - The spy passed as the bundle's onFieldUpdate.
 * @param {string} field - The top-level day field to match.
 * @returns {unknown} The value of the last matching patch, or undefined.
 */
function lastPatch(onFieldUpdate, field) {
  const calls = onFieldUpdate.mock.calls.filter((c) => c[0] === field);
  return calls.length ? calls[calls.length - 1][1] : undefined;
}

describe('EpochsTab — grid render + collapsed state cells', () => {
  it('renders one row per epoch with a task disclosure <button aria-expanded>', () => {
    render(<EpochsTab {...makeBundle()} />);
    expect(screen.getByText(/An epoch is one numbered block/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Show epochs' })).toBeInTheDocument();
    expect(screen.getByText('File naming & bulk entry')).toBeInTheDocument();
    expect(screen.getByLabelText(/epoch status summary/i)).toHaveTextContent(/3 epochs/i);
    expect(screen.getByLabelText(/epoch status summary/i)).toHaveTextContent(/Video information to enter for 2/i);
    expect(screen.getByRole('option', { name: 'Suggested StateScript logs (1)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Custom filenames (1)' })).toBeInTheDocument();
    const edit = screen.getByRole('button', { name: /Show epoch 1 details/i });
    expect(edit.tagName).toBe('BUTTON');
    expect(edit).toHaveTextContent(/Files & details/i);
    expect(edit).not.toHaveTextContent(/tag/i);
    expect(edit).toHaveAttribute('aria-expanded', 'false');
    expect(edit).toHaveAttribute('aria-controls', 'epoch-details-panel');
    expect(screen.getAllByText('Sleep')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: /Show epoch 2 details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show epoch 3 details/i })).toBeInTheDocument();
  });

  it('filters epochs with the list filter', async () => {
    const user = userEvent.setup();
    render(<EpochsTab {...makeBundle()} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Show epochs' }), 'needs-video');
    expect(screen.getByRole('button', { name: /Show epoch 1 details/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show epoch 2 details/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show epoch 3 details/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Show epochs' }), 'custom-filenames');
    expect(screen.queryByRole('button', { name: /Show epoch 1 details/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show epoch 2 details/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show epoch 3 details/i })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Show epochs' }), 'all');
    expect(screen.getByRole('button', { name: /Show epoch 1 details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show epoch 2 details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show epoch 3 details/i })).toBeInTheDocument();
  });

  it('shows file presence summaries (not names) in the collapsed Files cell', () => {
    render(<EpochsTab {...makeBundle()} />);
    // epoch 2 has a bound video; epochs 1,3 still need video declarations.
    expect(screen.getByText(/1 video filename entered/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Choose an answer/i)).toHaveLength(2);
    // Epoch 2 is a run epoch (a statescript is expected); the sleep epochs have no precedent yet.
    expect(screen.getAllByText(/StateScript:\s*Suggested log not added/i)).toHaveLength(1);
    expect(screen.getAllByText(/StateScript:\s*No log expected/i)).toHaveLength(2);
    // The video filename lives only in the drill-in, never the collapsed grid.
    expect(screen.queryByText('run_video')).not.toBeInTheDocument();
  });

  it('opens one details panel when the task disclosure is clicked', async () => {
    const user = userEvent.setup();
    render(<EpochsTab {...makeBundle()} />);
    const edit = screen.getByRole('button', { name: /Show epoch 1 details/i });
    await user.click(edit);
    expect(edit).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: /Epoch 1: Sleep/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Task$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Files for this epoch/i })).toBeInTheDocument();
    const rowActions = within(edit.closest('tr'));
    expect(rowActions.getByRole('button', { name: /More actions for epoch 1/i })).toBeInTheDocument();
    expect(rowActions.queryByRole('button', { name: /Move epoch 1/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Epoch structure actions/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show epoch 2 details/i }));
    expect(screen.getByRole('button', { name: /Show epoch 1 details/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /Hide epoch 2 details/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: /Epoch 2: Run/i })).toBeInTheDocument();
  });

  it('closes the details drawer with Escape', async () => {
    const user = userEvent.setup();
    render(<EpochsTab {...makeBundle()} />);

    const opener = screen.getByRole('button', { name: /Show epoch 1 details/i });
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: /Epoch 1: Sleep/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close epoch 1 details/i })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: /Epoch 1: Sleep/i })).not.toBeInTheDocument();
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    expect(opener).toHaveFocus();
  });

  it('closes the details panel when a filter hides the selected epoch', async () => {
    const user = userEvent.setup();
    render(<EpochsTab {...makeBundle()} />);

    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    expect(screen.getByRole('dialog', { name: /Epoch 1: Sleep/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Show epochs' }), 'custom-filenames');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show epoch 1 details/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show epoch 2 details/i })).toBeInTheDocument();
  });

  it('opens the owning epoch for a statescript associated_files repair focus path', async () => {
    render(
      <EpochsTab
        {...makeBundle({
          associated_files: [
            {
              name: 'statescript_s1',
              description: 'Statescript Log',
              path: '20230622_r_01_s1.stateScriptLog',
              task_epochs: 1,
            },
          ],
        })}
        focusRequest={{ fieldPath: 'associated_files[0].path', token: 1 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Hide epoch 1 details/i })).toBeInTheDocument();
    });
    expect(document.querySelector('[data-field-path="associated_files[0].path"]')).toBeInTheDocument();
  });
});

describe('EpochsTab — no-epochs onboarding empty state (Phase 8)', () => {
  it('renders the EmptyState onboarding card with an add-epoch CTA when there are no epochs', () => {
    render(<EpochsTab {...makeBundle({ taskInstances: [] })} />);
    expect(screen.getByRole('heading', { name: /What happened first/i })).toBeInTheDocument();
    // No epoch rows are rendered (no task disclosure buttons).
    expect(screen.queryByRole('button', { name: /Show epoch/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add epoch 1/i })).toBeInTheDocument();
  });

  it('requires a task choice and adds that task, rather than defaulting to the first type', async () => {
    const user = userEvent.setup();
    // A genuine no-epochs day has no file/video refs (so adding the first epoch orphans nothing).
    const bundle = makeBundle({ taskInstances: [], associated_video_files: [], associated_files: [] });
    render(<EpochsTab {...bundle} />);
    expect(screen.getByRole('button', { name: /Add epoch 1/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Task for epoch 1'), 'tasktype-1');
    await user.click(screen.getByRole('button', { name: /Add epoch 1/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-1', task_epochs: [1] },
    ]);
  });

  it('starts by creating a task when the animal has no task catalog yet', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle(
      { taskInstances: [], associated_video_files: [], associated_files: [] },
      { taskTypes: [] }
    );
    render(<EpochsTab {...bundle} />);

    expect(screen.queryByRole('button', { name: /choose a template/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /create first task and epoch/i }));

    expect(screen.getByRole('dialog', { name: /add task type/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/task name/i)).toHaveFocus();
  });
});

describe('EpochsTab — write-back patches', () => {
  it('changes a task directly in the sequence without rewriting its files', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<StatefulEpochsTab bundle={bundle} />);
    await user.selectOptions(screen.getByLabelText('Task for epoch 2'), 'tasktype-0');
    expect(screen.getByLabelText('Task for epoch 2')).toHaveValue('tasktype-0');
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toBeUndefined();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the add form ready for the next explicit task choice', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle({ taskInstances: [], associated_video_files: [] });
    render(<StatefulEpochsTab bundle={bundle} />);
    await user.selectOptions(screen.getByLabelText('Task for epoch 1'), 'tasktype-1');
    await user.click(screen.getByRole('button', { name: 'Add epoch 1', exact: true }));
    expect(screen.getByLabelText('Task for epoch 1')).toHaveValue('tasktype-1');
    expect(screen.getByLabelText('Task for epoch 2')).toHaveValue('');
    expect(screen.getByLabelText('Task for epoch 2')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Add epoch 2', exact: true })).toBeDisabled();
  });

  it('edits protocol power without changing its epoch scope', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle({ fs_gui_yamls: [{ name: 'stim.yaml', epochs: [1, 3], power_in_mW: 10 }] });
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByText('Stimulation protocols · 1'));
    await user.click(screen.getByRole('button', { name: 'Edit protocol 1' }));
    const input = screen.getByRole('spinbutton', { name: /Power \(mW\)/i });
    await user.clear(input);
    await user.type(input, '5');
    await user.tab();
    expect(lastPatch(bundle.onFieldUpdate, 'fs_gui_yamls')).toEqual([{ name: 'stim.yaml', epochs: [1, 3], power_in_mW: 5 }]);
  });

  it('reassigning a task writes a taskInstances patch (moves the epoch)', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /Epoch 1 task/i }), 'tasktype-1');
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [3] },
      { taskTypeId: 'tasktype-1', task_epochs: [1, 2] },
    ]);
  });

  describe('editing a task occurrence for THIS day (F3)', () => {
    /**
     * An animal whose Sleep task type has a default room, plus a day that ran it.
     * @param dayOverrides
     */
    const contextBundle = (dayOverrides = {}) =>
      makeBundle(
        {
          taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1], ...dayOverrides }],
          associated_video_files: [],
        },
        {
          taskTypes: [
            { id: 'tasktype-0', task_name: 'Sleep', task_description: 'sleep', task_environment: 'HaightRight', camera_id: [0] },
          ],
        }
      );

    it('records the room and cameras THIS day used, without touching the task type', async () => {
      const user = userEvent.setup();
      const bundle = contextBundle();
      render(<EpochsTab {...bundle} />);

      await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
      await user.click(screen.getByRole('button', { name: /Edit for this day/i }));

      const environment = screen.getByLabelText(/Environment for this day/i);
      expect(environment).toHaveValue('HaightRight'); // prefilled with the effective value
      await user.clear(environment);
      await user.type(environment, 'HaightLeft');
      await user.click(screen.getByRole('checkbox', { name: /cam1/i }));
      await user.click(screen.getByRole('button', { name: /Save for this day/i }));

      expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
        { taskTypeId: 'tasktype-0', task_epochs: [1], task_environment: 'HaightLeft', camera_id: [0, 1] },
      ]);
      // The shared task type is untouched — other days keep their default.
      expect(bundle.actions.updateAnimal).not.toHaveBeenCalled();
    });

    it('marks the row when this day differs from the task default', () => {
      render(<EpochsTab {...contextBundle({ task_environment: 'HaightLeft' })} />);
      const row = screen.getByRole('button', { name: /Show epoch 1 details/i }).closest('tr');
      expect(within(row).getByText(/Room or cameras changed for this day/i)).toBeInTheDocument();
    });

    it('shows no marker when the day follows the task default', () => {
      render(<EpochsTab {...contextBundle()} />);
      expect(screen.queryByText(/Room or cameras changed for this day/i)).not.toBeInTheDocument();
    });

    it('closes the per-day editor when the drill-in moves to another epoch', async () => {
      // The panel is reused across epochs; a left-open editor would still be prefilled from the
      // previous epoch and could write its context onto a different day's occurrence.
      const user = userEvent.setup();
      const bundle = makeBundle(
        { taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1] }, { taskTypeId: 'tasktype-1', task_epochs: [2] }], associated_video_files: [] },
        {
          taskTypes: [
            { id: 'tasktype-0', task_name: 'Sleep', task_description: 'sleep', task_environment: 'HaightRight', camera_id: [0] },
            { id: 'tasktype-1', task_name: 'Run', task_description: 'run', task_environment: 'Track', camera_id: [1] },
          ],
        }
      );
      render(<EpochsTab {...bundle} />);

      await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
      await user.click(screen.getByRole('button', { name: /Edit for this day/i }));
      expect(screen.getByLabelText(/Environment for this day/i)).toHaveValue('HaightRight');

      await user.click(screen.getByRole('button', { name: /Show epoch 2 details/i }));
      expect(screen.queryByLabelText(/Environment for this day/i)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Edit for this day/i }));
      expect(screen.getByLabelText(/Environment for this day/i)).toHaveValue('Track');
    });

    it('"Copy structure from prior day" copies the task references, not that day\'s room', async () => {
      // Same rule as creating a day from the prior one: the earlier day's recorded room/cameras are
      // ITS facts. Copying its structure must not silently claim today ran in the same place.
      const user = userEvent.setup();
      const priorDay = {
        id: 'r-2023-06-21',
        animalId: 'r',
        date: '2023-06-21',
        configurationVersion: undefined,
        taskInstances: [
          { taskTypeId: 'tasktype-0', task_environment: 'HaightRight', camera_id: [1], task_epochs: [1] },
        ],
      };
      const bundle = makeBundle(
        { id: 'r-2023-06-22', taskInstances: [], associated_video_files: [], associated_files: [] },
        {
          taskTypes: [
            { id: 'tasktype-0', task_name: 'Sleep', task_description: 'sleep', task_environment: 'HaightLeft', camera_id: [0] },
          ],
        }
      );
      render(<EpochsTab {...bundle} animalDays={[priorDay, bundle.day]} />);

      await user.click(screen.getByRole('button', { name: /Use a day template/i }));
      await user.click(screen.getByRole('menuitem', { name: /Copy structure from prior day/i }));

      expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
        { taskTypeId: 'tasktype-0', task_epochs: [1] },
      ]);
    });

    it('has no axe violations with the per-day editor open', async () => {
      const user = userEvent.setup();
      const { container } = render(<EpochsTab {...contextBundle()} />);
      await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
      await user.click(screen.getByRole('button', { name: /Edit for this day/i }));
      expect(await axe(container)).toHaveNoViolations();
    });

    it('blanking the environment means "use the task default", never an empty exported value', async () => {
      // A blank `task_environment` is never valid downstream, so an emptied field records nothing
      // and the occurrence goes back to following the task type.
      const user = userEvent.setup();
      const bundle = contextBundle({ task_environment: 'HaightLeft' });
      render(<EpochsTab {...bundle} />);

      await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
      await user.click(screen.getByRole('button', { name: /Edit for this day/i }));
      await user.clear(screen.getByLabelText(/Environment for this day/i));
      await user.click(screen.getByRole('button', { name: /Save for this day/i }));

      expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
        { taskTypeId: 'tasktype-0', task_epochs: [1] },
      ]);
    });

    describe('the recorded camera ORDER survives a per-day edit (R2)', () => {
      // The converter reads the FIRST task camera's calibration for an epoch's position scale
      // (trodes_to_nwb convert_position.py), so re-sorting a task's cameras into catalog order
      // silently changes meters_per_pixel. A room-only save must leave the references alone.

      /**
       * A Sleep occurrence over a three-camera catalog whose cameras are calibrated differently.
       * @param {Array<number>} taskDefaultCameras - The task type's default `camera_id`.
       * @param {object} [dayOverrides] - Fields recorded on the day's task instance.
       * @returns {object} The EpochsTab bundle.
       */
      const orderedCameraBundle = (taskDefaultCameras, dayOverrides = {}) =>
        makeBundle(
          {
            taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1], ...dayOverrides }],
            associated_video_files: [],
            configurationVersion: 1,
          },
          {
            // A minimal probe configuration, so the day can actually be merged for export.
            configurationHistory: [
              {
                version: 1,
                date: '2023-06-01',
                description: 'Initial configuration',
                devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
                appliedToDays: [],
              },
            ],
            cameras: [
              { id: 0, camera_name: 'cam0', meters_per_pixel: 0.00085 },
              { id: 1, camera_name: 'cam1', meters_per_pixel: 0.0009 },
              { id: 2, camera_name: 'cam2', meters_per_pixel: 0.00095 },
            ],
            taskTypes: [
              {
                id: 'tasktype-0',
                task_name: 'Sleep',
                task_description: 'sleep',
                task_environment: 'HaightRight',
                camera_id: taskDefaultCameras,
              },
            ],
          }
        );

      /**
       * Open epoch 1's per-day context editor and retype only its environment.
       * @param {object} user - The userEvent session.
       * @param {string} next - The new room.
       */
      const editRoomOnly = async (user, next) => {
        await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
        await user.click(screen.getByRole('button', { name: /Edit for this day/i }));
        const environment = screen.getByLabelText(/Environment for this day/i);
        await user.clear(environment);
        await user.type(environment, next);
        await user.click(screen.getByRole('button', { name: /Save for this day/i }));
      };

      it('a room-only save on [1, 0] records no camera override and keeps the first calibration', async () => {
        const user = userEvent.setup();
        const bundle = orderedCameraBundle([1, 0]);
        render(<EpochsTab {...bundle} />);

        await editRoomOnly(user, 'Second room');

        const patch = lastPatch(bundle.onFieldUpdate, 'taskInstances');
        // The selection did not change, so nothing is pinned — the day still follows the default.
        expect(patch).toEqual([
          { taskTypeId: 'tasktype-0', task_epochs: [1], task_environment: 'Second room' },
        ]);
        const merged = mergeDayMetadata(bundle.animal, { ...bundle.day, taskInstances: patch });
        expect(merged.tasks[0].camera_id).toEqual([1, 0]);
        const firstCamera = merged.cameras.find((c) => c.id === merged.tasks[0].camera_id[0]);
        expect(firstCamera.meters_per_pixel).toBe(0.0009);
      });

      it('a room-only save keeps a day-recorded [1, 0] exactly as recorded', async () => {
        const user = userEvent.setup();
        const bundle = orderedCameraBundle([0, 1], { camera_id: [1, 0] });
        render(<EpochsTab {...bundle} />);

        await editRoomOnly(user, 'Second room');

        const patch = lastPatch(bundle.onFieldUpdate, 'taskInstances');
        expect(patch[0].camera_id).toEqual([1, 0]);
        const merged = mergeDayMetadata(bundle.animal, { ...bundle.day, taskInstances: patch });
        expect(merged.tasks[0].camera_id).toEqual([1, 0]);
        const firstCamera = merged.cameras.find((c) => c.id === merged.tasks[0].camera_id[0]);
        expect(firstCamera.meters_per_pixel).toBe(0.0009);
      });

      it('keeps a split-import order like [2, 1] against a [0, 1, 2] catalog', async () => {
        // The calibration split names the later camera last in the catalog, so a day that used it
        // legitimately references a higher id first.
        const user = userEvent.setup();
        const bundle = orderedCameraBundle([0], { camera_id: [2, 1] });
        render(<EpochsTab {...bundle} />);

        await editRoomOnly(user, 'Second room');

        expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')[0].camera_id).toEqual([2, 1]);
      });

      it('deselecting a camera removes only that one, keeping the rest in order', async () => {
        const user = userEvent.setup();
        const bundle = orderedCameraBundle([1, 0]);
        render(<EpochsTab {...bundle} />);

        await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
        await user.click(screen.getByRole('button', { name: /Edit for this day/i }));
        await user.click(screen.getByRole('checkbox', { name: /cam1/i })); // off
        await user.click(screen.getByRole('button', { name: /Save for this day/i }));

        expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')[0].camera_id).toEqual([0]);
      });

      it('a newly selected camera is appended after the recorded ones', async () => {
        const user = userEvent.setup();
        const bundle = orderedCameraBundle([1, 0]);
        render(<EpochsTab {...bundle} />);

        await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
        await user.click(screen.getByRole('button', { name: /Edit for this day/i }));
        await user.click(screen.getByRole('checkbox', { name: /cam2/i })); // on
        await user.click(screen.getByRole('button', { name: /Save for this day/i }));

        expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')[0].camera_id).toEqual([1, 0, 2]);
      });
    });

    it('"Use task default" clears the day overrides', async () => {
      const user = userEvent.setup();
      const bundle = contextBundle({ task_environment: 'HaightLeft', camera_id: [1] });
      render(<EpochsTab {...bundle} />);

      await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
      await user.click(screen.getByRole('button', { name: /Edit for this day/i }));
      await user.click(screen.getByRole('button', { name: /Use task default/i }));

      expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
        { taskTypeId: 'tasktype-0', task_epochs: [1] },
      ]);
    });
  });

  it('deleting an epoch with no bound refs writes taskInstances + offers Undo (no confirm)', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /More actions for epoch 1/i }));
    await user.click(screen.getByRole('menuitem', { name: /Delete epoch 1/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [3] },
      { taskTypeId: 'tasktype-1', task_epochs: [2] },
    ]);
    expect(screen.getByText(/Epoch 1 deleted/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Undo/i })).toBeInTheDocument();
  });

  it('deleting a declared-videoless epoch drops the declaration and Undo restores it', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle({ state: { draft: true, videolessEpochs: [1, 3] } });
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /More actions for epoch 1/i }));
    await user.click(screen.getByRole('menuitem', { name: /Delete epoch 1/i }));

    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [3] },
      { taskTypeId: 'tasktype-1', task_epochs: [2] },
    ]);
    expect(lastPatch(bundle.onFieldUpdate, 'state')).toEqual({
      draft: true,
      validationDeferred: false,
      videolessEpochs: [3],
      deferredEpochs: [],
    });

    await user.click(screen.getByRole('button', { name: /Undo/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [1, 3] },
      { taskTypeId: 'tasktype-1', task_epochs: [2] },
    ]);
    expect(lastPatch(bundle.onFieldUpdate, 'state')).toEqual({
      draft: true,
      validationDeferred: false,
      videolessEpochs: [1, 3],
      deferredEpochs: [],
    });
  });
});

describe('EpochsTab — task-catalog collision review', () => {
  it('surfaces a name collision and blocks epoch edits until the user chooses', async () => {
    const user = userEvent.setup();
    const bundle = makeDivergentInlineBundle();
    render(<EpochsTab {...bundle} />);

    const review = screen.getByRole('heading', { name: /review task catalog match/i }).closest('section');
    expect(review).toBeInTheDocument();
    expect(review).toHaveTextContent(/Run/);
    expect(review).toHaveTextContent(/Day-specific run definition/);
    expect(review).toHaveTextContent(/Catalog run definition/);

    await user.click(screen.getByRole('button', { name: /More actions for epoch 1/i }));
    await user.click(screen.getByRole('menuitem', { name: /Duplicate epoch/i }));

    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toBeUndefined();
    expect(lastPatch(bundle.onFieldUpdate, 'tasks')).toBeUndefined();
  });

  it('Keep this day values mints a distinct type and preserves the inline definition', async () => {
    const user = userEvent.setup();
    const bundle = makeDivergentInlineBundle();
    render(<EpochsTab {...bundle} />);

    await user.click(screen.getByRole('button', { name: /Keep this day's values/i }));

    expect(bundle.actions.updateAnimal).toHaveBeenCalledWith('r', {
      taskTypes: [
        expect.objectContaining({
          id: 'tasktype-0',
          task_name: 'Run',
          task_description: 'Catalog run definition',
        }),
        expect.objectContaining({
          id: 'tasktype-1',
          task_name: 'Run (r-2023-06-22)',
          task_description: 'Day-specific run definition',
          task_environment: 'maze B',
          camera_id: [1],
        }),
      ],
    });
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-1', task_epochs: [1] },
    ]);
    expect(lastPatch(bundle.onFieldUpdate, 'tasks')).toEqual([]);
  });

  it('Keep catalog definition explicitly commits the catalog-backed conversion', async () => {
    const user = userEvent.setup();
    const bundle = makeDivergentInlineBundle();
    render(<EpochsTab {...bundle} />);

    const review = screen.getByRole('heading', { name: /review task catalog match/i }).closest('section');
    await user.click(within(review).getByRole('button', { name: /Keep catalog definition/i }));

    expect(bundle.actions.updateAnimal).not.toHaveBeenCalled();
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [1] },
    ]);
    expect(lastPatch(bundle.onFieldUpdate, 'tasks')).toEqual([]);
  });
});

describe('EpochsTab — confirm-before-orphan (never auto-scrub)', () => {
  it('deleting an epoch that strands a video prompts a confirm, and cancel writes nothing', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    // Epoch 2 owns the only video; deleting it would orphan that video.
    await user.click(screen.getByRole('button', { name: /More actions for epoch 2/i }));
    await user.click(screen.getByRole('menuitem', { name: /Delete epoch 2/i }));
    expect(screen.getByText(/Repair affected files\?/i)).toBeInTheDocument();
    // Nothing written yet (no auto-scrub).
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toBeUndefined();
    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(bundle.onFieldUpdate).not.toHaveBeenCalledWith('taskInstances', expect.anything());
  });

  it('confirming the repair writes the instances AND clears the orphaned video ref', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /More actions for epoch 2/i }));
    await user.click(screen.getByRole('menuitem', { name: /Delete epoch 2/i }));
    await user.click(screen.getByRole('button', { name: /Keep files unassigned/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [1, 3] },
    ]);
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toEqual([
      { name: 'run_video', camera_id: 1, task_epochs: '' },
    ]);
  });

  it('confirming a delete repair drops videoless state, and Undo restores it', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle({ state: { draft: true, videolessEpochs: [2, 3] } });
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /More actions for epoch 2/i }));
    await user.click(screen.getByRole('menuitem', { name: /Delete epoch 2/i }));

    expect(screen.getByText(/Repair affected files\?/i)).toBeInTheDocument();
    expect(lastPatch(bundle.onFieldUpdate, 'state')).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /Keep files unassigned/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toEqual([
      { name: 'run_video', camera_id: 1, task_epochs: '' },
    ]);
    expect(lastPatch(bundle.onFieldUpdate, 'state')).toEqual({
      draft: true,
      validationDeferred: false,
      videolessEpochs: [3],
      deferredEpochs: [],
    });

    await user.click(screen.getByRole('button', { name: /Undo/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toEqual([
      { name: 'run_video', camera_id: 1, task_epochs: 2 },
    ]);
    expect(lastPatch(bundle.onFieldUpdate, 'state')).toEqual({
      draft: true,
      validationDeferred: false,
      videolessEpochs: [2, 3],
      deferredEpochs: [],
    });
  });
});

describe('EpochsTab — renumber moves bound refs in lockstep (no silent misassociation)', () => {
  it('keeps move controls in the row overflow menu', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<StatefulEpochsTab bundle={bundle} />);

    expect(screen.queryByRole('button', { name: /Move epoch 2 up/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /More actions for epoch 2/i }));
    expect(screen.getByRole('menuitem', { name: /Move epoch 2 up/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Move epoch 2 down/i })).toBeInTheDocument();
  });

  it('Move up swaps the epoch numbers AND remaps the bound video to follow its task (no confirm)', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    // Epoch 2 (Run) owns the video. Move it up → swap 1↔2.
    await user.click(screen.getByRole('button', { name: /More actions for epoch 2/i }));
    await user.click(screen.getByRole('menuitem', { name: /Move epoch 2 up/i }));
    // No orphan confirm — the ref follows.
    expect(screen.queryByText(/Repair affected files\?/i)).not.toBeInTheDocument();
    // The Run instance moved to epoch 1; its video's task_epochs followed to 1.
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [2, 3] },
      { taskTypeId: 'tasktype-1', task_epochs: [1] },
    ]);
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toEqual([
      { name: 'run_video', camera_id: 1, task_epochs: 1 },
    ]);
  });

  it('Insert after remaps no-video declarations with the same epoch map as files/videos', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle({ state: { draft: true, videolessEpochs: [1, 3, 9] } });
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /More actions for epoch 1/i }));
    await user.click(screen.getByRole('menuitem', { name: /Insert epoch after/i }));

    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [1, 4, 2] },
      { taskTypeId: 'tasktype-1', task_epochs: [3] },
    ]);
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toEqual([
      { name: 'run_video', camera_id: 1, task_epochs: 3 },
    ]);
    expect(lastPatch(bundle.onFieldUpdate, 'state')).toEqual({
      draft: true,
      validationDeferred: false,
      videolessEpochs: [1, 4, 9],
      deferredEpochs: [2],
    });
  });
});

describe('EpochsTab — video 3-state', () => {
  it('keeps Enter later attached to its task when epochs are inserted or deleted', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle({ state: { videoPendingEpochs: [3] } });
    render(<StatefulEpochsTab bundle={bundle} />);
    await user.click(screen.getByRole('button', { name: /More actions for epoch 1/i }));
    await user.click(screen.getByRole('menuitem', { name: /Insert epoch after/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'state')).toMatchObject({ videoPendingEpochs: [4] });
    expect(within(screen.getByRole('group', { name: 'Was video recorded for epoch 4?' })).getByRole('radio', { name: 'Enter later' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: /More actions for epoch 4/i }));
    await user.click(screen.getByRole('menuitem', { name: /Delete epoch 4/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'state')).toMatchObject({ videoPendingEpochs: [] });
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(screen.getByRole('group', { name: 'Was video recorded for epoch 4?' })).getByRole('radio', { name: 'Enter later' })).toBeChecked();
  });

  it('records No and Enter later as different answers and preserves them when opening details', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<StatefulEpochsTab bundle={bundle} />);
    const choices = screen.getByRole('group', { name: 'Was video recorded for epoch 1?' });
    await user.click(within(choices).getByRole('radio', { name: 'No', exact: true }));
    expect(lastPatch(bundle.onFieldUpdate, 'state')).toMatchObject({ videolessEpochs: [1], deferredEpochs: [] });
    await user.click(within(choices).getByRole('radio', { name: 'Enter later' }));
    expect(lastPatch(bundle.onFieldUpdate, 'state')).toMatchObject({ videolessEpochs: [], deferredEpochs: [], videoPendingEpochs: [1] });
    await user.click(screen.getByRole('button', { name: 'Show epoch 1 details' }));
    await user.click(screen.getByRole('button', { name: 'Close epoch 1 details' }));
    expect(within(choices).getByRole('radio', { name: 'Enter later' })).toBeChecked();
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toEqual(bundle.day.associated_video_files);
  });

  it('adds camera-specific video entries atomically when Yes is chosen and supports undo', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle({ taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1], camera_id: [0, 1] }], associated_video_files: [], state: { videolessEpochs: [1], deferredEpochs: [1] } });
    const onFieldsUpdate = vi.fn();
    render(<EpochsTab {...bundle} onFieldsUpdate={onFieldsUpdate} />);
    await user.click(within(screen.getByRole('group', { name: 'Was video recorded for epoch 1?' })).getByRole('radio', { name: 'Yes' }));
    expect(onFieldsUpdate).toHaveBeenCalledTimes(1);
    expect(onFieldsUpdate.mock.calls[0][0]).toContainEqual(['associated_video_files', [
      { name: '20230622_r_01_s1.1.h264', camera_id: 0, task_epochs: 1 },
      { name: '20230622_r_01_s1.2.h264', camera_id: 1, task_epochs: 1 },
    ]]);
    expect(onFieldsUpdate.mock.calls[0][0]).toContainEqual(['state', expect.objectContaining({ videolessEpochs: [], deferredEpochs: [] })]);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onFieldsUpdate.mock.calls[1][0]).toContainEqual(['associated_video_files', []]);
  });

  it('asks before removing custom video metadata, allows cancellation, and restores it on undo', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<StatefulEpochsTab bundle={bundle} />);
    const choices = screen.getByRole('group', { name: 'Was video recorded for epoch 2?' });
    await user.click(within(choices).getByRole('radio', { name: 'No', exact: true }));
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toBeUndefined();
    await user.click(within(screen.getByRole('dialog', { name: /Change video answer/ })).getByRole('button', { name: 'Cancel' }));
    expect(within(choices).getByRole('radio', { name: 'Yes' })).toBeChecked();
    await user.click(within(choices).getByRole('radio', { name: 'No', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Remove entries and mark no video' }));
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toEqual([]);
    expect(within(choices).getByRole('radio', { name: 'No', exact: true })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toEqual(bundle.day.associated_video_files);
    expect(within(choices).getByRole('radio', { name: 'Yes' })).toBeChecked();
  });

  it('does not invent a camera when Yes is chosen for an animal without cameras', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle({ associated_video_files: [] }, { cameras: [] });
    render(<StatefulEpochsTab bundle={bundle} />);
    await user.click(within(screen.getByRole('group', { name: 'Was video recorded for epoch 1?' })).getByRole('radio', { name: 'Yes' }));
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toBeUndefined();
    expect(screen.getByText(/Choose a camera for this epoch before adding video/)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Epoch 1/ })).toBeInTheDocument();
  });

  it('corrects the camera for an existing video without changing its custom filename', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<StatefulEpochsTab bundle={bundle} />);
    await user.click(screen.getByRole('button', { name: 'Show epoch 2 details' }));
    await user.selectOptions(screen.getByLabelText('Epoch 2 video 1 camera'), '0');
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toEqual([{ name: 'run_video', camera_id: 0, task_epochs: 2 }]);
  });

  it('previews and applies the copied day’s video decisions atomically', async () => {
    const user = userEvent.setup();
    const priorDay = {
      id: 'r-2023-06-21',
      animalId: 'r',
      date: '2023-06-21',
      taskInstances: [
        { taskTypeId: 'tasktype-0', task_epochs: [1, 3] },
        { taskTypeId: 'tasktype-1', task_epochs: [2] },
      ],
      associated_files: [],
      associated_video_files: [
        { name: 'prior_sleep_video', camera_id: 0, task_epochs: 1 },
        { name: 'prior_run_video', camera_id: 1, task_epochs: 2 },
      ],
      fs_gui_yamls: [],
      state: { videolessEpochs: [3] },
    };
    const bundle = makeBundle({
      associated_video_files: [],
      provenance: { copiedFromDayId: priorDay.id },
    });
    const onFieldsUpdate = vi.fn();
    render(
      <EpochsTab
        {...bundle}
        animalDays={[priorDay, bundle.day]}
        onFieldsUpdate={onFieldsUpdate}
      />
    );

    await user.click(screen.getByRole('button', { name: /Review 2023-06-21 video plan/i }));
    const dialog = screen.getByRole('dialog', { name: /Use the 2023-06-21 video plan/i });
    expect(dialog).toHaveTextContent(/mark 1 epoch as having no video/i);
    expect(dialog).toHaveTextContent(/create 2 camera-specific video entries/i);
    await user.click(within(dialog).getByRole('button', { name: /Apply previous plan/i }));

    expect(onFieldsUpdate).toHaveBeenCalledTimes(1);
    const changes = onFieldsUpdate.mock.calls[0][0];
    expect(changes).toContainEqual(['associated_video_files', [
      { name: '20230622_r_01_s1.1.h264', camera_id: 0, task_epochs: 1 },
      { name: '20230622_r_02_r1.1.h264', camera_id: 1, task_epochs: 2 },
    ]]);
    expect(changes).toContainEqual(['state', expect.objectContaining({ videolessEpochs: [3] })]);
  });

  it('copies only cameras with prior video entries and skips incompatible camera choices', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle({
      associated_video_files: [],
      taskInstances: [
        { taskTypeId: 'tasktype-0', task_epochs: [1], camera_id: [0, 1] },
        { taskTypeId: 'tasktype-1', task_epochs: [2], camera_id: [1] },
      ],
    });
    const priorDay = { ...bundle.day, id: 'r-2023-06-21', date: '2023-06-21', associated_video_files: [
      { name: 'overhead_only.h264', camera_id: 0, task_epochs: 1 },
      { name: 'camera_no_longer_on_task.h264', camera_id: 0, task_epochs: 2 },
    ] };
    const onFieldsUpdate = vi.fn();
    render(<EpochsTab {...bundle} animalDays={[priorDay, bundle.day]} onFieldsUpdate={onFieldsUpdate} />);
    await user.click(screen.getByRole('button', { name: /Review 2023-06-21 video plan/i }));
    const dialog = screen.getByRole('dialog', { name: /Use the 2023-06-21 video plan/i });
    expect(within(dialog).getByText('Video: cam0')).toBeInTheDocument();
    expect(within(dialog).queryByText(/cam1/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Apply previous plan/i }));
    expect(onFieldsUpdate.mock.calls[0][0]).toContainEqual(['associated_video_files', [
      { name: '20230622_r_01_s1.1.h264', camera_id: 0, task_epochs: 1 },
    ]]);
  });

  it('a missing epoch can be declared video-less (off-export videolessEpochs patch)', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /^Mark no video$/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'state')).toEqual({
      validationDeferred: false,
      videolessEpochs: [1],
    });
  });

  it('a missing epoch can bind a derived video (associated_video_files patch)', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /^Add video entry$/i }));
    const patch = lastPatch(bundle.onFieldUpdate, 'associated_video_files');
    // Derived name for epoch 1 (Sleep, tag s1) in the day's data folder convention.
    expect(patch).toContainEqual({ name: '20230622_r_01_s1.1.h264', camera_id: 0, task_epochs: 1 });
  });

  it('manual video entry creates the expected row and focuses the editable name', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<StatefulEpochsTab bundle={bundle} />);

    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /Enter video manually for epoch 1/i }));

    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toContainEqual({
      name: '20230622_r_01_s1.1.h264',
      camera_id: 0,
      task_epochs: 1,
    });
    const input = await screen.findByRole('textbox', { name: /Epoch 1 video 1 name/i });
    expect(input).toHaveValue('20230622_r_01_s1.1.h264');
    await waitFor(() => expect(input).toHaveFocus());
  });

  // The per-epoch "Add video" is the sibling of the bulk generator: neither may mint a video for a
  // camera the animal does not have (the exported `camera_id` would be a dangling reference that
  // validation then has to block). Epoch 1's Sleep task declares camera 0.
  it('does not add a video for an epoch whose declared camera the animal no longer has', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle({}, { cameras: [{ id: 1, camera_name: 'cam1' }] });
    render(<StatefulEpochsTab bundle={bundle} />);

    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /^Add video entry$/i }));

    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toBeUndefined();
    expect(screen.getByRole('status')).toHaveTextContent(/camera/i);
  });

  it('does not add a video when the animal has no cameras to attribute it to', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle(
      { associated_video_files: [] },
      { cameras: [], taskTypes: [{ id: 'tasktype-0', task_name: 'Sleep', task_description: 'sleep' }] }
    );
    render(<StatefulEpochsTab bundle={bundle} />);

    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /Enter video manually for epoch 1/i }));

    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toBeUndefined();
    expect(screen.getByRole('status')).toHaveTextContent(/camera/i);
  });

  it('generates all missing expected videos and offers Undo', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);

    await user.click(screen.getByText('File naming & bulk entry'));
    await user.click(screen.getByRole('button', { name: /Add 2 video entries/i }));

    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toEqual([
      { name: 'run_video', camera_id: 1, task_epochs: 2 },
      { name: '20230622_r_01_s1.1.h264', camera_id: 0, task_epochs: 1 },
      { name: '20230622_r_03_s2.1.h264', camera_id: 0, task_epochs: 3 },
    ]);
    expect(screen.getByText(/Added 2 video metadata entries/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Undo/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toEqual([
      { name: 'run_video', camera_id: 1, task_epochs: 2 },
    ]);
  });

  it('keeps missing-video fixes in the selected epoch panel', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<StatefulEpochsTab bundle={bundle} />);

    expect(screen.queryByRole('button', { name: /Add video for epoch 1/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /^Add video entry$/i }));

    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toContainEqual({
      name: '20230622_r_01_s1.1.h264',
      camera_id: 0,
      task_epochs: 1,
    });
    expect(screen.getByRole('button', { name: /Hide epoch 1 details/i })).toBeInTheDocument();
    expect(screen.getByText('20230622_r_01_s1.1.h264')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Rename/i })).toHaveFocus());
  });

  it('keeps a repaired video row visible when adding from the needs-video filter', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<StatefulEpochsTab bundle={bundle} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Show epochs' }), 'needs-video');
    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /^Add video entry$/i }));

    expect(screen.getByRole('combobox', { name: 'Show epochs' })).toHaveValue('all');
    expect(screen.getByRole('button', { name: /Hide epoch 1 details/i })).toBeInTheDocument();
  });

  it('a declared-videoless epoch reads "absent" and never blocks (toggling never changes export shape)', () => {
    const bundle = makeBundle({ state: { videolessEpochs: [1, 3] } });
    render(<EpochsTab {...bundle} />);
    // epochs 1,3 declared absent → "No video"; epoch 2 still present.
    expect(screen.getAllByText(/No video recorded/i)).toHaveLength(2);
    expect(screen.queryByText(/Video:\s*Missing/i)).not.toBeInTheDocument();
  });
});

describe('EpochsTab — statescript naming', () => {
  it('an epoch with no statescript can add a derived one (associated_files patch)', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /^Add StateScript log$/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'associated_files')).toEqual([
      {
        name: '20230622_r_01_s1.stateScriptLog',
        description: 'statescript log',
        path: '/data/r/20230622/20230622_r_01_s1.stateScriptLog',
        task_epochs: 1,
      },
    ]);
  });

  it('manual statescript entry creates the expected row and focuses the editable path', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<StatefulEpochsTab bundle={bundle} />);

    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /Enter statescript manually for epoch 1/i }));

    expect(lastPatch(bundle.onFieldUpdate, 'associated_files')).toEqual([
      {
        name: '20230622_r_01_s1.stateScriptLog',
        description: 'statescript log',
        path: '/data/r/20230622/20230622_r_01_s1.stateScriptLog',
        task_epochs: 1,
      },
    ]);
    const input = await screen.findByRole('textbox', { name: /Epoch 1 statescript path/i });
    expect(input).toHaveValue('/data/r/20230622/20230622_r_01_s1.stateScriptLog');
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('generates every expected statescript and offers Undo', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    // A prior day logged a sleep statescript, so all three epochs expect one here.
    render(<EpochsTab {...bundle} animalDays={[PRIOR_SLEEP_DAY, bundle.day]} />);

    await user.click(screen.getByText('File naming & bulk entry'));
    await user.click(screen.getByRole('button', { name: /Add 3 suggested StateScript logs/i }));

    expect(lastPatch(bundle.onFieldUpdate, 'associated_files')).toEqual([
      {
        name: '20230622_r_01_s1.stateScriptLog',
        description: 'statescript log',
        path: '/data/r/20230622/20230622_r_01_s1.stateScriptLog',
        task_epochs: 1,
      },
      {
        name: '20230622_r_02_r1.stateScriptLog',
        description: 'statescript log',
        path: '/data/r/20230622/20230622_r_02_r1.stateScriptLog',
        task_epochs: 2,
      },
      {
        name: '20230622_r_03_s2.stateScriptLog',
        description: 'statescript log',
        path: '/data/r/20230622/20230622_r_03_s2.stateScriptLog',
        task_epochs: 3,
      },
    ]);
    expect(screen.getByText(/Added 3 StateScript metadata entries/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Undo/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'associated_files')).toEqual([]);
  });

  it('keeps missing-statescript fixes in the selected epoch panel', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<StatefulEpochsTab bundle={bundle} />);

    expect(screen.queryByRole('button', { name: /Add statescript for epoch 1/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /^Add StateScript log$/i }));

    expect(lastPatch(bundle.onFieldUpdate, 'associated_files')).toEqual([
      {
        name: '20230622_r_01_s1.stateScriptLog',
        description: 'statescript log',
        path: '/data/r/20230622/20230622_r_01_s1.stateScriptLog',
        task_epochs: 1,
      },
    ]);
    expect(screen.getByRole('button', { name: /Hide epoch 1 details/i })).toBeInTheDocument();
    expect(screen.getByText('20230622_r_01_s1.stateScriptLog')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Override path/i })).toHaveFocus());
  });
});

describe('EpochsTab — accessibility', () => {
  it('has no axe violations (collapsed and with a drill-in open)', async () => {
    const user = userEvent.setup();
    const { container } = render(<EpochsTab {...makeBundle()} />);
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: /Show epoch 1 details/i }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('EpochsTab — statescript expectation + the data-folder prerequisite (F6)', () => {
  it('keeps optional StateScript reminders separate from video information to enter', () => {
    render(<EpochsTab {...makeBundle()} />);
    expect(screen.getByRole('option', { name: 'Suggested StateScript logs (1)' })).toBeInTheDocument();
    expect(screen.getByLabelText(/epoch status summary/i)).toHaveTextContent('Video information to enter for 2');
    expect(screen.queryByText(/statescripts? expected/i)).not.toBeInTheDocument();
  });

  it('expects sleep statescripts once an earlier same-configuration day logged one', () => {
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} animalDays={[PRIOR_SLEEP_DAY, bundle.day]} />);
    expect(screen.getByRole('option', { name: 'Suggested StateScript logs (3)' })).toBeInTheDocument();
    expect(screen.getAllByText(/StateScript:\s*Suggested log not added/i)).toHaveLength(3);
  });

  it('filters the grid to the epochs that expect a statescript', async () => {
    const user = userEvent.setup();
    render(<EpochsTab {...makeBundle()} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Show epochs' }), 'expected-statescript');
    expect(screen.queryByRole('button', { name: /Show epoch 1 details/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show epoch 2 details/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show epoch 3 details/i })).not.toBeInTheDocument();
  });

  it('names the linked statescript on the collapsed cell once one is bound', () => {
    const bundle = makeBundle({
      associated_files: [
        {
          name: 'statescript_r1',
          description: 'Statescript Log',
          path: '/data/r/20230622/20230622_r_02_r1.stateScriptLog',
          task_epochs: 2,
        },
      ],
    });
    render(<EpochsTab {...bundle} />);
    expect(screen.getByText(/StateScript:\s*Suggested name added/i)).toHaveAttribute(
      'title',
      '/data/r/20230622/20230622_r_02_r1.stateScriptLog'
    );
    expect(screen.queryByText(/StateScript:\s*Suggested log not added/i)).not.toBeInTheDocument();
  });

  it('never bulk-generates a statescript for an epoch that expects none', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);

    // Only the run epoch expects one; the two sleep epochs have no precedent on this animal.
    await user.click(screen.getByText('File naming & bulk entry'));
    await user.click(screen.getByRole('button', { name: /^Add 1 suggested StateScript log$/ }));

    expect(lastPatch(bundle.onFieldUpdate, 'associated_files')).toEqual([
      {
        name: '20230622_r_02_r1.stateScriptLog',
        description: 'statescript log',
        path: '/data/r/20230622/20230622_r_02_r1.stateScriptLog',
        task_epochs: 2,
      },
    ]);
  });

  it('has no axe violations with the data-folder disclosure open', async () => {
    const user = userEvent.setup();
    const { container } = render(<EpochsTab {...makeBundle({ dataFolder: '' })} />);
    await user.click(screen.getByText('File naming & bulk entry'));
    await user.click(screen.getByRole('button', { name: /^Add 1 suggested StateScript log$/ }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('asks for the data folder where the files are generated, never by naming another section', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle({ dataFolder: '' });
    render(<StatefulEpochsTab bundle={bundle} />);

    expect(screen.queryByText(/Daily Setup/i)).not.toBeInTheDocument();
    const help = screen.getByText(/Folder containing this recording’s files/i);
    expect(help).not.toBeVisible();
    await user.click(screen.getByText('File naming & bulk entry'));
    const addStatescript = screen.getByRole('button', { name: /^Add 1 suggested StateScript log$/ });
    expect(addStatescript).toBeEnabled();

    await user.click(addStatescript);
    expect(help).toBeVisible();

    const input = screen.getByLabelText(/^StateScript file folder$/i);
    await waitFor(() => expect(input).toHaveFocus());
    await user.type(input, '/data/r/20230622');
    await user.tab();

    await waitFor(() =>
      expect(bundle.onFieldUpdate).toHaveBeenCalledWith('dataFolder', '/data/r/20230622')
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Add 1 suggested StateScript log$/ })).toBeEnabled()
    );
    // Keep the tools open so the next action (adding the logs) stays in place.
    expect(help).toBeVisible();
  });
});
