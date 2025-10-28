/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ElectrodeGroupModal from '../ElectrodeGroupModal';

/**
 * Tests for ElectrodeGroupModal component (M7.2.2)
 *
 * Modal dialog for CRUD operations on electrode groups.
 * Supports add/edit modes with form validation and accessibility.
 */

describe('ElectrodeGroupModal', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should not render modal when isOpen is false', () => {
      const { container } = render(
        <ElectrodeGroupModal
          isOpen={false}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      const { container } = render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(container.querySelector('[role="dialog"]')).toBeInTheDocument();
    });

    it('should render all form fields', () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByLabelText(/device type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/ap|anterior[- ]?posterior/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/ml|medial[- ]?lateral/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/dv|dorsal[- ]?ventral/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/units/i)).toBeInTheDocument();
    });

    it('should render Save and Cancel buttons', () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Modal title', () => {
    it('should show "Add Electrode Group" in add mode', () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByText(/add electrode group/i)).toBeInTheDocument();
    });

    it('should show "Edit Electrode Group" in edit mode', () => {
      const group = {
        id: 'eg1',
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm',
      };

      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="edit"
          group={group}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByText(/edit electrode group/i)).toBeInTheDocument();
    });
  });

  describe('Pre-population in edit mode', () => {
    it('should populate form fields from group prop in edit mode', () => {
      const group = {
        id: 'eg1',
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm',
      };

      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="edit"
          group={group}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByDisplayValue('tetrode_12.5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CA1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3')).toBeInTheDocument();
      expect(screen.getByDisplayValue('mm')).toBeInTheDocument();
    });

    it('should not require initial values for pre-population', () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Should render with empty values
      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      expect(deviceTypeSelect.value).toBe('');
    });
  });

  describe('Form validation', () => {
    it('should disable Save button when device_type is empty', async () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should disable Save button when location is empty', async () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Fill device_type
      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      // Leave location empty - Save should still be disabled
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should disable Save button when coordinates are empty', async () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      const locationInput = screen.getByLabelText(/location/i);
      await user.type(locationInput, 'CA1');

      // Leave coordinates empty - Save should still be disabled
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable Save button when all required fields are filled', async () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      const locationInput = screen.getByLabelText(/location/i);
      const apInput = screen.getByLabelText(/ap|anterior[- ]?posterior/i);
      const mlInput = screen.getByLabelText(/ml|medial[- ]?lateral/i);
      const dvInput = screen.getByLabelText(/dv|dorsal[- ]?ventral/i);
      const unitsSelect = screen.getByLabelText(/units/i);

      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');
      await user.type(locationInput, 'CA1');
      await user.type(apInput, '1.0');
      await user.type(mlInput, '2.0');
      await user.type(dvInput, '3.0');
      await user.selectOptions(unitsSelect, 'mm');

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should disable Save if coordinates become empty after being filled', async () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      const locationInput = screen.getByLabelText(/location/i);
      const apInput = screen.getByLabelText(/ap|anterior[- ]?posterior/i);
      const mlInput = screen.getByLabelText(/ml|medial[- ]?lateral/i);
      const dvInput = screen.getByLabelText(/dv|dorsal[- ]?ventral/i);
      const unitsSelect = screen.getByLabelText(/units/i);

      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');
      await user.type(locationInput, 'CA1');
      await user.type(apInput, '1.0');
      await user.type(mlInput, '2.0');
      await user.type(dvInput, '3.0');
      await user.selectOptions(unitsSelect, 'mm');

      // Clear AP coordinate
      await user.clear(apInput);

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Save button behavior', () => {
    it('should call onSave with form data when Save is clicked', async () => {
      const onSave = vi.fn();
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={onSave}
          onCancel={() => {}}
        />
      );

      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      const locationInput = screen.getByLabelText(/location/i);
      const apInput = screen.getByLabelText(/ap|anterior[- ]?posterior/i);
      const mlInput = screen.getByLabelText(/ml|medial[- ]?lateral/i);
      const dvInput = screen.getByLabelText(/dv|dorsal[- ]?ventral/i);
      const unitsSelect = screen.getByLabelText(/units/i);

      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');
      await user.type(locationInput, 'CA1');
      await user.type(apInput, '1.5');
      await user.type(mlInput, '2.5');
      await user.type(dvInput, '3.5');
      await user.selectOptions(unitsSelect, 'μm');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(onSave).toHaveBeenCalledWith({
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_x: 1.5,
        targeted_y: 2.5,
        targeted_z: 3.5,
        units: 'μm',
        bad_channels: '',
      });
    });

    it('should call onSave with numeric coordinates even when typed as strings', async () => {
      const onSave = vi.fn();
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={onSave}
          onCancel={() => {}}
        />
      );

      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      const locationInput = screen.getByLabelText(/location/i);
      const apInput = screen.getByLabelText(/ap|anterior[- ]?posterior/i);
      const mlInput = screen.getByLabelText(/ml|medial[- ]?lateral/i);
      const dvInput = screen.getByLabelText(/dv|dorsal[- ]?ventral/i);
      const unitsSelect = screen.getByLabelText(/units/i);

      await user.selectOptions(deviceTypeSelect, 'A1x32-6mm-50-177-H32_21mm');
      await user.type(locationInput, 'M1');
      await user.type(apInput, '0.5');
      await user.type(mlInput, '1.5');
      await user.type(dvInput, '2.5');
      await user.selectOptions(unitsSelect, 'mm');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      const callArgs = onSave.mock.calls[0][0];
      expect(typeof callArgs.targeted_x).toBe('number');
      expect(typeof callArgs.targeted_y).toBe('number');
      expect(typeof callArgs.targeted_z).toBe('number');
    });
  });

  describe('Cancel button behavior', () => {
    it('should call onCancel when Cancel button is clicked', async () => {
      const onCancel = vi.fn();
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should not call onSave when Cancel is clicked', async () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={onSave}
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onSave).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('ESC key handling', () => {
    it('should call onCancel when ESC key is pressed', async () => {
      const onCancel = vi.fn();
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={onCancel}
        />
      );

      await user.keyboard('{Escape}');

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Backdrop click handling', () => {
    it('should call onCancel when backdrop is clicked', async () => {
      const onCancel = vi.fn();
      const { container } = render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={onCancel}
        />
      );

      const backdrop = container.querySelector('.electrode-group-modal-overlay');
      await user.click(backdrop);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should not call onCancel when modal content is clicked', async () => {
      const onCancel = vi.fn();
      const { container } = render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={onCancel}
        />
      );

      const content = container.querySelector('.electrode-group-modal-content');
      await user.click(content);

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('Focus management', () => {
    it('should focus the first input field when modal opens', async () => {
      const { rerender } = render(
        <ElectrodeGroupModal
          isOpen={false}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      rerender(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      await waitFor(() => {
        const deviceTypeSelect = screen.getByLabelText(/device type/i);
        expect(document.activeElement).toBe(deviceTypeSelect);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have role="dialog" for accessibility', () => {
      const { container } = render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(container.querySelector('[role="dialog"]')).toBeInTheDocument();
    });

    it('should have aria-modal="true"', () => {
      const { container } = render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(container.querySelector('[aria-modal="true"]')).toBeInTheDocument();
    });

    it('should have aria-labelledby pointing to title', () => {
      const { container } = render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy)).toBeInTheDocument();
    });

    it('should have proper labels for all form fields', () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByLabelText(/device type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/ap|anterior[- ]?posterior/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/ml|medial[- ]?lateral/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/dv|dorsal[- ]?ventral/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/units/i)).toBeInTheDocument();
    });

    it('should have Cancel button with aria-label', () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toHaveAttribute('aria-label');
    });
  });

  describe('Location field - BrainRegionAutocomplete integration', () => {
    it('should use BrainRegionAutocomplete component for location field', () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const input = screen.getByLabelText(/location/i);
      expect(input).toHaveAttribute('list', expect.stringContaining('brain-region'));
    });

    it('should provide autocomplete suggestions for brain regions', () => {
      const { container } = render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const datalistId = screen.getByLabelText(/location/i).getAttribute('list');
      const datalist = container.querySelector(`#${datalistId}`);
      expect(datalist).toBeInTheDocument();

      // Check for some common brain regions
      const options = Array.from(datalist.querySelectorAll('option')).map((opt) => opt.value);
      expect(options).toContain('CA1');
      expect(options).toContain('M1');
      expect(options).toContain('PFC');
    });
  });

  describe('Device type options', () => {
    it('should include common device types in dropdown', () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      const options = Array.from(deviceTypeSelect.options).map((opt) => opt.value);

      expect(options).toContain('tetrode_12.5');
      expect(options).toContain('A1x32-6mm-50-177-H32_21mm');
      expect(options).toContain('128c-4s8mm6cm-20um-40um-sl');
    });
  });

  describe('Units dropdown', () => {
    it('should provide mm and μm options for units', () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const unitsSelect = screen.getByLabelText(/units/i);
      const options = Array.from(unitsSelect.options).map((opt) => opt.value);

      expect(options).toContain('mm');
      expect(options).toContain('μm');
    });
  });

  describe('Body scroll lock', () => {
    it('should lock body scroll when modal opens', () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when modal closes', () => {
      const { unmount } = render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Numeric input handling', () => {
    it('should accept decimal coordinates', async () => {
      const onSave = vi.fn();
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={onSave}
          onCancel={() => {}}
        />
      );

      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      const locationInput = screen.getByLabelText(/location/i);
      const apInput = screen.getByLabelText(/ap|anterior[- ]?posterior/i);
      const mlInput = screen.getByLabelText(/ml|medial[- ]?lateral/i);
      const dvInput = screen.getByLabelText(/dv|dorsal[- ]?ventral/i);
      const unitsSelect = screen.getByLabelText(/units/i);

      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');
      await user.type(locationInput, 'CA1');
      await user.type(apInput, '0.123');
      await user.type(mlInput, '1.456');
      await user.type(dvInput, '2.789');
      await user.selectOptions(unitsSelect, 'mm');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      const callArgs = onSave.mock.calls[0][0];
      expect(callArgs.targeted_x).toBe(0.123);
      expect(callArgs.targeted_y).toBe(1.456);
      expect(callArgs.targeted_z).toBe(2.789);
    });

    it('should accept negative coordinates', async () => {
      const onSave = vi.fn();
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={onSave}
          onCancel={() => {}}
        />
      );

      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      const locationInput = screen.getByLabelText(/location/i);
      const apInput = screen.getByLabelText(/ap|anterior[- ]?posterior/i);
      const mlInput = screen.getByLabelText(/ml|medial[- ]?lateral/i);
      const dvInput = screen.getByLabelText(/dv|dorsal[- ]?ventral/i);
      const unitsSelect = screen.getByLabelText(/units/i);

      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');
      await user.type(locationInput, 'CA1');
      await user.type(apInput, '-1.0');
      await user.type(mlInput, '-2.0');
      await user.type(dvInput, '-3.0');
      await user.selectOptions(unitsSelect, 'mm');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      const callArgs = onSave.mock.calls[0][0];
      expect(callArgs.targeted_x).toBe(-1.0);
      expect(callArgs.targeted_y).toBe(-2.0);
      expect(callArgs.targeted_z).toBe(-3.0);
    });
  });

  describe('Bad channels field', () => {
    it('should render bad_channels input field', () => {
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByLabelText(/bad channels/i)).toBeInTheDocument();
    });

    it('should pre-populate bad_channels in edit mode', () => {
      const group = {
        id: 'eg1',
        device_type: 'tetrode_12.5',
        location: 'CA1',
        targeted_x: 1.0,
        targeted_y: 2.0,
        targeted_z: 3.0,
        units: 'mm',
        bad_channels: '0,1,3',
      };

      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="edit"
          group={group}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByDisplayValue('0,1,3')).toBeInTheDocument();
    });

    it('should save bad_channels with form data', async () => {
      const onSave = vi.fn();
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={onSave}
          onCancel={() => {}}
        />
      );

      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      const locationInput = screen.getByLabelText(/location/i);
      const apInput = screen.getByLabelText(/ap|anterior[- ]?posterior/i);
      const mlInput = screen.getByLabelText(/ml|medial[- ]?lateral/i);
      const dvInput = screen.getByLabelText(/dv|dorsal[- ]?ventral/i);
      const badChannelsInput = screen.getByLabelText(/bad channels/i);

      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');
      await user.type(locationInput, 'CA1');
      await user.type(apInput, '1.0');
      await user.type(mlInput, '2.0');
      await user.type(dvInput, '3.0');
      await user.type(badChannelsInput, '0,2');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          bad_channels: '0,2',
        })
      );
    });

    it('should allow empty bad_channels (optional field)', async () => {
      const onSave = vi.fn();
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={onSave}
          onCancel={() => {}}
        />
      );

      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      const locationInput = screen.getByLabelText(/location/i);
      const apInput = screen.getByLabelText(/ap|anterior[- ]?posterior/i);
      const mlInput = screen.getByLabelText(/ml|medial[- ]?lateral/i);
      const dvInput = screen.getByLabelText(/dv|dorsal[- ]?ventral/i);

      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');
      await user.type(locationInput, 'CA1');
      await user.type(apInput, '1.0');
      await user.type(mlInput, '2.0');
      await user.type(dvInput, '3.0');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          bad_channels: '',
        })
      );
    });

    it('should handle bad_channels with spaces in comma-separated list', async () => {
      const onSave = vi.fn();
      render(
        <ElectrodeGroupModal
          isOpen={true}
          mode="add"
          onSave={onSave}
          onCancel={() => {}}
        />
      );

      const deviceTypeSelect = screen.getByLabelText(/device type/i);
      const locationInput = screen.getByLabelText(/location/i);
      const apInput = screen.getByLabelText(/ap|anterior[- ]?posterior/i);
      const mlInput = screen.getByLabelText(/ml|medial[- ]?lateral/i);
      const dvInput = screen.getByLabelText(/dv|dorsal[- ]?ventral/i);
      const badChannelsInput = screen.getByLabelText(/bad channels/i);

      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');
      await user.type(locationInput, 'CA1');
      await user.type(apInput, '1.0');
      await user.type(mlInput, '2.0');
      await user.type(dvInput, '3.0');
      await user.type(badChannelsInput, '0, 1, 3');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          bad_channels: '0, 1, 3',
        })
      );
    });
  });
});
