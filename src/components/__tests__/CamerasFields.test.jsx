import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CamerasFields from '../CamerasFields';

describe('CamerasFields', () => {
  let defaultProps;

  beforeEach(() => {
    defaultProps = {
      formData: {
        cameras: [
          {
            id: '',
            meters_per_pixel: '',
            manufacturer: '',
            model: '',
            lens: '',
            camera_name: '',
          },
        ],
      },
      handleChange: vi.fn(() => vi.fn()),
      onBlur: vi.fn(),
      addArrayItem: vi.fn(),
      removeArrayItem: vi.fn(),
      duplicateArrayItem: vi.fn(),
      sanitizeTitle: vi.fn((val) => val),
    };
  });

  it('renders cameras section', () => {
    render(<CamerasFields {...defaultProps} />);
    expect(screen.getByText('Cameras')).toBeInTheDocument();
  });

  it('renders all camera fields', () => {
    render(<CamerasFields {...defaultProps} />);
    expect(screen.getAllByLabelText(/Camera Id/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Meters Per Pixel/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Manufacturer/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/model/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/lens/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Camera Name/i)[0]).toBeInTheDocument();
  });

  it('displays values from formData', () => {
    const props = {
      ...defaultProps,
      formData: {
        cameras: [
          {
            id: 1,
            meters_per_pixel: 0.5,
            manufacturer: 'Basler',
            model: 'acA1300',
            lens: 'Fujinon',
            camera_name: 'overhead',
          },
        ],
      },
    };
    render(<CamerasFields {...props} />);
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Basler')).toBeInTheDocument();
  });
});
