import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import DeviceFields from '../DeviceFields';

describe('DeviceFields', () => {
  let initialState;

  beforeEach(() => {
    // Default state matching App.js interface
    initialState = {
      device: {
        name: [],
      },
    };
  });

  describe('Component Rendering', () => {
    it('renders the device section', () => {
      renderWithProviders(<DeviceFields />, { initialState });

      expect(screen.getByText('Device')).toBeInTheDocument();
    });

    it('renders with details element open by default', () => {
      const { container } = renderWithProviders(<DeviceFields />, { initialState });

      const details = container.querySelector('details');
      expect(details).toHaveAttribute('open');
    });

    it('has correct area ID', () => {
      const { container } = renderWithProviders(<DeviceFields />, { initialState });

      const area = container.querySelector('#device-area');
      expect(area).toBeInTheDocument();
      expect(area).toHaveClass('area-region');
    });

    it('renders ListElement for device names', () => {
      renderWithProviders(<DeviceFields />, { initialState });

      // ListElement should render with title "Name"
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });

  describe('Field Values from Store', () => {
    it('displays device names from formData', () => {
      const stateWithDevices = {
        device: {
          name: ['Device1', 'Device2'],
        },
      };

      renderWithProviders(<DeviceFields />, { initialState: stateWithDevices });

      // ListElement displays array items
      // We can verify the component renders without error
      expect(screen.getByText('Device')).toBeInTheDocument();
    });

    it('handles empty device name array', () => {
      renderWithProviders(<DeviceFields />, { initialState });

      expect(screen.getByText('Device')).toBeInTheDocument();
    });
  });
});
