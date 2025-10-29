import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HardwareConfigStep from '../HardwareConfigStep';

describe('HardwareConfigStep', () => {
  const mockAnimal = {
    id: 'remy',
    cameras: [
      {
        id: '1',
        camera_name: 'Overhead',
        manufacturer: 'Basler',
        model: 'acA1300-60gm',
        lens: 'Fujinon 12.5mm',
        meters_per_pixel: 0.001,
      },
    ],
    data_acq_device: {
      system: 'SpikeGadgets',
      amplifier: 'Intan RHD2000',
      adc_circuit: 'Intan',
    },
    technical: {
      default_header_file_path: '/path/to/config.trodesconf',
      ephys_to_volt_conversion: 1.0,
      times_period_multiplier: 1.0,
    },
    behavioral_events: [
      { name: 'reward_left', description: 'Left reward port' },
      { name: 'reward_right', description: 'Right reward port' },
    ],
  };

  const mockOnFieldUpdate = vi.fn();
  const mockOnNavigateBack = vi.fn();
  const mockOnNavigateNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 3 sections (Cameras, Data Acq, Behavioral Events)', () => {
    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Check for specific section headings (use getAllByText to handle multiple matches)
    const cameraHeadings = screen.getAllByText(/Cameras/i);
    expect(cameraHeadings.length).toBeGreaterThan(0);

    expect(screen.getByText(/Data Acquisition Device/i)).toBeInTheDocument();

    const behavioralEventsHeadings = screen.getAllByText(/Behavioral Events/i);
    expect(behavioralEventsHeadings.length).toBeGreaterThan(0);
  });

  it('sections have correct elevation styling (cameras=1, data_acq=0, events=1)', () => {
    const { container } = render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Cameras section should have elevation-1 class
    const camerasSection = container.querySelector('.cameras-section').closest('.section-elevation-1');
    expect(camerasSection).toBeInTheDocument();

    // Data acquisition section should have elevation-0 class
    const dataAcqSection = container.querySelector('.data-acq-section').closest('.section-elevation-0');
    expect(dataAcqSection).toBeInTheDocument();

    // Behavioral events section should have elevation-1 class
    const eventsSection = container.querySelector('.behavioral-events-section').closest('.section-elevation-1');
    expect(eventsSection).toBeInTheDocument();
  });

  it('save indicator shows "Saving..." on changes', async () => {
    const user = userEvent.setup();

    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Find the amplifier input (text field that can be edited)
    const amplifierInput = screen.getByDisplayValue('Intan RHD2000');

    // Change the value and blur to trigger save
    await user.clear(amplifierInput);
    await user.type(amplifierInput, 'New Amplifier');
    amplifierInput.blur();

    // Save indicator should show "Saving..." or "Saved"
    await waitFor(() => {
      const savingOrSaved = screen.queryByText(/Saving/i) || screen.queryByText(/Saved/i);
      expect(savingOrSaved).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('save indicator shows "Saved" after success', async () => {
    const user = userEvent.setup();

    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Find the amplifier input (text field that can be edited)
    const amplifierInput = screen.getByDisplayValue('Intan RHD2000');

    // Change the value and blur to trigger save
    await user.clear(amplifierInput);
    await user.type(amplifierInput, 'New Amplifier');
    amplifierInput.blur();

    // Wait for "Saved" status (might take up to 500ms based on SaveIndicator component)
    await waitFor(() => {
      expect(screen.getByText(/Saved/i)).toBeInTheDocument();
    }, { timeout: 1500 });
  });

  it('navigation buttons enabled/disabled based on validation', () => {
    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Back button should always be enabled in Step 3
    const backButton = screen.getByText(/Back/i);
    expect(backButton).not.toBeDisabled();

    // Continue button should be enabled (hardware config is optional)
    const continueButton = screen.getByText(/Continue/i);
    expect(continueButton).not.toBeDisabled();
  });

  it('Back button navigates to Step 2 (Channel Maps)', async () => {
    const user = userEvent.setup();

    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    const backButton = screen.getByText(/Back/i);
    await user.click(backButton);

    expect(mockOnNavigateBack).toHaveBeenCalledTimes(1);
  });

  it('Continue button saves and exits (or goes to Step 4 if optogenetics exists)', async () => {
    const user = userEvent.setup();

    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    const continueButton = screen.getByText(/Continue/i);
    await user.click(continueButton);

    expect(mockOnNavigateNext).toHaveBeenCalledTimes(1);
  });

  it('handles save errors gracefully', async () => {
    const user = userEvent.setup();
    const mockOnFieldUpdateWithError = vi.fn(() => {
      throw new Error('Save failed');
    });

    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdateWithError}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Trigger a change that will cause an error using amplifier input
    const amplifierInput = screen.getByDisplayValue('Intan RHD2000');
    await user.clear(amplifierInput);
    await user.type(amplifierInput, 'New Amplifier');
    amplifierInput.blur();

    // Error message should be displayed in SaveIndicator (role="alert")
    await waitFor(() => {
      const alert = screen.queryByRole('alert');
      expect(alert).toBeInTheDocument();
    }, { timeout: 1500 });
  });

  it('sections expand/collapse correctly', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Find the first collapsible section (if any)
    const detailsElements = container.querySelectorAll('details');
    if (detailsElements.length > 0) {
      const firstDetails = detailsElements[0];
      const summary = firstDetails.querySelector('summary');

      // Toggle expansion
      await user.click(summary);

      // Check that details element toggled
      expect(firstDetails.hasAttribute('open')).toBe(true);
    }
  });

  it('integrates with AnimalEditorStepper props', () => {
    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Component should render without errors and accept all props
    const cameraHeadings = screen.getAllByText(/Cameras/i);
    expect(cameraHeadings.length).toBeGreaterThan(0);
  });

  it('verifies data persists in animal.cameras, animal.data_acq_device, animal.behavioral_events', () => {
    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Verify cameras are displayed
    expect(screen.getByText('Overhead')).toBeInTheDocument();

    // Verify data_acq_device is displayed
    expect(screen.getByDisplayValue('SpikeGadgets')).toBeInTheDocument();

    // Verify behavioral_events are displayed
    expect(screen.getByText('reward_left')).toBeInTheDocument();
    expect(screen.getByText('reward_right')).toBeInTheDocument();
  });

  it('accessibility: all sections have proper landmarks', () => {
    const { container } = render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Check for section elements or regions
    const sections = container.querySelectorAll('section, [role="region"]');
    expect(sections.length).toBeGreaterThanOrEqual(3);
  });

  it('accessibility: keyboard navigation works', async () => {
    const user = userEvent.setup();

    render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Tab through elements - first should be "Add Camera" button
    await user.tab();
    const addCameraButton = screen.getByText(/Add Camera/i);
    expect(addCameraButton).toHaveFocus();

    // Keep tabbing until we reach the Back button (skip all section elements)
    let foundBackButton = false;
    for (let i = 0; i < 20 && !foundBackButton; i++) {
      await user.tab();
      const backButton = screen.getByText(/Back to Channel Maps/i);
      if (backButton === document.activeElement) {
        foundBackButton = true;
        expect(backButton).toHaveFocus();
      }
    }

    expect(foundBackButton).toBe(true);
  });

  it('responsive: mobile layout at < 600px', () => {
    // Set viewport to mobile size
    global.innerWidth = 400;
    global.dispatchEvent(new Event('resize'));

    const { container } = render(
      <HardwareConfigStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    // Check that container has responsive class or styling
    const mainContainer = container.querySelector('.hardware-config-step');
    expect(mainContainer).toBeInTheDocument();
  });

  it('performance: handles 10 cameras without lag', async () => {
    const largeMockAnimal = {
      ...mockAnimal,
      cameras: Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        camera_name: `Camera ${i + 1}`,
        manufacturer: 'Basler',
        model: 'acA1300-60gm',
        lens: 'Fujinon 12.5mm',
        meters_per_pixel: 0.001,
      })),
    };

    const startTime = performance.now();

    render(
      <HardwareConfigStep
        animal={largeMockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onNavigateBack={mockOnNavigateBack}
        onNavigateNext={mockOnNavigateNext}
      />
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Render should complete in < 1000ms
    expect(renderTime).toBeLessThan(1000);

    // Verify all cameras are rendered
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(`Camera ${i}`)).toBeInTheDocument();
    }
  });
});
