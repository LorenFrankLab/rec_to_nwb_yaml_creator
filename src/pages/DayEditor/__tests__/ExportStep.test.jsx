import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportStep from '../ExportStep';
import * as yaml from '../../../io/yaml';
import * as shadow from '../../../domain/shadowExport';
import { overrideFlags, restoreFlags } from '../../../featureFlags';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { computeStepStatus } from '../../../domain/validation';
import { validate } from '../../../validation';
import * as validationModule from '../../../validation';
import { buildDayEditorViewModel } from '../../../viewModels/dayEditorViewModel';

// Phase 3-f: ExportStep renders its blocked repair list from `vm.issues` and its lifecycle status
// from `vm.export` (the DayEditorStepper threads both). This helper builds the view-model from the
// SAME workspace ExportStep merges internally, so the threaded slices match the component's own gate.
// (ExportStep keeps its independent download gate — defense in depth — so passing the slices does not
// change which days it blocks.)
const renderExport = (animal, day, extraProps = {}) => {
  const vm = buildDayEditorViewModel({ animals: { [animal.id]: animal }, days: { [day.id]: day } }, day.id);
  return render(<ExportStep animal={animal} day={day} issues={vm.issues} exportGate={vm.export} {...extraProps} />);
};

const UNSTABLE = {
  ok: false,
  yaml: 'line1\nA\n',
  stableYaml: 'line1\nB\n',
  diff: 'First difference at line 2:\n  encode A: "A"\n  encode B: "B"',
};

/**
 * A realistic workspace whose merged day carries an export-blocking schema error
 * (non-numeric electrode-group `targeted_x`). Routes to the Devices step.
 *
 * @returns {{ animal: object, day: object }}
 */
function buildExportErrorWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  animal.configurationHistory[0].devices.electrode_groups[0].targeted_x = 'not-a-number';
  return { animal, day };
}

/**
 * A realistic workspace whose merged day has NO schema/rule validation error, but
 * an electrode group with ALL its channels marked bad — a device-status failure
 * (computeDevicesStatus → 'error') that a flat validate(merged) pass does not
 * surface. This is the case where ExportStep's old narrow gate (validate only)
 * would have let the download through.
 *
 * @returns {{ animal: object, day: object }}
 */
function buildAllChannelsBadWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  // The merge resolves bad_channels from the DAY OVERRIDE ONLY (a snapshot base mark
  // is moved down into the day's override by the load-time migration). To mark every
  // channel of group 0's ntrode bad, set the day override — not the snapshot base,
  // which the merge no longer reads. Group 0 is ntrode_id 1 in the realistic map.
  const badByNtrode = {};
  animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map.forEach((n) => {
    if (n.electrode_group_id === 0) badByNtrode[n.ntrode_id] = [0, 1, 2, 3];
  });
  day.deviceOverrides = { bad_channels: badByNtrode };
  return { animal, day };
}

afterEach(() => {
  vi.restoreAllMocks();
  restoreFlags();
});

