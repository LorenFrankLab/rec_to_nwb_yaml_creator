import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TasksFilesSection from '../TasksFilesSection';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { mergeDayMetadata } from '../../../state/workspaceUtils';

/**
 * Render the focused Tasks & Files section with one supplemental associated file.
 *
 * @param {object | null} focusRequest - Optional repair-focus request to thread into the section.
 * @returns {import('@testing-library/react').RenderResult & { onFieldUpdate: ReturnType<typeof vi.fn> }}
 */
function renderSection(focusRequest = null) {
  const { animal, day } = buildRealisticWorkspace();
  const onFieldUpdate = vi.fn();
  const dayWithFiles = {
    ...day,
    associated_files: [
      { name: 'statescript', description: 'StateScript file', path: 'statescript_01.stateScriptLog', task_epochs: 1 },
      { name: 'stim1', description: 'Psychopy stim generation script for stim 1', path: 'stim1.py', task_epochs: 1 },
    ],
  };
  const mergedDay = mergeDayMetadata(animal, dayWithFiles);
  return {
    onFieldUpdate,
    ...render(
      <TasksFilesSection
        animal={animal}
        day={dayWithFiles}
        mergedDay={mergedDay}
        onFieldUpdate={onFieldUpdate}
        focusRequest={focusRequest}
      />
    ),
  };
}

describe('TasksFilesSection', () => {
  it('shows additional-file actions while keeping complete record editing collapsed', () => {
    renderSection();

    expect(screen.getByRole('heading', { name: 'Additional files' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Add Psychopy stim script/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /Add Realtime output/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /Add Behavior timeline/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /Add FSGUI log/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /Add Custom file/i })).toBeVisible();
    expect(screen.getByRole('list', { name: 'Added additional files' })).toHaveTextContent('stim1');
    expect(screen.getByRole('list', { name: 'Added additional files' })).toHaveTextContent('Epoch 1');
    expect(screen.getByRole('list', { name: 'Added additional files' })).toHaveTextContent('stim1.py');
    expect(screen.getByRole('button', { name: 'Edit additional file stim1' })).toBeVisible();

    const summary = screen.getByText(/Edit saved file details/i);
    const disclosure = summary.closest('details');
    expect(disclosure).not.toHaveAttribute('open');
  });

  it('keeps associated-file repair anchors available without opening a disclosure', () => {
    const { container } = renderSection({ fieldPath: 'associated_files[1].path', token: 1 });

    expect(container.querySelector('[data-field-path="associated_files[1].path"]')).toBeInTheDocument();
    expect(screen.getByText(/Edit saved file details/i).closest('details')).toHaveAttribute('open');
  });

  it('renders the supplemental files editor and writes associated_files', async () => {
    const user = userEvent.setup();
    const { onFieldUpdate } = renderSection();
    await user.click(screen.getByRole('button', { name: /Add Custom file/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('associated_files', [
      { name: 'statescript', description: 'StateScript file', path: 'statescript_01.stateScriptLog', task_epochs: 1 },
      { name: 'stim1', description: 'Psychopy stim generation script for stim 1', path: 'stim1.py', task_epochs: 1 },
      { name: '', description: '', path: '', task_epochs: '' },
    ]);
    expect(screen.getByText(/Edit saved file details/i).closest('details')).toHaveAttribute('open');
  });
});
