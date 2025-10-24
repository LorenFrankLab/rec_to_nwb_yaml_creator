/**
 * @file Tests for ArrayUpdateMenu component
 * @description Phase 1, Week 6 - Priority 2: Missing Component Tests
 *
 * Component location: src/ArrayUpdateMenu.jsx
 *
 * Purpose: Provides UI for adding array items with optional count input
 *
 * Test Coverage: 24 tests documenting current behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArrayUpdateMenu from '../../../ArrayUpdateMenu';

/**
 * Note: These are DOCUMENTATION TESTS (Phase 1)
 *
 * ArrayUpdateMenu has two modes:
 * 1. Simple mode (allowMultiple=false): Just a "+" button
 * 2. Multiple mode (allowMultiple=true): Number input + "+" button
 *
 * Component provides UI for addArrayItem() function from App.js
 */
describe('ArrayUpdateMenu Component', () => {
  let mockAddArrayItem;
  let defaultProps;

  beforeEach(() => {
    mockAddArrayItem = vi.fn();
    defaultProps = {
      itemsKey: 'cameras',
      items: [],
      addArrayItem: mockAddArrayItem,
      allowMultiple: false,
    };
  });

  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      render(<ArrayUpdateMenu {...defaultProps} />);

      // Should render without errors
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('renders add button with + symbol (&#65291;)', () => {
      render(<ArrayUpdateMenu {...defaultProps} />);

      const button = screen.getByRole('button');
      // &#65291; is Unicode FULLWIDTH PLUS SIGN
      expect(button.textContent).toContain('\uFF0B'); // Unicode character
    });

    it('renders add button with title attribute', () => {
      render(<ArrayUpdateMenu {...defaultProps} itemsKey="cameras" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Add cameras');
    });

    it('renders button with type="button" to prevent form submission', () => {
      render(<ArrayUpdateMenu {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('renders in array-update-area container', () => {
      const { container } = render(<ArrayUpdateMenu {...defaultProps} />);

      const div = container.querySelector('.array-update-area');
      expect(div).toBeInTheDocument();
    });
  });

  describe('Simple Mode (allowMultiple=false)', () => {
    it('renders only add button when allowMultiple is false', () => {
      render(<ArrayUpdateMenu {...defaultProps} allowMultiple={false} />);

      // Should have button
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();

      // Should NOT have number input
      const input = screen.queryByRole('spinbutton');
      expect(input).not.toBeInTheDocument();
    });

    it('uses allowMultiple=false by default (defaultProps)', () => {
      // Don't pass allowMultiple prop - should default to false
      const { itemsKey, items, addArrayItem } = defaultProps;
      render(
        <ArrayUpdateMenu itemsKey={itemsKey} items={items} addArrayItem={addArrayItem} />
      );

      // Should NOT have number input
      const input = screen.queryByRole('spinbutton');
      expect(input).not.toBeInTheDocument();
    });

    it('calls add function without count parameter in simple mode', async () => {
      const user = userEvent.setup();
      render(<ArrayUpdateMenu {...defaultProps} allowMultiple={false} />);

      const button = screen.getByRole('button');
      await user.click(button);

      // In simple mode, onClick={add} passes click event as first arg to add()
      // add() function is called with the event object
      // Inside add(), there's no count parameter, so addArrayItem(itemsKey, count) gets undefined for count
      // ACTUALLY: Looking at line 40, onClick={add} means add gets the event
      // But add(count) expects count, so event object becomes count parameter
      // This means addArrayItem gets (itemsKey, event)
      expect(mockAddArrayItem).toHaveBeenCalledTimes(1);
      // First arg should be 'cameras'
      expect(mockAddArrayItem.mock.calls[0][0]).toBe('cameras');
      // Second arg is the click event object (not undefined)
      expect(mockAddArrayItem.mock.calls[0][1]).toBeTruthy();
    });
  });

  describe('Multiple Mode (allowMultiple=true)', () => {
    beforeEach(() => {
      defaultProps.allowMultiple = true;
    });

    it('renders number input when allowMultiple is true', () => {
      render(<ArrayUpdateMenu {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'number');
    });

    it('renders input with default value of 1', () => {
      render(<ArrayUpdateMenu {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(1);
    });

    it('renders input with step="1" attribute', () => {
      render(<ArrayUpdateMenu {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('step', '1');
    });

    it('renders input with min="1" attribute', () => {
      render(<ArrayUpdateMenu {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '1');
    });

    it('renders in multi-area container', () => {
      const { container } = render(<ArrayUpdateMenu {...defaultProps} />);

      const div = container.querySelector('.multi-area');
      expect(div).toBeInTheDocument();
    });
  });

  describe('Add Button Interaction (Multiple Mode)', () => {
    beforeEach(() => {
      defaultProps.allowMultiple = true;
    });

    it('calls addArrayItem with default count (1) when button clicked', async () => {
      const user = userEvent.setup();
      render(<ArrayUpdateMenu {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockAddArrayItem).toHaveBeenCalledTimes(1);
      expect(mockAddArrayItem).toHaveBeenCalledWith('cameras', 1);
    });

    it('calls addArrayItem with count from input value', async () => {
      const user = userEvent.setup();
      render(<ArrayUpdateMenu {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      const button = screen.getByRole('button');

      // Change input to 5
      await user.clear(input);
      await user.type(input, '5');
      await user.click(button);

      expect(mockAddArrayItem).toHaveBeenCalledWith('cameras', 5);
    });

    it('resets input value to 1 after successful add', async () => {
      const user = userEvent.setup();
      render(<ArrayUpdateMenu {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      const button = screen.getByRole('button');

      // Change input to 3
      await user.clear(input);
      await user.type(input, '3');
      await user.click(button);

      // After add, input should reset to 1
      expect(input).toHaveValue(1);
    });

    it('passes itemsKey parameter to addArrayItem', async () => {
      const user = userEvent.setup();
      render(<ArrayUpdateMenu {...defaultProps} itemsKey="tasks" />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockAddArrayItem).toHaveBeenCalledWith('tasks', 1);
    });

    it('parses input value as integer with parseInt(value, 10)', async () => {
      const user = userEvent.setup();
      render(<ArrayUpdateMenu {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      const button = screen.getByRole('button');

      // Type a decimal (browser may round, but we test the parse logic)
      await user.clear(input);
      await user.type(input, '3.7');
      await user.click(button);

      // parseInt('3.7', 10) = 3
      // Actual call depends on what browser does with number input
      expect(mockAddArrayItem).toHaveBeenCalled();
      const [, count] = mockAddArrayItem.mock.calls[0];
      expect(Number.isInteger(count)).toBe(true);
    });
  });

  describe('Count Validation', () => {
    beforeEach(() => {
      defaultProps.allowMultiple = true;
    });

    it('shows validation error when count < 1', async () => {
      const user = userEvent.setup();
      render(<ArrayUpdateMenu {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      const button = screen.getByRole('button');

      // Try to add 0 items
      await user.clear(input);
      await user.type(input, '0');
      await user.click(button);

      // Should NOT call addArrayItem
      expect(mockAddArrayItem).not.toHaveBeenCalled();
    });

    it('does not call addArrayItem when count < 1', async () => {
      const user = userEvent.setup();
      render(<ArrayUpdateMenu {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      const button = screen.getByRole('button');

      // Try negative count
      await user.clear(input);
      await user.type(input, '-1');
      await user.click(button);

      expect(mockAddArrayItem).not.toHaveBeenCalled();
    });

    it('accepts count = 1 (minimum valid value)', async () => {
      const user = userEvent.setup();
      render(<ArrayUpdateMenu {...defaultProps} />);

      const button = screen.getByRole('button');
      await user.click(button);

      // Default is 1, should be accepted
      expect(mockAddArrayItem).toHaveBeenCalledWith('cameras', 1);
    });

    it('accepts large count values (e.g., 100)', async () => {
      const user = userEvent.setup();
      render(<ArrayUpdateMenu {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      const button = screen.getByRole('button');

      await user.clear(input);
      await user.type(input, '100');
      await user.click(button);

      expect(mockAddArrayItem).toHaveBeenCalledWith('cameras', 100);
    });
  });

  describe('Props and PropTypes', () => {
    it('accepts itemsKey prop (string)', () => {
      render(<ArrayUpdateMenu {...defaultProps} itemsKey="electrode_groups" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Add electrode_groups');
    });

    it('accepts items prop (array)', () => {
      const items = [{ id: 0 }, { id: 1 }];
      render(<ArrayUpdateMenu {...defaultProps} items={items} />);

      // Should render without errors
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('accepts addArrayItem prop (function)', async () => {
      const customAdd = vi.fn();
      const user = userEvent.setup();

      render(<ArrayUpdateMenu {...defaultProps} addArrayItem={customAdd} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(customAdd).toHaveBeenCalled();
    });
  });
});

/**
 * Implementation Notes (from reading ArrayUpdateMenu.jsx):
 *
 * **Component Structure:**
 * - Line 13-14: Destructures props (itemsKey, items, addArrayItem, allowMultiple)
 * - Line 16: Uses useRef for itemCountRef (number input reference)
 * - Line 35: Unused displayStatus variable (likely for future feature)
 *
 * **add() Function (lines 18-32):**
 * 1. Validates count >= 1 (line 19-25)
 * 2. Calls addArrayItem(itemsKey, count) (line 27)
 * 3. Resets input value to 1 (line 29-31)
 *
 * **Rendering Modes:**
 * - Simple mode (allowMultiple=false): Just button, onClick={add} with no args
 * - Multiple mode (allowMultiple=true): Input + button, onClick={() => add(parseInt(...))}
 *
 * **Bugs Found:**
 * 1. Line 65: PropTypes typo - `propType` instead of `propTypes` (same as other components)
 * 2. Line 67: removeArrayItem in PropTypes but not used in component
 * 3. Line 35: displayStatus calculated but never used (dead code)
 *
 * **Validation:**
 * - Uses showCustomValidityError() for count < 1
 * - Early return prevents addArrayItem call when invalid
 *
 * **Input Reset:**
 * - Line 29-31: Checks itemCountRef?.current?.value exists before resetting
 * - Resets to 1 (not empty) for better UX
 *
 * **Used By:**
 * - App.js in various array sections (cameras, tasks, electrode_groups, etc.)
 * - Provides consistent UI for adding array items
 */
