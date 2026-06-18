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
      { name: 'statescript', description: 'StateScript file', path: 'statescript_01.py', task_epochs: 1 },
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
  it('keeps supplemental files visible below the epoch workspace by default', () => {
    renderSection();

    const section = screen.getByRole('heading', { name: /other associated files/i }).closest('section');
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent(/1 file/i);
    expect(screen.getByRole('button', { name: /add file/i })).toBeInTheDocument();
  });

  it('keeps associated-file repair anchors available without opening a disclosure', () => {
    const { container } = renderSection({ fieldPath: 'associated_files[0].path', token: 1 });

    expect(container.querySelector('[data-field-path="associated_files[0].path"]')).toBeInTheDocument();
  });

  it('renders the supplemental files editor and writes associated_files', async () => {
    const user = userEvent.setup();
    const { onFieldUpdate } = renderSection();

    await user.click(screen.getByRole('button', { name: /add file/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('associated_files', [
      { name: 'statescript', description: 'StateScript file', path: 'statescript_01.py', task_epochs: 1 },
      { name: '', description: '', path: '', task_epochs: '' },
    ]);
  });
});
