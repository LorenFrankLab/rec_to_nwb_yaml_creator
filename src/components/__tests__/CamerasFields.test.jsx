import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  describe('CRUD Operations', () => {
    it('calls addArrayItem when add button is clicked', async () => {
      const user = userEvent.setup();
      const mockAddArrayItem = vi.fn();
      const props = { ...defaultProps, addArrayItem: mockAddArrayItem };

      render(<CamerasFields {...props} />);

      const addButton = screen.getByRole('button', { name: '＋' });
      await user.click(addButton);

      expect(mockAddArrayItem).toHaveBeenCalledTimes(1);
      expect(mockAddArrayItem.mock.calls[0][0]).toBe('cameras');
      // In simple mode (allowMultiple=false), second arg is click event object
      expect(mockAddArrayItem.mock.calls[0][1]).toBeTruthy();
    });

    it('calls removeArrayItem when remove button is clicked', async () => {
      const user = userEvent.setup();
      const mockRemoveArrayItem = vi.fn();
      const props = { ...defaultProps, removeArrayItem: mockRemoveArrayItem };

      render(<CamerasFields {...props} />);

      const removeButton = screen.getByRole('button', { name: /Remove/i });
      await user.click(removeButton);

      expect(mockRemoveArrayItem).toHaveBeenCalledWith(0, 'cameras');
    });

    it('calls duplicateArrayItem when duplicate button is clicked', async () => {
      const user = userEvent.setup();
      const mockDuplicateArrayItem = vi.fn();
      const props = { ...defaultProps, duplicateArrayItem: mockDuplicateArrayItem };

      render(<CamerasFields {...props} />);

      const duplicateButton = screen.getByRole('button', { name: /Duplicate/i });
      await user.click(duplicateButton);

      expect(mockDuplicateArrayItem).toHaveBeenCalledWith(0, 'cameras');
    });

    it('renders multiple cameras with independent values', () => {
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
            {
              id: 2,
              meters_per_pixel: 0.3,
              manufacturer: 'FLIR',
              model: 'Blackfly',
              lens: 'Tamron',
              camera_name: 'side',
            },
          ],
        },
      };

      render(<CamerasFields {...props} />);

      expect(screen.getByDisplayValue('overhead')).toBeInTheDocument();
      expect(screen.getByDisplayValue('side')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Basler')).toBeInTheDocument();
      expect(screen.getByDisplayValue('FLIR')).toBeInTheDocument();
    });

    it('handles empty cameras array', () => {
      const props = {
        ...defaultProps,
        formData: { cameras: [] },
      };

      render(<CamerasFields {...props} />);

      expect(screen.getByText('Cameras')).toBeInTheDocument();
      expect(screen.queryByText(/Item #1/i)).not.toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('marks all camera fields as required', () => {
      render(<CamerasFields {...defaultProps} />);

      expect(screen.getAllByLabelText(/Camera Id/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/Meters Per Pixel/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/Manufacturer/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/model/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/lens/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/Camera Name/i)[0]).toBeRequired();
    });

    it('validates camera ID as number type', () => {
      render(<CamerasFields {...defaultProps} />);

      const idInput = screen.getAllByLabelText(/Camera Id/i)[0];
      expect(idInput).toHaveAttribute('type', 'number');
    });

    it('validates meters_per_pixel as decimal with step', () => {
      render(<CamerasFields {...defaultProps} />);

      const input = screen.getAllByLabelText(/Meters Per Pixel/i)[0];
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('step', '0.1');
    });
  });

  describe('User Interactions', () => {
    it('calls handleChange when camera fields are edited', async () => {
      const user = userEvent.setup();
      const mockHandleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange: mockHandleChange };

      render(<CamerasFields {...props} />);

      const idInput = screen.getAllByLabelText(/Camera Id/i)[0];
      await user.type(idInput, '1');

      expect(mockHandleChange).toHaveBeenCalledWith('id', 'cameras', 0);
    });

    it('calls onBlur when camera fields lose focus', async () => {
      const user = userEvent.setup();
      const mockOnBlur = vi.fn();
      const props = { ...defaultProps, onBlur: mockOnBlur };

      render(<CamerasFields {...props} />);

      const idInput = screen.getAllByLabelText(/Camera Id/i)[0];
      await user.click(idInput);
      await user.tab();

      expect(mockOnBlur).toHaveBeenCalledWith(
        expect.any(Object),
        { key: 'cameras', index: 0 }
      );
    });
  });
});
