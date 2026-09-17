import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
  it('keeps the advanced file editor collapsed when saved files are already assigned', async () => {
    const user = userEvent.setup();
    renderSection();

    const summary = screen.getByText(/Other files & advanced file editing/i);
    const disclosure = summary.closest('details');
    expect(disclosure).not.toHaveAttribute('open');

    await user.click(summary);
    const section = screen.getByRole('heading', { name: /other files and advanced editing/i }).closest('section');
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute('tabindex', '-1');
    expect(section).toHaveTextContent(/6 files/i);
    expect(within(section).getByRole('button', { name: /custom file/i })).toBeInTheDocument();
  });

  it('keeps associated-file repair anchors available without opening a disclosure', () => {
    const { container } = renderSection({ fieldPath: 'associated_files[1].path', token: 1 });

    expect(container.querySelector('[data-field-path="associated_files[1].path"]')).toBeInTheDocument();
    expect(screen.getByText(/Other files & advanced file editing/i).closest('details')).toHaveAttribute('open');
  });

  it('renders the supplemental files editor and writes associated_files', async () => {
    const user = userEvent.setup();
    const { onFieldUpdate } = renderSection();
    await user.click(screen.getByText(/Other files & advanced file editing/i));
    const section = screen.getByRole('heading', { name: /other files and advanced editing/i }).closest('section');

    await user.click(within(section).getByRole('button', { name: /custom file/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('associated_files', [
      { name: 'statescript', description: 'StateScript file', path: 'statescript_01.stateScriptLog', task_epochs: 1 },
      { name: 'stim1', description: 'Psychopy stim generation script for stim 1', path: 'stim1.py', task_epochs: 1 },
      { name: '', description: '', path: '', task_epochs: '' },
    ]);
  });
});
