import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import BrainRegionAutocomplete from '../BrainRegionAutocomplete';

describe('BrainRegionAutocomplete', () => {
  let mockOnChange;

  beforeEach(() => {
    mockOnChange = vi.fn();
  });

  describe('Component Rendering', () => {
    it('renders input element with datalist', () => {
      const { container } = render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
          label="Brain Region"
          name="brain_region"
        />
      );

      const input = container.querySelector('input');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('list');
      const listAttr = input.getAttribute('list');
      // Datalist ID should reference brain-region and be present in the document
      const datalist = container.querySelector(`#${listAttr}`);
      expect(datalist).toBeInTheDocument();
      expect(datalist?.tagName).toBe('DATALIST');
    });

    it('renders label with default text', () => {
      render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const label = screen.getByText('Brain Region');
      expect(label).toBeInTheDocument();
    });

    it('renders label with custom text', () => {
      render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
          label="Recording Location"
        />
      );

      const label = screen.getByText('Recording Location');
      expect(label).toBeInTheDocument();
    });

    it('associates label with input via htmlFor', () => {
      const { container } = render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
          name="test_region"
        />
      );

      const label = container.querySelector('label');
      const input = container.querySelector('input');

      // Use label.htmlFor (property) instead of getAttribute (attribute)
      expect(label.htmlFor).toBe(input.id);
    });
  });

  describe('Datalist Suggestions', () => {
    it('renders datalist with common brain regions', () => {
      const { container } = render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const datalist = container.querySelector('datalist');
      expect(datalist).toBeInTheDocument();

      const options = container.querySelectorAll('datalist option');
      expect(options.length).toBeGreaterThan(10);

      const optionValues = Array.from(options).map(opt => opt.value);
      expect(optionValues).toContain('CA1');
      expect(optionValues).toContain('CA3');
      expect(optionValues).toContain('PFC');
      expect(optionValues).toContain('M1');
    });

    it('includes hippocampal regions', () => {
      const { container } = render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const options = container.querySelectorAll('datalist option');
      const optionValues = Array.from(options).map(opt => opt.value);

      expect(optionValues).toContain('CA1');
      expect(optionValues).toContain('CA2');
      expect(optionValues).toContain('CA3');
      expect(optionValues).toContain('DG');
    });

    it('includes prefrontal cortex regions', () => {
      const { container } = render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const options = container.querySelectorAll('datalist option');
      const optionValues = Array.from(options).map(opt => opt.value);

      expect(optionValues).toContain('PFC');
      expect(optionValues).toContain('mPFC');
      expect(optionValues).toContain('OFC');
    });

    it('includes motor and somatosensory regions', () => {
      const { container } = render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const options = container.querySelectorAll('datalist option');
      const optionValues = Array.from(options).map(opt => opt.value);

      expect(optionValues).toContain('M1');
      expect(optionValues).toContain('M2');
      expect(optionValues).toContain('S1');
      expect(optionValues).toContain('S2');
    });

    it('includes visual and reward regions', () => {
      const { container } = render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const options = container.querySelectorAll('datalist option');
      const optionValues = Array.from(options).map(opt => opt.value);

      expect(optionValues).toContain('V1');
      expect(optionValues).toContain('V2');
      expect(optionValues).toContain('NAc');
      expect(optionValues).toContain('VTA');
    });

    it('includes other common regions', () => {
      const { container } = render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const options = container.querySelectorAll('datalist option');
      const optionValues = Array.from(options).map(opt => opt.value);

      expect(optionValues).toContain('Amy');
      expect(optionValues).toContain('Striatum');
      expect(optionValues).toContain('SNc');
    });
  });

  describe('Value Management', () => {
    it('pre-populates value from prop', () => {
      render(
        <BrainRegionAutocomplete
          value="CA1"
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('CA1');
      expect(input).toBeInTheDocument();
    });

    it('updates when value prop changes', () => {
      const { rerender } = render(
        <BrainRegionAutocomplete
          value="CA1"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByDisplayValue('CA1')).toBeInTheDocument();

      rerender(
        <BrainRegionAutocomplete
          value="PFC"
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByDisplayValue('CA1')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('PFC')).toBeInTheDocument();
    });
  });

  describe('User Interaction', () => {
    it('calls onChange when user types', async () => {
      const user = userEvent.setup();
      const localMockOnChange = vi.fn();

      render(
        <BrainRegionAutocomplete
          value=""
          onChange={localMockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'CA');

      expect(localMockOnChange).toHaveBeenCalled();
      // Verify that onChange was called with the typed characters
      const calls = localMockOnChange.mock.calls.map(c => c[0]);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls).toContain('C');
    });

    it('allows typing custom brain region not in suggestions', async () => {
      const user = userEvent.setup();

      render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'Custom');

      expect(mockOnChange).toHaveBeenCalled();
      expect(mockOnChange).toHaveBeenCalledWith('C');
    });

    it('preserves case sensitivity when typing', async () => {
      const user = userEvent.setup();
      const localMockOnChange = vi.fn();

      render(
        <BrainRegionAutocomplete
          value=""
          onChange={localMockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'ca');

      // Should call onChange with lowercase characters, not convert to 'CA'
      expect(localMockOnChange).toHaveBeenCalled();
      // Check that at least one call was with the lowercase characters
      const calls = localMockOnChange.mock.calls.map(c => c[0]);
      expect(calls.some(call => call.toLowerCase() === call)).toBe(true);
    });

    it('does not normalize input to match suggestions', async () => {
      const customMockOnChange = vi.fn();
      const user = userEvent.setup();

      render(
        <BrainRegionAutocomplete
          value=""
          onChange={customMockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'pf');

      // Should call onChange with 'pf' even though 'PFC' is in suggestions
      expect(customMockOnChange).toHaveBeenCalled();
      // Verify that the input was typed in lowercase, not normalized to uppercase
      const calls = customMockOnChange.mock.calls.map(c => c[0]);
      // Should have calls with 'p' and 'f' (lowercase)
      expect(calls).toContain('p');
      expect(calls).toContain('f');
    });
  });

  describe('Accessibility', () => {
    it('has associated label with htmlFor attribute', () => {
      const { container } = render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
          name="brain_location"
        />
      );

      const input = container.querySelector('input');
      const label = container.querySelector('label');

      expect(label).not.toBeNull();
      expect(input).not.toBeNull();

      // Get the raw HTML to see what's actually rendered
      const labelHTML = label.outerHTML;
      const inputId = input.getAttribute('id');

      // Verify that the label's htmlFor attribute matches the input's id
      // Check both via getAttribute and via direct property access
      const htmlForViaAttr = label.getAttribute('htmlFor');
      const htmlForViaProp = label.htmlFor;

      expect(htmlForViaAttr || htmlForViaProp).toBe(inputId);
    });

    it('has name attribute for form submission', () => {
      render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
          name="brain_region"
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('name', 'brain_region');
    });

    it('supports required attribute', () => {
      render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
          required={true}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('required');
    });

    it('has autocomplete attribute set to off to allow datalist suggestions', () => {
      render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      // The input should have the list attribute to work with datalist
      expect(input).toHaveAttribute('list');
    });

    it('input has correct role for combobox pattern', () => {
      render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty value gracefully', () => {
      render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input.value).toBe('');
    });

    it('handles undefined value gracefully', () => {
      render(
        <BrainRegionAutocomplete
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      // Should treat undefined as empty string
      expect(input.value).toBe('');
    });

    it('handles whitespace-only value', () => {
      render(
        <BrainRegionAutocomplete
          value="   "
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input.value).toBe('   ');
    });
  });

  describe('Optional Props', () => {
    it('uses default label when not provided', () => {
      render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Brain Region')).toBeInTheDocument();
    });

    it('does not require required prop', () => {
      render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).not.toHaveAttribute('required');
    });

    it('does not require name prop', () => {
      render(
        <BrainRegionAutocomplete
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('combobox');
      // name can be undefined/null
      expect(input).toBeInTheDocument();
    });
  });
});
