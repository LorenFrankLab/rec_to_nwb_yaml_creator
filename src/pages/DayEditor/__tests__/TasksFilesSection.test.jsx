import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  it('keeps supplemental files collapsed below the epoch workspace by default', () => {
    renderSection();

    const details = screen.getByText(/supplemental files/i).closest('details');
    expect(details).not.toHaveAttribute('open');
    expect(details).toHaveTextContent(/1 file/i);
  });

  it('auto-opens supplemental files when repair focus targets an associated-file field', async () => {
    renderSection({ fieldPath: 'associated_files[0].path', token: 1 });

    const details = screen.getByText(/supplemental files/i).closest('details');
    await waitFor(() => expect(details).toHaveAttribute('open'));
  });

  it('renders the supplemental files editor and writes associated_files', async () => {
    const user = userEvent.setup();
    const { onFieldUpdate } = renderSection();

    await user.click(screen.getByText(/supplemental files/i));
    await user.click(screen.getByRole('button', { name: /add file/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('associated_files', [
      { name: 'statescript', description: 'StateScript file', path: 'statescript_01.py', task_epochs: 1 },
      { name: '', description: '', path: '', task_epochs: '' },
    ]);
  });
});
