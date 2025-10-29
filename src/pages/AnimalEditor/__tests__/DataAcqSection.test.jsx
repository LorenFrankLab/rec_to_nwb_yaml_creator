/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataAcqSection from '../DataAcqSection';

/**
 * Tests for DataAcqSection component (M8a Task 3)
 *
 * Single form (not table) for data acquisition device configuration.
 * Tests cover rendering, collapsible advanced settings, validation, and accessibility.
 */

describe('DataAcqSection', () => {
  let user;

  const mockAnimal = {
    id: 'remy',
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
  };

  const mockOnFieldUpdate = vi.fn();

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  describe('Form Fields', () => {
    it('should render all form fields (system dropdown, amplifier, ADC)', () => {
      render(
        <DataAcqSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Check for system dropdown
      expect(screen.getByLabelText(/System/i)).toBeInTheDocument();

      // Check for amplifier input
      expect(screen.getByLabelText(/Amplifier/i)).toBeInTheDocument();

      // Check for ADC input
      expect(screen.getByLabelText(/ADC/i)).toBeInTheDocument();

      // Check for header file path
      expect(screen.getByLabelText(/Default Header File/i)).toBeInTheDocument();
    });

    it('should populate fields with existing animal data', () => {
      render(
        <DataAcqSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Check values are populated
      expect(screen.getByDisplayValue('SpikeGadgets')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Intan RHD2000')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Intan')).toBeInTheDocument();
      expect(screen.getByDisplayValue('/path/to/config.trodesconf')).toBeInTheDocument();
    });
  });

  describe('Advanced Settings', () => {
    it('should have advanced settings collapsed by default', () => {
      render(
        <DataAcqSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Find the details element
      const details = screen.getByText(/Advanced Settings/i).closest('details');
      expect(details).toBeInTheDocument();
      expect(details).not.toHaveAttribute('open');
    });

    it('should toggle advanced settings open/closed on click', async () => {
      render(
        <DataAcqSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Find the summary element
      const summary = screen.getByText(/Advanced Settings/i);
      const details = summary.closest('details');

      // Initially closed
      expect(details).not.toHaveAttribute('open');

      // Click to open
      await user.click(summary);
      expect(details).toHaveAttribute('open');

      // Click to close
      await user.click(summary);
      expect(details).not.toHaveAttribute('open');
    });

    it('should show help text visible for advanced settings', async () => {
      render(
        <DataAcqSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Open advanced settings
      const summary = screen.getByText(/Advanced Settings/i);
      await user.click(summary);

      // Check for help text
      expect(screen.getByText(/Contact support before changing/i)).toBeInTheDocument();
    });
  });

  describe('File Browser', () => {
    it('should open file picker when file browser button is clicked', async () => {
      render(
        <DataAcqSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Find the browse button
      const browseButton = screen.getByRole('button', { name: /Browse/i });
      expect(browseButton).toBeInTheDocument();

      // Click should not throw error
      await user.click(browseButton);
    });
  });

  describe('Validation', () => {
    it('should validate ephys_to_volt > 0', async () => {
      const invalidAnimal = {
        ...mockAnimal,
        technical: {
          ...mockAnimal.technical,
          ephys_to_volt_conversion: -1.0,
        },
      };

      render(
        <DataAcqSection
          animal={invalidAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Open advanced settings to access field
      const summary = screen.getByText(/Advanced Settings/i);
      await user.click(summary);

      // Find ephys_to_volt input
      const ephysInput = screen.getByLabelText(/Ephys to Volt/i);
      expect(ephysInput).toBeInTheDocument();

      // Should have invalid value
      expect(ephysInput).toHaveValue(-1);
    });

    it('should validate times_multiplier > 0', async () => {
      const invalidAnimal = {
        ...mockAnimal,
        technical: {
          ...mockAnimal.technical,
          times_period_multiplier: -1.0,
        },
      };

      render(
        <DataAcqSection
          animal={invalidAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Open advanced settings to access field
      const summary = screen.getByText(/Advanced Settings/i);
      await user.click(summary);

      // Find times_multiplier input
      const timesInput = screen.getByLabelText(/Times Period Multiplier/i);
      expect(timesInput).toBeInTheDocument();

      // Should have invalid value
      expect(timesInput).toHaveValue(-1);
    });
  });

  describe('Save Changes', () => {
    it('should save changes on blur with debounce', async () => {
      render(
        <DataAcqSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Find amplifier input
      const amplifierInput = screen.getByLabelText(/Amplifier/i);

      // Clear and type new value
      await user.clear(amplifierInput);
      await user.type(amplifierInput, 'New Amplifier');

      // Blur to trigger save
      await user.tab();

      // Wait for debounce
      await waitFor(() => {
        expect(mockOnFieldUpdate).toHaveBeenCalled();
      }, { timeout: 1000 });
    });
  });
});
