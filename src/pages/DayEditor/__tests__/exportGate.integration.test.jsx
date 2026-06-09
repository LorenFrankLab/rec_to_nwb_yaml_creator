import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import DayEditorStepper from '../DayEditorStepper';
import { useDayIdFromUrl } from '../../../hooks/useDayIdFromUrl';
import { emitStepperShortcut } from '../../../hooks/stepperShortcuts';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

vi.mock('../../../hooks/useDayIdFromUrl', () => ({
  useDayIdFromUrl: vi.fn(),
}));

/**
 *
 * @param animal
 * @param day
 */
function seed(animal, day) {
  return {
    workspace: {
      animals: { [animal.id]: animal },
      days: { [day.id]: day },
      settings: {},
    },
  };
}

/**
 * Build a workspace whose day is schema-INVALID in a way that leaves every
 * prerequisite step `'valid'` but the authoritative `export` status `'error'`.
 *
 * A non-numeric electrode-group `targeted_x` is a device-field schema error: it
 * routes to the Devices error bucket, which `computeDevicesStatus` ignores
 * (it gates on completeness, not schema errors), so Devices and the catch-all
 * Validation step both stay `'valid'`. This isolates the new export gate — a
 * blank `session_description` would instead trip Overview completeness and the
 * old prerequisite gate, proving nothing about the export status.
 *
 * @returns {{ animal: object, day: object }}
 */
function buildExportErrorWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  animal.configurationHistory[0].devices.electrode_groups[0].targeted_x = 'not-a-number';
  return { animal, day };
}

describe('Day editor export gate (integration)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('reaches the Export step and enables the download when every step is valid', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();
    useDayIdFromUrl.mockReturnValue(day.id);

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Export is a freely reachable tab — never nav-locked.
    const exportButton = screen.getByRole('button', { name: /^Export/ });
    expect(exportButton).not.toHaveAttribute('aria-disabled', 'true');

    await user.click(exportButton);

    // ExportStep rendered: the resolved filename is shown and the download is enabled.
    expect(screen.getByText(/06222023_remy_metadata\.yml/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download yaml/i })).toBeEnabled();
  });

  it('reaches the Export step but blocks the download when a prerequisite step is invalid', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();
    // No tasks → epochs incomplete. The nav no longer gates reaching Export; ExportStep
    // self-gates the DOWNLOAD action instead.
    const incompleteDay = { ...day, tasks: [] };
    useDayIdFromUrl.mockReturnValue(day.id);

    render(
      <StoreProvider initialState={seed(animal, incompleteDay)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    const exportButton = screen.getByRole('button', { name: /^Export/ });
    expect(exportButton).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(exportButton);

    expect(screen.getByRole('button', { name: /download yaml/i })).toBeDisabled();
  });

  it('reaches the Export step on a day with an export-blocking schema error but keeps the download blocked', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildExportErrorWorkspace();
    useDayIdFromUrl.mockReturnValue(day.id);

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    const exportButton = screen.getByRole('button', { name: /^Export/ });
    // Freely reachable — the gate is the download action, not the tab.
    expect(exportButton).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(exportButton);

    // ExportStep renders (filename line present) but its self-gate keeps the download disabled.
    expect(screen.getByText(/06222023_remy_metadata\.yml/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download yaml/i })).toBeDisabled();
  });

  it('advances into Export via the keyboard stepper shortcut even on an export-blocked day (download stays blocked)', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildExportErrorWorkspace();
    useDayIdFromUrl.mockReturnValue(day.id);

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Reach the Validation step first.
    await user.click(screen.getByRole('button', { name: /^Validation/ }));
    expect(screen.getByText('Validation Summary')).toBeInTheDocument();

    // Alt+Right now crosses freely into Export (no keyboard fail-close); ExportStep self-gates.
    act(() => emitStepperShortcut('next'));

    expect(screen.getByText(/06222023_remy_metadata\.yml/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download yaml/i })).toBeDisabled();
  });

  it('advances from Validation into Export via the keyboard stepper shortcut on a valid day', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();
    useDayIdFromUrl.mockReturnValue(day.id);

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Validation/ }));
    expect(screen.getByText('Validation Summary')).toBeInTheDocument();

    act(() => emitStepperShortcut('next'));

    expect(screen.getByText(/06222023_remy_metadata\.yml/)).toBeInTheDocument();
  });

  it('reaches the Validation step and shows the ready-to-export indicator for a clean day', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();
    useDayIdFromUrl.mockReturnValue(day.id);

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Validation/ }));

    expect(screen.getByText(/ready to export/i)).toBeInTheDocument();
  });
});
