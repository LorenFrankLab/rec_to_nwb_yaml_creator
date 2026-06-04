import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
