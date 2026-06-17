import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportPreview from '../ExportPreview';
import { encodeYaml, downloadYamlFile } from '../../../io/yaml';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { restoreFlags } from '../../../featureFlags';
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
  it('is quiet ("Ready to export") with Download AND Copy ENABLED on a clean day', () => {
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day);

    expect(screen.getByText(/ready to export/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeEnabled();
  });

  it('disables BOTH Download AND Copy on a blocking day (Copy is not a gate bypass)', () => {
    const { animal, day } = buildExportErrorWorkspace();
    renderPreview(animal, day);

    // The blocked region (scoped past the readiness phrasing) names the blocking reason.
    const blocked = screen.getByRole('alert');
    expect(within(blocked).getByText(/resolve \d+ validation error/i)).toBeInTheDocument();
    // BOTH actions produce the YAML, so BOTH are gated.
    expect(screen.getByRole('button', { name: /download/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeDisabled();
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

    const blocked = screen.getByRole('alert');
    expect(within(blocked).getByText(/complete the required setup/i)).toBeInTheDocument();
    expect(within(blocked).queryByText(/validation error/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeDisabled();
  });

  it('surfaces the executable Rebuild repair when configurationHistory is missing (merge fails)', async () => {
    const user = userEvent.setup();
    const onRepair = vi.fn();
    const { animal, day } = buildRealisticWorkspace();
    animal.configurationHistory = [];
    renderPreview(animal, day, { onRepair });

    expect(screen.getByRole('button', { name: /download/i })).toBeDisabled();
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

    await user.click(screen.getByRole('button', { name: /download/i }));

    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    expect(downloadYamlFile).toHaveBeenCalledWith('06222023_remy_metadata.yml', expect.any(String));
    expect(await screen.findByText(/downloaded 06222023_remy_metadata\.yml/i)).toBeInTheDocument();
  });

  it('marks the day exported after a successful download (display-only lifecycle, never in the YAML)', async () => {
    const user = userEvent.setup();
    const updateDay = vi.fn();
    const { animal, day } = buildRealisticWorkspace();
    renderPreview(animal, day, { actions: { updateDay } });

    await user.click(screen.getByRole('button', { name: /download/i }));

    expect(updateDay).toHaveBeenCalledWith(day.id, { state: expect.objectContaining({ exported: true }) });
  });

  it('copies the exported YAML to the clipboard and toasts success', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    const { animal, day } = buildRealisticWorkspace();
    // The copied bytes are the SAME bytes the preview shows and the download writes.
    const expectedYaml = encodeYaml(mergeDayMetadata(animal, day));
    renderPreview(animal, day);

    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    expect(writeText).toHaveBeenCalledWith(expectedYaml);
    expect(await screen.findByText(/yaml copied/i)).toBeInTheDocument();
  });

  it('does not download a blocked day even when the disabled guard is bypassed (fail closed)', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildExportErrorWorkspace();
    renderPreview(animal, day);

    const button = screen.getByRole('button', { name: /download/i });
    button.removeAttribute('disabled');
    await user.click(button);

    expect(downloadYamlFile).not.toHaveBeenCalled();
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
    expect(screen.getByRole('button', { name: /download/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeDisabled();
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

    expect(screen.getByRole('button', { name: /download/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeEnabled();
  });
});
