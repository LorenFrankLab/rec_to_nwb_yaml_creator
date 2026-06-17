/**
 * Component tests for the Phase-4 Epochs grid (EpochsTab).
 *
 * The grid is a thin renderer over the TDD'd pure layers (buildEpochGrid / epochOperations /
 * fileNaming); these tests pin the WIRING: collapsed file-state cells, the caret button, write-back
 * patches (each edit → the expected updateDay patch over the existing arrays), the video 3-state +
 * its off-export videolessEpochs writer, confirm-before-orphan (never auto-scrubbing), and a11y.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import EpochsTab from '../EpochsTab';

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
  it('renders one row per epoch with a focusable caret <button aria-expanded>', () => {
    render(<EpochsTab {...makeBundle()} />);
    const caret = screen.getByRole('button', { name: /Toggle epoch 1 details/i });
    expect(caret.tagName).toBe('BUTTON');
    expect(caret).toHaveAttribute('aria-expanded', 'false');
    expect(caret).toHaveAttribute('aria-controls', 'epoch-1-details');
    expect(screen.getByRole('button', { name: /Toggle epoch 2 details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Toggle epoch 3 details/i })).toBeInTheDocument();
  });

  it('shows video presence (not names) in the collapsed Video cell', () => {
    render(<EpochsTab {...makeBundle()} />);
    // epoch 2 has a bound video → "1 video"; epochs 1,3 are undeclared-videoless → "Missing".
    expect(screen.getByText('1 video')).toBeInTheDocument();
    expect(screen.getAllByText('Missing')).toHaveLength(2);
    // The video filename lives only in the drill-in, never the collapsed grid.
    expect(screen.queryByText('run_video')).not.toBeInTheDocument();
  });

  it('expands the drill-in when the caret is clicked', async () => {
    const user = userEvent.setup();
    render(<EpochsTab {...makeBundle()} />);
    const caret = screen.getByRole('button', { name: /Toggle epoch 1 details/i });
    await user.click(caret);
    expect(caret).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: /What happened/i })).toBeInTheDocument();
  });
});

describe('EpochsTab — no-epochs onboarding empty state (Phase 8)', () => {
  it('renders the EmptyState onboarding card with an add-epoch CTA when there are no epochs', () => {
    render(<EpochsTab {...makeBundle({ taskInstances: [] })} />);
    expect(screen.getByRole('heading', { name: /no epochs yet/i })).toBeInTheDocument();
    // No epoch rows are rendered (no caret).
    expect(screen.queryByRole('button', { name: /Toggle epoch/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add an epoch/i })).toBeInTheDocument();
  });

  it('the add-epoch CTA writes a taskInstances patch adding one epoch to the first task type', async () => {
    const user = userEvent.setup();
    // A genuine no-epochs day has no file/video refs (so adding the first epoch orphans nothing).
    const bundle = makeBundle({ taskInstances: [], associated_video_files: [], associated_files: [] });
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /add an epoch/i }));
    // 'blank' template adds one epoch to the first task type (Sleep / tasktype-0).
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [1] },
    ]);
  });
});

describe('EpochsTab — write-back patches', () => {
  it('per-epoch opto power writes a fs_gui_yamls patch', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    const input = screen.getByRole('spinbutton', { name: /Epoch 1 opto power/i });
    await user.type(input, '5');
    input.blur();
    const patch = lastPatch(bundle.onFieldUpdate, 'fs_gui_yamls');
    expect(patch).toEqual([{ name: '', epochs: [1], power_in_mW: 5 }]);
  });

  it('reassigning a task writes a taskInstances patch (moves the epoch)', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /Toggle epoch 1 details/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /Epoch 1 task/i }), 'tasktype-1');
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [3] },
      { taskTypeId: 'tasktype-1', task_epochs: [1, 2] },
    ]);
  });

  it('deleting an epoch with no bound refs writes taskInstances + offers Undo (no confirm)', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /Epoch 1 actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /Delete epoch/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [3] },
      { taskTypeId: 'tasktype-1', task_epochs: [2] },
    ]);
    expect(screen.getByText(/Epoch 1 deleted/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Undo/i })).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: /Epoch 1 actions/i }));
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
    await user.click(screen.getByRole('button', { name: /Epoch 2 actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /Delete epoch/i }));
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
    await user.click(screen.getByRole('button', { name: /Epoch 2 actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /Delete epoch/i }));
    await user.click(screen.getByRole('button', { name: /Clear references/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'taskInstances')).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [1, 3] },
    ]);
    expect(lastPatch(bundle.onFieldUpdate, 'associated_video_files')).toEqual([
      { name: 'run_video', camera_id: 1, task_epochs: '' },
    ]);
  });
});

describe('EpochsTab — renumber moves bound refs in lockstep (no silent misassociation)', () => {
  it('Move up swaps the epoch numbers AND remaps the bound video to follow its task (no confirm)', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    // Epoch 2 (Run) owns the video. Move it up → swap 1↔2.
    await user.click(screen.getByRole('button', { name: /Epoch 2 actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /Move up/i }));
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
});

describe('EpochsTab — video 3-state', () => {
  it('a missing epoch can be declared video-less (off-export videolessEpochs patch)', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /Toggle epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /Mark .no video./i }));
    expect(lastPatch(bundle.onFieldUpdate, 'state')).toEqual({ videolessEpochs: [1] });
  });

  it('a missing epoch can bind a derived video (associated_video_files patch)', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /Toggle epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /^\+ Add video$/i }));
    const patch = lastPatch(bundle.onFieldUpdate, 'associated_video_files');
    // Derived name for epoch 1 (Sleep, tag s1) in the day's data folder convention.
    expect(patch).toContainEqual({ name: '20230622_r_01_s1.1.h264', camera_id: 0, task_epochs: 1 });
  });

  it('a declared-videoless epoch reads "absent" and never blocks (toggling never changes export shape)', () => {
    const bundle = makeBundle({ state: { videolessEpochs: [1, 3] } });
    render(<EpochsTab {...bundle} />);
    // epochs 1,3 declared absent → "No video"; epoch 2 still present.
    expect(screen.getAllByText('No video')).toHaveLength(2);
    expect(screen.queryByText('Missing')).not.toBeInTheDocument();
  });
});

describe('EpochsTab — statescript naming', () => {
  it('an epoch with no statescript can add a derived one (associated_files patch)', async () => {
    const user = userEvent.setup();
    const bundle = makeBundle();
    render(<EpochsTab {...bundle} />);
    await user.click(screen.getByRole('button', { name: /Toggle epoch 1 details/i }));
    await user.click(screen.getByRole('button', { name: /Add statescript/i }));
    expect(lastPatch(bundle.onFieldUpdate, 'associated_files')).toEqual([
      {
        name: '20230622_r_01_s1.stateScriptLog',
        description: '',
        path: '/data/r/20230622/20230622_r_01_s1.stateScriptLog',
        task_epochs: 1,
      },
    ]);
  });
});

describe('EpochsTab — accessibility', () => {
  it('has no axe violations (collapsed and with a drill-in open)', async () => {
    const user = userEvent.setup();
    const { container } = render(<EpochsTab {...makeBundle()} />);
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: /Toggle epoch 1 details/i }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
