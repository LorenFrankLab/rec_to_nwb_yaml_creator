/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CameraModal from '../CameraModal';

/**
 * Tests for CameraModal component (M8a.1)
 *
 * Modal dialog for CRUD operations on cameras.
 * Supports add/edit modes with form validation and accessibility.
 */

describe('CameraModal', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render modal with all form fields', () => {
      render(
        <CameraModal
          isOpen={true}
          mode="add"
          existingCameras={[]}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Check modal is rendered
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Check all form fields are present
      expect(screen.getByLabelText(/camera id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^camera name$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/manufacturer/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/model/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/lens/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/meters per pixel/i)).toBeInTheDocument();

      // Check buttons
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('ID auto-assignment', () => {
    it('should auto-assign next sequential ID when no cameras exist', () => {
      render(
        <CameraModal
          isOpen={true}
          mode="add"
          existingCameras={[]}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const idInput = screen.getByLabelText(/camera id/i);
      expect(idInput).toHaveValue('0');
      expect(idInput).toHaveAttribute('readonly');
    });

    it('should auto-assign next sequential ID when cameras exist', () => {
      const existingCameras = [
        { id: 0, camera_name: 'Camera 0' },
        { id: 1, camera_name: 'Camera 1' },
      ];

      render(
        <CameraModal
          isOpen={true}
          mode="add"
          existingCameras={existingCameras}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const idInput = screen.getByLabelText(/camera id/i);
      expect(idInput).toHaveValue('2');
    });
  });

  describe('Validation - Required fields', () => {
    it('should validate required fields (name, manufacturer, model)', async () => {
      const onSave = vi.fn();

      render(
        <CameraModal
          isOpen={true}
          mode="add"
          existingCameras={[]}
          onSave={onSave}
          onCancel={() => {}}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });

      // Save button should be disabled initially
      expect(saveButton).toBeDisabled();

      // Fill in camera_name only
      await user.type(screen.getByLabelText(/^camera name$/i), 'Test Camera');
      expect(saveButton).toBeDisabled();

      // Fill in manufacturer
      await user.type(screen.getByLabelText(/manufacturer/i), 'Test Manufacturer');
      expect(saveButton).toBeDisabled();

      // Fill in model
      await user.type(screen.getByLabelText(/model/i), 'Test Model');
      expect(saveButton).toBeDisabled();

      // Fill in meters_per_pixel (required field)
      await user.type(screen.getByLabelText(/meters per pixel/i), '0.001');

      // Now save button should be enabled
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('Validation - meters_per_pixel > 0', () => {
    it('should validate meters_per_pixel is greater than 0', async () => {
      const onSave = vi.fn();

      render(
        <CameraModal
          isOpen={true}
          mode="add"
          existingCameras={[]}
          onSave={onSave}
          onCancel={() => {}}
        />
      );

      // Fill required fields
      await user.type(screen.getByLabelText(/^camera name$/i), 'Test Camera');
      await user.type(screen.getByLabelText(/manufacturer/i), 'Test Manufacturer');
      await user.type(screen.getByLabelText(/model/i), 'Test Model');

      const metersPerPixelInput = screen.getByLabelText(/meters per pixel/i);

      // Try negative value
      await user.clear(metersPerPixelInput);
      await user.type(metersPerPixelInput, '-0.001');

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();

      // Try zero
      await user.clear(metersPerPixelInput);
      await user.type(metersPerPixelInput, '0');
      expect(saveButton).toBeDisabled();

      // Valid positive value
      await user.clear(metersPerPixelInput);
      await user.type(metersPerPixelInput, '0.001');

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('Validation - meters_per_pixel typical range warning', () => {
    it('should warn if meters_per_pixel outside typical range (0.0005-0.002)', async () => {
      render(
        <CameraModal
          isOpen={true}
          mode="add"
          existingCameras={[]}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const metersPerPixelInput = screen.getByLabelText(/meters per pixel/i);

      // Value below typical range
      await user.clear(metersPerPixelInput);
      await user.type(metersPerPixelInput, '0.0001');

      // Should show warning (look for the warning text specifically, not the help text)
      await waitFor(() => {
        expect(screen.getByText(/value outside typical range/i)).toBeInTheDocument();
      });

      // Value above typical range
      await user.clear(metersPerPixelInput);
      await user.type(metersPerPixelInput, '0.005');

      // Should show warning
      await waitFor(() => {
        expect(screen.getByText(/value outside typical range/i)).toBeInTheDocument();
      });

      // Value within typical range
      await user.clear(metersPerPixelInput);
      await user.type(metersPerPixelInput, '0.001');

      // Warning should disappear
      await waitFor(() => {
        expect(screen.queryByText(/value outside typical range/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Save button state', () => {
    it('should keep save button disabled until form is valid', async () => {
      render(
        <CameraModal
          isOpen={true}
          mode="add"
          existingCameras={[]}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();

      // Fill all required fields
      await user.type(screen.getByLabelText(/^camera name$/i), 'Test Camera');
      await user.type(screen.getByLabelText(/manufacturer/i), 'Test Manufacturer');
      await user.type(screen.getByLabelText(/model/i), 'Test Model');
      await user.type(screen.getByLabelText(/meters per pixel/i), '0.001');

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('Cancel functionality', () => {
    it('should close modal without saving changes when cancel is clicked', async () => {
      const onCancel = vi.fn();
      const onSave = vi.fn();

      render(
        <CameraModal
          isOpen={true}
          mode="add"
          existingCameras={[]}
          onSave={onSave}
          onCancel={onCancel}
        />
      );

      // Fill some fields
      await user.type(screen.getByLabelText(/^camera name$/i), 'Test Camera');

      // Click cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // onCancel should be called
      expect(onCancel).toHaveBeenCalledTimes(1);
      // onSave should NOT be called
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('Edit mode', () => {
    it('should pre-populate form with camera data in edit mode', () => {
      const cameraData = {
        id: 1,
        camera_name: 'Existing Camera',
        manufacturer: 'Manta',
        model: 'G-146B',
        lens: '16mm',
        meters_per_pixel: 0.000842,
      };

      render(
        <CameraModal
          isOpen={true}
          mode="edit"
          camera={cameraData}
          existingCameras={[cameraData]}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Check all fields are pre-populated
      expect(screen.getByLabelText(/camera id/i)).toHaveValue('1');
      expect(screen.getByLabelText(/^camera name$/i)).toHaveValue('Existing Camera');
      expect(screen.getByLabelText(/manufacturer/i)).toHaveValue('Manta');
      expect(screen.getByLabelText(/model/i)).toHaveValue('G-146B');
      expect(screen.getByLabelText(/lens/i)).toHaveValue('16mm');
      expect(screen.getByLabelText(/meters per pixel/i)).toHaveValue(0.000842);
    });
  });

  describe('Save functionality', () => {
    it('should handle create success state', async () => {
      const onSave = vi.fn();

      render(
        <CameraModal
          isOpen={true}
          mode="add"
          existingCameras={[]}
          onSave={onSave}
          onCancel={() => {}}
        />
      );

      // Fill all required fields
      await user.type(screen.getByLabelText(/^camera name$/i), 'New Camera');
      await user.type(screen.getByLabelText(/manufacturer/i), 'Manta');
      await user.type(screen.getByLabelText(/model/i), 'G-146B');
      await user.type(screen.getByLabelText(/lens/i), '16mm');
      await user.type(screen.getByLabelText(/meters per pixel/i), '0.000842');

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
      await user.click(saveButton);

      // onSave should be called with correct data
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({
        id: 0,
        camera_name: 'New Camera',
        manufacturer: 'Manta',
        model: 'G-146B',
        lens: '16mm',
        meters_per_pixel: 0.000842,
      });
    });
  });

  describe('Focus management', () => {
    it('should auto-focus first field when modal opens', async () => {
      render(
        <CameraModal
          isOpen={true}
          mode="add"
          existingCameras={[]}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Camera name should be focused (first editable field)
      await waitFor(() => {
        expect(screen.getByLabelText(/^camera name$/i)).toHaveFocus();
      });
    });

    it('should trap focus within modal - Tab at last element cycles to first', async () => {
      render(
        <CameraModal
          isOpen={true}
          mode="add"
          existingCameras={[]}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Fill required fields to enable Save button
      await user.type(screen.getByLabelText(/^camera name$/i), 'Test');
      await user.type(screen.getByLabelText(/manufacturer/i), 'Test');
      await user.type(screen.getByLabelText(/model/i), 'Test');
      await user.type(screen.getByLabelText(/meters per pixel/i), '0.001');

      // Wait for Save button to be enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
      });

      // Focus the last focusable element (Save button)
      const saveButton = screen.getByRole('button', { name: /save/i });
      saveButton.focus();
      expect(saveButton).toHaveFocus();

      // Press Tab - should cycle to first focusable element (Camera Name input)
      await user.tab();

      await waitFor(() => {
        expect(screen.getByLabelText(/^camera name$/i)).toHaveFocus();
      });
    });

    it('should trap focus within modal - Shift+Tab at first element cycles to last', async () => {
      render(
        <CameraModal
          isOpen={true}
          mode="add"
          existingCameras={[]}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Fill required fields to enable Save button
      await user.type(screen.getByLabelText(/^camera name$/i), 'Test');
      await user.type(screen.getByLabelText(/manufacturer/i), 'Test');
      await user.type(screen.getByLabelText(/model/i), 'Test');
      await user.type(screen.getByLabelText(/meters per pixel/i), '0.001');

      // Wait for Save button to be enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
      });

      // Explicitly focus first element (Camera Name input)
      const cameraNameInput = screen.getByLabelText(/^camera name$/i);
      cameraNameInput.focus();
      expect(cameraNameInput).toHaveFocus();

      // Press Shift+Tab - should cycle to last focusable element (Save button)
      await user.tab({ shift: true });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toHaveFocus();
      });
    });
  });
});
