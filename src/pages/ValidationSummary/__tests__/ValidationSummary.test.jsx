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
  it('lists all days across animals with lifecycle status chips derived from the real computeStepStatus', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);

    // One row per day (3), each chip derived from the real computeStepStatus.
    const validRow = screen.getByTestId(`day-row-${ids.validDayId}`);
    const errorRow = screen.getByTestId(`day-row-${ids.errorDayId}`);
    const incompleteRow = screen.getByTestId(`day-row-${ids.incompleteDayId}`);

    // The valid fixture day is live-valid but NOT persisted-validated (state.draft), so it reads
    // "Ready to export" — the shared lifecycle word for "passes now, not yet saved" — matching the
    // Day Validation surface instead of a bespoke "Valid".
    expect(within(validRow).getByText('Ready to export')).toBeInTheDocument();
    expect(within(errorRow).getByText('Error')).toBeInTheDocument();
    expect(within(incompleteRow).getByText('Incomplete')).toBeInTheDocument();
  });

  it('shows a persisted-validated day as "Validated" (distinct from merely live-valid "Ready to export")', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    // Persist the validation outcome onto the valid day (what "Validate All" writes).
    workspace.days[ids.validDayId].state = { draft: false, validated: true, exported: false };
    provideStore(workspace);

    render(<ValidationSummary />);

    const validRow = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(validRow).getByText('Validated')).toBeInTheDocument();
    // The persisted state is visually distinct from a merely live-valid (unsaved) day.
    expect(within(validRow).queryByText('Ready to export')).not.toBeInTheDocument();
  });

  it('shows an exported day as "Exported" (export history outranks validated)', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    workspace.days[ids.validDayId].state = { draft: false, validated: true, exported: true };
    provideStore(workspace);

    render(<ValidationSummary />);

    const validRow = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(validRow).getByText('Exported')).toBeInTheDocument();
    expect(within(validRow).queryByText('Validated')).not.toBeInTheDocument();
  });

  it('reads the LIVE state, not a stale saved flag: a day saved validated but now live-error reads "Error"', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    // The error day was previously saved as validated, but its session is now live-broken.
    workspace.days[ids.errorDayId].state = { draft: false, validated: true, exported: false };
    provideStore(workspace);

    render(<ValidationSummary />);

    const errorRow = screen.getByTestId(`day-row-${ids.errorDayId}`);
    expect(within(errorRow).getByText('Error')).toBeInTheDocument();
    // The stale "Validated" must NOT win over the live error.
    expect(within(errorRow).queryByText('Validated')).not.toBeInTheDocument();
  });

  it('shows batch-row scan fields (config version + opto state) on a readable row (Task 10)', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);

    // The valid row carries the scan detail so days are comparable before opening each editor:
    // the pinned configuration version and the day-protocol opto state (not a binary on/off). The
    // realistic fixture has no optogenetics, so the exact day-protocol state must read that way
    // (asserting the precise state, not just "some opto label", catches a mis-reported state).
    const validRow = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(validRow).getByText(/config v\d/i)).toBeInTheDocument();
    expect(within(validRow).getByText(/no optogenetics/i)).toBeInTheDocument();
  });

  it('shows each day-used camera calibration (name + meters_per_pixel) in the scan', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);

    // A re-calibrated camera (changed meters_per_pixel) must be visible during catch-up triage,
    // not hidden behind a bare camera count. The realistic fixture's first camera is
    // "overhead_camera" at 0.00085 m/px — its name AND value must appear in the scan cell.
    const validRow = screen.getByTestId(`day-row-${ids.validDayId}`);
    const scan = within(validRow).getByText(/config v\d/i);
    expect(scan).toHaveTextContent(/overhead_camera/);
    expect(scan).toHaveTextContent(/0\.00085/);
  });

  it('labels the config version with a latest/historical marker on the cross-animal batch table', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);

    // The realistic fixture pins the day to its only (latest) configuration version.
    const validRow = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(validRow).getByText(/config v1 \(latest\)/i)).toBeInTheDocument();
  });

  it('uses the SAME version label (with latest/historical marker) on the per-animal scan', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary animalKey="remy" />);

    // The per-animal Validation & Export tab must read the same unified label, not "config from <date>".
    const validRow = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(validRow).getByText(/config v1 \(latest\)/i)).toBeInTheDocument();
    expect(within(validRow).queryByText(/config from/i)).not.toBeInTheDocument();
  });

  it('marks a pinned historical configuration version as (historical) on both surfaces', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    // Add a newer configuration version and pin the valid day to the older (historical) one.
    const remy = workspace.animals.remy;
    remy.configurationHistory = [
      ...remy.configurationHistory,
      { ...structuredClone(remy.configurationHistory[0]), version: 2, date: '2023-07-01' },
    ];
    workspace.days[ids.validDayId].configurationVersion = 1;
    provideStore(workspace);

    render(<ValidationSummary animalKey="remy" />);

    const validRow = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(validRow).getByText(/config v1 \(historical\)/i)).toBeInTheDocument();
  });

  it('surfaces the session description in a batch row when the day has one', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);

    // The realistic fixture's valid day carries a session_description; it must be visible in the
    // row (previously the Session column bound session_id only and the description was hidden).
    const validRow = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(
      within(validRow).getByText(/Day 45 of chronic recording, W-track alternation/i)
    ).toBeInTheDocument();
  });

  it('does not render a whitespace-only session description (shows the session id, no stray blank)', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    provideStore(workspace);

    render(<ValidationSummary />);

    // The error day has a whitespace-only session_description ('   '); it must NOT be surfaced as a
    // description line. The session id still shows.
    const errorRow = screen.getByTestId(`day-row-${ids.errorDayId}`);
    expect(
      within(errorRow).queryByTestId(`session-description-${ids.errorDayId}`)
    ).not.toBeInTheDocument();
    expect(within(errorRow).getByText('remy_20230622')).toBeInTheDocument();
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

  it('Export Valid Only: drops a day that became WRONG-OWNER after the preflight (no stale export of the wrong subject)', async () => {
    const user = userEvent.setup();
    const { workspace, ids } = makeSummaryWorkspace();
    delete workspace.animals.totoro;
    delete workspace.days[ids.incompleteDayId];
    delete workspace.days[ids.errorDayId];
    workspace.animals.remy.days = [ids.validDayId];
    provideStore(workspace);

    render(<ValidationSummary />);
    // Open the preflight while the day is a valid ok recording day...
    await user.click(screen.getByRole('button', { name: /export valid only/i }));
    // ...then the record drifts to a different owner before the user confirms (import/corruption).
    // runExport re-derives recovery status from the LIVE workspace, so this must NOT export as remy.
    workspace.days[ids.validDayId].animalId = 'someone-else';
    await user.click(screen.getByRole('button', { name: /confirm export/i }));

    expect(downloadYamlFile).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/since the preflight/i);
    expect(alert).toHaveTextContent(ids.validDayId);
  });

  it('Export Valid Only: drops a day whose record was DELETED after the preflight', async () => {
    const user = userEvent.setup();
    const { workspace, ids } = makeSummaryWorkspace();
    delete workspace.animals.totoro;
    delete workspace.days[ids.incompleteDayId];
    delete workspace.days[ids.errorDayId];
    workspace.animals.remy.days = [ids.validDayId];
    provideStore(workspace);

    render(<ValidationSummary />);
    await user.click(screen.getByRole('button', { name: /export valid only/i }));
    delete workspace.days[ids.validDayId]; // gone between preflight and confirm
    await user.click(screen.getByRole('button', { name: /confirm export/i }));

    expect(downloadYamlFile).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/no longer present since the preflight/i);
  });

  it('Export Valid Only: a day that becomes UNREADABLE after the preflight is reported as "could not be re-validated", not "no longer valid"', async () => {
    const user = userEvent.setup();
    const { workspace, ids } = makeSummaryWorkspace();
    delete workspace.animals.totoro;
    delete workspace.days[ids.incompleteDayId];
    delete workspace.days[ids.errorDayId];
    workspace.animals.remy.days = [ids.validDayId];
    provideStore(workspace);

    render(<ValidationSummary />);
    await user.click(screen.getByRole('button', { name: /export valid only/i }));
    // Corrupt the animal's configuration so the re-validation MERGE throws (≠ "no longer valid").
    workspace.animals.remy.configurationHistory = 'corrupt';
    await user.click(screen.getByRole('button', { name: /confirm export/i }));

    expect(downloadYamlFile).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/could not be re-validated since the preflight/i);
  });

  it('Export Valid Only: no valid days short-circuits with a helpful message and no downloads', async () => {
    const user = userEvent.setup();
    // 0 valid with only INCOMPLETE days (no errors): the button STAYS enabled and a click yields the
    // helpful guidance. Scope to remy and drop its valid day so only the incomplete day remains —
    // keeping the global error day (totoro's) out would otherwise DISABLE the button.
    const { workspace, ids } = makeSummaryWorkspace();
    delete workspace.days[ids.validDayId];
    workspace.animals.remy.days = [ids.incompleteDayId];
    provideStore(workspace);

    render(<ValidationSummary animalKey="remy" />);

    const button = screen.getByRole('button', { name: /export valid only/i });
    expect(button).toBeEnabled();
    await user.click(button);

    expect(checkShadowExport).not.toHaveBeenCalled();
    expect(downloadYamlFile).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/no days are ready to export/i);
  });

  it('Export Valid Only is DISABLED with an accessible reason when 0 days are valid and some have errors', () => {
    // Keep only the error day (drop valid + incomplete) → counts.valid === 0, counts.error > 0.
    const { workspace, ids } = makeSummaryWorkspace();
    delete workspace.days[ids.validDayId];
    delete workspace.days[ids.incompleteDayId];
    workspace.animals.remy.days = [ids.errorDayId];
    provideStore(workspace);

    render(<ValidationSummary />);

    const button = screen.getByRole('button', { name: /export valid only/i });
    expect(button).toBeDisabled();
    // The disabled reason is programmatically associated (not just a hover title).
    const reasonId = button.getAttribute('aria-describedby');
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId)).toHaveTextContent(/no valid days to export — fix errors first/i);
  });

  it('Export Valid Only stays ENABLED when 0 valid but only INCOMPLETE days (no errors)', () => {
    // Scope to remy and keep only its incomplete day: 0 valid, 0 error → not the disable case.
    const { workspace, ids } = makeSummaryWorkspace();
    delete workspace.days[ids.validDayId];
    workspace.animals.remy.days = [ids.incompleteDayId];
    provideStore(workspace);

    render(<ValidationSummary animalKey="remy" />);

    // No errors block here — the button stays enabled (a click yields the "complete fields" guidance).
    expect(screen.getByRole('button', { name: /export valid only/i })).toBeEnabled();
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

  it('marks each downloaded day as exported (state.exported) after a batch export', async () => {
    const user = userEvent.setup();
    const { workspace, ids } = makeSummaryWorkspace();
    const updateDay = provideStore(workspace);

    render(<ValidationSummary />);
    await user.click(screen.getByRole('button', { name: /export valid only/i }));
    await user.click(screen.getByRole('button', { name: /confirm export/i }));

    // Only the valid day downloads; it is then recorded as exported so it reads "Exported"
    // afterwards. `state` is display-only (never in the YAML), so byte-identity is unaffected.
    expect(updateDay).toHaveBeenCalledWith(ids.validDayId, {
      state: expect.objectContaining({ exported: true }),
    });
  });

  it('shows "Re-link to export" (not "Ready to export") on a valid recovered-unlinked row', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    // Keep the (valid) record but drop it from its animal's index → recovered-unlinked.
    workspace.animals.remy.days = workspace.animals.remy.days.filter((id) => id !== ids.validDayId);
    provideStore(workspace);

    render(<ValidationSummary />);

    const row = screen.getByTestId(`day-row-${ids.validDayId}`);
    // The day is valid metadata but not exportable until re-linked (batch export filters it out),
    // so its chip must NOT claim export-readiness — it shows the actionable linkage blocker.
    expect(within(row).getByText('Re-link to export')).toBeInTheDocument();
    expect(within(row).queryByText('Ready to export')).not.toBeInTheDocument();
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

    // The chip tolerates the malformed `state`: a live-valid day with a corrupt (non-record) state
    // reads "Ready to export" (treated as not-persisted), never crashing or blanking the row.
    const validRow = screen.getByTestId(`day-row-${ids.validDayId}`);
    expect(within(validRow).getByText('Ready to export')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /validate all/i }));

    // The corrupt-state day's flag was NOT written (no laundering).
    expect(updateDay.mock.calls.some((call) => call[0] === ids.validDayId)).toBe(false);
    // It is reported as a failure, not silently counted as validated.
    expect(screen.getByRole('status')).toHaveTextContent(/1 failed/i);
    // The failure is surfaced in the UI (not console-only): the affected day + its repair path.
    const report = screen.getByText(/could not be validated/i).closest('[role="alert"]');
    expect(report).toHaveTextContent(ids.validDayId);
    expect(report).toHaveTextContent(/saved state is corrupt/i);
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
