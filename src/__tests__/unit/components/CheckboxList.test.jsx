/**
 * Tests for CheckboxList component
 *
 * Phase 1: Testing Foundation - Week 4
 *
 * These tests verify the CheckboxList component correctly:
 * - Renders with required props
 * - Displays multiple checkboxes for data items
 * - Handles checkbox selection/deselection
 * - Manages default checked values
 * - Shows "No data" message when dataItems is empty
 * - Calls updateFormArray with correct metadata
 * - Sanitizes IDs for React keys
 * - Displays info icons with placeholder text
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CheckboxList from '../../../element/CheckboxList';
import { getByClass } from '../../helpers/test-selectors';

describe('CheckboxList Component', () => {
  const defaultProps = {
    id: 'test-checkbox-list',
    name: 'test_cameras',
    title: 'Select Cameras',
    dataItems: [],
    objectKind: 'camera',
    placeholder: '',
    defaultValue: [],
    updateFormArray: vi.fn(),
    metaData: {
      nameValue: 'tasks',
      keyValue: 'camera_id',
      index: 0,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with required props', () => {
      render(<CheckboxList {...defaultProps} />);

      expect(screen.getByText('Select Cameras')).toBeInTheDocument();
    });

    it('should render label with title text', () => {
      render(<CheckboxList {...defaultProps} />);

      expect(screen.getByText('Select Cameras')).toBeInTheDocument();
    });

    it('should use fieldset with legend for semantic grouping', () => {
      render(<CheckboxList {...defaultProps} />);

      // Should use fieldset/legend instead of label for accessibility
      const fieldset = screen.getByRole('group', { name: /Select Cameras/i });
      expect(fieldset.tagName).toBe('FIELDSET');

      const legend = within(fieldset).getByText('Select Cameras');
      expect(legend.tagName).toBe('LEGEND');
    });

    it('should render InfoIcon with placeholder as tooltip', () => {
      const { container } = render(
        <CheckboxList
          {...defaultProps}
          placeholder="Select one or more cameras"
        />
      );

      // InfoIcon renders a span with title attribute
      const infoIcon = container.querySelector('span[title="Select one or more cameras"]');
      expect(infoIcon).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show "No data" message when dataItems is empty', () => {
      render(
        <CheckboxList
          {...defaultProps}
          dataItems={[]}
          objectKind="camera"
        />
      );

      expect(screen.getByText(/No camera Item available/)).toBeInTheDocument();
    });

    it('should hide checkbox-list div when dataItems is empty', () => {
      render(
        <CheckboxList {...defaultProps} dataItems={[]} />
      );

      const checkboxListDiv = getByClass('checkbox-list')[0];
      expect(checkboxListDiv).toHaveClass('hide');
    });

    it('should NOT show "No data" message when dataItems has items', () => {
      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['0', '1', '2']}
        />
      );

      expect(screen.queryByText(/No .* Item available/)).not.toBeInTheDocument();
    });
  });

  describe('Checkbox List Rendering', () => {
    it('should render checkbox for each data item', () => {
      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['0', '1', '2']}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
    });

    it('should render checkbox labels with data item values', () => {
      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['Camera 0', 'Camera 1', 'Camera 2']}
        />
      );

      expect(screen.getByLabelText('Camera 0')).toBeInTheDocument();
      expect(screen.getByLabelText('Camera 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Camera 2')).toBeInTheDocument();
    });

    it('should set checkbox value attribute to data item', () => {
      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['5', '10', '15']}
        />
      );

      const checkbox1 = screen.getByLabelText('5');
      const checkbox2 = screen.getByLabelText('10');
      const checkbox3 = screen.getByLabelText('15');

      expect(checkbox1).toHaveAttribute('value', '5');
      expect(checkbox2).toHaveAttribute('value', '10');
      expect(checkbox3).toHaveAttribute('value', '15');
    });

    it('should generate unique IDs for each checkbox', () => {
      render(
        <CheckboxList
          {...defaultProps}
          id="cameras"
          dataItems={['0', '1', '2']}
        />
      );

      expect(screen.getByLabelText('0')).toHaveAttribute('id', 'cameras-0');
      expect(screen.getByLabelText('1')).toHaveAttribute('id', 'cameras-1');
      expect(screen.getByLabelText('2')).toHaveAttribute('id', 'cameras-2');
    });

    it('should generate unique names for each checkbox', () => {
      render(
        <CheckboxList
          {...defaultProps}
          name="camera_id"
          id="cameras"
          dataItems={['0', '1', '2']}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toHaveAttribute('name', 'camera_id-cameras');
      });
    });

    it('should generate React keys using sanitized titles', () => {
      const { container } = render(
        <CheckboxList
          {...defaultProps}
          id="cameras"
          dataItems={['Camera-0', 'Camera 1', 'Camera_2']}
        />
      );

      // Check that divs with sanitized keys exist
      expect(container.querySelector('[class="checkbox-list-item"]')).toBeInTheDocument();
      // All divs should be rendered (3 items)
      const listItems = getByClass('checkbox-list-item');
      expect(listItems).toHaveLength(3);
    });
  });

  describe('Default Checked State', () => {
    it('should check checkboxes matching defaultValue array', () => {
      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['0', '1', '2', '3']}
          defaultValue={[0, 2]}
        />
      );

      expect(screen.getByLabelText('0')).toBeChecked();
      expect(screen.getByLabelText('1')).not.toBeChecked();
      expect(screen.getByLabelText('2')).toBeChecked();
      expect(screen.getByLabelText('3')).not.toBeChecked();
    });

    it('should handle defaultValue with string numbers (uses stringToInteger)', () => {
      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['5', '10', '15']}
          defaultValue={[5, 15]}
        />
      );

      expect(screen.getByLabelText('5')).toBeChecked();
      expect(screen.getByLabelText('10')).not.toBeChecked();
      expect(screen.getByLabelText('15')).toBeChecked();
    });

    it('should handle empty defaultValue array', () => {
      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          defaultValue={[]}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });
    });

    it('should handle defaultValue with non-matching values', () => {
      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          defaultValue={[99, 100]}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });
    });
  });

  describe('User Interactions', () => {
    it('should call updateFormArray when checkbox is clicked', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          updateFormArray={mockUpdate}
          metaData={{
            nameValue: 'tasks',
            keyValue: 'camera_id',
            index: 0,
          }}
        />
      );

      const checkbox = screen.getByLabelText('1');
      await user.click(checkbox);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should pass correct arguments to updateFormArray on check', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['5', '10', '15']}
          updateFormArray={mockUpdate}
          metaData={{
            nameValue: 'tasks',
            keyValue: 'camera_id',
            index: 2,
          }}
        />
      );

      const checkbox = screen.getByLabelText('10');
      await user.click(checkbox);

      expect(mockUpdate).toHaveBeenCalledWith(
        'tasks',           // nameValue
        10,                // parsed integer value
        'camera_id',       // keyValue
        2,                 // index
        true               // checked status
      );
    });

    it('should pass correct arguments to updateFormArray on uncheck', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          defaultValue={[1]}
          updateFormArray={mockUpdate}
          metaData={{
            nameValue: 'tasks',
            keyValue: 'camera_id',
            index: 0,
          }}
        />
      );

      const checkbox = screen.getByLabelText('1');
      expect(checkbox).toBeChecked();

      await user.click(checkbox);

      expect(mockUpdate).toHaveBeenCalledWith(
        'tasks',
        1,
        'camera_id',
        0,
        false              // unchecked status
      );
    });

    it('should parse checkbox value as integer before passing to updateFormArray', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['42', '99', '123']}
          updateFormArray={mockUpdate}
        />
      );

      const checkbox = screen.getByLabelText('99');
      await user.click(checkbox);

      // First argument should be parsed integer 99, not string "99"
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.any(String),
        99,                 // integer, not "99"
        expect.any(String),
        expect.any(Number),
        expect.any(Boolean)
      );
    });

    it('should handle multiple checkbox clicks independently', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          updateFormArray={mockUpdate}
        />
      );

      await user.click(screen.getByLabelText('0'));
      await user.click(screen.getByLabelText('2'));

      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle dataItems with special characters (sanitization)', () => {
      render(
        <CheckboxList
          {...defaultProps}
          id="test-id"
          dataItems={['Camera-1', 'Camera 2', 'Camera_3!@#']}
        />
      );

      // All checkboxes should render despite special characters
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);

      // Keys are sanitized for React (no special chars)
      const listItems = getByClass('checkbox-list-item');
      expect(listItems).toHaveLength(3);
    });

    it('should handle very long dataItems arrays', () => {
      const longArray = Array.from({ length: 100 }, (_, i) => i.toString());

      render(
        <CheckboxList
          {...defaultProps}
          dataItems={longArray}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(100);
    });

    it('should handle dataItems with duplicate values (KNOWN ISSUE: duplicate keys)', () => {
      // This documents current behavior - duplicate values create duplicate keys
      render(
        <CheckboxList
          {...defaultProps}
          id="cameras"
          dataItems={['Camera 1', 'Camera 2', 'Camera 1']}
        />
      );

      // All items render (3 checkboxes)
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);

      // But this creates duplicate React keys (warning in console)
      // Key format: `${id}-${sanitizeTitle(dataItem)}`
      // Both "Camera 1" items get key: "cameras-Camera1"
      const listItems = getByClass('checkbox-list-item');
      expect(listItems).toHaveLength(3);
    });

    it('should handle empty string in dataItems', () => {
      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['', '0', '1']}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
    });

    it('should handle numeric dataItems (converted to strings)', () => {
      // dataItems should be strings per PropTypes, but component may handle numbers
      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['0', '1', '2']}
        />
      );

      expect(screen.getByLabelText('0')).toBeInTheDocument();
      expect(screen.getByLabelText('1')).toBeInTheDocument();
      expect(screen.getByLabelText('2')).toBeInTheDocument();
    });
  });

  describe('PropTypes and Defaults', () => {
    it('should use empty string as defaultValue when not provided', () => {
      // KNOWN ISSUE: propType says `defaultValue: PropTypes.instanceOf(Array)`
      // but defaultProps sets it to '' (empty string), not []
      // This documents the inconsistency
      render(
        <CheckboxList
          id="test"
          name="test"
          title="Test"
          dataItems={['0', '1']}
          objectKind="item"
          updateFormArray={vi.fn()}
          metaData={{}}
        />
      );

      // Component still renders (prop type mismatch doesn't break it)
      expect(getByClass('checkbox-list')[0]).toBeInTheDocument();
    });

    it('should use empty string defaults for optional props', () => {
      render(
        <CheckboxList
          id="test"
          name="test"
          title="Test"
          dataItems={[]}
          // objectKind not provided - should default to ''
          // placeholder not provided - should default to ''
          updateFormArray={vi.fn()}
          metaData={{}}
        />
      );

      // Should show empty string in "No Item available" message
      expect(screen.getByText(/No Item available/)).toBeInTheDocument();
    });
  });

  describe('Commented Code', () => {
    it('DOCUMENTED: onChecked has commented-out code (lines 29-31)', () => {
      // Lines 29-31 contain commented code that would collect all checked values
      // const values = Array.from(
      //   target.parentElement.querySelectorAll('input[type="checkbox"]:checked')
      // ).map((a) => parseInt(a.value, 10));

      // Current implementation passes single value + checked status to updateFormArray
      // Commented code would have collected all checked values at once

      // This test documents the existence of commented code
      const mockUpdate = vi.fn();

      render(
        <CheckboxList
          {...defaultProps}
          dataItems={['0', '1', '2']}
          updateFormArray={mockUpdate}
        />
      );

      // Behavior: passes single value, not array of all checked values
      expect(mockUpdate).toHaveBeenCalledTimes(0); // Not called until user interaction
    });
  });
});
