/**
 * Tests for the per-animal Validation & Export tab mounted into AnimalView (Phase 3-5).
 *
 * The `export` tab renders <ValidationSummary animalKey={id}> — the SAME component as the standalone
 * page, scoped by a filter (buildAnimalRows) to ONE animal, without a second #main-content. These
 * prove: the scoped header + only-this-animal rows render (not the placeholder), and exporting from
 * the tab reuses runExport to download the animal's valid days while skipping a non-valid one.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { makeSummaryWorkspace } from '../../../__tests__/helpers/integration-test-helpers';
import { checkShadowExport } from '../../../domain/shadowExport';
import { downloadYamlFile } from '../../../io/yaml';
import { AnimalView } from '../index';

// The shadow gate + download side-effect are mocked so we can assert export behavior without real
// downloads; the validation chain (computeStepStatus / mergeDayMetadata) stays REAL.
vi.mock('../../../domain/shadowExport', () => ({ checkShadowExport: vi.fn() }));
vi.mock('../../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadYamlFile: vi.fn() };
});

/**
 * Render the AnimalView export tab for an animal against a real store seeded with the workspace.
 * @param {string} animalId - The animal to view.
 * @param {object} workspace - The workspace slice.
 * @returns {object} render result
 */
function renderExportTab(animalId, workspace) {
  return render(
    <StoreProvider initialState={{ workspace }}>
      <AnimalView animalId={animalId} tab="export" />
    </StoreProvider>
  );
}

describe('AnimalView — Validation & Export tab (Phase 3-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkShadowExport.mockReturnValue({ ok: true, yaml: 'metadata: ok\n', diff: '' });
    delete window.location;
    window.location = { hash: '#/animal/remy/export' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('shows the scoped header and only this animal\'s rows (not the placeholder)', () => {
    const { workspace } = makeSummaryWorkspace();
    renderExportTab('remy', workspace);
    // Scoped header — remy has a valid day + an incomplete day = 2 days.
    expect(screen.getByText(/showing: remy — 2 days/i)).toBeInTheDocument();
    expect(screen.queryByText(/this section moves here in a later phase/i)).not.toBeInTheDocument();
    // remy's days render; totoro's error day does NOT appear in remy's scoped tab.
    expect(screen.getByTestId('day-row-remy-2023-06-22')).toBeInTheDocument();
    expect(screen.getByTestId('day-row-remy-2023-06-23')).toBeInTheDocument();
    expect(screen.queryByTestId('day-row-totoro-2023-06-22')).not.toBeInTheDocument();
  });

  it('links up to the cross-animal batch Validation & Export screen (Task 4.4)', () => {
    const { workspace } = makeSummaryWorkspace();
    renderExportTab('remy', workspace);
    // The per-animal tab handles ONE animal; it makes the batch screen explicit by linking to it.
    const uplink = screen.getByRole('link', { name: /all animals|batch|workspace validation/i });
    expect(uplink).toHaveAttribute('href', '#/validation');
  });

  it('does not render a second #main-content (AnimalView owns the page landmark)', () => {
    const { workspace } = makeSummaryWorkspace();
    renderExportTab('remy', workspace);
    expect(document.querySelectorAll('#main-content')).toHaveLength(1);
  });

  it('exports the animal\'s valid days via runExport; a non-valid day is skipped', async () => {
    const user = userEvent.setup();
    const { workspace } = makeSummaryWorkspace();
    renderExportTab('remy', workspace);

    await user.click(screen.getByRole('button', { name: /export valid only/i }));
    // Preflight lists only the valid day (the incomplete day is not export-eligible).
    const preflight = screen.getByRole('region', { name: /batch export preflight/i });
    expect(within(preflight).getByText(/confirm export \(1\)/i)).toBeInTheDocument();
    await user.click(within(preflight).getByRole('button', { name: /confirm export \(1\)/i }));

    // The single valid day downloaded; the incomplete day was never exported.
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/exported 1 file/i)).toBeInTheDocument();
  });
});
