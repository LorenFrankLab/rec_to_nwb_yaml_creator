import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportPreview from '../ExportPreview';
import { encodeYaml, downloadYamlFile } from '../../../io/yaml';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import * as shadowExport from '../../../domain/shadowExport';
import { overrideFlags, restoreFlags } from '../../../featureFlags';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { buildDayEditorViewModel } from '../../../viewModels/dayEditorViewModel';

// The download goes through the shared `exportDayFile` core, so mock the download side-effect at the
// module boundary (the proven bulkExport pattern); encodeYaml / formatDeterministicFilename stay REAL.
vi.mock('../../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadYamlFile: vi.fn() };
});

/**
 * Render the export-preview surface the way the Day Editor frame mounts it: the day bundle plus the
 * view-model's authoritative export gate (`vm.export`) and classified issues (`vm.issues`), and the
 * single-animal workspace the batch reads.
 *
 * @param {object} animal - The owning animal record.
 * @param {object} day - The recording day record.
 * @param {object} [extraProps] - Props to override (e.g. `actions`, `onNavigate`, `onRepair`).
 * @returns {import('@testing-library/react').RenderResult}
 */
function renderPreview(animal, day, extraProps = {}) {
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
      onRepair={vi.fn()}
      {...extraProps}
    />
  );
}

/** A realistic day with an export-blocking schema error (non-numeric electrode-group `targeted_x`). */
function buildExportErrorWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  animal.configurationHistory[0].devices.electrode_groups[0].targeted_x = 'not-a-number';
  return { animal, day };
}

/** A realistic day with NO schema error but every channel of a group marked bad (devices → 'error'). */
function buildAllChannelsBadWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  const badByNtrode = {};
  animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map.forEach((n) => {
    if (n.electrode_group_id === 0) badByNtrode[n.ntrode_id] = [0, 1, 2, 3];
  });
  day.deviceOverrides = { bad_channels: badByNtrode };
  return { animal, day };
}

/**
 * Assert `first` precedes `second` in document order (reading order on the rendered page).
 *
 * @param {Element} first - The element expected to come first.
 * @param {Element} second - The element expected to follow it.
 */
function expectInDocumentOrder(first, second) {
  // eslint-disable-next-line no-bitwise
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

/** Stub navigator.clipboard.writeText (a getter-only prop in jsdom), returning the spy for assertions. */
function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  restoreFlags();
});

