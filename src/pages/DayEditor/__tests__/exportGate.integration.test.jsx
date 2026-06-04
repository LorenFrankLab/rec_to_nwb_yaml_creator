import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import DayEditorStepper from '../DayEditorStepper';
import { useDayIdFromUrl } from '../../../hooks/useDayIdFromUrl';
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
