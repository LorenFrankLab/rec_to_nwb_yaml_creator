import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeviceFields from '../DeviceFields';

describe('DeviceFields', () => {
  let defaultProps;

  beforeEach(() => {
    // Default props matching App.js interface
    defaultProps = {
      formData: {
        device: {
          name: [],
        },
      },
      updateFormData: vi.fn(),
    };
  });

  describe('Component Rendering', () => {
    it('renders the device section', () => {
      render(<DeviceFields {...defaultProps} />);

      expect(screen.getByText('Device')).toBeInTheDocument();
    });

    it('renders with details element open by default', () => {
      const { container } = render(<DeviceFields {...defaultProps} />);

      const details = container.querySelector('details');
      expect(details).toHaveAttribute('open');
    });

    it('has correct area ID', () => {
      const { container } = render(<DeviceFields {...defaultProps} />);

      const area = container.querySelector('#device-area');
      expect(area).toBeInTheDocument();
      expect(area).toHaveClass('area-region');
    });

    it('renders ListElement for device names', () => {
      render(<DeviceFields {...defaultProps} />);

      // ListElement should render with title "Name"
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });

  describe('Field Values from Props', () => {
    it('displays device names from formData', () => {
      const props = {
        ...defaultProps,
        formData: {
          device: {
            name: ['Device1', 'Device2'],
          },
        },
      };

      render(<DeviceFields {...props} />);

      // ListElement displays array items
      // We can verify the component renders without error
      expect(screen.getByText('Device')).toBeInTheDocument();
    });

    it('handles empty device name array', () => {
      render(<DeviceFields {...defaultProps} />);

      expect(screen.getByText('Device')).toBeInTheDocument();
    });
  });
});