describe('ExportStep', () => {
  it('renders the resolved filename and downloads YAML when the shadow gate passes', async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    const { animal, day } = buildRealisticWorkspace();

    renderExport(animal, day);

    expect(screen.getByText(/06222023_remy_metadata\.yml/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /download/i }));

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy).toHaveBeenCalledWith('06222023_remy_metadata.yml', expect.any(String));
  });

  it('names the persisted lifecycle status (Validated) on an exportable, saved day', () => {
    const { animal, day } = buildRealisticWorkspace();
    day.state = { draft: false, validated: true, exported: false };
    renderExport(animal, day);
    // The Export step uses the SAME shared vocabulary as Animal Days / Day Validation, so a saved
    // day reads "Validated" here too (never a contradictory phrase).
    expect(screen.getByTestId('export-lifecycle-status')).toHaveTextContent('Validated');
  });

  it('reads a not-yet-saved exportable day as "Ready to export"', () => {
    const { animal, day } = buildRealisticWorkspace(); // realistic fixture day is state.draft
    renderExport(animal, day);
    expect(screen.getByTestId('export-lifecycle-status')).toHaveTextContent('Ready to export');
  });

  it('persists state.exported after a successful download (so the day then reads "Exported")', async () => {
    const user = userEvent.setup();
    vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    const updateDay = vi.fn();
    const { animal, day } = buildRealisticWorkspace();

    // Pass store actions (the DayEditor provides these via context; an isolated render passes them
    // as props) so the export can record the lifecycle transition.
    renderExport(animal, day, { actions: { updateDay } });

    await user.click(screen.getByRole('button', { name: /download/i }));

    // `state` is display-only (never in the YAML), so this does not affect byte-identity — it just
    // moves the day to the "Exported" lifecycle state.
    expect(updateDay).toHaveBeenCalledWith(day.id, {
      state: expect.objectContaining({ exported: true }),
    });
  });

  it('hides the YAML preview until the toggle is clicked', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();

    renderExport(animal, day);

    expect(screen.queryByText(/session_id: remy_20230622/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show preview/i }));

    expect(screen.getByText(/session_id: remy_20230622/)).toBeInTheDocument();
  });

  it('blocks the download and shows a diff when the shadow gate fails in strict mode', async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    vi.spyOn(shadow, 'checkShadowExport').mockReturnValue(UNSTABLE);
    const { animal, day } = buildRealisticWorkspace();

    renderExport(animal, day);
    await user.click(screen.getByRole('button', { name: /download/i }));

    expect(downloadSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/encoder-stability check failed/i)).toBeInTheDocument();
    expect(screen.getByText(/First difference at line 2/)).toBeInTheDocument();
  });

  it('announces a successful download', async () => {
    const user = userEvent.setup();
    vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    const { animal, day } = buildRealisticWorkspace();

    renderExport(animal, day);
    await user.click(screen.getByRole('button', { name: /download yaml/i }));

    expect(screen.getByText(/downloaded 06222023_remy_metadata\.yml/i)).toBeInTheDocument();
  });

  it('re-enables the download button after dismissing a blocking error', async () => {
    const user = userEvent.setup();
    vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    vi.spyOn(shadow, 'checkShadowExport').mockReturnValue(UNSTABLE);
    const { animal, day } = buildRealisticWorkspace();

    renderExport(animal, day);
    const downloadButton = screen.getByRole('button', { name: /download yaml/i });

    await user.click(downloadButton);
    expect(downloadButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /dismiss and try again/i }));
    expect(downloadButton).toBeEnabled();
  });

  it('blocks the download and surfaces the validation errors when the merged day has error-severity issues', async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    const { animal, day } = buildExportErrorWorkspace();

    renderExport(animal, day, { onNavigate: vi.fn() });

    // The blocking reason is visible before the user even clicks.
    expect(screen.getByText(/validation error/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /download yaml/i }));

    // Defense in depth: no file is produced for an error day.
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('humanizes raw AJV required-property jargon in the export-blocked issue list (display only)', () => {
    // S1 audit finding: the export-blocked state must not show raw "must have required
    // property 'X'" jargon. Force a required-field error and assert the blocked list shows a
    // friendly sentence — while validate() still emits the raw, parseable message.
    vi.spyOn(validationModule, 'validate').mockReturnValue([
      {
        severity: 'error',
        path: 'data_acq_device',
        code: 'required',
        message: "must have required property 'data_acq_device'",
      },
    ]);
    const { animal, day } = buildRealisticWorkspace();

    renderExport(animal, day, { onNavigate: vi.fn() });

    const blocked = screen.getByRole('alert');
    expect(within(blocked).getByText('A data acquisition device is required')).toBeInTheDocument();
    expect(within(blocked).queryByText(/must have required property/i)).not.toBeInTheDocument();
  });

  it('does not run the shadow-export check when validation already blocks the day', async () => {
    const user = userEvent.setup();
    const shadowSpy = vi.spyOn(shadow, 'checkShadowExport');
    const { animal, day } = buildExportErrorWorkspace();

    renderExport(animal, day, { onNavigate: vi.fn() });
    await user.click(screen.getByRole('button', { name: /download yaml/i }));

    expect(shadowSpy).not.toHaveBeenCalled();
  });

  it('blocks the download on a device-status failure (all channels bad) that flat validation misses', async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    const shadowSpy = vi.spyOn(shadow, 'checkShadowExport');
    const { animal, day } = buildAllChannelsBadWorkspace();

    // Sanity: this fixture has NO schema/rule validation error — validate(merged)
    // alone would not block — but computeStepStatus's devices status is 'error'
    // (all channels bad), so the authoritative export gate is closed.
    const merged = mergeDayMetadata(animal, day);
    expect(validate(merged).filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(computeStepStatus(day, merged).export).toBe('valid');

    renderExport(animal, day, { onNavigate: vi.fn() });

    const downloadButton = screen.getByRole('button', { name: /download yaml/i });
    // The button is disabled and a blocking reason is shown up front.
    expect(downloadButton).toBeDisabled();
    expect(screen.getByText(/before exporting/i)).toBeInTheDocument();

    await user.click(downloadButton);

    // Defense in depth: no file is produced and the shadow check never runs.
    expect(downloadSpy).not.toHaveBeenCalled();
    expect(shadowSpy).not.toHaveBeenCalled();
  });

  it('does not imply validation errors when export is blocked only by an incomplete prerequisite step', () => {
    // 0 error-severity validation issues, but the gate is closed by computeStepStatus
    // (all channels bad). The blocked reason must NOT claim "validation error(s)" exist; it
    // must point the user to the required setup shown below instead.
    const { animal, day } = buildAllChannelsBadWorkspace();

    renderExport(animal, day, { onNavigate: vi.fn() });

    const blocked = screen.getByRole('alert');
    expect(within(blocked).getByText(/complete the required setup shown below before exporting/i)).toBeInTheDocument();
    // It must not falsely imply validation errors exist when there are none.
    expect(within(blocked).queryByText(/validation error/i)).not.toBeInTheDocument();
  });

  it('keeps the "Resolve N validation errors" message when there ARE error-severity issues', () => {
    const { animal, day } = buildExportErrorWorkspace();

    renderExport(animal, day, { onNavigate: vi.fn() });

    const blocked = screen.getByRole('alert');
    expect(within(blocked).getByText(/resolve \d+ validation error/i)).toBeInTheDocument();
  });

  it('offers a repair action for a STEP-STATUS-only blocker (all channels bad) with no validate() error', async () => {
    // Boundary 3 / Medium-1: the gate is closed via computeStepStatus.devices === 'error'
    // (all channels bad), but validate(merged) has no error — so the OLD ExportStep showed
    // generic text with no button (a repair dead-end). It must route to the blocking step.
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const { animal, day } = buildAllChannelsBadWorkspace();

    renderExport(animal, day, { onNavigate });

    const repairButton = screen.getByRole('button', { name: /fix in devices/i });
    await user.click(repairButton);
    expect(onNavigate).toHaveBeenCalledWith('devices', undefined);
  });

  it('routes a devices-INCOMPLETE blocker (no electrode groups) to the Animal Editor, not Day Devices', async () => {
    // Missing maps / no electrode groups are ANIMAL-owned (geometry lives at the animal
    // level), so the Export blocker must route there, not generically to Day Devices.
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const { animal, day } = buildRealisticWorkspace();
    // Strip all electrode groups + channel maps → devices status 'incomplete'.
    animal.configurationHistory[0].devices.electrode_groups = [];
    animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map = [];

    renderExport(animal, day, { onNavigate });

    await user.click(screen.getByRole('button', { name: /fix in animal setup/i }));
    expect(onNavigate).toHaveBeenCalledWith('animal', undefined);
  });

  it('routes a devices-INCOMPLETE blocker (groups present, missing maps) to the Electrode Groups tab', async () => {
    // Electrode groups exist but a group has no channel map → devices 'incomplete'. Channel maps
    // are auto-generated from each group's device_type, so the repair deep-links to Electrode Groups
    // (with the electrode_groups field hint) — the owner where the missing map is regenerated.
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const { animal, day } = buildRealisticWorkspace();
    // Keep electrode groups; strip only the channel maps.
    animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map = [];

    renderExport(animal, day, { onNavigate });

    await user.click(screen.getByRole('button', { name: /fix in animal setup/i }));
    expect(onNavigate).toHaveBeenCalledWith('animal', 'electrode_groups');
  });

  it('tolerates a malformed-animal merge throw (corrupt configurationHistory) without crashing', () => {
    // mergeDayMetadata throws by design on a non-array configurationHistory; ExportStep
    // must render (blocked) and surface the repairable reason instead of crashing.
    const { animal, day } = buildRealisticWorkspace();
    animal.configurationHistory = 'corrupt';
    expect(() => renderExport(animal, day, { onNavigate: vi.fn() })).not.toThrow();
    expect(screen.getByText(/could not be assembled|missing or corrupt/i)).toBeInTheDocument();
  });

  it('surfaces an EXECUTABLE rebuild repair when configurationHistory is missing/empty (merge throws → merged {})', async () => {
    // The merge throws on an empty history, so ExportStep falls back to merged={}. The raw
    // animal gate must still surface the missing-history issue AND offer its executable
    // rebuild button (not just a dead-end blocked message).
    const user = userEvent.setup();
    const onRepair = vi.fn();
    const { animal, day } = buildRealisticWorkspace();
    animal.configurationHistory = [];
    renderExport(animal, day, { onNavigate: vi.fn(), onRepair });

    expect(screen.getByRole('button', { name: /download yaml/i })).toBeDisabled();
    expect(screen.getByText(/configuration history is missing or empty/i)).toBeInTheDocument();
    const rebuild = screen.getByRole('button', { name: /^rebuild device configuration history$/i });
    await user.click(rebuild);
    expect(onRepair).toHaveBeenCalledWith(
      expect.objectContaining({ repairCommand: { type: 'rebuildConfigurationHistory' } })
    );
  });

  it('blocks export AND surfaces a routable repair when animal.cameras is corrupt (raw-animal gate)', () => {
    const { animal, day } = buildRealisticWorkspace();
    animal.cameras = 'nope';
    renderExport(animal, day, { onNavigate: vi.fn() });
    // The download is blocked AND the raw-animal issue renders an executable repair (the
    // view-model classifies the commandable cameras corruption as an in-place reset, Phase 3-f) —
    // not a dead-end disabled button with no surfaced fix.
    expect(screen.getByRole('button', { name: /download yaml/i })).toBeDisabled();
    expect(screen.getByText(/cameras.*is corrupt|corrupt.*list/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset cameras/i })).toBeInTheDocument();
  });

  it('offers a repair action per error that routes to the editable owner with the field target', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const { animal, day } = buildExportErrorWorkspace();

    renderExport(animal, day, { onNavigate });

    // The targeted_x type error is device geometry — editable only in the Animal Editor —
    // so the repair routes to the 'animal' surface, not the Day-Editor Devices step.
    const repairButton = screen.getByRole('button', { name: /fix in animal setup/i });
    await user.click(repairButton);

    expect(onNavigate).toHaveBeenCalledWith('animal', expect.stringContaining('electrode_groups'));
  });

  it('shows a preflight summary derived from the merged day on a valid day', () => {
    const { animal, day } = buildRealisticWorkspace();

    renderExport(animal, day, { onNavigate: vi.fn() });

    const preflight = screen.getByRole('region', { name: /preflight/i });
    // Section labels present, derived from mergedDay (not duplicate component state).
    expect(within(preflight).getByText('Animal & day')).toBeInTheDocument();
    expect(within(preflight).getByText('Subject & session')).toBeInTheDocument();
    expect(within(preflight).getByText('Configuration version')).toBeInTheDocument();
    expect(within(preflight).getByText('Cameras / calibration')).toBeInTheDocument();
    expect(within(preflight).getByText('Probes & failed channels')).toBeInTheDocument();
    expect(within(preflight).getByText('Data acquisition')).toBeInTheDocument();
    expect(within(preflight).getByText('Tasks & videos')).toBeInTheDocument();
    expect(within(preflight).getByText('Optogenetics')).toBeInTheDocument();
    expect(within(preflight).getByText('Non-blocking warnings')).toBeInTheDocument();

    // Spot-check derived values: animal/day, 8 electrode groups, the camera-calibration row
    // (each day-used camera's name + meters_per_pixel, so a recalibration is visible at the
    // gate), opto state (no optogenetics — Task 10's day-protocol three-state, not a binary
    // "Off"), current (not historical) configuration.
    expect(within(preflight).getByText(/remy — 2023-06-22/i)).toBeInTheDocument();
    expect(within(preflight).getByText(/8 electrode groups/i)).toBeInTheDocument();
    expect(
      within(preflight).getByText(/overhead_camera \(0\.00085 m\/px\), side_camera \(0\.0009 m\/px\)/i)
    ).toBeInTheDocument();
    expect(within(preflight).getByText(/no optogenetics/i)).toBeInTheDocument();
    expect(within(preflight).getByText(/version 1 \(current\)/i)).toBeInTheDocument();
  });

  it('reports the resolved configuration version in preflight, not the day-pinned value', () => {
    const { animal, day } = buildRealisticWorkspace();
    // An unpinned day resolves to the latest snapshot (version 1). The preflight must
    // show the resolved version (via resolveDayConfig), not the day's own pin — which
    // here is absent and would otherwise render as "—".
    delete day.configurationVersion;

    renderExport(animal, day, { onNavigate: vi.fn() });

    const preflight = screen.getByRole('region', { name: /preflight/i });
    expect(within(preflight).getByText(/version 1\b/i)).toBeInTheDocument();
  });

  it('marks the preflight configuration version as historical when the day pins an older version', () => {
    const { animal, day } = buildRealisticWorkspace();
    // Add a newer snapshot; the day still pins v1, so it exports against a historical config.
    animal.configurationHistory.push({
      version: 2,
      date: '2023-07-01',
      description: 'Lowered tetrodes',
      devices: animal.configurationHistory[0].devices,
      appliedToDays: [],
    });

    renderExport(animal, day, { onNavigate: vi.fn() });

    const preflight = screen.getByRole('region', { name: /preflight/i });
    expect(within(preflight).getByText(/version 1 \(historical\)/i)).toBeInTheDocument();
  });

  it('BLOCKS export for an unpinned day in a multi-version animal (no preflight, repair offered)', () => {
    const { animal, day } = buildRealisticWorkspace();
    animal.configurationHistory.push({
      version: 2,
      date: '2023-07-01',
      description: 'Lowered tetrodes',
      devices: animal.configurationHistory[0].devices,
      appliedToDays: [],
    });
    delete day.configurationVersion; // unpinned, two versions → wrong-geometry risk → blocked

    renderExport(animal, day, { onNavigate: vi.fn() });

    // Export is blocked: no preflight, a blocking explanation, and a disabled download.
    expect(screen.queryByRole('region', { name: /preflight/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no pinned hardware configuration version/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download yaml/i })).toBeDisabled();
  });

  it('BLOCKS single-day export for a recovered-unlinked day (record not in the animal index)', () => {
    const { animal, day } = buildRealisticWorkspace();
    // The record exists, but the animal's index doesn't list it (recovered/unlinked).
    animal.days = [];

    renderExport(animal, day, { onNavigate: vi.fn() });

    expect(screen.queryByRole('region', { name: /preflight/i })).not.toBeInTheDocument();
    expect(screen.getByText(/not in .*day list/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download yaml/i })).toBeDisabled();
  });

  it('reports unresolved non-blocking warnings in the preflight', () => {
    const { animal, day } = buildRealisticWorkspace();
    // One warning-severity issue (no errors) — the day stays exportable but preflight must
    // surface the unresolved warning so it reads as a confidence check, not a pass/fail dump.
    vi.spyOn(validationModule, 'validate').mockReturnValue([
      { severity: 'warning', code: 'epoch_overlap', path: 'tasks[0].task_epochs', message: 'epochs overlap' },
    ]);

    renderExport(animal, day, { onNavigate: vi.fn() });

    const preflight = screen.getByRole('region', { name: /preflight/i });
    expect(within(preflight).getByText(/1 warning to review \(does not block export\)/i)).toBeInTheDocument();
  });

  it('blocks the download in handleDownload even if the disabled button state is bypassed', async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    const { animal, day } = buildExportErrorWorkspace();

    renderExport(animal, day, { onNavigate: vi.fn() });

    // Defeat the visual disabled guard so the click reaches handleDownload, proving
    // the in-handler validation guard (not just the disabled attribute) fails closed.
    const button = screen.getByRole('button', { name: /download yaml/i });
    button.removeAttribute('disabled');
    await user.click(button);

    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('does not show the preflight summary on an export-blocked day', () => {
    const { animal, day } = buildExportErrorWorkspace();

    renderExport(animal, day, { onNavigate: vi.fn() });

    expect(screen.queryByRole('region', { name: /preflight/i })).not.toBeInTheDocument();
  });

  it('overrides the gate and downloads with a warning when strict mode is off', async () => {
    const user = userEvent.setup();
    overrideFlags({ shadowExportStrict: false });
    const downloadSpy = vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    vi.spyOn(shadow, 'checkShadowExport').mockReturnValue(UNSTABLE);
    const { animal, day } = buildRealisticWorkspace();

    renderExport(animal, day);
    await user.click(screen.getByRole('button', { name: /download/i }));

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy).toHaveBeenCalledWith('06222023_remy_metadata.yml', 'line1\nA\n');
    expect(screen.getByText(/overridden/i)).toBeInTheDocument();
  });
});
