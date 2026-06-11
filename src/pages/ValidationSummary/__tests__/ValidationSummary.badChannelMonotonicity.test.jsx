import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useStoreContext } from '../../../state/StoreContext';
import { checkShadowExport } from '../../../domain/shadowExport';
import { downloadYamlFile } from '../../../io/yaml';
import { isFeatureEnabled } from '../../../featureFlags';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

import { ValidationSummary } from '../index';

vi.mock('../../../state/StoreContext', () => ({
  useStoreContext: vi.fn(),
}));

vi.mock('../../../domain/shadowExport', () => ({
  checkShadowExport: vi.fn(),
}));

vi.mock('../../../featureFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isFeatureEnabled: vi.fn(actual.isFeatureEnabled) };
});

vi.mock('../../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadYamlFile: vi.fn() };
});

/**
 * A single-animal workspace with two same-config days where day 2 silently un-fails channel 2
 * on ntrode 1 (marked bad on day 1) without acknowledgement — an unacknowledged monotonicity
 * regression. The regression lives in the cross-day relationship, so it only surfaces when the
 * per-day chip / batch gate is fed the animal's other days.
 *
 * @returns {{ workspace: object, ids: { day1Id: string, day2Id: string } }}
 */
function makeRegressingWorkspace() {
  const ts = '2023-06-22T12:00:00.000Z';
  const { animal, day: day1 } = buildRealisticWorkspace();
  day1.id = 'remy-2023-06-22';
  day1.date = '2023-06-22';
  day1.experimentDate = '06222023';
  day1.deviceOverrides = { bad_channels: { 1: [2] } };

  const day2 = structuredClone(day1);
  day2.id = 'remy-2023-06-23';
  day2.date = '2023-06-23';
  day2.experimentDate = '06232023';
  day2.session = { ...day2.session, session_id: 'remy_20230623' };
  day2.deviceOverrides = { bad_channels: { 1: [] } };

  animal.days = [day1.id, day2.id];

  return {
    workspace: {
      version: '1.0.0',
      lastModified: ts,
      animals: { [animal.id]: animal },
      days: { [day1.id]: day1, [day2.id]: day2 },
      settings: {
        defaultLab: 'Frank',
        defaultInstitution: 'University of California, San Francisco',
        defaultExperimenters: [],
        autoSaveInterval: 30000,
        shadowExportEnabled: true,
      },
    },
    ids: { day1Id: day1.id, day2Id: day2.id },
  };
}

/**
 * Configure the mocked store for a given workspace.
 *
 * @param {object} workspace - The workspace slice to expose as `model.workspace`.
 */
function provideStore(workspace) {
  useStoreContext.mockReturnValue({
    model: { workspace },
    actions: {
      updateDay: vi.fn(),
      removeDayReference: vi.fn(),
      relinkDayReference: vi.fn(),
      unlinkDayReference: vi.fn(),
    },
    selectors: {},
    persistence: { enabled: false },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkShadowExport.mockReturnValue({ ok: true, yaml: 'yaml-bytes', stableYaml: 'yaml-bytes', diff: null });
  isFeatureEnabled.mockReturnValue(true);
});

describe('ValidationSummary — bad-channel monotonicity gate', () => {
  it("the regressing day's readiness chip is NOT 'valid' (it reads as an error)", () => {
    const { workspace, ids } = makeRegressingWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);

    // Day 1 (the earlier marked-bad day) is live-valid (unsaved) → "Ready to export".
    const day1Row = screen.getByTestId(`day-row-${ids.day1Id}`);
    expect(within(day1Row).getByText('Ready to export')).toBeInTheDocument();

    // Day 2 silently un-fails channel 2 → blocked, so its chip must NOT read ready/valid.
    const day2Row = screen.getByTestId(`day-row-${ids.day2Id}`);
    expect(within(day2Row).queryByText('Ready to export')).not.toBeInTheDocument();
    expect(within(day2Row).getByText('Error')).toBeInTheDocument();
  });

  it('batch Export Valid Only does NOT export the regressing day', async () => {
    const user = userEvent.setup();
    const { workspace, ids } = makeRegressingWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);

    await user.click(screen.getByRole('button', { name: /export valid only/i }));

    // Only the valid day 1 reaches the preflight; the regressing day 2 is filtered out.
    const confirm = await screen.findByRole('button', { name: /confirm export/i });
    expect(confirm).toHaveTextContent(/\(1\)/);

    await user.click(confirm);

    // Exactly one file downloaded, and it is day 1 — never the regressing day 2.
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    expect(downloadYamlFile).not.toHaveBeenCalledWith(
      expect.stringContaining('06232023'),
      expect.anything()
    );
    expect(downloadYamlFile).toHaveBeenCalledWith(
      expect.stringContaining('06222023'),
      expect.anything()
    );
    void ids;
  });

  it('a non-regressing later day (superset bad set) stays valid and exportable', async () => {
    const user = userEvent.setup();
    const { workspace, ids } = makeRegressingWorkspace();
    // Day 2 keeps channel 2 and adds channel 1 — monotonic, no false block.
    workspace.days[ids.day2Id].deviceOverrides = { bad_channels: { 1: [1, 2] } };
    provideStore(workspace);

    render(<ValidationSummary />);

    const day2Row = screen.getByTestId(`day-row-${ids.day2Id}`);
    expect(within(day2Row).getByText('Ready to export')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /export valid only/i }));
    const confirm = await screen.findByRole('button', { name: /confirm export/i });
    expect(confirm).toHaveTextContent(/\(2\)/);
    await user.click(confirm);

    expect(downloadYamlFile).toHaveBeenCalledTimes(2);
  });
});
