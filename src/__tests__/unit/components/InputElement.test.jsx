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

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { getByClass, getMainForm } from '../../helpers/test-selectors';
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
      render(
        <InputElement
          id="test-input"
          type="date"
          title="Date of Birth"
          name="date_of_birth"
        />
      );

      const input = document.querySelector('[type="date"]');
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
          value="Loren Frank Lab"
          onChange={() => {}}
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
          value="350"
          onChange={() => {}}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(350);
    });

    it('should format date default value correctly (YYYY-MM-DD)', () => {
      render(
        <InputElement
          id="test-input"
          type="date"
          title="Date of Birth"
          name="date_of_birth"
          value="2023-01-15T00:00:00.000Z"
          onChange={() => {}}
        />
      );

      const input = document.querySelector('[type="date"]');
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
          value=""
          onChange={() => {}}
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
      const handleChange = vi.fn();

      render(
        <InputElement
          id="test-input"
          type="text"
          title="Test Field"
          name="test_field"
          value="test value"
          onChange={handleChange}
          onBlur={handleBlur}
        />
      );

      const input = screen.getByRole('textbox');
      await user.click(input); // Focus the input first
      await user.tab(); // Then blur it

      expect(handleBlur).toHaveBeenCalled();
      const event = handleBlur.mock.calls[0][0];
      expect(event.target.value).toBe('test value');
    });

    it('should accept user input for text fields', async () => {
      const handleChange = vi.fn();

      render(
        <InputElement
          id="test-input"
          type="text"
          title="Test Field"
          name="test_field"
          value="Hello World"
          onChange={handleChange}
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('Hello World');
    });

    it('should accept numeric input for number fields', async () => {
      const handleChange = vi.fn();

      render(
        <InputElement
          id="test-input"
          type="number"
          title="Weight"
          name="weight"
          value="42"
          onChange={handleChange}
        />
      );

      const input = screen.getByRole('spinbutton');
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
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Field Title"
          name="field"
        />
      );

      const item1 = getByClass('item1')[0];
      expect(item1).toBeInTheDocument();
      expect(item1).toHaveTextContent('Field Title');
    });

    it('should wrap input in item2 div', () => {
      render(
        <InputElement
          id="test-input"
          type="text"
          title="Field"
          name="field"
        />
      );

      const item2 = getByClass('item2')[0];
      expect(item2).toBeInTheDocument();
      expect(item2.querySelector('input')).toBeInTheDocument();
    });
  });

  // Key Prop test REMOVED: InputElement now uses controlled inputs (value + onChange)
  // instead of key={defaultValue} hack. Uncontrolled mode still works but doesn't
  // force re-renders - use controlled mode for dynamic updates.

  describe('Date Formatting Edge Cases', () => {
    it('should handle date with single-digit month', () => {
      render(
        <InputElement
          id="test-input"
          type="date"
          title="Date"
          name="date"
          value="2023-01-05T00:00:00.000Z"
          onChange={() => {}}
        />
      );

      const input = document.querySelector('[type="date"]');
      // CURRENT BEHAVIOR: Correctly formats as 2023-01-05
      expect(input).toHaveValue('2023-01-05');
    });

    it('should handle ISO 8601 datetime strings correctly (FIXED)', () => {
      render(
        <InputElement
          id="test-input"
          type="date"
          title="Date"
          name="date"
          value="2023-12-01T00:00:00.000Z"
          onChange={() => {}}
        />
      );

      const input = document.querySelector('[type="date"]');
      // FIXED: Now correctly extracts date portion from ISO 8601 string
      // getDateValue() now checks if value includes 'T' and splits on it
      // This avoids timezone conversion issues and off-by-one bugs
      expect(input).toHaveValue('2023-12-01');
    });

    it('should return empty string for date input with no value', () => {
      render(
        <InputElement
          id="test-input"
          type="date"
          title="Date"
          name="date"
          value=""
          onChange={() => {}}
        />
      );

      const input = document.querySelector('[type="date"]');
      expect(input).toHaveValue('');
    });
  });

  describe('Integration with Form', () => {
    it('should work within a form element', () => {
      render(
        <form>
          <InputElement
            id="test-input"
            type="text"
            title="Field"
            name="field"
          />
        </form>
      );

      const form = getMainForm();
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

  describe('Validation Integration (Phase 2B)', () => {
    describe('Required Validation', () => {
      it('should accept validation prop with required type', () => {
        render(
          <InputElement
            id="test-input"
            type="text"
            title="Lab"
            name="lab"
            validation={{ type: 'required' }}
          />
        );

        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
      });

      it('should show hint when required field is empty', async () => {
        const user = userEvent.setup();
        let value = '';
        const handleChange = (e) => { value = e.target.value; };

        const { rerender } = render(
          <InputElement
            id="test-input"
            type="text"
            title="Lab"
            name="lab"
            value={value}
            onChange={handleChange}
            validation={{ type: 'required' }}
          />
        );

        const input = screen.getByRole('textbox');

        // Simulate typing by triggering onChange
        await user.type(input, 'a');
        rerender(
          <InputElement
            id="test-input"
            type="text"
            title="Lab"
            name="lab"
            value="a"
            onChange={handleChange}
            validation={{ type: 'required' }}
          />
        );

        // Clear input
        await user.clear(input);
        rerender(
          <InputElement
            id="test-input"
            type="text"
            title="Lab"
            name="lab"
            value=""
            onChange={handleChange}
            validation={{ type: 'required' }}
          />
        );

        // Wait for debounced hint (300ms default)
        await new Promise(resolve => setTimeout(resolve, 350));

        expect(screen.getByText('This field is required')).toBeInTheDocument();
      });

      it('should clear hint when required field is filled', async () => {
        const user = userEvent.setup();
        render(
          <InputElement
            id="test-input"
            type="text"
            title="Lab"
            name="lab"
            defaultValue=""
            validation={{ type: 'required' }}
          />
        );

        const input = screen.getByRole('textbox');

        // Type a value
        await user.type(input, 'Frank Lab');

        // Wait for debounced validation
        await new Promise(resolve => setTimeout(resolve, 350));

        // Hint should not be present
        expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
      });
    });

    describe('Pattern Validation', () => {
      it('should accept validation prop with pattern type', () => {
        render(
          <InputElement
            id="test-input"
            type="text"
            title="Session ID"
            name="session_id"
            validation={{
              type: 'pattern',
              pattern: /^[a-zA-Z0-9_-]+$/,
              patternMessage: 'Must be alphanumeric'
            }}
          />
        );

        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
      });

      it('should show custom message when pattern fails', async () => {
        const user = userEvent.setup();
        render(
          <InputElement
            id="test-input"
            type="text"
            title="Session ID"
            name="session_id"
            defaultValue=""
            validation={{
              type: 'pattern',
              pattern: /^[a-zA-Z0-9_-]+$/,
              patternMessage: 'Session ID must contain only letters, numbers, underscores, or hyphens'
            }}
          />
        );

        const input = screen.getByRole('textbox');

        // Type invalid characters
        await user.type(input, 'test@#$');

        // Wait for debounced hint
        await new Promise(resolve => setTimeout(resolve, 350));

        expect(screen.getByText(/Session ID must contain only letters, numbers, underscores, or hyphens/)).toBeInTheDocument();
      });

      it('should clear hint when pattern matches', async () => {
        const user = userEvent.setup();
        render(
          <InputElement
            id="test-input"
            type="text"
            title="Session ID"
            name="session_id"
            defaultValue="invalid@#$"
            validation={{
              type: 'pattern',
              pattern: /^[a-zA-Z0-9_-]+$/,
              patternMessage: 'Must be alphanumeric'
            }}
          />
        );

        const input = screen.getByRole('textbox');

        // Clear and type valid value
        await user.clear(input);
        await user.type(input, 'session_123');

        // Wait for debounced validation
        await new Promise(resolve => setTimeout(resolve, 350));

        // Hint should not be present
        expect(screen.queryByText('Must be alphanumeric')).not.toBeInTheDocument();
      });
    });

    describe('Custom Debounce', () => {
      it('should respect custom debounceMs option', async () => {
        const user = userEvent.setup();

        // Use React component with state to properly test controlled input
        /**
         *
         */
        function TestComponent() {
          const [value, setValue] = React.useState('test');
          return (
            <InputElement
              id="test-input"
              type="text"
              title="Lab"
              name="lab"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              validation={{
                type: 'required',
                debounceMs: 500
              }}
            />
          );
        }

        render(<TestComponent />);

        const input = screen.getByRole('textbox');
        await user.clear(input);

        // Wait less than debounce time - hint should not appear yet
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(screen.queryByText('This field is required')).not.toBeInTheDocument();

        // Wait for full debounce time - hint should now appear
        await waitFor(
          () => {
            expect(screen.getByText('This field is required')).toBeInTheDocument();
          },
          { timeout: 1000 }
        );
      });
    });

    describe('Backward Compatibility', () => {
      it('should work without validation prop (original behavior)', () => {
        const mockOnBlur = vi.fn();
        render(
          <InputElement
            id="test-input"
            type="text"
            title="Lab"
            name="lab"
            onBlur={mockOnBlur}
          />
        );

        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();

        // Should not show any hints
        expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
      });

      it('should not interfere with existing onBlur handler', async () => {
        const mockOnBlur = vi.fn();
        const user = userEvent.setup();

        render(
          <InputElement
            id="test-input"
            type="text"
            title="Lab"
            name="lab"
            onBlur={mockOnBlur}
            validation={{ type: 'required' }}
          />
        );

        const input = screen.getByRole('textbox');
        await user.click(input);
        await user.tab();

        // onBlur should still be called
        expect(mockOnBlur).toHaveBeenCalled();
      });
    });

    describe('Accessibility', () => {
      it('should have aria-live region for hints', async () => {
        const user = userEvent.setup();

        // Use React component with state to properly test controlled input
        /**
         *
         */
        function TestComponent() {
          const [value, setValue] = React.useState('test');
          return (
            <InputElement
              id="test-input"
              type="text"
              title="Lab"
              name="lab"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              validation={{ type: 'required' }}
            />
          );
        }

        render(<TestComponent />);

        const input = screen.getByRole('textbox');
        await user.clear(input);

        // Wait for hint to appear
        await waitFor(
          () => {
            const hint = screen.getByText('This field is required');
            expect(hint).toHaveAttribute('aria-live', 'polite');
          },
          { timeout: 1000 }
        );
      });
    });
  });
});
