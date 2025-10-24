/**
 * Tests for InputElement component
 *
 * Phase 1: Testing Foundation - Week 4
 *
 * These tests verify the InputElement component correctly:
 * - Renders with required props
 * - Handles different input types (text, number, date)
 * - Manages validation attributes (required, pattern, min)
 * - Processes user interactions (blur events)
 * - Handles readonly state
 * - Displays info icons with placeholder text
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import InputElement from '../../../element/InputElement';

describe('InputElement Component', () => {
  describe('Basic Rendering', () => {
    it('should render with required props', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Test Field"
          name="test_field"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('id', 'test-input');
      expect(input).toHaveAttribute('name', 'test_field');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render label with title text', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Session Description"
          name="session_description"
        />
      );

      expect(screen.getByText('Session Description')).toBeInTheDocument();
    });

    it('should have label associated with input via htmlFor', () => {
      const { container } = render(
        <InputElement
          id="test-input"
          type="text"
          title="Test Field"
          name="test_field"
        />
      );

      const label = container.querySelector('label[for="test-input"]');
      expect(label).toBeInTheDocument();
    });

    it('should render InfoIcon with placeholder as tooltip', () => {
      const { container } = render(
        <InputElement
          id="test-input"
          type="text"
          title="Test Field"
          name="test_field"
          placeholder="This is helpful information"
        />
      );

      // InfoIcon renders a span with title attribute
      const infoIcon = container.querySelector('span[title="This is helpful information"]');
      expect(infoIcon).toBeInTheDocument();
    });
  });

  describe('Input Types', () => {
    it('should render text input by default', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Test Field"
          name="test_field"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render number input when type is number', () => {
      render(
        <InputElement
          id="test-input"
          type="number"
          title="Weight"
          name="weight"
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('should render date input when type is date', () => {
      const { container } = render(
        <InputElement
          id="test-input"
          type="date"
          title="Date of Birth"
          name="date_of_birth"
        />
      );

      const input = container.querySelector('input[type="date"]');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Default Values', () => {
    it('should display string default value for text inputs', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Lab Name"
          name="lab"
          defaultValue="Loren Frank Lab"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('Loren Frank Lab');
    });

    it('should display numeric default value for number inputs', () => {
      render(
        <InputElement
          id="test-input"
          type="number"
          title="Weight"
          name="weight"
          defaultValue="350"
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(350);
    });

    it('should format date default value correctly (YYYY-MM-DD)', () => {
      const { container } = render(
        <InputElement
          id="test-input"
          type="date"
          title="Date of Birth"
          name="date_of_birth"
          defaultValue="2023-01-15T00:00:00.000Z"
        />
      );

      const input = container.querySelector('input[type="date"]');
      // CURRENT BEHAVIOR: Input shows 2023-01-15 (ISO date from Date object)
      // Note: The component DOES NOT actually add 1 to the date as code suggests
      // The getDate() + 1 in line 38 appears to be a BUG but doesn't affect output
      expect(input).toHaveValue('2023-01-15');
    });

    it('should handle empty default value', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Optional Field"
          name="optional"
          defaultValue=""
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });

    it('should handle missing default value prop', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Field"
          name="field"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });
  });

  describe('Validation Attributes', () => {
    it('should mark input as required when required prop is true', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Required Field"
          name="required_field"
          required={true}
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeRequired();
    });

    it('should not mark input as required when required prop is false', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Optional Field"
          name="optional_field"
          required={false}
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).not.toBeRequired();
    });

    it('should apply pattern attribute for validation', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Session ID"
          name="session_id"
          pattern="^[a-zA-Z0-9_]+$"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('pattern', '^[a-zA-Z0-9_]+$');
    });

    it('should apply default pattern if not specified', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Field"
          name="field"
        />
      );

      const input = screen.getByRole('textbox');
      // Default pattern from defaultProps
      expect(input).toHaveAttribute('pattern', '^.+$');
    });

    it('should apply min attribute for number inputs', () => {
      render(
        <InputElement
          id="test-input"
          type="number"
          title="Weight"
          name="weight"
          min="0"
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '0');
    });

    it('should apply step attribute for number inputs', () => {
      render(
        <InputElement
          id="test-input"
          type="number"
          title="Weight"
          name="weight"
          step="0.1"
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('step', '0.1');
    });

    it('should use default step="any" if not specified', () => {
      render(
        <InputElement
          id="test-input"
          type="number"
          title="Weight"
          name="weight"
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('step', 'any');
    });
  });

  describe('Readonly State', () => {
    it('should render as readonly when readOnly prop is true', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Readonly Field"
          name="readonly_field"
          readOnly={true}
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readonly');
    });

    it('should apply gray-out class when readOnly is true', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Readonly Field"
          name="readonly_field"
          readOnly={true}
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('gray-out');
    });

    it('should not be readonly when readOnly prop is false', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Editable Field"
          name="editable_field"
          readOnly={false}
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('readonly');
      expect(input).not.toHaveClass('gray-out');
    });
  });

  describe('User Interactions', () => {
    it('should call onBlur when input loses focus', async () => {
      const user = userEvent.setup();
      const handleBlur = vi.fn();

      render(
        <InputElement
          id="test-input"
          type="text"
          title="Test Field"
          name="test_field"
          onBlur={handleBlur}
        />
      );

      const input = screen.getByRole('textbox');

      await user.click(input);
      await user.tab(); // Move focus away

      expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it('should pass event object to onBlur handler', async () => {
      const user = userEvent.setup();
      const handleBlur = vi.fn();

      render(
        <InputElement
          id="test-input"
          type="text"
          title="Test Field"
          name="test_field"
          onBlur={handleBlur}
        />
      );

      const input = screen.getByRole('textbox');

      await user.type(input, 'test value');
      await user.tab();

      expect(handleBlur).toHaveBeenCalled();
      const event = handleBlur.mock.calls[0][0];
      expect(event.target.value).toBe('test value');
    });

    it('should accept user input for text fields', async () => {
      const user = userEvent.setup();

      render(
        <InputElement
          id="test-input"
          type="text"
          title="Test Field"
          name="test_field"
        />
      );

      const input = screen.getByRole('textbox');

      await user.type(input, 'Hello World');

      expect(input).toHaveValue('Hello World');
    });

    it('should accept numeric input for number fields', async () => {
      const user = userEvent.setup();

      render(
        <InputElement
          id="test-input"
          type="number"
          title="Weight"
          name="weight"
        />
      );

      const input = screen.getByRole('spinbutton');

      await user.type(input, '42');

      expect(input).toHaveValue(42);
    });

    it('should not trigger onBlur if not provided', async () => {
      const user = userEvent.setup();

      render(
        <InputElement
          id="test-input"
          type="text"
          title="Test Field"
          name="test_field"
        />
      );

      const input = screen.getByRole('textbox');

      // Should not throw error
      await user.click(input);
      await user.tab();
    });
  });

  describe('Placeholder Text', () => {
    it('should display placeholder attribute on input', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Session ID"
          name="session_id"
          placeholder="Enter unique session identifier"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', 'Enter unique session identifier');
    });

    it('should use empty string placeholder by default', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Field"
          name="field"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', '');
    });
  });

  describe('CSS Classes', () => {
    it('should apply base-width class to input', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Field"
          name="field"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('base-width');
    });

    it('should apply container class to label', () => {
      const { container } = render(
        <InputElement
          id="test-input"
          type="text"
          title="Field"
          name="field"
        />
      );

      const label = container.querySelector('label');
      expect(label).toHaveClass('container');
    });

    it('should wrap title in item1 div', () => {
      const { container } = render(
        <InputElement
          id="test-input"
          type="text"
          title="Field Title"
          name="field"
        />
      );

      const item1 = container.querySelector('.item1');
      expect(item1).toBeInTheDocument();
      expect(item1).toHaveTextContent('Field Title');
    });

    it('should wrap input in item2 div', () => {
      const { container } = render(
        <InputElement
          id="test-input"
          type="text"
          title="Field"
          name="field"
        />
      );

      const item2 = container.querySelector('.item2');
      expect(item2).toBeInTheDocument();
      expect(item2.querySelector('input')).toBeInTheDocument();
    });
  });

  describe('Key Prop for Re-rendering', () => {
    it('should use defaultValue as key to force re-render on value change', () => {
      const { container, rerender } = render(
        <InputElement
          id="test-input"
          type="text"
          title="Field"
          name="field"
          defaultValue="initial"
        />
      );

      const firstInput = container.querySelector('input');
      expect(firstInput).toHaveValue('initial');

      // Re-render with new defaultValue
      rerender(
        <InputElement
          id="test-input"
          type="text"
          title="Field"
          name="field"
          defaultValue="updated"
        />
      );

      const updatedInput = container.querySelector('input');
      expect(updatedInput).toHaveValue('updated');
    });
  });

  describe('Date Formatting Edge Cases', () => {
    it('should handle date with single-digit month', () => {
      const { container } = render(
        <InputElement
          id="test-input"
          type="date"
          title="Date"
          name="date"
          defaultValue="2023-01-05T00:00:00.000Z"
        />
      );

      const input = container.querySelector('input[type="date"]');
      // CURRENT BEHAVIOR: Correctly formats as 2023-01-05
      expect(input).toHaveValue('2023-01-05');
    });

    it('should handle end-of-month dates (BUG: timezone + day offset creates invalid dates)', () => {
      const { container } = render(
        <InputElement
          id="test-input"
          type="date"
          title="Date"
          name="date"
          defaultValue="2023-12-01T00:00:00.000Z"
        />
      );

      const input = container.querySelector('input[type="date"]');
      // CURRENT BEHAVIOR (BUG): Returns empty string
      // Root cause: Triple bug in getDefaultDateValue()
      // 1. UTC date "2023-12-01T00:00:00.000Z" converts to Nov 30 in PST/PDT
      // 2. getDate() returns 30, then adds 1 = 31
      // 3. November 31st is invalid, so browser shows empty
      // TODO Phase 2: Fix by:
      //   - NOT adding 1 to getDate() (it's already 1-indexed)
      //   - Using toISOString().split('T')[0] instead of manual formatting
      expect(input).toHaveValue('');
    });

    it('should return empty string for date input with no defaultValue', () => {
      const { container } = render(
        <InputElement
          id="test-input"
          type="date"
          title="Date"
          name="date"
        />
      );

      const input = container.querySelector('input[type="date"]');
      expect(input).toHaveValue('');
    });
  });

  describe('Integration with Form', () => {
    it('should work within a form element', () => {
      const { container } = render(
        <form>
          <InputElement
            id="test-input"
            type="text"
            title="Field"
            name="field"
          />
        </form>
      );

      const form = container.querySelector('form');
      const input = screen.getByRole('textbox');

      expect(form).toContainElement(input);
    });

    it('should have correct name attribute for form submission', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Session ID"
          name="session_id"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('name', 'session_id');
    });
  });
});
