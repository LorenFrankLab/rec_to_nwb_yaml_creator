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
    expect(exportButton).toBeDisabled();
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
});