describe('ExportPreview — readiness gate', () => {
  it('blocks emitted bytes while a displayed field edit is still pending acceptance', () => {
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day, { hasPendingDrafts: true });

    expect(screen.getByText(/edit is still unsaved/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Download YAML$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Copy YAML$/i })).toBeDisabled();
  });

  it('is quiet ("Ready to export") with Download AND Copy ENABLED on a clean day', () => {
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day);

    expect(screen.getByText(/ready to export/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Download YAML$/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Copy YAML$/i })).toBeEnabled();
  });

  it('says how many warnings are still to review beside "Ready to export"', () => {
    const { animal, day } = buildRealisticWorkspace();
    // Two real, non-blocking warnings: statescript logs whose description omits the keyword
    // Spyglass needs to create StateScriptFile rows. Neither blocks the gate.
    day.associated_files.push(
      { name: 'statescript_epoch2', description: 'Log for epoch 2', path: '/data/remy/20230622/e2.stateScriptLog', task_epochs: 2 },
      { name: 'statescript_epoch4', description: 'Log for epoch 4', path: '/data/remy/20230622/e4.stateScriptLog', task_epochs: 4 }
    );
    renderPreview(animal, day);

    const ready = screen.getByRole('status');
    expect(ready).toHaveTextContent(/Ready to export\s*·\s*2 warnings to review/i);
    expect(screen.getByRole('button', { name: /^Download YAML$/i })).toBeEnabled();
  });

  it('the scientific review reports the SAME warnings the gate counts', () => {
    // The readiness line and the review sit on one screen: a review that says "None" while the gate
    // asks for two warnings to be reviewed is a false reassurance at the download gate.
    const { animal, day } = buildRealisticWorkspace();
    day.associated_files.push(
      { name: 'statescript_epoch2', description: 'Log for epoch 2', path: '/data/remy/20230622/e2.stateScriptLog', task_epochs: 2 },
      { name: 'statescript_epoch4', description: 'Log for epoch 4', path: '/data/remy/20230622/e4.stateScriptLog', task_epochs: 4 }
    );
    renderPreview(animal, day);

    expect(screen.getByRole('status')).toHaveTextContent(/Ready to export\s*·\s*2 warnings to review/i);
    const review = screen.getByRole('group', { name: /effective setup for this day/i });
    expect(within(review).getByText(/^Validation warnings$/i).parentElement).toHaveTextContent(
      /2 warnings to review \(does not block export\)/i
    );
  });

  it('the scientific review says "None" only when the gate counts no warnings', () => {
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day);

    const review = screen.getByRole('group', { name: /effective setup for this day/i });
    expect(within(review).getByText(/^Validation warnings$/i).parentElement).toHaveTextContent(/None/);
  });

  it('keeps optional file reminders visible without blocking a valid day', () => {
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day);

    const ready = screen.getByRole('status');
    expect(ready).toHaveTextContent(/Ready to export/i);
    expect(ready).toHaveTextContent(/optional statescripts to review/i);
    expect(screen.getByRole('button', { name: /^Download YAML$/i })).toBeEnabled();
    expect(screen.getByRole('group', { name: /Optional file reminders/i })).toHaveTextContent(/Optional for export/);
  });

  it('shows what the file will say — weight, team, calibration, each task\'s room — above Download', () => {
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day);

    const review = screen.getByRole('group', { name: /effective setup for this day/i });
    // The values a plausible-but-wrong day gets caught by: the weight THIS day measured, who ran it,
    // the calibration each camera was on, and the room each task ran in (per-day overrides included).
    expect(within(review).getByText('485 g — Guidera, Jennifer; Comrie, Alison')).toBeInTheDocument();
    expect(within(review).getByText(/overhead_camera \(0\.00085 m\/px\)/)).toBeInTheDocument();
    expect(within(review).getByText(/w_alternation \(2\) — elevated W-track \(180cm arms\)/)).toBeInTheDocument();
    expect(within(review).getByText(/sleep \(1\) — home cage/)).toBeInTheDocument();
    expect(screen.getByText(/check these values before downloading/i)).toBeInTheDocument();

    // Read the values, THEN download: the review sits between the readiness line and the actions.
    expectInDocumentOrder(screen.getByRole('status'), review);
    expectInDocumentOrder(review, screen.getByRole('button', { name: /^Download YAML$/i }));
  });

  it('keeps the repair list first on a blocked day, with the review below it', () => {
    const { animal, day } = buildExportErrorWorkspace();
    renderPreview(animal, day);

    const blocked = document.querySelector('[class*=blocked], [class*=incomplete]');
    const review = screen.getByRole('group', { name: /effective setup for this day/i });
    expectInDocumentOrder(blocked, review);
    expectInDocumentOrder(review, screen.getByRole('button', { name: /^Download YAML$/i }));
  });

  it('disables BOTH Download AND Copy on a blocking day (Copy is not a gate bypass)', () => {
    const { animal, day } = buildExportErrorWorkspace();
    renderPreview(animal, day);

    // The blocked region (scoped past the readiness phrasing) names the blocking reason.
    const blocked = document.querySelector('[class*=blocked], [class*=incomplete]');
    expect(within(blocked).getByText(/Complete these entries|resolve \d+ validation error/i)).toBeInTheDocument();
    // BOTH actions produce the YAML, so BOTH are gated.
    expect(screen.getByRole('button', { name: /^Download YAML$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Copy YAML$/i })).toBeDisabled();
  });

  it('offers a field-linked "Fix in …" repair action in the blocked region', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const { animal, day } = buildExportErrorWorkspace();
    renderPreview(animal, day, { onNavigate });

    // targeted_x is animal-owned device geometry → routes to the Animal Editor.
    const fix = screen.getByRole('button', { name: /fix in animal setup/i });
    await user.click(fix);
    expect(onNavigate).toHaveBeenCalledWith('animal', expect.stringContaining('electrode_groups'));
  });

  it('shows the "complete the required setup" reason for an incomplete-step blocker (all channels bad)', () => {
    const { animal, day } = buildAllChannelsBadWorkspace();
    renderPreview(animal, day);

    const blocked = document.querySelector('[class*=blocked], [class*=incomplete]');
    expect(within(blocked).getByText(/complete the required setup/i)).toBeInTheDocument();
    expect(within(blocked).queryByText(/validation error/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Download YAML$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Copy YAML$/i })).toBeDisabled();
  });

  it('surfaces the executable Rebuild repair when configurationHistory is missing (merge fails)', async () => {
    const user = userEvent.setup();
    const onRepair = vi.fn();
    const { animal, day } = buildRealisticWorkspace();
    animal.configurationHistory = [];
    renderPreview(animal, day, { onRepair });

    expect(screen.getByRole('button', { name: /^Download YAML$/i })).toBeDisabled();
    const rebuild = screen.getByRole('button', { name: /^rebuild device configuration history$/i });
    await user.click(rebuild);
    expect(onRepair).toHaveBeenCalledWith(
      expect.objectContaining({ repairCommand: { type: 'rebuildConfigurationHistory' } })
    );
  });
});

