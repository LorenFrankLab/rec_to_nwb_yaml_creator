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

  it('enables the Export tab and reaches the Export step when every step is valid', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildRealisticWorkspace();
    useDayIdFromUrl.mockReturnValue(day.id);

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    const exportButton = screen.getByRole('button', { name: /^Export/ });
    expect(exportButton).not.toHaveAttribute('aria-disabled', 'true');

    await user.click(exportButton);

    // ExportStep rendered: the resolved filename is shown.
    expect(screen.getByText(/06222023_remy_metadata\.yml/)).toBeInTheDocument();
  });

  it('disables the Export tab when a prerequisite step is invalid', () => {
    const { animal, day } = buildRealisticWorkspace();
    // No tasks → epochs incomplete → export gated (isExportEnabled unchanged).
    const incompleteDay = { ...day, tasks: [] };
    useDayIdFromUrl.mockReturnValue(day.id);

    render(
      <StoreProvider initialState={seed(animal, incompleteDay)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    expect(screen.getByRole('button', { name: /^Export/ })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('keeps the Export tab locked and does not navigate to it on a day that is valid in every step but has an export-blocking schema error', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildExportErrorWorkspace();
    useDayIdFromUrl.mockReturnValue(day.id);

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    const exportButton = screen.getByRole('button', { name: /^Export/ });
    expect(exportButton).toHaveAttribute('aria-disabled', 'true');

    await user.click(exportButton);

    // Click is swallowed: the Export step (its filename line) never renders.
    expect(screen.queryByText(/06222023_remy_metadata\.yml/)).not.toBeInTheDocument();
  });

  it('does not advance into Export via the keyboard stepper shortcut on an export-blocked day', async () => {
    const user = userEvent.setup();
    const { animal, day } = buildExportErrorWorkspace();
    useDayIdFromUrl.mockReturnValue(day.id);

    render(
      <StoreProvider initialState={seed(animal, day)}>
        <DayEditorStepper />
      </StoreProvider>
    );

    // Reach the (reachable) Validation step first.
    await user.click(screen.getByRole('button', { name: /^Validation/ }));
    expect(screen.getByText('Validation Summary')).toBeInTheDocument();

    // Alt+Right from Validation must NOT cross into Export on an export-blocked day.
    act(() => emitStepperShortcut('next'));

    expect(screen.getByText('Validation Summary')).toBeInTheDocument();
    expect(screen.queryByText(/06222023_remy_metadata\.yml/)).not.toBeInTheDocument();
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
