import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportStep from '../ExportStep';
import * as yaml from '../../../io/yaml';
import * as shadow from '../shadowExport';
import { overrideFlags, restoreFlags } from '../../../featureFlags';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

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

afterEach(() => {
  vi.restoreAllMocks();
  restoreFlags();
});

describe('ExportStep', () => {
  it('renders the resolved filename and downloads YAML when the shadow gate passes', async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    const { animal, day } = buildRealisticWorkspace();

    render(<ExportStep animal={animal} day={day} />);

    expect(screen.getByText(/06222023_remy_metadata\.yml/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /download/i }));

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy).toHaveBeenCalledWith('06222023_remy_metadata.yml', expect.any(String));
  });

  it('hides the YAML preview until the toggle is clicked', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();

    render(<ExportStep animal={animal} day={day} />);

    expect(screen.queryByText(/session_id: remy_20230622/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show preview/i }));

    expect(screen.getByText(/session_id: remy_20230622/)).toBeInTheDocument();
  });

  it('blocks the download and shows a diff when the shadow gate fails in strict mode', async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    vi.spyOn(shadow, 'checkShadowExport').mockReturnValue(UNSTABLE);
    const { animal, day } = buildRealisticWorkspace();

    render(<ExportStep animal={animal} day={day} />);
    await user.click(screen.getByRole('button', { name: /download/i }));

    expect(downloadSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/encoder-stability check failed/i)).toBeInTheDocument();
    expect(screen.getByText(/First difference at line 2/)).toBeInTheDocument();
  });

  it('announces a successful download', async () => {
    const user = userEvent.setup();
    vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    const { animal, day } = buildRealisticWorkspace();

    render(<ExportStep animal={animal} day={day} />);
    await user.click(screen.getByRole('button', { name: /download yaml/i }));

    expect(screen.getByText(/downloaded 06222023_remy_metadata\.yml/i)).toBeInTheDocument();
  });

  it('re-enables the download button after dismissing a blocking error', async () => {
    const user = userEvent.setup();
    vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    vi.spyOn(shadow, 'checkShadowExport').mockReturnValue(UNSTABLE);
    const { animal, day } = buildRealisticWorkspace();

    render(<ExportStep animal={animal} day={day} />);
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

    render(<ExportStep animal={animal} day={day} onNavigate={vi.fn()} />);

    // The blocking reason is visible before the user even clicks.
    expect(screen.getByText(/validation error/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /download yaml/i }));

    // Defense in depth: no file is produced for an error day.
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('does not run the shadow-export check when validation already blocks the day', async () => {
    const user = userEvent.setup();
    const shadowSpy = vi.spyOn(shadow, 'checkShadowExport');
    const { animal, day } = buildExportErrorWorkspace();

    render(<ExportStep animal={animal} day={day} onNavigate={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /download yaml/i }));

    expect(shadowSpy).not.toHaveBeenCalled();
  });

  it('offers a repair action per error that routes to the owning step with the field target', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const { animal, day } = buildExportErrorWorkspace();

    render(<ExportStep animal={animal} day={day} onNavigate={onNavigate} />);

    // The targeted_x type error routes to the Devices step.
    const repairButton = screen.getByRole('button', { name: /devices/i });
    await user.click(repairButton);

    expect(onNavigate).toHaveBeenCalledWith('devices', expect.stringContaining('electrode_groups'));
  });

  it('shows a preflight summary derived from the merged day on a valid day', () => {
    const { animal, day } = buildRealisticWorkspace();

    render(<ExportStep animal={animal} day={day} onNavigate={vi.fn()} />);

    const preflight = screen.getByRole('region', { name: /preflight/i });
    // Section labels present, derived from mergedDay (not duplicate component state).
    expect(within(preflight).getByText('Subject & session')).toBeInTheDocument();
    expect(within(preflight).getByText('Configuration version')).toBeInTheDocument();
    expect(within(preflight).getByText('Cameras')).toBeInTheDocument();
    expect(within(preflight).getByText('Probes & bad channels')).toBeInTheDocument();
    expect(within(preflight).getByText('Tasks & videos')).toBeInTheDocument();
    expect(within(preflight).getByText('Optogenetics')).toBeInTheDocument();

    // Spot-check derived values: 8 electrode groups (+ bad channels), 2 cameras, opto off.
    expect(within(preflight).getByText(/8 electrode groups/i)).toBeInTheDocument();
    expect(within(preflight).getByText(/2 cameras/i)).toBeInTheDocument();
    expect(within(preflight).getByText('Off')).toBeInTheDocument();
  });

  it('reports the resolved configuration version in preflight, not a stale day-pinned one', () => {
    const { animal, day } = buildRealisticWorkspace();
    // Day pins a version that no longer exists; resolveDayConfig falls back to the
    // animal's actual snapshot (version 1). The preflight must show what is encoded.
    day.configurationVersion = 99;

    render(<ExportStep animal={animal} day={day} onNavigate={vi.fn()} />);

    const preflight = screen.getByRole('region', { name: /preflight/i });
    expect(within(preflight).getByText(/version 1\b/i)).toBeInTheDocument();
    expect(within(preflight).queryByText(/version 99/i)).not.toBeInTheDocument();
  });

  it('blocks the download in handleDownload even if the disabled button state is bypassed', async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    const { animal, day } = buildExportErrorWorkspace();

    render(<ExportStep animal={animal} day={day} onNavigate={vi.fn()} />);

    // Defeat the visual disabled guard so the click reaches handleDownload, proving
    // the in-handler validation guard (not just the disabled attribute) fails closed.
    const button = screen.getByRole('button', { name: /download yaml/i });
    button.removeAttribute('disabled');
    await user.click(button);

    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('does not show the preflight summary on an export-blocked day', () => {
    const { animal, day } = buildExportErrorWorkspace();

    render(<ExportStep animal={animal} day={day} onNavigate={vi.fn()} />);

    expect(screen.queryByRole('region', { name: /preflight/i })).not.toBeInTheDocument();
  });

  it('overrides the gate and downloads with a warning when strict mode is off', async () => {
    const user = userEvent.setup();
    overrideFlags({ shadowExportStrict: false });
    const downloadSpy = vi.spyOn(yaml, 'downloadYamlFile').mockImplementation(() => {});
    vi.spyOn(shadow, 'checkShadowExport').mockReturnValue(UNSTABLE);
    const { animal, day } = buildRealisticWorkspace();

    render(<ExportStep animal={animal} day={day} />);
    await user.click(screen.getByRole('button', { name: /download/i }));

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy).toHaveBeenCalledWith('06222023_remy_metadata.yml', 'line1\nA\n');
    expect(screen.getByText(/overridden/i)).toBeInTheDocument();
  });
});
