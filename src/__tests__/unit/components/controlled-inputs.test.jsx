/**
 * @file Tests for controlled input behavior
 * @description Verifies that form components use controlled inputs properly
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InputElement from '../../../element/InputElement';
import DataListElement from '../../../element/DataListElement';
import SelectElement from '../../../element/SelectElement';
import ListElement from '../../../element/ListElement';

describe('Controlled Inputs', () => {
  describe('InputElement - Controlled Behavior', () => {
    it('should use controlled value prop instead of defaultValue', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <InputElement
          id="test-input"
          type="text"
          name="test"
          title="Test"
          value="initial"
          onChange={onChange}
        />
      );

      const input = screen.getByRole('textbox');
      expect(input.value).toBe('initial');

      // Update value prop
      rerender(
        <InputElement
          id="test-input"
          type="text"
          name="test"
          title="Test"
          value="updated"
          onChange={onChange}
        />
      );

      // Value should update without remounting
      expect(input.value).toBe('updated');
      expect(input).toBe(screen.getByRole('textbox')); // Same DOM node
    });

    it('should call onChange when user types', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <InputElement
          id="test-input"
          type="text"
          name="test"
          title="Test"
          value=""
          onChange={onChange}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'hello');

      expect(onChange).toHaveBeenCalledTimes(5); // One per character
    });

    it('should not remount when value changes (performance)', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <InputElement
          id="test-input"
          type="text"
          name="test"
          title="Test"
          value="first"
          onChange={onChange}
        />
      );

      const input = screen.getByRole('textbox');
      const originalNode = input;

      // Change value 10 times
      for (let i = 0; i < 10; i++) {
        rerender(
          <InputElement
            id="test-input"
            type="text"
            name="test"
            title="Test"
            value={`value-${i}`}
            onChange={onChange}
          />
        );
      }

      // Should be the exact same DOM node (not remounted)
      expect(screen.getByRole('textbox')).toBe(originalNode);
    });

    it('should work with number type inputs', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <InputElement
          id="test-number"
          type="number"
          name="weight"
          title="Weight"
          value="100"
          onChange={onChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      await user.clear(input);
      await user.type(input, '200');

      expect(onChange).toHaveBeenCalled();
    });

    it('should work with date type inputs', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <InputElement
          id="test-date"
          type="date"
          name="dob"
          title="Date of Birth"
          value="2023-01-01"
          onChange={onChange}
        />
      );

      const input = document.getElementById('test-date');
      expect(input.value).toBe('2023-01-01');

      rerender(
        <InputElement
          id="test-date"
          type="date"
          name="dob"
          title="Date of Birth"
          value="2023-12-31"
          onChange={onChange}
        />
      );

      expect(input.value).toBe('2023-12-31');
    });
  });

  describe('DataListElement - Controlled Behavior', () => {
    it('should use controlled value prop', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <DataListElement
          id="test-datalist"
          name="species"
          title="Species"
          dataItems={['Rat', 'Mouse', 'Human']}
          value="Rat"
          onChange={onChange}
        />
      );

      const input = screen.getByRole('combobox');
      expect(input.value).toBe('Rat');

      rerender(
        <DataListElement
          id="test-datalist"
          name="species"
          title="Species"
          dataItems={['Rat', 'Mouse', 'Human']}
          value="Mouse"
          onChange={onChange}
        />
      );

      expect(input.value).toBe('Mouse');
    });

    it('should not remount when value changes', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <DataListElement
          id="test-datalist"
          name="species"
          title="Species"
          dataItems={['Rat', 'Mouse']}
          value="Rat"
          onChange={onChange}
        />
      );

      const originalInput = screen.getByRole('combobox');

      rerender(
        <DataListElement
          id="test-datalist"
          name="species"
          title="Species"
          dataItems={['Rat', 'Mouse']}
          value="Mouse"
          onChange={onChange}
        />
      );

      expect(screen.getByRole('combobox')).toBe(originalInput);
    });
  });

  describe('SelectElement - Already Controlled (Verify)', () => {
    it('should use controlled value prop (existing behavior)', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <SelectElement
          id="test-select"
          name="device"
          title="Device Type"
          type="text"
          dataItems={['tetrode', 'probe']}
          value="tetrode"
          onChange={onChange}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select.value).toBe('tetrode');

      rerender(
        <SelectElement
          id="test-select"
          name="device"
          title="Device Type"
          type="text"
          dataItems={['tetrode', 'probe']}
          value="probe"
          onChange={onChange}
        />
      );

      expect(select.value).toBe('probe');
    });

    it('should not remount when value changes', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <SelectElement
          id="test-select"
          name="device"
          title="Device Type"
          type="text"
          dataItems={['a', 'b', 'c']}
          defaultValue="a"
          onChange={onChange}
        />
      );

      const originalSelect = screen.getByRole('combobox');

      for (let i = 0; i < 5; i++) {
        rerender(
          <SelectElement
            id="test-select"
            name="device"
            title="Device Type"
            type="text"
            dataItems={['a', 'b', 'c']}
            defaultValue={['a', 'b', 'c'][i % 3]}
            onChange={onChange}
          />
        );
      }

      expect(screen.getByRole('combobox')).toBe(originalSelect);
    });
  });

  describe('ListElement - Controlled Behavior', () => {
    it('should display current value from props', () => {
      const updateFormData = vi.fn();

      render(
        <ListElement
          id="test-list"
          name="experimenters"
          title="Experimenters"
          type="text"
          defaultValue={['Alice', 'Bob']}
          metaData={{}}
          updateFormData={updateFormData}
        />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('should update display when value prop changes', () => {
      const updateFormData = vi.fn();
      const { rerender } = render(
        <ListElement
          id="test-list"
          name="experimenters"
          title="Experimenters"
          type="text"
          defaultValue={['Alice']}
          metaData={{}}
          updateFormData={updateFormData}
        />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();

      rerender(
        <ListElement
          id="test-list"
          name="experimenters"
          title="Experimenters"
          type="text"
          defaultValue={['Alice', 'Bob', 'Carol']}
          metaData={{}}
          updateFormData={updateFormData}
        />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Carol')).toBeInTheDocument();
    });

    it('should have a properly labeled input field', () => {
      const updateFormData = vi.fn();

      render(
        <ListElement
          id="test-list"
          name="experimenters"
          title="Experimenters"
          type="text"
          defaultValue={[]}
          metaData={{}}
          updateFormData={updateFormData}
        />
      );

      // Input should be found by its label
      const input = screen.getByLabelText(/Experimenters/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('id');
      expect(input.id).toBeTruthy();
    });
  });

  describe('Performance - No Unnecessary Remounts', () => {
    it('should handle rapid value changes without remounting', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <InputElement
          id="perf-test"
          type="text"
          name="test"
          title="Test"
          value=""
          onChange={onChange}
        />
      );

      const originalInput = screen.getByRole('textbox');

      // Simulate 100 rapid value changes (like during YAML import)
      for (let i = 0; i < 100; i++) {
        rerender(
          <InputElement
            id="perf-test"
            type="text"
            name="test"
            title="Test"
            value={`value-${i}`}
            onChange={onChange}
          />
        );
      }

      // Should still be the same DOM node
      expect(screen.getByRole('textbox')).toBe(originalInput);
    });
  });
});
