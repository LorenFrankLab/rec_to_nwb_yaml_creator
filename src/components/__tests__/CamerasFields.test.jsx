import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import CamerasFields from '../CamerasFields';

describe('CamerasFields', () => {
  let initialState;

  beforeEach(() => {
    initialState = {
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
    };
  });

  it('renders cameras section', () => {
    renderWithProviders(<CamerasFields />, { initialState });
    expect(screen.getByText('Cameras')).toBeInTheDocument();
  });

  it('renders all camera fields', () => {
    renderWithProviders(<CamerasFields />, { initialState });
    expect(screen.getAllByLabelText(/Camera Id/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Meters Per Pixel/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Manufacturer/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/model/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/lens/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Camera Name/i)[0]).toBeInTheDocument();
  });

  it('displays values from formData', () => {
    const state = {
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
    };
    renderWithProviders(<CamerasFields />, { initialState: state });
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Basler')).toBeInTheDocument();
  });

  describe('CRUD Operations', () => {
    it('renders add button for adding cameras', () => {
      renderWithProviders(<CamerasFields />, { initialState });

      const addButton = screen.getByRole('button', { name: '＋' });
      expect(addButton).toBeInTheDocument();
    });

    it('renders remove button for removing cameras', () => {
      renderWithProviders(<CamerasFields />, { initialState });

      const removeButton = screen.getByRole('button', { name: /Remove/i });
      expect(removeButton).toBeInTheDocument();
    });

    it('renders duplicate button for duplicating cameras', () => {
      renderWithProviders(<CamerasFields />, { initialState });

      const duplicateButton = screen.getByRole('button', { name: /Duplicate/i });
      expect(duplicateButton).toBeInTheDocument();
    });

    it('renders multiple cameras with independent values', () => {
      const state = {
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
      };

      renderWithProviders(<CamerasFields />, { initialState: state });

      expect(screen.getByDisplayValue('overhead')).toBeInTheDocument();
      expect(screen.getByDisplayValue('side')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Basler')).toBeInTheDocument();
      expect(screen.getByDisplayValue('FLIR')).toBeInTheDocument();
    });

    it('handles empty cameras array', () => {
      const state = { cameras: [] };

      renderWithProviders(<CamerasFields />, { initialState: state });

      expect(screen.getByText('Cameras')).toBeInTheDocument();
      expect(screen.queryByText(/Item #1/i)).not.toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('marks all camera fields as required', () => {
      renderWithProviders(<CamerasFields />, { initialState });

      expect(screen.getAllByLabelText(/Camera Id/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/Meters Per Pixel/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/Manufacturer/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/model/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/lens/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/Camera Name/i)[0]).toBeRequired();
    });

    it('validates camera ID as number type', () => {
      renderWithProviders(<CamerasFields />, { initialState });

      const idInput = screen.getAllByLabelText(/Camera Id/i)[0];
      expect(idInput).toHaveAttribute('type', 'number');
    });

    it('validates meters_per_pixel as decimal with step', () => {
      renderWithProviders(<CamerasFields />, { initialState });

      const input = screen.getAllByLabelText(/Meters Per Pixel/i)[0];
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('step', '0.1');
    });
  });

  describe('User Interactions', () => {
    it('allows editing camera fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CamerasFields />, { initialState });

      const idInput = screen.getAllByLabelText(/Camera Id/i)[0];
      await user.type(idInput, '1');

      // Verify input accepts text
      expect(idInput).toHaveValue(1);
    });

    it('handles blur on camera fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CamerasFields />, { initialState });

      const idInput = screen.getAllByLabelText(/Camera Id/i)[0];
      await user.click(idInput);
      await user.tab();

      // Verify blur doesn't cause errors (onBlur is handled by store)
      expect(idInput).not.toHaveFocus();
    });
  });
});
