/**
 * AssociatedFilesEditor — the repair surface for the `orphaned_file` validation
 * error, which routes to the Epochs step but previously had no editing UI (a
 * dead-end that blocked export). Mirrors AssociatedVideosEditor's controlled-ref
 * contract: task_epochs is a SCALAR chosen from the day's task epochs; a loaded
 * stale epoch is surfaced as a visible "Missing epoch N" option, flagged via
 * role="alert", and is repairable by re-pointing it. Writes flow through onChange.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssociatedFilesEditor from '../AssociatedFilesEditor';

const tasks = [{ task_epochs: [1, 3] }];

describe('AssociatedFilesEditor', () => {
  it('adds a file row with a name and a scalar epoch from current tasks', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <AssociatedFilesEditor files={[]} tasks={tasks} onChange={onChange} />
    );

    await user.click(screen.getByRole('button', { name: /custom file/i }));
    // Re-render with the appended empty row so the controlled inputs exist.
    rerender(
      <AssociatedFilesEditor
        files={[{ name: '', description: '', path: '', task_epochs: '' }]}
        tasks={tasks}
        onChange={onChange}
      />
    );

    const epochSelect = screen.getByRole('combobox', { name: /epoch/i });
    // Only epochs 1 and 3 exist — there must be no option "2".
    expect(within(epochSelect).queryByRole('option', { name: '2' })).toBeNull();
    await user.selectOptions(epochSelect, '3');

    const lastCall = onChange.mock.calls.at(-1)[0];
    expect(lastCall[0].task_epochs).toBe(3);
    expect(typeof lastCall[0].task_epochs).toBe('number');
  });

  it('prefills corpus-backed supplemental file presets', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <AssociatedFilesEditor files={[]} tasks={tasks} onChange={onChange} />
    );

    await user.click(screen.getByRole('button', { name: /psychopy stim script/i }));
    expect(onChange).toHaveBeenLastCalledWith([
      {
        name: 'stim1',
        description: 'Psychopy stim generation script for stim 1',
        path: '',
        task_epochs: '',
      },
    ]);

    rerender(
      <AssociatedFilesEditor
        files={[
          {
            name: 'stim1',
            description: 'Psychopy stim generation script for stim 1',
            path: '',
            task_epochs: '',
          },
        ]}
        tasks={tasks}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /psychopy stim script/i }));
    expect(onChange).toHaveBeenLastCalledWith([
      {
        name: 'stim1',
        description: 'Psychopy stim generation script for stim 1',
        path: '',
        task_epochs: '',
      },
      {
        name: 'stim2',
        description: 'Psychopy stim generation script for stim 2',
        path: '',
        task_epochs: '',
      },
    ]);
  });

  it.each([
    [
      /realtime output/i,
      {
        name: 'realtime_output_r1',
        description: 'realtime_decoding_outputfile',
        path: '',
        task_epochs: '',
      },
    ],
    [
      /behavior timeline/i,
      {
        name: 'Behavior timeline',
        description: 'Behavior timeline',
        path: '',
        task_epochs: '',
      },
    ],
    [
      /fsgui log/i,
      {
        name: 'fsgui_log',
        description: 'FSGUI log',
        path: '',
        task_epochs: '',
      },
    ],
  ])('prefills the %s supplemental preset', async (buttonName, expectedRow) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AssociatedFilesEditor files={[]} tasks={tasks} onChange={onChange} />
    );

    await user.click(screen.getByRole('button', { name: buttonName }));

    expect(onChange).toHaveBeenLastCalledWith([expectedRow]);
  });

  it('can render only supplemental rows while preserving original associated_files indices', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AssociatedFilesEditor
        files={[
          { name: 'statescript_r1', description: 'Statescript Log', path: 'r1.stateScriptLog', task_epochs: 1 },
          { name: 'stim1', description: 'Psychopy stim generation script for stim 1', path: 'stim1.py', task_epochs: 1 },
        ]}
        tasks={tasks}
        supplementalOnly
        onChange={onChange}
      />
    );

    expect(screen.queryByDisplayValue('statescript_r1')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('stim1')).toBeInTheDocument();
    expect(document.querySelector('[data-field-path="associated_files[0].path"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-field-path="associated_files[1].path"]')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /file name/i }), 't');

    expect(onChange).toHaveBeenLastCalledWith([
      { name: 'statescript_r1', description: 'Statescript Log', path: 'r1.stateScriptLog', task_epochs: 1 },
      {
        name: 'stim1t',
        description: 'Psychopy stim generation script for stim 1',
        path: 'stim1.py',
        task_epochs: 1,
      },
    ]);
  });

  it('appends and removes supplemental-only rows without dropping statescript rows', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AssociatedFilesEditor
        files={[
          { name: 'statescript_r1', description: 'Statescript Log', path: 'r1.stateScriptLog', task_epochs: 1 },
          { name: 'stim1', description: 'Psychopy stim generation script for stim 1', path: 'stim1.py', task_epochs: 1 },
        ]}
        tasks={tasks}
        supplementalOnly
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /custom file/i }));
    expect(onChange).toHaveBeenLastCalledWith([
      { name: 'statescript_r1', description: 'Statescript Log', path: 'r1.stateScriptLog', task_epochs: 1 },
      { name: 'stim1', description: 'Psychopy stim generation script for stim 1', path: 'stim1.py', task_epochs: 1 },
      { name: '', description: '', path: '', task_epochs: '' },
    ]);

    await user.click(screen.getByRole('button', { name: /remove file stim1/i }));
    expect(onChange).toHaveBeenLastCalledWith([
      { name: 'statescript_r1', description: 'Statescript Log', path: 'r1.stateScriptLog', task_epochs: 1 },
    ]);
  });

  it('offers a scalar <select> for the epoch (no manual numeric entry)', () => {
    render(
      <AssociatedFilesEditor
        files={[{ name: 'f', task_epochs: '' }]}
        tasks={tasks}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole('combobox', { name: /epoch/i }).tagName).toBe('SELECT');
    expect(screen.queryByRole('spinbutton', { name: /epoch/i })).toBeNull();
  });

  it('renders a stale epoch as a visible "Missing epoch N" option, not a blank select', () => {
    render(
      <AssociatedFilesEditor
        files={[{ name: 'stale_file', task_epochs: 9 }]}
        tasks={tasks}
        onChange={() => {}}
      />
    );
    const epochSelect = screen.getByLabelText(/task epoch/i);
    const staleOption = within(epochSelect).getByRole('option', { name: /missing epoch 9/i });
    expect(staleOption).toBeInTheDocument();
    expect(epochSelect).toHaveValue('9');
  });

  it('flags a loaded file with a stale epoch via role="alert" naming the value', () => {
    render(
      <AssociatedFilesEditor
        files={[{ name: 'stale_file', task_epochs: 9 }]}
        tasks={tasks}
        onChange={() => {}}
      />
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/epoch 9/i);
    expect(alert).toHaveTextContent(/stale_file/i);
  });

  it('repairs a stale epoch by re-pointing it to a valid epoch', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AssociatedFilesEditor
        files={[{ name: 'stale_file', task_epochs: 9 }]}
        tasks={tasks}
        onChange={onChange}
      />
    );
    const epochSelect = screen.getByLabelText(/task epoch/i);
    await user.selectOptions(epochSelect, '1');
    expect(onChange).toHaveBeenCalledWith([
      { name: 'stale_file', task_epochs: 1 },
    ]);
  });

  it('shows an empty-state note when no task epochs are defined', () => {
    render(
      <AssociatedFilesEditor
        files={[{ name: 'f', task_epochs: '' }]}
        tasks={[]}
        onChange={() => {}}
      />
    );
    expect(screen.getByText(/no task epochs/i)).toBeInTheDocument();
  });

  it('marks the file name field as required', () => {
    render(
      <AssociatedFilesEditor
        files={[{ name: '', task_epochs: '' }]}
        tasks={tasks}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole('textbox', { name: /file name/i })).toBeRequired();
  });

  it('removes a file row through the editor', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AssociatedFilesEditor
        files={[{ name: 'f', task_epochs: 1 }]}
        tasks={tasks}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole('button', { name: /remove file/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  // collectValidEpochs iterates each task's task_epochs. A task inside an otherwise
  // valid tasks array can carry a malformed task_epochs (a string, not an array);
  // it must contribute no epochs rather than crash the epoch-repair UI.
  it('does not throw when a task has a non-array task_epochs', () => {
    expect(() =>
      render(
        <AssociatedFilesEditor
          files={[{ name: 'f', task_epochs: '' }]}
          tasks={[{ task_name: 'a', task_epochs: '1' }]}
          onChange={() => {}}
        />
      )
    ).not.toThrow();
    // The malformed task contributes no valid epochs, so the empty-state note shows.
    expect(screen.getByText(/no task epochs/i)).toBeInTheDocument();
  });
});