describe('ExportPreview — download & copy', () => {
  it('downloads the deterministic file and toasts success when the gate is open', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day, { actions: { updateDay: vi.fn() } });

    await user.click(screen.getByRole('button', { name: /^Download YAML$/i }));

    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    expect(downloadYamlFile).toHaveBeenCalledWith('20230622_remy_metadata.yml', expect.any(String));
    expect(await screen.findByText(/downloaded 20230622_remy_metadata\.yml/i)).toBeInTheDocument();
  });

  it('marks the day exported after a successful download (display-only lifecycle, never in the YAML)', async () => {
    const user = userEvent.setup();
    const updateDay = vi.fn();
    const { animal, day } = buildRealisticWorkspace();
    day.state = { ...day.state, deferredEpochs: [99] };
    renderPreview(animal, day, { actions: { updateDay } });

    await user.click(screen.getByRole('button', { name: /^Download YAML$/i }));

    expect(updateDay).toHaveBeenCalledWith(day.id, {
      // The download receipt (filename + hash) travels with the lifecycle flag (finding F6).
      exportReceipt: expect.objectContaining({ filename: '20230622_remy_metadata.yml', contentHash: expect.any(String) }),
      state: expect.objectContaining({ exported: true, deferredEpochs: [] }),
    });
  });

  it('copies the exported YAML to the clipboard and toasts success', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    const { animal, day } = buildRealisticWorkspace();
    // The copied bytes are the SAME bytes the preview shows and the download writes.
    const expectedYaml = encodeYaml(mergeDayMetadata(animal, day));
    renderPreview(animal, day);

    await user.click(screen.getByRole('button', { name: /^Copy YAML$/i }));

    expect(writeText).toHaveBeenCalledWith(expectedYaml);
    expect(await screen.findByText(/yaml copied/i)).toBeInTheDocument();
  });

  it('does not download a blocked day even when the disabled guard is bypassed (fail closed)', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildExportErrorWorkspace();
    renderPreview(animal, day);

    const button = screen.getByRole('button', { name: /^Download YAML$/i });
    button.removeAttribute('disabled');
    await user.click(button);

    expect(downloadYamlFile).not.toHaveBeenCalled();
  });
});

