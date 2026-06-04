import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StepNavigation from '../StepNavigation';

describe('StepNavigation', () => {
  const steps = [
    { id: 'overview', label: 'Overview' },
    { id: 'devices', label: 'Devices' },
    { id: 'epochs', label: 'Epochs' },
    { id: 'validation', label: 'Validation' },
    { id: 'export', label: 'Export' },
  ];

  const stepStatus = {
    overview: 'valid',
    devices: 'incomplete',
    epochs: 'incomplete',
    validation: 'incomplete',
    export: 'error',
  };

  it('renders all step buttons', () => {
    render(
      <StepNavigation
        steps={steps}
        currentStep="overview"
        stepStatus={stepStatus}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Devices')).toBeInTheDocument();
    expect(screen.getByText('Epochs')).toBeInTheDocument();
    expect(screen.getByText('Validation')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('shows status icons', () => {
    render(
      <StepNavigation
        steps={steps}
        currentStep="overview"
        stepStatus={stepStatus}
        onNavigate={vi.fn()}
      />
    );

    // Check that status icons are rendered (they're in the buttons)
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('marks current step with aria-current', () => {
    render(
      <StepNavigation
        steps={steps}
        currentStep="devices"
        stepStatus={stepStatus}
        onNavigate={vi.fn()}
      />
    );

    const devicesButton = screen.getByRole('button', { name: /Devices/ });
    expect(devicesButton).toHaveAttribute('aria-current', 'step');
  });

  it('disables export when validation incomplete', () => {
    const incompleteStatus = {
      overview: 'valid',
      devices: 'incomplete',
      epochs: 'incomplete',
      validation: 'incomplete',
      export: 'error',
    };

    render(
      <StepNavigation
        steps={steps}
        currentStep="overview"
        stepStatus={incompleteStatus}
        onNavigate={vi.fn()}
      />
    );

    const exportButton = screen.getByRole('button', { name: /Export/ });
    // aria-disabled (kept in the a11y tree) rather than the native disabled attribute.
    expect(exportButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('enables export when all steps valid', () => {
    const allValidStatus = {
      overview: 'valid',
      devices: 'valid',
      epochs: 'valid',
      validation: 'valid',
      export: 'valid',
    };

    render(
      <StepNavigation
        steps={steps}
        currentStep="overview"
        stepStatus={allValidStatus}
        onNavigate={vi.fn()}
      />
    );

    const exportButton = screen.getByRole('button', { name: /Export/ });
    expect(exportButton).not.toBeDisabled();
    expect(exportButton).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('calls onNavigate when step clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <StepNavigation
        steps={steps}
        currentStep="overview"
        stepStatus={stepStatus}
        onNavigate={onNavigate}
      />
    );

    const devicesButton = screen.getByRole('button', { name: /Devices/ });
    await user.click(devicesButton);

    expect(onNavigate).toHaveBeenCalledWith('devices');
  });

  it('does not call onNavigate when disabled export clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <StepNavigation
        steps={steps}
        currentStep="overview"
        stepStatus={stepStatus}
        onNavigate={onNavigate}
      />
    );

    const exportButton = screen.getByRole('button', { name: /Export/ });
    await user.click(exportButton);

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('announces status to screen readers', () => {
    render(
      <StepNavigation
        steps={steps}
        currentStep="overview"
        stepStatus={stepStatus}
        onNavigate={vi.fn()}
      />
    );

    // Check that aria-label includes status
    const overviewButton = screen.getByRole('button', { name: /Overview.*Complete/i });
    expect(overviewButton).toBeInTheDocument();

    const devicesButton = screen.getByRole('button', { name: /Devices.*Incomplete/i });
    expect(devicesButton).toBeInTheDocument();
  });

  it('highlights current step visually', () => {
    render(
      <StepNavigation
        steps={steps}
        currentStep="devices"
        stepStatus={stepStatus}
        onNavigate={vi.fn()}
      />
    );

    const devicesButton = screen.getByRole('button', { name: /Devices/ });
    const parentLi = devicesButton.closest('li');

    expect(parentLi).toHaveClass('current');
  });

  describe('disabled (not-yet-available) steps', () => {
    const stepsWithDisabled = [
      { id: 'overview', label: 'Overview' },
      { id: 'devices', label: 'Devices' },
      { id: 'epochs', label: 'Epochs', disabled: true },
      { id: 'validation', label: 'Validation', disabled: true },
      { id: 'export', label: 'Export' },
    ];

    it('marks Epochs, Validation, and Export buttons aria-disabled (kept in tab order for AT)', () => {
      render(
        <StepNavigation
          steps={stepsWithDisabled}
          currentStep="overview"
          stepStatus={stepStatus}
          onNavigate={vi.fn()}
        />
      );

      // aria-disabled (not native `disabled`) so screen readers can still reach and
      // announce these steps. Epochs/Validation via the marker; Export via the gate.
      expect(screen.getByRole('button', { name: /Epochs/ })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('button', { name: /Validation/ })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('button', { name: /Export/ })).toHaveAttribute('aria-disabled', 'true');
      // The disabled steps are NOT removed from the accessibility tree.
      expect(screen.getByRole('button', { name: /Epochs/ })).not.toBeDisabled();
    });

    it('gives disabled/locked steps a meaningful accessible status (not a false "Complete")', () => {
      render(
        <StepNavigation
          steps={stepsWithDisabled}
          currentStep="overview"
          stepStatus={{ ...stepStatus, export: 'valid' }}
          onNavigate={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /Epochs.*not available/i })).toBeInTheDocument();
      // Export reads as locked, never "Complete", even if its raw status is 'valid'.
      expect(screen.getByRole('button', { name: /Export.*locked/i })).toBeInTheDocument();
    });

    it('explains an export blocked by validation errors differently from incomplete prerequisites', () => {
      // Every prerequisite step is valid, but export is gated by a validation error.
      render(
        <StepNavigation
          steps={steps}
          currentStep="overview"
          stepStatus={{
            overview: 'valid',
            devices: 'valid',
            epochs: 'valid',
            validation: 'valid',
            export: 'error',
          }}
          onNavigate={vi.fn()}
        />
      );

      // The locked reason must point at validation, not at already-complete steps.
      expect(
        screen.getByRole('button', { name: /Export.*resolve validation errors/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Export.*complete previous steps/i })
      ).not.toBeInTheDocument();
    });

    it('does not navigate when a disabled step is activated', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      render(
        <StepNavigation
          steps={stepsWithDisabled}
          currentStep="overview"
          stepStatus={stepStatus}
          onNavigate={onNavigate}
        />
      );

      // Disabled buttons swallow clicks; assert the handler is never invoked.
      await user.click(screen.getByRole('button', { name: /Epochs/ }));
      await user.click(screen.getByRole('button', { name: /Validation/ }));
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });
});
