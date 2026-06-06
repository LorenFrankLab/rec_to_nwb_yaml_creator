import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeSummaryWorkspace } from '../../../__tests__/helpers/integration-test-helpers';

// Control the store (model + spy actions) without forking validation: chips are
// still derived from the REAL computeStepStatus/validate over the fixture data.
import { useStoreContext } from '../../../state/StoreContext';
// The shadow gate and the download side-effect are mocked so the batch tests can
// assert call counts/arguments without producing real downloads.
import { checkShadowExport } from '../../../domain/shadowExport';
import { downloadYamlFile } from '../../../io/yaml';
import { isFeatureEnabled } from '../../../featureFlags';

import { ValidationSummary } from '../index';

vi.mock('../../../state/StoreContext', () => ({
  useStoreContext: vi.fn(),
}));

vi.mock('../../../domain/shadowExport', () => ({
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
    // removeDayReference is present so a missing-record row's repair button never references
    // an undefined action; the dedicated repair test installs its own captured spy.
    actions: { updateDay, removeDayReference: vi.fn(), relinkDayReference: vi.fn(), unlinkDayReference: vi.fn() },
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
    // Batch export now shows a preflight; confirm it to run the downloads.
    await user.click(screen.getByRole('button', { name: /confirm export/i }));

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
    await user.click(screen.getByRole('button', { name: /confirm export/i }));

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
    await user.click(screen.getByRole('button', { name: /confirm export/i }));

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
    await user.click(screen.getByRole('button', { name: /confirm export/i }));

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
    await user.click(screen.getByRole('button', { name: /confirm export/i }));

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
    expect(screen.getByRole('status')).toHaveTextContent(/no days are ready to export/i);
  });

  it('Export Valid Only shows a per-day preflight (config version + contents) before downloading', async () => {
    const user = userEvent.setup();
    const { workspace } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);
    await user.click(screen.getByRole('button', { name: /export valid only/i }));

    // Preflight region appears; nothing has downloaded yet (confidence check, not one-click).
    const preflight = screen.getByRole('region', { name: /batch export preflight/i });
    expect(within(preflight).getByText(/config v1/i)).toBeInTheDocument();
    expect(within(preflight).getByText(/electrode group/i)).toBeInTheDocument();
    expect(downloadYamlFile).not.toHaveBeenCalled();
  });

  it('surfaces an orphaned day record (a record not in any animal index) instead of losing it', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    // Drop the valid day from its animal's index but KEEP the record in workspace.days — a
    // recovered/corrupt-index scenario that would otherwise make the record disappear.
    workspace.animals.remy.days = workspace.animals.remy.days.filter((id) => id !== ids.validDayId);
    provideStore(workspace);

    render(<ValidationSummary />);

    const row = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(row).getByText(/not in day list/i)).toBeInTheDocument();
    // Still openable in its editor (the record exists), so it is recoverable, not lost.
    expect(within(row).getByRole('link')).toHaveAttribute('href', `#/day/${ids.validDayId}`);
    // …and re-linkable: an "Add to day list" repair restores it to the animal's index.
    expect(within(row).getByRole('button', { name: /add .* back to .* day list/i })).toBeInTheDocument();
  });

  it('Export Valid Only EXCLUDES a recovered-unlinked (orphan) day until it is re-linked', async () => {
    const user = userEvent.setup();
    const { workspace, ids } = makeSummaryWorkspace();
    // Make the incomplete day valid (an OK day) and orphan the valid day (keep the record, drop
    // it from the index). The orphan's chip is still 'valid', but policy excludes it from export.
    const fixedDay = workspace.days[ids.incompleteDayId];
    fixedDay.session = { ...fixedDay.session, session_id: 'remy_20230623' };
    delete workspace.animals.totoro;
    delete workspace.days[ids.errorDayId];
    workspace.animals.remy.days = [ids.incompleteDayId];
    provideStore(workspace);

    render(<ValidationSummary />);
    await user.click(screen.getByRole('button', { name: /export valid only/i }));
    await user.click(screen.getByRole('button', { name: /confirm export/i }));

    // Only the OK valid day downloads; the orphaned (recovered-unlinked) valid record is excluded.
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    expect(downloadYamlFile).toHaveBeenCalledWith('06232023_remy_metadata.yml', 'yaml-bytes');
  });

  it('re-links an orphaned day record into its animal index when the repair is clicked', async () => {
    const user = userEvent.setup();
    const { workspace, ids } = makeSummaryWorkspace();
    workspace.animals.remy.days = workspace.animals.remy.days.filter((id) => id !== ids.validDayId);
    const relinkDayReference = vi.fn();
    useStoreContext.mockReturnValue({
      model: { workspace },
      actions: { updateDay: vi.fn(), removeDayReference: vi.fn(), relinkDayReference },
      selectors: {},
      persistence: { enabled: false },
    });

    render(<ValidationSummary />);
    const row = screen.getByTestId(`day-row-${ids.validDayId}`);
    await user.click(within(row).getByRole('button', { name: /add .* back to .* day list/i }));
    expect(relinkDayReference).toHaveBeenCalledWith('remy', ids.validDayId);
  });

  it('Validate All does not write to a wrong-owner row (would corrupt another animal\'s day)', async () => {
    const user = userEvent.setup();
    const { workspace, ids } = makeSummaryWorkspace();
    // remy indexes a record that belongs to totoro.
    workspace.days[ids.validDayId].animalId = 'totoro';
    const updateDay = provideStore(workspace);

    render(<ValidationSummary />);
    await user.click(screen.getByRole('button', { name: /validate all/i }));

    // The wrong-owner day id must NOT be written (it belongs to totoro, not remy).
    const wroteWrongOwner = updateDay.mock.calls.some((call) => call[0] === ids.validDayId);
    expect(wroteWrongOwner).toBe(false);
  });

  it('flags an indexed wrong-owner record and offers an unlink repair (never exports it as this animal)', async () => {
    const user = userEvent.setup();
    const { workspace, ids } = makeSummaryWorkspace();
    // remy's index points at a record that belongs to totoro — exporting it as remy would corrupt
    // the YAML (wrong subject/probe). It must be flagged, not silently exported.
    workspace.days[ids.validDayId].animalId = 'totoro';
    const unlinkDayReference = vi.fn();
    useStoreContext.mockReturnValue({
      model: { workspace },
      actions: { updateDay: vi.fn(), removeDayReference: vi.fn(), relinkDayReference: vi.fn(), unlinkDayReference },
      selectors: {},
      persistence: { enabled: false },
    });

    render(<ValidationSummary />);
    const row = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(row).getByText(/belongs to totoro/i)).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: /remove .* from .* belongs to totoro/i }));
    expect(unlinkDayReference).toHaveBeenCalledWith('remy', ids.validDayId);
  });

  it('does not offer a dead-end "Open editor" for an orphan whose owning animal is gone', () => {
    // A day record whose animalId references no animal: the editor would dead-end.
    const { workspace, ids } = makeSummaryWorkspace();
    workspace.days[ids.validDayId].animalId = 'ghost';
    delete workspace.animals.remy; // the owner is gone
    workspace.days[ids.incompleteDayId] && delete workspace.days[ids.incompleteDayId];
    provideStore(workspace);

    render(<ValidationSummary />);
    const row = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(row).getByText(/no owning animal/i)).toBeInTheDocument();
    expect(within(row).queryByRole('link', { name: /open editor/i })).not.toBeInTheDocument();
  });

  it('Export Valid Only: cancelling the preflight downloads nothing', async () => {
    const user = userEvent.setup();
    const { workspace } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);
    await user.click(screen.getByRole('button', { name: /export valid only/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('region', { name: /batch export preflight/i })).not.toBeInTheDocument();
    expect(downloadYamlFile).not.toHaveBeenCalled();
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

  it('describes a wrong-owner row with a non-string (object) owner readably, not "[object Object]"', () => {
    // remy indexes a record whose animalId is a corrupt object. The note must read as a usable
    // explanation, not leak "[object Object]".
    const { workspace, ids } = makeSummaryWorkspace();
    delete workspace.days[ids.incompleteDayId];
    delete workspace.days[ids.errorDayId];
    workspace.animals.remy.days = [ids.validDayId];
    workspace.animals.totoro.days = [];
    workspace.days[ids.validDayId].animalId = { not: 'a string' };
    provideStore(workspace);

    render(<ValidationSummary />);
    const row = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(row).getByText(/belongs to another animal \(unreadable id\)/i)).toBeInTheDocument();
    expect(within(row).queryByText(/\[object Object\]/)).not.toBeInTheDocument();
  });

  it('Validate All does NOT launder a corrupt day.state — it skips the write and counts it', async () => {
    const user = userEvent.setup();
    // An otherwise-valid (exportable) day whose `state` is a corrupt non-record. Validate All must
    // not coerce it to {} and stamp `validated` (which would hide the corruption); it skips + counts.
    const { workspace, ids } = makeSummaryWorkspace();
    delete workspace.days[ids.incompleteDayId];
    delete workspace.days[ids.errorDayId];
    workspace.animals.remy.days = [ids.validDayId];
    workspace.animals.totoro.days = [];
    workspace.days[ids.validDayId].state = 'corrupt-state-string';
    const updateDay = provideStore(workspace);

    render(<ValidationSummary />);
    await user.click(screen.getByRole('button', { name: /validate all/i }));

    // The corrupt-state day's flag was NOT written (no laundering).
    expect(updateDay.mock.calls.some((call) => call[0] === ids.validDayId)).toBe(false);
    // It is reported as a failure, not silently counted as validated.
    expect(screen.getByRole('status')).toHaveTextContent(/1 failed/i);
  });

  it('renders an orphan row with a non-string (object) owner without crashing (no object as React child)', () => {
    // A corrupt import persists an unindexed record whose animalId is an object. The summary must
    // surface it as an orphan, not throw "objects are not valid as a React child".
    const { workspace, ids } = makeSummaryWorkspace();
    delete workspace.days[ids.incompleteDayId];
    delete workspace.days[ids.errorDayId];
    workspace.animals.remy.days = [];
    workspace.animals.totoro.days = [];
    workspace.days[ids.validDayId].animalId = { not: 'a string' };
    provideStore(workspace);

    expect(() => render(<ValidationSummary />)).not.toThrow();
    const row = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(row).getByText(/no owning animal/i)).toBeInTheDocument();
  });

  it('Validate All names skipped rows instead of a bare "Validated 0 days" when nothing is validatable', async () => {
    const user = userEvent.setup();
    // remy's only listed day is wrong-owner (belongs to totoro) — not a validatable recording day
    // for remy. totoro has no rows. So nothing is validatable, but a bare "Validated 0 days" would
    // misread as "nothing to do" when the truth is the row was deliberately skipped.
    const { workspace, ids } = makeSummaryWorkspace();
    delete workspace.days[ids.incompleteDayId];
    delete workspace.days[ids.errorDayId];
    workspace.animals.remy.days = [ids.validDayId];
    workspace.days[ids.validDayId].animalId = 'totoro';
    workspace.animals.totoro.days = [];
    provideStore(workspace);

    render(<ValidationSummary />);
    await user.click(screen.getByRole('button', { name: /validate all/i }));

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/validated 0 days/i);
    expect(status).toHaveTextContent(/1 day skipped/i);
  });

  describe('corrupt workspace shape during initial row construction', () => {
    it('a day whose mergeDayMetadata throws is flagged as an error row, not crashing the whole summary', () => {
      // One good animal/day plus a broken animal whose configurationHistory is
      // missing → mergeDayMetadata throws by design. The broken day must be
      // reported (an error chip), and the good day must still render: one corrupt
      // day must never blank the whole multi-day summary.
      const { workspace, ids } = makeSummaryWorkspace();

      // Break remy so resolveDayConfig (inside mergeDayMetadata) throws for its days.
      workspace.animals.remy.configurationHistory = [];
      // Keep only one remy day to assert it precisely.
      delete workspace.days[ids.incompleteDayId];
      workspace.animals.remy.days = [ids.validDayId];

      provideStore(workspace);

      // Renders without throwing — the broken day is contained, not fatal.
      expect(() => render(<ValidationSummary />)).not.toThrow();

      // The good (totoro) day still renders.
      expect(screen.getByTestId(`day-row-${ids.errorDayId}`)).toBeInTheDocument();

      // The broken remy day is present and visibly flagged as an error/unreadable
      // row — never silently dropped or shown as valid.
      const brokenRow = screen.getByTestId(`day-row-${ids.validDayId}`);
      expect(within(brokenRow).getByText(/error/i)).toBeInTheDocument();
    });

    it('a non-array animal.days does not crash the summary', () => {
      // Corrupt import: animal.days is an object, not an array. Iterating it must
      // not throw; the animal simply contributes no rows.
      const { workspace, ids } = makeSummaryWorkspace();
      workspace.animals.remy.days = {}; // corrupt shape
      provideStore(workspace);

      expect(() => render(<ValidationSummary />)).not.toThrow();

      // The other animal's day still renders.
      expect(screen.getByTestId(`day-row-${ids.errorDayId}`)).toBeInTheDocument();
    });

    it('surfaces every referenced day as an error row when the whole days map is MISSING', () => {
      // Phase 4: a missing top-level `days` map is corruption, not emptiness. Every animal
      // day reference resolves to no record and must surface as an explicit error row — never
      // laundered into the "No recording days" empty state, which would hide every day.
      const { workspace, ids } = makeSummaryWorkspace();
      delete workspace.days; // days map absent
      provideStore(workspace);

      expect(() => render(<ValidationSummary />)).not.toThrow();

      expect(screen.queryByText(/no recording days/i)).not.toBeInTheDocument();
      expect(screen.getByTestId(`day-row-${ids.validDayId}`)).toBeInTheDocument();
      expect(screen.getByTestId(`day-row-${ids.errorDayId}`)).toBeInTheDocument();
      // remy (2 days) + totoro (1 day) = 3 references, all surfaced as errors, none valid.
      expect(screen.getByTestId('summary-counts')).toHaveTextContent(/0 valid/i);
      expect(screen.getByTestId('summary-counts')).toHaveTextContent(/3 with errors/i);
    });

    it('surfaces every referenced day as an error row when the days map is a NON-RECORD', () => {
      // `days` persisted as a non-record (e.g. an array from a bad migration). Each reference
      // resolves to no record → explicit error row, not the laundered empty state.
      const { workspace, ids } = makeSummaryWorkspace();
      workspace.days = []; // non-record shape
      provideStore(workspace);

      expect(() => render(<ValidationSummary />)).not.toThrow();
      expect(screen.queryByText(/no recording days/i)).not.toBeInTheDocument();
      expect(screen.getByTestId(`day-row-${ids.errorDayId}`)).toBeInTheDocument();
      expect(screen.getByTestId('summary-counts')).toHaveTextContent(/3 with errors/i);
    });

    it('offers an executable "Remove day reference" repair on a missing-record row (no dead-end)', async () => {
      // A missing-record row must not dead-end on "Open editor" (#/day/<id> → Day not found).
      // It offers an executable repair that drops the dangling reference from the owning animal.
      const user = userEvent.setup();
      const { workspace } = makeSummaryWorkspace();
      delete workspace.days[`${'remy-2023-06-22'}`];
      delete workspace.days['remy-2023-06-23'];
      workspace.animals.remy.days = ['remy-2099-01-01'];
      workspace.animals.totoro.days = [];

      const removeDayReference = vi.fn();
      useStoreContext.mockReturnValue({
        model: { workspace },
        actions: { updateDay: vi.fn(), removeDayReference },
        selectors: {},
        persistence: { enabled: false },
      });

      render(<ValidationSummary />);
      const row = screen.getByTestId('day-row-remy-2099-01-01');
      await user.click(within(row).getByRole('button', { name: /remove .*day reference/i }));
      expect(removeDayReference).toHaveBeenCalledWith('remy', 'remy-2099-01-01');
    });

    it('repairs a dangling reference using the workspace MAP KEY even when animal.id is corrupt', async () => {
      // The summary tolerates a missing/corrupt animal.id; the repair must still target the
      // owning animal. buildRows carries the reliable map key, so removeDayReference is called
      // with the key (the real store handle), not a missing `animal.id` (which would no-op).
      const user = userEvent.setup();
      const { workspace } = makeSummaryWorkspace();
      delete workspace.days[`${'remy-2023-06-22'}`];
      delete workspace.days['remy-2023-06-23'];
      delete workspace.animals.remy.id; // corrupt: no own id
      workspace.animals.remy.days = ['remy-2099-01-01'];
      workspace.animals.totoro.days = [];

      const removeDayReference = vi.fn();
      useStoreContext.mockReturnValue({
        model: { workspace },
        actions: { updateDay: vi.fn(), removeDayReference },
        selectors: {},
        persistence: { enabled: false },
      });

      render(<ValidationSummary />);
      const row = screen.getByTestId('day-row-remy-2099-01-01');
      await user.click(within(row).getByRole('button', { name: /remove .*day reference/i }));
      // 'remy' is the workspace.animals MAP KEY (the store handle), not animal.id (deleted).
      expect(removeDayReference).toHaveBeenCalledWith('remy', 'remy-2099-01-01');
    });

    it('non-string animal ids do not crash the summary', () => {
      // Corrupt import: animal ids are missing (would be non-string). They are
      // used in `.localeCompare` while sorting animals and as a fallback label,
      // so a non-string must be tolerated without throwing. Both animals lose
      // their id so the throw is independent of sort argument order.
      const { workspace, ids } = makeSummaryWorkspace();
      delete workspace.animals.remy.id;
      delete workspace.animals.totoro.id;
      provideStore(workspace);

      expect(() => render(<ValidationSummary />)).not.toThrow();

      // The days still render despite the unsortable ids.
      expect(screen.getByTestId(`day-row-${ids.validDayId}`)).toBeInTheDocument();
      expect(screen.getByTestId(`day-row-${ids.errorDayId}`)).toBeInTheDocument();
    });

    it('non-string day dates do not crash the summary', () => {
      // Corrupt import: day `date` values are numbers. They are used in
      // `.localeCompare` while sorting days, so a non-string must be tolerated
      // without throwing. Both remy days are broken so the throw is independent
      // of sort argument order.
      const { workspace, ids } = makeSummaryWorkspace();
      workspace.days[ids.validDayId].date = 20230622;
      workspace.days[ids.incompleteDayId].date = 20230623;
      provideStore(workspace);

      expect(() => render(<ValidationSummary />)).not.toThrow();

      // The well-formed animal's day still renders.
      expect(screen.getByTestId(`day-row-${ids.errorDayId}`)).toBeInTheDocument();
    });

    it('a non-record day record (truthy but malformed) is surfaced as an EXPLICIT error row, never dropped or valid', () => {
      // Phase 4: a day id resolving to a truthy-but-non-record value (e.g. a leftover
      // string from a partial migration) must NOT be silently dropped — that would let the
      // accounting report only the surviving rows while a corrupt day hides. It is surfaced
      // as a distinct error row so validate/export counts stay honest.
      const { workspace, ids } = makeSummaryWorkspace();
      delete workspace.days[ids.incompleteDayId];
      workspace.animals.remy.days = [ids.validDayId];
      workspace.days[ids.validDayId] = 'corrupt-day-string';
      provideStore(workspace);

      expect(() => render(<ValidationSummary />)).not.toThrow();

      // The well-formed animal's day still renders.
      expect(screen.getByTestId(`day-row-${ids.errorDayId}`)).toBeInTheDocument();

      // The corrupt reference is now an explicit error row (not dropped), never valid.
      const corruptRow = screen.getByTestId(`day-row-${ids.validDayId}`);
      expect(within(corruptRow).getByText(/error/i)).toBeInTheDocument();
      // Two error rows now: totoro's error day + the corrupt reference. None valid.
      expect(screen.getByTestId('summary-counts')).toHaveTextContent(/0 valid/i);
      expect(screen.getByTestId('summary-counts')).toHaveTextContent(/2 with errors/i);
    });

    it('a day reference with NO matching record (missing day) is surfaced as an explicit error row', () => {
      // Phase 4: an animal references a day id that does not exist in workspace.days (a
      // dangling reference from a partial migration). It must be reported as an error row,
      // not dropped — otherwise the day silently disappears from the accounting.
      const { workspace, ids } = makeSummaryWorkspace();
      delete workspace.days[ids.validDayId];
      delete workspace.days[ids.incompleteDayId];
      workspace.animals.remy.days = ['remy-2099-01-01'];
      provideStore(workspace);

      expect(() => render(<ValidationSummary />)).not.toThrow();

      const missingRow = screen.getByTestId('day-row-remy-2099-01-01');
      expect(within(missingRow).getByText(/error/i)).toBeInTheDocument();
      // totoro's error day + the missing reference = 2 errors, 0 valid.
      expect(screen.getByTestId('summary-counts')).toHaveTextContent(/0 valid/i);
      expect(screen.getByTestId('summary-counts')).toHaveTextContent(/2 with errors/i);
    });
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