describe('ExportPreview — encoder-stability (parity) gate', () => {
  const UNSTABLE = {
    ok: false,
    yaml: 'shipped\n',
    stableYaml: 'other\n',
    diff: 'First difference at line 1:\n  encode A: "shipped"\n  encode B: "other"',
  };

  it('blocks Copy on a strict-mode encoder-stability failure (Copy is not a parity bypass)', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    // strict mode is the default; the day passes the readiness gate, so the ONLY gate left is parity.
    vi.spyOn(shadowExport, 'checkShadowExport').mockReturnValue(UNSTABLE);
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day);

    await user.click(screen.getByRole('button', { name: /^Copy YAML$/i }));

    // Copy did NOT reach the clipboard — the same parity gate Download enforces blocks it too.
    expect(writeText).not.toHaveBeenCalled();
    expect(await screen.findByText(/encoder-stability check failed/i)).toBeInTheDocument();
  });

  it('surfaces a strict-off parity override loudly on Download (never a silent success)', async () => {
    const user = userEvent.setup();
    overrideFlags({ shadowExportStrict: false });
    vi.spyOn(shadowExport, 'checkShadowExport').mockReturnValue(UNSTABLE);
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day, { actions: { updateDay: vi.fn() } });

    await user.click(screen.getByRole('button', { name: /^Download YAML$/i }));

    // The bytes DID ship (override), but the mismatch is surfaced loudly — not swallowed into success.
    expect(downloadYamlFile).toHaveBeenCalledWith('20230622_remy_metadata.yml', 'shipped\n');
    const notice = await screen.findByText(/encoder-stability/i);
    expect(notice).toBeInTheDocument();
    expect(screen.getByText(/strict mode off/i)).toBeInTheDocument();
  });

  it('copies the parity-checked bytes (same bytes Download ships), not the raw memoized preview', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    overrideFlags({ shadowExportStrict: false });
    vi.spyOn(shadowExport, 'checkShadowExport').mockReturnValue(UNSTABLE);
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day);

    await user.click(screen.getByRole('button', { name: /^Copy YAML$/i }));

    // Strict off → the override copies the SAME canonical bytes Download would ship, with a loud notice.
    expect(writeText).toHaveBeenCalledWith('shipped\n');
    expect(await screen.findByText(/encoder-stability/i)).toBeInTheDocument();
  });
});

describe('ExportPreview — bad-channel monotonicity gate', () => {
  /**
   * A two-day, same-config animal where day 2 silently un-fails channel 2 (a monotonicity regression).
   *
   * @returns {{ animal: object, day1: object, day2: object, animalDays: object[] }}
   */
  function buildRegressingTwoDayAnimal() {
    const { animal, day: day1 } = buildRealisticWorkspace();
    day1.deviceOverrides = { bad_channels: { 1: [2] } };
    const day2 = structuredClone(day1);
    day2.id = 'remy-2023-06-23';
    day2.date = '2023-06-23';
    day2.experimentDate = '06232023';
    day2.deviceOverrides = { bad_channels: { 1: [] } }; // silently un-fails channel 2 → blocked
    animal.days = [day1.id, day2.id];
    return { animal, day1, day2, animalDays: [day1, day2] };
  }

  it('BLOCKS both actions for a day that silently un-fails an earlier same-config bad channel', () => {
    const { animal, day1, day2, animalDays } = buildRegressingTwoDayAnimal();
    const workspace = { animals: { [animal.id]: animal }, days: { [day1.id]: day1, [day2.id]: day2 } };
    const vm = buildDayEditorViewModel(workspace, day2.id);
    render(
      <ExportPreview
        animal={animal}
        day={day2}
        animalKey={animal.id}
        animalDays={animalDays}
        workspace={workspace}
        issues={vm.issues}
        exportGate={vm.export}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText(/marked bad on an earlier recording day/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Download YAML$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Copy YAML$/i })).toBeDisabled();
  });

  it('ENABLES export once the bad-channel removal is acknowledged', () => {
    const { animal, day2, animalDays } = buildRegressingTwoDayAnimal();
    day2.state = { ...day2.state, badChannelRemovalAcks: { 1: [2] } };
    const workspace = { animals: { [animal.id]: animal }, days: { [day2.id]: day2 } };
    const vm = buildDayEditorViewModel(workspace, day2.id);
    render(
      <ExportPreview
        animal={animal}
        day={day2}
        animalKey={animal.id}
        animalDays={animalDays}
        workspace={workspace}
        issues={vm.issues}
        exportGate={vm.export}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /^Download YAML$/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Copy YAML$/i })).toBeEnabled();
  });
});
