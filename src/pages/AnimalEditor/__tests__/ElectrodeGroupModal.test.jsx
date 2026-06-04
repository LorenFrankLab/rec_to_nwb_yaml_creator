/**
 * @vitest-environment jsdom
 */

import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ElectrodeGroupModal from '../ElectrodeGroupModal';
import { deviceTypes } from '../../../valueList';

/**
 * Tests for ElectrodeGroupModal component.
 *
 * Modal dialog for CRUD operations on electrode groups. Supports add/edit modes
 * with form validation and accessibility. The saved group carries the
 * schema-required `description` and `targeted_location`, uses canonical region
 * entry for `location` / `targeted_location`, and emits NO stray `bad_channels`
 * string (bad channels are managed per-ntrode in the Channel Map editor).
 */

/**
 * Fill every required field with valid values for a tetrode group.
 *
 * @param {object} user - userEvent instance.
 * @param {object} [overrides] - Optional field overrides.
 * @returns {Promise<void>}
 */
async function fillRequiredFields(user, overrides = {}) {
  const values = {
    device_type: 'tetrode_12.5',
    location: 'CA1',
    description: 'CA1 tetrode',
    targeted_location: 'CA1',
    targeted_x: '1.0',
    targeted_y: '2.0',
    targeted_z: '3.0',
    units: 'mm',
    ...overrides,
  };

  // userEvent.type throws on an empty string, so only type non-empty values;
  // a skipped field stays at its empty initial state (the "missing field" case).
  const typeIfPresent = async (el, text) => {
    if (text !== '') await user.type(el, text);
  };

  await user.selectOptions(screen.getByLabelText(/device type/i), values.device_type);
  await typeIfPresent(screen.getByLabelText('Location'), values.location);
  await typeIfPresent(screen.getByLabelText(/description/i), values.description);
  await typeIfPresent(screen.getByLabelText('Targeted Location'), values.targeted_location);
  await typeIfPresent(screen.getByLabelText(/ap|anterior[- ]?posterior/i), values.targeted_x);
  await typeIfPresent(screen.getByLabelText(/ml|medial[- ]?lateral/i), values.targeted_y);
  await typeIfPresent(screen.getByLabelText(/dv|dorsal[- ]?ventral/i), values.targeted_z);
  await user.selectOptions(screen.getByLabelText(/units/i), values.units);
}

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
        <ElectrodeGroupModal isOpen={false} mode="add" onSave={() => {}} onCancel={() => {}} />
      );
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      const { container } = render(
        <ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />
      );
      expect(container.querySelector('[role="dialog"]')).toBeInTheDocument();
    });

    it('should render all form fields including description and targeted_location', () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);

      expect(screen.getByLabelText(/device type/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Location')).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Targeted Location')).toBeInTheDocument();
      expect(screen.getByLabelText(/ap|anterior[- ]?posterior/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/ml|medial[- ]?lateral/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/dv|dorsal[- ]?ventral/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/units/i)).toBeInTheDocument();
    });

    it('does not render a group-level Bad Channels field (managed per ntrode)', () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      expect(screen.queryByLabelText(/bad channels/i)).not.toBeInTheDocument();
    });

    it('should render Save and Cancel buttons', () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Modal title', () => {
    it('should show "Add Electrode Group" in add mode', () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      expect(screen.getByText(/add electrode group/i)).toBeInTheDocument();
    });

    it('should show "Edit Electrode Group" in edit mode', () => {
      const group = {
        id: 0, device_type: 'tetrode_12.5', location: 'CA1', description: 'CA1 tetrode',
        targeted_location: 'CA1', targeted_x: 1.0, targeted_y: 2.0, targeted_z: 3.0, units: 'mm',
      };
      render(<ElectrodeGroupModal isOpen mode="edit" group={group} onSave={() => {}} onCancel={() => {}} />);
      expect(screen.getByText(/edit electrode group/i)).toBeInTheDocument();
    });
  });

  describe('Pre-population in edit mode', () => {
    it('should populate form fields from group prop in edit mode', () => {
      const group = {
        id: 0, device_type: 'tetrode_12.5', location: 'CA1', description: 'CA1 tetrode',
        targeted_location: 'CA3', targeted_x: 1.0, targeted_y: 2.0, targeted_z: 3.0, units: 'mm',
      };
      render(<ElectrodeGroupModal isOpen mode="edit" group={group} onSave={() => {}} onCancel={() => {}} />);

      expect(screen.getByDisplayValue('tetrode_12.5')).toBeInTheDocument();
      expect(screen.getByLabelText('Location')).toHaveValue('CA1');
      expect(screen.getByLabelText(/description/i)).toHaveValue('CA1 tetrode');
      expect(screen.getByLabelText('Targeted Location')).toHaveValue('CA3');
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3')).toBeInTheDocument();
      expect(screen.getByDisplayValue('mm')).toBeInTheDocument();
    });

    it('should render with empty values in add mode', () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      expect(screen.getByLabelText(/device type/i)).toHaveValue('');
    });
  });

  describe('Form validation', () => {
    it('should disable Save button when device_type is empty', () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('should disable Save button when description is empty', async () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      await fillRequiredFields(user, { description: '' });
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('should disable Save button when targeted_location is empty', async () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      await fillRequiredFields(user, { targeted_location: '' });
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('should disable Save button when coordinates are empty', async () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      await fillRequiredFields(user, { targeted_x: '' });
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('should disable Save button when a coordinate is non-finite', async () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      await fillRequiredFields(user);

      fireEvent.change(screen.getByLabelText(/ap|anterior[- ]?posterior/i), {
        target: { value: 'NaN' },
      });

      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('should enable Save button when all required fields are filled', async () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      await fillRequiredFields(user);
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
    });

    it('shows a hint explaining the disabled Save, and removes it once valid', async () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);

      // Incomplete form: a hint names what's missing instead of a silent disabled button.
      expect(screen.getByText(/fill in all required fields/i)).toBeInTheDocument();

      await fillRequiredFields(user);

      // Once valid, the hint disappears and Save is enabled.
      expect(screen.queryByText(/fill in all required fields/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
    });
  });

  describe('Region fields use controlled / canonical entry', () => {
    it('cannot save a whitespace-only location', async () => {
      const onSave = vi.fn();
      render(<ElectrodeGroupModal isOpen mode="add" onSave={onSave} onCancel={() => {}} />);
      await fillRequiredFields(user, { location: '   ' });
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('cannot save a whitespace-only targeted_location', async () => {
      const onSave = vi.fn();
      render(<ElectrodeGroupModal isOpen mode="add" onSave={onSave} onCancel={() => {}} />);
      await fillRequiredFields(user, { targeted_location: '   ' });
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('offers known brain regions as autocomplete suggestions for both region fields', () => {
      const { container } = render(
        <ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />
      );

      for (const field of ['Location', 'Targeted Location']) {
        const datalistId = screen.getByLabelText(field).getAttribute('list');
        const datalist = container.querySelector(`#${datalistId}`);
        const options = Array.from(datalist.querySelectorAll('option')).map((o) => o.value);
        expect(options).toContain('CA1');
        expect(options).toContain('PFC');
      }
    });

    it('snaps a case-only variant of a known region to the canonical value on save', async () => {
      const onSave = vi.fn();
      render(<ElectrodeGroupModal isOpen mode="add" onSave={onSave} onCancel={() => {}} />);

      // Type 'ca1' (lower-case) where the canonical known region is 'CA1'.
      await fillRequiredFields(user, { location: 'ca1', targeted_location: 'ca1' });
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ location: 'CA1', targeted_location: 'CA1' })
      );
    });

    it('allows a novel "other" region not in the known list', async () => {
      const onSave = vi.fn();
      render(<ElectrodeGroupModal isOpen mode="add" onSave={onSave} onCancel={() => {}} />);

      await fillRequiredFields(user, { location: 'Subiculum-tail', targeted_location: 'Subiculum-tail' });
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ location: 'Subiculum-tail', targeted_location: 'Subiculum-tail' })
      );
    });
  });

  describe('Save button behavior', () => {
    it('calls onSave with the schema-shaped group (description + targeted_location, no bad_channels)', async () => {
      const onSave = vi.fn();
      render(<ElectrodeGroupModal isOpen mode="add" onSave={onSave} onCancel={() => {}} />);

      await fillRequiredFields(user, {
        description: 'Dorsal CA1 tetrode',
        targeted_location: 'CA1',
        targeted_x: '1.5',
        targeted_y: '2.5',
        targeted_z: '3.5',
        units: 'μm',
      });
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(onSave).toHaveBeenCalledWith({
        device_type: 'tetrode_12.5',
        location: 'CA1',
        description: 'Dorsal CA1 tetrode',
        targeted_location: 'CA1',
        targeted_x: 1.5,
        targeted_y: 2.5,
        targeted_z: 3.5,
        units: 'μm',
        count: 1,
      });
      expect(onSave.mock.calls[0][0]).not.toHaveProperty('bad_channels');
    });

    it('emits numeric coordinates even when typed as strings', async () => {
      const onSave = vi.fn();
      render(<ElectrodeGroupModal isOpen mode="add" onSave={onSave} onCancel={() => {}} />);

      await fillRequiredFields(user, { device_type: 'A1x32-6mm-50-177-H32_21mm', location: 'M1', targeted_location: 'M1' });
      await user.click(screen.getByRole('button', { name: /save/i }));

      const callArgs = onSave.mock.calls[0][0];
      expect(typeof callArgs.targeted_x).toBe('number');
      expect(typeof callArgs.targeted_y).toBe('number');
      expect(typeof callArgs.targeted_z).toBe('number');
    });

    it('accepts decimal and negative coordinates', async () => {
      const onSave = vi.fn();
      render(<ElectrodeGroupModal isOpen mode="add" onSave={onSave} onCancel={() => {}} />);

      await fillRequiredFields(user, { targeted_x: '0.123', targeted_y: '-1.456', targeted_z: '2.789' });
      await user.click(screen.getByRole('button', { name: /save/i }));

      const callArgs = onSave.mock.calls[0][0];
      expect(callArgs.targeted_x).toBe(0.123);
      expect(callArgs.targeted_y).toBe(-1.456);
      expect(callArgs.targeted_z).toBe(2.789);
    });
  });

  describe('Cancel button behavior', () => {
    it('should call onCancel when Cancel button is clicked', async () => {
      const onCancel = vi.fn();
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={onCancel} />);
      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('ESC key handling', () => {
    it('should call onCancel when ESC key is pressed', async () => {
      const onCancel = vi.fn();
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={onCancel} />);
      await user.keyboard('{Escape}');
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Backdrop click handling', () => {
    it('should call onCancel when backdrop is clicked', async () => {
      const onCancel = vi.fn();
      const { container } = render(
        <ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={onCancel} />
      );
      await user.click(container.querySelector('.modal-overlay'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should not call onCancel when modal content is clicked', async () => {
      const onCancel = vi.fn();
      const { container } = render(
        <ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={onCancel} />
      );
      await user.click(container.querySelector('.electrode-group-modal-content'));
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('Device type options', () => {
    it('sources device types from the single canonical list (no hardcoded copy)', () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      const optionValues = Array.from(screen.getByLabelText(/device type/i).options)
        .map((opt) => opt.value)
        .filter((v) => v !== '');
      expect(optionValues).toEqual(deviceTypes());
      expect(optionValues).toContain('128c-4s8mm6cm-15um-26um-sl');
    });
  });

  describe('Units dropdown', () => {
    it('should provide mm and μm options for units', () => {
      render(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      const options = Array.from(screen.getByLabelText(/units/i).options).map((opt) => opt.value);
      expect(options).toContain('mm');
      expect(options).toContain('μm');
    });
  });

  describe('Accessibility', () => {
    it('should have role="dialog"', () => {
      const { container } = render(
        <ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />
      );
      expect(container.querySelector('[role="dialog"]')).toBeInTheDocument();
    });

    it('should have aria-modal="true"', () => {
      const { container } = render(
        <ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />
      );
      expect(container.querySelector('[aria-modal="true"]')).toBeInTheDocument();
    });

    it('should focus the first input field when modal opens', async () => {
      const { rerender } = render(
        <ElectrodeGroupModal isOpen={false} mode="add" onSave={() => {}} onCancel={() => {}} />
      );
      rerender(<ElectrodeGroupModal isOpen mode="add" onSave={() => {}} onCancel={() => {}} />);
      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByLabelText(/device type/i));
      });
    });

    it('returns focus to the trigger when closed via ESC', async () => {
      /**
       * @returns {JSX.Element} Harness with a focusable trigger.
       */
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>Open modal</button>
            <ElectrodeGroupModal
              isOpen={open}
              mode="add"
              onSave={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          </>
        );
      }
      render(<Harness />);
      const trigger = screen.getByRole('button', { name: /open modal/i });
      trigger.focus();
      await user.click(trigger);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(trigger).toHaveFocus());
    });
  });
});
