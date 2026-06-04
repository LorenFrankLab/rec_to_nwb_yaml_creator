import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeSummaryWorkspace } from '../../../__tests__/helpers/integration-test-helpers';

// Control the store (model + spy actions) without forking validation: chips are
// still derived from the REAL computeStepStatus/validate over the fixture data.
import { useStoreContext } from '../../../state/StoreContext';
// The shadow gate and the download side-effect are mocked so the batch tests can
// assert call counts/arguments without producing real downloads.
import { checkShadowExport } from '../../DayEditor/shadowExport';
import { downloadYamlFile } from '../../../io/yaml';
import { isFeatureEnabled } from '../../../featureFlags';

import { ValidationSummary } from '../index';

vi.mock('../../../state/StoreContext', () => ({
  useStoreContext: vi.fn(),
}));

vi.mock('../../DayEditor/shadowExport', () => ({
  checkShadowExport: vi.fn(),
}));

// Spy on isFeatureEnabled (defaults preserved) so the debug-override branch can be
// exercised. The real validation chain does not import featureFlags, so chips stay
// genuine.
vi.mock('../../../featureFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isFeatureEnabled: vi.fn(actual.isFeatureEnabled) };
});

vi.mock('../../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // Keep formatDeterministicFilename REAL so filename assertions are genuine.
    downloadYamlFile: vi.fn(),
  };
});

/**
 * Configure the mocked store for a given workspace, returning the updateDay spy.
 *
 * @param {object} workspace - The workspace slice to expose as `model.workspace`.
 * @returns {import('vitest').Mock} The `updateDay` spy for assertions.
 */
function provideStore(workspace) {
  const updateDay = vi.fn();
  useStoreContext.mockReturnValue({
    model: { workspace },
    actions: { updateDay },
    selectors: {},
    persistence: { enabled: false },
  });
  return updateDay;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: shadow gate passes for every day, strict mode on (the production default).
  checkShadowExport.mockReturnValue({ ok: true, yaml: 'yaml-bytes', stableYaml: 'yaml-bytes', diff: null });
  isFeatureEnabled.mockReturnValue(true);
});

