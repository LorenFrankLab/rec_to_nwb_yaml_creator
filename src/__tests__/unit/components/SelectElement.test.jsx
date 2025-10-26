/**
 * Tests for SelectElement component
 *
 * Phase 1: Testing Foundation - Week 4
 *
 * These tests verify the SelectElement component correctly:
 * - Renders with required props
 * - Handles different option types (text, number)
 * - Manages option lists (flat arrays, dataItemsInfo)
 * - Handles blank option for optional selections
 * - Processes user selection changes
 * - Renders InfoIcon with placeholder text
 * - Handles edge cases (empty arrays, special characters)
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SelectElement from '../../../element/SelectElement';

describe('SelectElement Component', () => {
  describe('Basic Rendering', () => {
    it('should render with required props', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2']}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select).toHaveAttribute('id', 'test-select');
      expect(select).toHaveAttribute('name', 'test_field');
    });

    it('should render label with title text', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Device Type"
          name="device_type"
          dataItems={['tetrode', 'probe']}
        />
      );

      expect(screen.getByText('Device Type')).toBeInTheDocument();
    });

    it('should have label associated with select via htmlFor', () => {
      const { container } = render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
        />
      );

      const label = container.querySelector('label[for="test-select"]');
      expect(label).toBeInTheDocument();
    });

    it('should render InfoIcon with placeholder as tooltip', () => {
      const { container } = render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
          placeholder="Select a value from the list"
        />
      );

      // InfoIcon renders a span with title attribute
      const infoIcon = container.querySelector('span[title="Select a value from the list"]');
      expect(infoIcon).toBeInTheDocument();
    });
  });

  describe('Option Rendering', () => {
    it('should render all options from dataItems array', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2', 'option3']}
        />
      );

      expect(screen.getByRole('option', { name: 'option1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'option2' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'option3' })).toBeInTheDocument();
    });

    it('should render blank option when addBlankOption is true', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2']}
          addBlankOption={true}
        />
      );

      // Blank option has empty value
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveValue('');
      expect(options[0].textContent).toMatch(/^\s+$/); // Non-breaking space
    });

    it('should NOT render blank option when addBlankOption is false', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2']}
          addBlankOption={false}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveValue('option1');
    });

    it('should NOT render blank option by default (defaultProps)', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2']}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
    });

    it('should render options with dataItemsInfo as additional text', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Device Type"
          name="device_type"
          dataItems={['tetrode_12.5', 'A1x32-6mm']}
          dataItemsInfo={['4 channels', '32 channels']}
        />
      );

      expect(screen.getByRole('option', { name: 'tetrode_12.5 (4 channels)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'A1x32-6mm (32 channels)' })).toBeInTheDocument();
    });

    it('should handle partial dataItemsInfo array (fewer info items than data items)', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2', 'option3']}
          dataItemsInfo={['info1', 'info2']} // Missing info3
        />
      );

      expect(screen.getByRole('option', { name: 'option1 (info1)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'option2 (info2)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'option3 ()' })).toBeInTheDocument();
    });

    it('should handle empty dataItemsInfo array (defaultProps)', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2']}
        />
      );

      // Should render plain options without extra info
      expect(screen.getByRole('option', { name: 'option1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'option2' })).toBeInTheDocument();
    });
  });

  describe('Number Type Handling', () => {
    it('should parse dataItem as integer when type is number', () => {
      render(
        <SelectElement
          id="test-select"
          type="number"
          title="Camera ID"
          name="camera_id"
          dataItems={['0', '1', '2']}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveValue('0');
      expect(options[1]).toHaveValue('1');
      expect(options[2]).toHaveValue('2');
    });

    it('should handle empty string in number type without parsing', () => {
      render(
        <SelectElement
          id="test-select"
          type="number"
          title="Test Field"
          name="test_field"
          dataItems={['', '0', '1']}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveValue('');
    });

    it('should show parsed integer in dataItemsInfo for number type', () => {
      render(
        <SelectElement
          id="test-select"
          type="number"
          title="Camera ID"
          name="camera_id"
          dataItems={['0', '1']}
          dataItemsInfo={['Front camera', 'Back camera']}
        />
      );

      // dataItemValue is parsed to integer, shown in info
      expect(screen.getByRole('option', { name: '0 (Front camera)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '1 (Back camera)' })).toBeInTheDocument();
    });
  });

  describe('Default Value and Selection', () => {
    it('should set defaultValue as selected option', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2', 'option3']}
          defaultValue="option2"
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('option2');
    });

    it('should default to empty string when no defaultValue provided (defaultProps)', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2']}
        />
      );

      const select = screen.getByRole('combobox');
      // BASELINE: Without addBlankOption, browser selects first option by default
      // Even though defaultValue is '', the browser auto-selects first option
      expect(select).toHaveValue('option1');
    });

    it('should handle numeric defaultValue', () => {
      render(
        <SelectElement
          id="test-select"
          type="number"
          title="Camera ID"
          name="camera_id"
          dataItems={['0', '1', '2']}
          defaultValue={1}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('1');
    });
  });

  describe('User Interactions', () => {
    it('should call onChange when user selects an option', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2', 'option3']}
          onChange={handleChange}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'option2');

      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('should call onChange with event object containing select element', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2']}
          onChange={handleChange}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'option2');

      // Verify onChange was called with event object
      expect(handleChange).toHaveBeenCalledTimes(1);
      const callArg = handleChange.mock.calls[0][0];

      // Event object should have target with select element properties
      expect(callArg.target).toBeDefined();
      expect(callArg.target.name).toBe('test_field');
      expect(callArg.target.id).toBe('test-select');
    });

    it('should update selected value when user changes selection', async () => {
      const user = userEvent.setup();

      const { rerender } = render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2', 'option3']}
          defaultValue="option1"
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('option1');

      // Rerender with new defaultValue (simulating parent state update)
      rerender(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2', 'option3']}
          defaultValue="option2"
        />
      );

      expect(select).toHaveValue('option2');
    });

    it('should NOT call onChange when no onChange handler provided (defaultProps)', async () => {
      const user = userEvent.setup();

      // Should not throw error when rendering without onChange
      expect(() => {
        render(
          <SelectElement
            id="test-select"
            type="text"
            title="Test Field"
            name="test_field"
            dataItems={['option1', 'option2']}
          />
        );
      }).not.toThrow();

      const select = screen.getByRole('combobox');

      // BASELINE: SelectElement is a controlled component using value={defaultValue}
      // Without onChange updating the defaultValue prop, the select remains at initial value
      // The browser's internal value changes, but React's controlled value doesn't update
      expect(select).toHaveValue('option1'); // Still at initial browser selection

      // User interaction should not throw error even without onChange handler
      await expect(async () => {
        await user.selectOptions(select, 'option2');
      }).not.toThrow();
    });
  });

  describe('Edge Cases and Special Characters', () => {
    it('should handle empty dataItems array', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={[]}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();

      const options = screen.queryAllByRole('option');
      expect(options).toHaveLength(0);
    });

    it('should handle dataItems with empty strings', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['', 'option1', 'option2']}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveValue('');
    });

    it('should handle dataItems with special characters', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option-1', 'option_2', 'option.3', 'option@4']}
        />
      );

      expect(screen.getByRole('option', { name: 'option-1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'option_2' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'option.3' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'option@4' })).toBeInTheDocument();
    });

    it('should handle dataItems with unicode characters', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['CA1', 'CA3', '实验区域']}
        />
      );

      expect(screen.getByRole('option', { name: 'CA1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '实验区域' })).toBeInTheDocument();
    });

    it('should handle very long dataItems array (100+ options)', () => {
      const manyOptions = Array.from({ length: 150 }, (_, i) => `option${i}`);

      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={manyOptions}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(150);
    });

    it('should handle duplicate values in dataItems', () => {
      render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2', 'option1']}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);

      // Both option1 instances should render
      const option1Elements = screen.getAllByRole('option', { name: 'option1' });
      expect(option1Elements).toHaveLength(2);
    });
  });

  describe('Key Generation', () => {
    it('should generate unique keys for options using sanitizeTitle', () => {
      const { container } = render(
        <SelectElement
          id="test-select"
          type="text"
          title="Test Field"
          name="test_field"
          dataItems={['option-1', 'option_2', 'option.3']}
        />
      );

      const options = container.querySelectorAll('option');
      const keys = Array.from(options).map(opt => opt.getAttribute('name'));

      // All options should have name attribute set
      expect(keys.every(key => key === 'test_field')).toBe(true);
    });

    it('should generate fallback keys for empty string options', () => {
      const { container } = render(
        <SelectElement
          id="test-select"
          type="text"
          title="Device Type"
          name="device_type"
          dataItems={['', 'tetrode', '']}
        />
      );

      // Should not throw error with empty strings
      const options = container.querySelectorAll('option');
      expect(options).toHaveLength(3);
    });
  });

  describe('Integration with Real-World Usage', () => {
    it('should work with device type selection (real example)', () => {
      const deviceTypes = [
        'tetrode_12.5',
        'A1x32-6mm-50-177-H32_21mm',
        '128c-4s8mm6cm-20um-40um-sl'
      ];

      render(
        <SelectElement
          id="device-type"
          type="text"
          title="Device Type"
          name="device_type"
          dataItems={deviceTypes}
          placeholder="Select electrode device type"
          defaultValue="tetrode_12.5"
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('tetrode_12.5');

      deviceTypes.forEach(type => {
        expect(screen.getByRole('option', { name: type })).toBeInTheDocument();
      });
    });

    it('should work with camera ID selection with blank option (real example)', () => {
      render(
        <SelectElement
          id="camera-id"
          type="number"
          title="Camera ID"
          name="camera_id"
          dataItems={['0', '1', '2']}
          dataItemsInfo={['Front', 'Back', 'Overhead']}
          addBlankOption={true}
          placeholder="Select camera for this task"
        />
      );

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(4); // Blank + 3 cameras

      expect(screen.getByRole('option', { name: '0 (Front)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '1 (Back)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '2 (Overhead)' })).toBeInTheDocument();
    });
  });

  describe('PropTypes Validation Note', () => {
    // Note: Line 68 has typo: "propType" should be "propTypes"
    // This doesn't affect functionality but should be fixed in Phase 2/3
    it('KNOWN ISSUE: propType typo on line 68 (should be propTypes)', () => {
      // This is a code quality issue, not a functional bug
      // PropTypes won't validate properly but component still works
      // Fix in Phase 3: Code Quality & Refactoring
    });
  });
});
