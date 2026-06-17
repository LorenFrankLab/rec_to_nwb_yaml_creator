import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportPreview from '../ExportPreview';
import { encodeYaml, downloadYamlFile } from '../../../io/yaml';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { buildDayEditorViewModel } from '../../../viewModels/dayEditorViewModel';

// The batch downloads through the shared exportDayFile core — mock only the download side-effect.
vi.mock('../../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadYamlFile: vi.fn() };
});

/**
 * A `remy` animal with TWO days: a valid (video-complete) day, and an error day whose only problem is a
 * whitespace-only session_description (a day-owned schema error → routes to Overview). The error is
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

describe('ExportPreview — "Export all days" batch', () => {
  it('exports the valid day, skips the error day, and reports the counts', async () => {
    const user = userEvent.setup();
    const { animal, validDay, workspace } = buildTwoDayAnimal();
    const vm = buildDayEditorViewModel(workspace, validDay.id);
    render(
      <ExportPreview
        animal={animal}
        day={validDay}
        animalKey={animal.id}
        animalDays={[validDay]}
        workspace={workspace}
        issues={vm.issues}
        exportGate={vm.export}
        onNavigate={vi.fn()}
        actions={{ updateDay: vi.fn() }}
      />
    );

    await user.click(screen.getByRole('button', { name: /export all 2 days/i }));

    const result = await screen.findByRole('status', { name: /batch export result/i });
    expect(result).toHaveTextContent(/exported 1/i);
    expect(result).toHaveTextContent(/skipped 1/i);

    // The valid day's bytes are the SAME single-day export bytes (batch === single export).
    const expectedBytes = encodeYaml(mergeDayMetadata(animal, validDay));
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    expect(downloadYamlFile).toHaveBeenCalledWith('06222023_remy_metadata.yml', expectedBytes);
  });

  it('links each skipped day to its blocking issue via the field-level repair route (not a bare day link)', async () => {
    const user = userEvent.setup();
    const { animal, validDay, errorDay, workspace } = buildTwoDayAnimal();
    const vm = buildDayEditorViewModel(workspace, validDay.id);
    render(
      <ExportPreview
        animal={animal}
        day={validDay}
        animalKey={animal.id}
        animalDays={[validDay]}
        workspace={workspace}
        issues={vm.issues}
        exportGate={vm.export}
        onNavigate={vi.fn()}
        actions={{ updateDay: vi.fn() }}
      />
    );

    await user.click(screen.getByRole('button', { name: /export all 2 days/i }));

    const result = await screen.findByRole('status', { name: /batch export result/i });
    // The skipped day's link resolves through repairRouting to the issue's OWNER (Overview), carrying
    // the field as a ?field= deep-link — not a bare "open this day" link.
    const fix = within(result).getByRole('link', { name: /fix in overview/i });
    expect(fix.getAttribute('href')).toMatch(new RegExp(`^#/day/${errorDay.id}\\?field=`));
  });
});
