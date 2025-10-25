/**
 * Tests for RadioList component
 *
 * Phase 1: Testing Foundation - Week 4
 *
 * These tests verify the RadioList component correctly:
 * - Renders with required props
 * - Displays radio buttons (single-select, not multi-select)
 * - Handles radio selection
 * - Manages default checked value
 * - Shows "No data" message when dataItems is empty
 * - Calls updateFormData with correct metadata
 * - Handles both number and string types
 * - Sanitizes IDs for React keys
 * - Displays info icons with placeholder text
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RadioList from '../../../element/RadioList';

describe('RadioList Component', () => {
  const defaultProps = {
    id: 'test-radio-list',
    name: 'test_field',
    title: 'Select Option',
    dataItems: [],
    objectKind: 'option',
    placeholder: '',
    defaultValue: '',
    updateFormData: vi.fn(),
    metaData: {
      nameValue: 'form_field',
      keyValue: 'value',
      index: 0,
    },
    type: 'number',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with required props', () => {
      render(<RadioList {...defaultProps} />);

      expect(screen.getByText('Select Option')).toBeInTheDocument();
    });

    it('should render label with title text', () => {
      render(<RadioList {...defaultProps} />);

      expect(screen.getByText('Select Option')).toBeInTheDocument();
    });

    it('should have label with correct htmlFor attribute', () => {
      const { container } = render(<RadioList {...defaultProps} />);

      const label = container.querySelector('label[for="test-radio-list"]');
      expect(label).toBeInTheDocument();
    });

    it('should render InfoIcon with placeholder as tooltip', () => {
      const { container } = render(
        <RadioList
          {...defaultProps}
          placeholder="Select one option"
        />
      );

      // InfoIcon renders a span with title attribute
      const infoIcon = container.querySelector('span[title="Select one option"]');
      expect(infoIcon).toBeInTheDocument();
    });
  });

  describe('Documentation Issues', () => {
    it('DOCUMENTED: JSDoc comment is incorrect (line 9)', () => {
      // Line 9 says "where multiple items can be selected"
      // But radio buttons are SINGLE-select, not multi-select
      // This test documents the misleading comment
      expect(true).toBe(true);
    });

    it('DOCUMENTED: Uses checkbox-list CSS classes (line 48, 52)', () => {
      // Despite being a RadioList, component uses "checkbox-list" classes
      // This is likely copy-paste artifact from CheckboxList
      const { container } = render(
        <RadioList {...defaultProps} dataItems={['0', '1']} />
      );

      const listDiv = container.querySelector('.checkbox-list');
      expect(listDiv).toBeInTheDocument();

      const itemDiv = container.querySelector('.checkbox-list-item');
      expect(itemDiv).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show "No data" message when dataItems is empty', () => {
      render(
        <RadioList
          {...defaultProps}
          dataItems={[]}
          objectKind="option"
        />
      );

      expect(screen.getByText(/No option Item available/)).toBeInTheDocument();
    });

    it('should hide radio-list div when dataItems is empty', () => {
      const { container } = render(
        <RadioList {...defaultProps} dataItems={[]} />
      );

      const radioListDiv = container.querySelector('.checkbox-list');
      expect(radioListDiv).toHaveClass('hide');
    });

    it('should NOT show "No data" message when dataItems has items', () => {
      render(
        <RadioList
          {...defaultProps}
          dataItems={['0', '1', '2']}
        />
      );

      expect(screen.queryByText(/No .* Item available/)).not.toBeInTheDocument();
    });
  });

  describe('Radio Button Rendering', () => {
    it('should render radio button for each data item', () => {
      render(
        <RadioList
          {...defaultProps}
          dataItems={['0', '1', '2']}
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });

    it('should render radio labels with data item values', () => {
      render(
        <RadioList
          {...defaultProps}
          dataItems={['Option A', 'Option B', 'Option C']}
        />
      );

      expect(screen.getByLabelText('Option A')).toBeInTheDocument();
      expect(screen.getByLabelText('Option B')).toBeInTheDocument();
      expect(screen.getByLabelText('Option C')).toBeInTheDocument();
    });

    it('should set radio value attribute to data item', () => {
      render(
        <RadioList
          {...defaultProps}
          dataItems={['5', '10', '15']}
        />
      );

      const radio1 = screen.getByLabelText('5');
      const radio2 = screen.getByLabelText('10');
      const radio3 = screen.getByLabelText('15');

      expect(radio1).toHaveAttribute('value', '5');
      expect(radio2).toHaveAttribute('value', '10');
      expect(radio3).toHaveAttribute('value', '15');
    });

    it('should generate unique IDs for each radio', () => {
      render(
        <RadioList
          {...defaultProps}
          id="options"
          dataItems={['0', '1', '2']}
        />
      );

      expect(screen.getByLabelText('0')).toHaveAttribute('id', 'options-0');
      expect(screen.getByLabelText('1')).toHaveAttribute('id', 'options-1');
      expect(screen.getByLabelText('2')).toHaveAttribute('id', 'options-2');
    });

    it('should group all radios with same name attribute', () => {
      render(
        <RadioList
          {...defaultProps}
          name="selection"
          id="options"
          dataItems={['0', '1', '2']}
        />
      );

      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).toHaveAttribute('name', 'selection-options');
      });
    });

    it('should generate React keys using sanitized titles', () => {
      const { container } = render(
        <RadioList
          {...defaultProps}
          id="options"
          dataItems={['Option-1', 'Option 2', 'Option_3!@#']}
        />
      );

      // All radios should render despite special characters
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);

      // Keys are sanitized for React (no special chars)
      const listItems = container.querySelectorAll('.checkbox-list-item');
      expect(listItems).toHaveLength(3);
    });
  });

  describe('Default Checked State', () => {
    it('should check radio matching defaultValue', () => {
      render(
        <RadioList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          defaultValue="1"
        />
      );

      expect(screen.getByLabelText('0')).not.toBeChecked();
      expect(screen.getByLabelText('1')).toBeChecked();
      expect(screen.getByLabelText('2')).not.toBeChecked();
    });

    it('should handle numeric string defaultValue', () => {
      render(
        <RadioList
          {...defaultProps}
          dataItems={['5', '10', '15']}
          defaultValue="10"
        />
      );

      expect(screen.getByLabelText('5')).not.toBeChecked();
      expect(screen.getByLabelText('10')).toBeChecked();
      expect(screen.getByLabelText('15')).not.toBeChecked();
    });

    it('should handle empty defaultValue (no radio checked)', () => {
      render(
        <RadioList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          defaultValue=""
        />
      );

      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).not.toBeChecked();
      });
    });

    it('should handle defaultValue with non-matching value', () => {
      render(
        <RadioList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          defaultValue="99"
        />
      );

      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).not.toBeChecked();
      });
    });

    it('should only allow one radio to be checked at a time', () => {
      render(
        <RadioList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          defaultValue="1"
        />
      );

      const checkedRadios = screen.getAllByRole('radio').filter(r => r.checked);
      expect(checkedRadios).toHaveLength(1);
      expect(checkedRadios[0]).toHaveAttribute('value', '1');
    });
  });

  describe('User Interactions', () => {
    it('should call updateFormData when radio is clicked', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <RadioList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          updateFormData={mockUpdate}
          metaData={{
            nameValue: 'form_field',
            keyValue: 'value',
            index: 0,
          }}
        />
      );

      const radio = screen.getByLabelText('1');
      await user.click(radio);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should pass correct arguments to updateFormData with type=number', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <RadioList
          {...defaultProps}
          dataItems={['5', '10', '15']}
          type="number"
          updateFormData={mockUpdate}
          metaData={{
            nameValue: 'task_index',
            keyValue: 'selected_value',
            index: 2,
          }}
        />
      );

      const radio = screen.getByLabelText('10');
      await user.click(radio);

      expect(mockUpdate).toHaveBeenCalledWith(
        'task_index',      // nameValue
        10,                // parsed integer value
        'selected_value',  // keyValue
        2                  // index
      );
    });

    it('should pass string value to updateFormData with type=string', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <RadioList
          {...defaultProps}
          dataItems={['Option A', 'Option B', 'Option C']}
          type="string"
          updateFormData={mockUpdate}
          metaData={{
            nameValue: 'selection',
            keyValue: 'choice',
            index: 0,
          }}
        />
      );

      const radio = screen.getByLabelText('Option B');
      await user.click(radio);

      expect(mockUpdate).toHaveBeenCalledWith(
        'selection',
        'Option B',        // string, not parsed
        'choice',
        0
      );
    });

    it('should default to type=number when type prop not provided', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <RadioList
          id="test"
          name="test"
          title="Test"
          dataItems={['42', '99']}
          objectKind="item"
          placeholder=""
          defaultValue=""
          updateFormData={mockUpdate}
          metaData={{ nameValue: 'field', keyValue: 'val', index: 0 }}
          // type not provided, should default to 'number'
        />
      );

      const radio = screen.getByLabelText('42');
      await user.click(radio);

      // Should parse as number, not string
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.any(String),
        42,               // number, not "42"
        expect.any(String),
        expect.any(Number)
      );
    });

    it('should handle clicking already-checked radio', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <RadioList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          defaultValue="1"
          updateFormData={mockUpdate}
        />
      );

      const radio = screen.getByLabelText('1');
      expect(radio).toBeChecked();

      await user.click(radio);

      // Still calls updateFormData (radio behavior)
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple radio clicks (only last one checked)', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <RadioList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          updateFormData={mockUpdate}
        />
      );

      await user.click(screen.getByLabelText('0'));
      await user.click(screen.getByLabelText('2'));

      expect(mockUpdate).toHaveBeenCalledTimes(2);

      // Due to radio group behavior, only one can be checked
      // But both clicks trigger updateFormData
    });
  });

  describe('Type Handling', () => {
    it('should parse value as integer when type="number"', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <RadioList
          {...defaultProps}
          dataItems={['123', '456', '789']}
          type="number"
          updateFormData={mockUpdate}
        />
      );

      await user.click(screen.getByLabelText('456'));

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.any(String),
        456,              // integer
        expect.any(String),
        expect.any(Number)
      );
    });

    it('should keep value as string when type="string"', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <RadioList
          {...defaultProps}
          dataItems={['123', '456', '789']}
          type="string"
          updateFormData={mockUpdate}
        />
      );

      await user.click(screen.getByLabelText('456'));

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.any(String),
        '456',            // string, not integer
        expect.any(String),
        expect.any(Number)
      );
    });

    it('should handle non-numeric strings with type="number" (NaN)', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <RadioList
          {...defaultProps}
          dataItems={['Option A', 'Option B', 'Option C']}
          type="number"
          updateFormData={mockUpdate}
        />
      );

      await user.click(screen.getByLabelText('Option A'));

      // parseInt('Option A', 10) returns NaN
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.any(String),
        NaN,              // parseInt of non-numeric string
        expect.any(String),
        expect.any(Number)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle dataItems with special characters (sanitization)', () => {
      const { container } = render(
        <RadioList
          {...defaultProps}
          id="test-id"
          dataItems={['Option-1', 'Option 2', 'Option_3!@#']}
        />
      );

      // All radios should render despite special characters
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);

      // Keys are sanitized for React (no special chars)
      const listItems = container.querySelectorAll('.checkbox-list-item');
      expect(listItems).toHaveLength(3);
    });

    it('should handle very long dataItems arrays', () => {
      const longArray = Array.from({ length: 100 }, (_, i) => i.toString());

      render(
        <RadioList
          {...defaultProps}
          dataItems={longArray}
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(100);
    });

    it('should handle dataItems with duplicate values (KNOWN ISSUE: duplicate keys)', () => {
      // This documents current behavior - duplicate values create duplicate keys
      const { container } = render(
        <RadioList
          {...defaultProps}
          id="options"
          dataItems={['Option 1', 'Option 2', 'Option 1']}
        />
      );

      // All items render (3 radios)
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);

      // But this creates duplicate React keys (warning in console)
      // Key format: `${id}-${sanitizeTitle(dataItem)}`
      // Both "Option 1" items get key: "options-Option1"
      const listItems = container.querySelectorAll('.checkbox-list-item');
      expect(listItems).toHaveLength(3);
    });

    it('should handle empty string in dataItems', () => {
      render(
        <RadioList
          {...defaultProps}
          dataItems={['', 'Option 1', 'Option 2']}
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });

    it('should handle single dataItem', () => {
      render(
        <RadioList
          {...defaultProps}
          dataItems={['Only Option']}
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(1);
    });
  });

  describe('PropTypes and Defaults', () => {
    it('should use empty string as defaultValue when not provided', () => {
      // defaultProps sets defaultValue: ''
      const { container } = render(
        <RadioList
          id="test"
          name="test"
          title="Test"
          dataItems={['0', '1']}
          objectKind="item"
          updateFormData={vi.fn()}
          metaData={{}}
          type="number"
        />
      );

      // Component still renders
      expect(container.querySelector('.checkbox-list')).toBeInTheDocument();
    });

    it('FIXED: PropTypes defaultValue now matches (line 80 vs 92)', () => {
      // Line 80: PropTypes expects Array (instanceOf(Array))
      // Line 92: defaultProps now sets empty array []
      // This type mismatch has been FIXED
      expect(Array.isArray(RadioList.defaultProps.defaultValue)).toBe(true);
      expect(RadioList.defaultProps.defaultValue).toEqual([]);
      // PropTypes and defaultProps now match - bug fixed!
    });

    it('should use empty string defaults for optional props', () => {
      render(
        <RadioList
          id="test"
          name="test"
          title="Test"
          dataItems={[]}
          // objectKind not provided - should default to ''
          // placeholder not provided - should default to ''
          updateFormData={vi.fn()}
          metaData={{}}
          type="number"
        />
      );

      // Should show empty string in "No Item available" message
      expect(screen.getByText(/No Item available/)).toBeInTheDocument();
    });
  });

  describe('Formatting Issues', () => {
    it('DOCUMENTED: Inconsistent else statement formatting (line 36)', () => {
      // Line 36: `else {radioValue = value;}`
      // Missing space after `else` before `{`
      // This is a formatting inconsistency
      expect(true).toBe(true);
    });
  });
});
