import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExportPreview from '../ExportPreview';
import { downloadYamlFile } from '../../../io/yaml';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { buildDayEditorViewModel } from '../../../viewModels/dayEditorViewModel';

// The batch downloads through the shared exportDayFile core — mock only the download side-effect.
vi.mock('../../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadYamlFile: vi.fn() };
});

/**
 * A `remy` animal with TWO days: a valid (video-complete) day, and an error day whose only problem is a
 * whitespace-only session_description (a day-owned schema error → routes to the Daily log). The error is
 * day-level (on `day.session`) so it does not also break the valid day.
 */
function buildTwoDayAnimal() {
  const { animal, day: validDay } = buildRealisticWorkspace();
  const errorDay = structuredClone(validDay);
  errorDay.id = 'remy-2023-06-23';
  errorDay.date = '2023-06-23';
  errorDay.experimentDate = '06232023';
  errorDay.session = { ...errorDay.session, session_description: '   ' };
  animal.days = [validDay.id, errorDay.id];
  const workspace = { animals: { [animal.id]: animal }, days: { [validDay.id]: validDay, [errorDay.id]: errorDay } };
  return { animal, validDay, errorDay, workspace };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('ExportPreview — bulk review entry', () => {
  it('routes this animal’s other recordings through selection and preflight before any download', () => {
    const { animal, validDay, workspace } = buildTwoDayAnimal();
    const vm = buildDayEditorViewModel(workspace, validDay.id);
    render(<ExportPreview animal={animal} day={validDay} animalKey={animal.id}
      animalDays={[validDay]} workspace={workspace} issues={vm.issues} exportGate={vm.export}
      onNavigate={vi.fn()} actions={{ updateDay: vi.fn() }} />);
    expect(screen.getByRole('link', { name: /Review other recordings for remy/i })).toHaveAttribute('href', '#/animal/remy/export');
    expect(screen.queryByRole('button', { name: /Download all/i })).not.toBeInTheDocument();
    expect(downloadYamlFile).not.toHaveBeenCalled();
  });
});