describe('ValidationSummary', () => {
  it('lists all days across animals with correct chips', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);

    // One row per day (3), each chip derived from the real computeStepStatus.
    const validRow = screen.getByTestId(`day-row-${ids.validDayId}`);
    const errorRow = screen.getByTestId(`day-row-${ids.errorDayId}`);
    const incompleteRow = screen.getByTestId(`day-row-${ids.incompleteDayId}`);

    expect(within(validRow).getByText('Valid')).toBeInTheDocument();
    expect(within(errorRow).getByText('Error')).toBeInTheDocument();
    expect(within(incompleteRow).getByText('Incomplete')).toBeInTheDocument();
  });

  it('counts reflect chip breakdown', () => {
    const { workspace } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);

    const counts = screen.getByTestId('summary-counts');
    expect(counts).toHaveTextContent(/1 valid/i);
    expect(counts).toHaveTextContent(/1 with errors/i);
    expect(counts).toHaveTextContent(/1 incomplete/i);
  });

  it('each row links to its DayEditor', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);

    const validRow = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(validRow).getByRole('link')).toHaveAttribute('href', `#/day/${ids.validDayId}`);

    const errorRow = screen.getByTestId(`day-row-${ids.errorDayId}`);
    expect(within(errorRow).getByRole('link')).toHaveAttribute('href', `#/day/${ids.errorDayId}`);
  });

  it('empty workspace renders empty state and no table', () => {
    provideStore({
      version: '1.0.0',
      lastModified: '2023-06-22T12:00:00.000Z',
      animals: {},
      days: {},
      settings: {},
    });

    render(<ValidationSummary />);

    expect(screen.getByText(/no recording days/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('Validate All recomputes and persists status for every day', async () => {
    const user = userEvent.setup();
    const { workspace, ids } = makeSummaryWorkspace();
    const updateDay = provideStore(workspace);

    render(<ValidationSummary />);

    await user.click(screen.getByRole('button', { name: /validate all/i }));

    // updateDay called once per day (3).
    expect(updateDay).toHaveBeenCalledTimes(3);

    // state.validated is true ONLY for the genuinely-valid day.
    const callFor = (dayId) => updateDay.mock.calls.find((c) => c[0] === dayId)[1];
    expect(callFor(ids.validDayId).state.validated).toBe(true);
    expect(callFor(ids.errorDayId).state.validated).toBe(false);
    expect(callFor(ids.incompleteDayId).state.validated).toBe(false);

    // Completion announced in the status region.
    expect(screen.getByRole('status')).toHaveTextContent(/validated 3 days/i);
  });

  it('Export Valid Only exports only valid days through the shadow gate', async () => {
    const user = userEvent.setup();
    const { workspace } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);

    await user.click(screen.getByRole('button', { name: /export valid only/i }));

    // Only the single valid day is shadow-checked and downloaded.
    expect(checkShadowExport).toHaveBeenCalledTimes(1);
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    expect(downloadYamlFile).toHaveBeenCalledWith('06222023_remy_metadata.yml', 'yaml-bytes');
  });

  it('Export Valid Only: parity mismatch is skipped and reported, never downloaded', async () => {
    const user = userEvent.setup();
    const { workspace } = makeSummaryWorkspace();
    provideStore(workspace);

    // The (otherwise valid) day fails the gate.
    checkShadowExport.mockReturnValue({
      ok: false,
      yaml: 'yaml-bytes',
      stableYaml: 'other',
      diff: 'First difference at line 3:\n  encode A: "a"\n  encode B: "b"',
    });

    render(<ValidationSummary />);

    await user.click(screen.getByRole('button', { name: /export valid only/i }));

    // Skipped, never downloaded.
    expect(downloadYamlFile).not.toHaveBeenCalled();

    // Reported with its diff in an alert region.
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/skipped/i);
    expect(alert).toHaveTextContent(/06222023_remy_metadata\.yml|remy/i);
    expect(within(alert).getByText(/First difference at line 3/)).toBeInTheDocument();
  });

  it('Export Valid Only: sequential downloads, one file per valid day in stable order', async () => {
    const user = userEvent.setup();
    // Two valid days under one animal: start from the summary fixture, make the
    // incomplete day valid (restore session_id) and drop the error animal.
    const { workspace, ids } = makeSummaryWorkspace();
    const remy = workspace.animals.remy;
    const fixedDay = workspace.days[ids.incompleteDayId];
    fixedDay.session = { ...fixedDay.session, session_id: 'remy_20230623' };
    delete workspace.animals.totoro;
    delete workspace.days[ids.errorDayId];
    remy.days = [ids.validDayId, ids.incompleteDayId];
    provideStore(workspace);

    render(<ValidationSummary />);

    await user.click(screen.getByRole('button', { name: /export valid only/i }));

    expect(downloadYamlFile).toHaveBeenCalledTimes(2);
    // Stable order: sorted by date → 06-22 then 06-23.
    expect(downloadYamlFile.mock.calls[0][0]).toBe('06222023_remy_metadata.yml');
    expect(downloadYamlFile.mock.calls[1][0]).toBe('06232023_remy_metadata.yml');
  });

  it('Export Valid Only: with strict mode off, a parity-mismatch day is still downloaded (debug override) and reported', async () => {
    const user = userEvent.setup();
    const { workspace } = makeSummaryWorkspace();
    provideStore(workspace);

    isFeatureEnabled.mockReturnValue(false); // shadowExportStrict off (debug)
    checkShadowExport.mockReturnValue({
      ok: false,
      yaml: 'yaml-bytes',
      stableYaml: 'other',
      diff: 'First difference at line 7:\n  encode A: "x"\n  encode B: "y"',
    });

    render(<ValidationSummary />);

    await user.click(screen.getByRole('button', { name: /export valid only/i }));

    // The override DOWNLOADS the mismatched day...
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    expect(downloadYamlFile).toHaveBeenCalledWith('06222023_remy_metadata.yml', 'yaml-bytes');
    // ...but never silently: the override is surfaced with its diff.
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/despite a parity mismatch/i);
    expect(within(alert).getByText(/First difference at line 7/)).toBeInTheDocument();
  });

  it('Export Valid Only: exports the good day and skips the mismatched one in a single run', async () => {
    const user = userEvent.setup();
    // Two valid days; the gate fails for only one of them.
    const { workspace, ids } = makeSummaryWorkspace();
    const fixedDay = workspace.days[ids.incompleteDayId];
    fixedDay.session = { ...fixedDay.session, session_id: 'remy_20230623' };
    delete workspace.animals.totoro;
    delete workspace.days[ids.errorDayId];
    workspace.animals.remy.days = [ids.validDayId, ids.incompleteDayId];
    provideStore(workspace);

    checkShadowExport.mockImplementation((_animal, day) =>
      day.id === ids.validDayId
        ? { ok: true, yaml: 'good', stableYaml: 'good', diff: null }
        : { ok: false, yaml: 'bad', stableYaml: 'other', diff: 'mismatch on day 2' }
    );

    render(<ValidationSummary />);

    await user.click(screen.getByRole('button', { name: /export valid only/i }));

    // Only the good day downloads; the mismatched day is skipped (not downloaded).
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    expect(downloadYamlFile).toHaveBeenCalledWith('06222023_remy_metadata.yml', 'good');

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/skipped/i);
    expect(alert).toHaveTextContent(ids.incompleteDayId);
    expect(alert).not.toHaveTextContent(ids.validDayId);
  });

  it('Export Valid Only: no valid days short-circuits with a helpful message and no downloads', async () => {
    const user = userEvent.setup();
    // Keep only the error + incomplete days (drop the valid one).
    const { workspace, ids } = makeSummaryWorkspace();
    delete workspace.days[ids.validDayId];
    workspace.animals.remy.days = [ids.incompleteDayId];
    provideStore(workspace);

    render(<ValidationSummary />);

    await user.click(screen.getByRole('button', { name: /export valid only/i }));

    expect(checkShadowExport).not.toHaveBeenCalled();
    expect(downloadYamlFile).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/no valid days to export/i);
  });

  it('Validate All announces a singular day for a one-day workspace', async () => {
    const user = userEvent.setup();
    // One valid day only.
    const { workspace, ids } = makeSummaryWorkspace();
    delete workspace.animals.totoro;
    delete workspace.days[ids.incompleteDayId];
    delete workspace.days[ids.errorDayId];
    workspace.animals.remy.days = [ids.validDayId];
    provideStore(workspace);

    render(<ValidationSummary />);

    await user.click(screen.getByRole('button', { name: /validate all/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/validated 1 day\./i);
  });

  it('an animal with zero days contributes no rows and does not crash', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    // Strip remy down to a single day; give totoro no days at all.
    delete workspace.days[ids.incompleteDayId];
    delete workspace.days[ids.errorDayId];
    workspace.animals.remy.days = [ids.validDayId];
    workspace.animals.totoro.days = [];
    provideStore(workspace);

    render(<ValidationSummary />);

    // Only remy's valid day renders; totoro contributes nothing.
    expect(screen.getAllByRole('row')).toHaveLength(2); // header + 1 data row
    expect(screen.getByTestId(`day-row-${ids.validDayId}`)).toBeInTheDocument();
  });
});
