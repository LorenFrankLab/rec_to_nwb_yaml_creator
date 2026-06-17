import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExportPreview from '../ExportPreview';
import { encodeYaml, formatDeterministicFilename } from '../../../io/yaml';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { buildDayEditorViewModel } from '../../../viewModels/dayEditorViewModel';

/**
 * Render the export-preview surface with the view-model gate/issues for the given day.
 *
 * @param {object} animal - The owning animal record.
 * @param {object} day - The recording day record.
 * @returns {import('@testing-library/react').RenderResult}
 */
function renderPreview(animal, day) {
  const workspace = { animals: { [animal.id]: animal }, days: { [day.id]: day } };
  const vm = buildDayEditorViewModel(workspace, day.id);
  return render(
    <ExportPreview
      animal={animal}
      day={day}
      animalKey={animal.id}
      animalDays={[day]}
      workspace={workspace}
      issues={vm.issues}
      exportGate={vm.export}
      onNavigate={vi.fn()}
    />
  );
}

describe('ExportPreview — YAML preview is the real export bytes', () => {
  it('renders the preview body as encodeYaml(mergeDayMetadata(animal, day)) verbatim', () => {
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day);

    const expected = encodeYaml(mergeDayMetadata(animal, day));
    const preview = screen.getByLabelText(/yaml preview/i);
    // The preview is the EXACT bytes — never a hand-built approximation.
    expect(preview.textContent).toBe(expected);
  });

  it('shows the deterministic download filename for the golden day', () => {
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day);

    const expectedFilename = formatDeterministicFilename({
      ...mergeDayMetadata(animal, day),
      EXPERIMENT_DATE_in_format_mmddYYYY: day.experimentDate,
    });
    expect(expectedFilename).toBe('06222023_remy_metadata.yml');
    expect(screen.getByText(expectedFilename)).toBeInTheDocument();
  });
});
