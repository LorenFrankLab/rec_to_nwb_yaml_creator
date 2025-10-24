import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectInputPairElement, { splitTextNumber } from '../../../element/SelectInputPairElement';

describe('SelectInputPairElement', () => {
  const defaultProps = {
    id: 'test-field',
    title: 'Test Field',
    name: 'test_field',
    items: ['Din', 'Dout', 'Accel', 'Gyro', 'Mag'], // Valid behavioral events
    type: 'number',
    placeholder: 'Test placeholder',
    defaultValue: 'Din1',
    onBlur: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders select and input elements', () => {
      render(<SelectInputPairElement {...defaultProps} />);

      expect(screen.getByText('Type:')).toBeInTheDocument();
      expect(screen.getByText('Index:')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('renders label with title', () => {
      render(<SelectInputPairElement {...defaultProps} />);

      expect(screen.getByText('Test Field')).toBeInTheDocument();
    });

    it('renders select with items from props', () => {
      render(<SelectInputPairElement {...defaultProps} />);

      const select = screen.getByRole('combobox');
      const options = Array.from(select.querySelectorAll('option'));

      expect(options).toHaveLength(5);
      expect(options[0].textContent).toBe('Din');
      expect(options[1].textContent).toBe('Dout');
      expect(options[2].textContent).toBe('Accel');
      expect(options[3].textContent).toBe('Gyro');
      expect(options[4].textContent).toBe('Mag');
    });

    it('renders InfoIcon with placeholder text', () => {
      render(<SelectInputPairElement {...defaultProps} />);

      // InfoIcon renders a <span> with title attribute
      const infoIcon = screen.getByTitle('Test placeholder');
      expect(infoIcon).toBeInTheDocument();
    });

    it('applies required attribute to input when specified', () => {
      render(<SelectInputPairElement {...defaultProps} required={true} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toBeRequired();
    });

    it('applies readOnly attribute to input when specified', () => {
      render(<SelectInputPairElement {...defaultProps} readOnly={true} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('Default Value Splitting', () => {
    it('splits defaultValue "Din1" into text="Din" and number=1', () => {
      render(<SelectInputPairElement {...defaultProps} defaultValue="Din1" />);

      const select = screen.getByRole('combobox');
      const input = screen.getByRole('spinbutton');

      expect(select).toHaveValue('Din');
      expect(input).toHaveValue(1);
    });

    it('splits defaultValue "Dout5" into text="Dout" and number=5', () => {
      render(<SelectInputPairElement {...defaultProps} defaultValue="Dout5" />);

      const select = screen.getByRole('combobox');
      const input = screen.getByRole('spinbutton');

      expect(select).toHaveValue('Dout');
      expect(input).toHaveValue(5);
    });

    it('handles empty defaultValue with fallback text="Din" and number=1', () => {
      render(<SelectInputPairElement {...defaultProps} defaultValue="" />);

      const select = screen.getByRole('combobox');
      const input = screen.getByRole('spinbutton');

      // splitTextNumber returns { text: 'Din', number: 1 } for empty string
      expect(select).toHaveValue('Din');
      expect(input).toHaveValue(1);
    });

    it('handles defaultValue with only text (no number)', () => {
      render(<SelectInputPairElement {...defaultProps} defaultValue="Accel" />);

      const select = screen.getByRole('combobox');
      const input = screen.getByRole('spinbutton');

      expect(select).toHaveValue('Accel');
      // When no number found, splitTextNumber returns empty string for number
      expect(input).toHaveValue(null); // Empty number input shows null
    });

    it('handles defaultValue with only number (no text) - BUG: crashes', () => {
      // BUG: Line 38 tries to access textPart.length without null check
      // When input is "42", textPart is null, causing: Cannot read properties of null (reading 'length')
      // This test documents the current BROKEN behavior
      // Expected after fix: Should handle gracefully and return { text: '', number: 42 }

      expect(() => {
        render(<SelectInputPairElement {...defaultProps} defaultValue="42" />);
      }).toThrow("Cannot read properties of null (reading 'length')");
    });
  });

  describe('Combined Behavior', () => {
    it('calls onBlur with combined value when select changes', async () => {
      const user = userEvent.setup();
      const handleBlur = vi.fn();

      render(<SelectInputPairElement {...defaultProps} onBlur={handleBlur} defaultValue="Din1" />);

      const select = screen.getByRole('combobox');

      // Change select to "Dout"
      await user.selectOptions(select, 'Dout');
      await user.tab(); // Trigger blur

      expect(handleBlur).toHaveBeenCalled();
      const eventData = handleBlur.mock.calls[0][0];
      expect(eventData.target.value).toBe('Dout1'); // Dout + 1
      expect(eventData.target.name).toBe('test_field');
      expect(eventData.target.type).toBe('text');
    });

    it('calls onBlur with combined value when input changes', async () => {
      const user = userEvent.setup();
      const handleBlur = vi.fn();

      render(<SelectInputPairElement {...defaultProps} onBlur={handleBlur} defaultValue="Din1" />);

      const input = screen.getByRole('spinbutton');

      // Change input to 5
      await user.clear(input);
      await user.type(input, '5');
      await user.tab(); // Trigger blur

      expect(handleBlur).toHaveBeenCalled();
      const eventData = handleBlur.mock.calls[0][0];
      expect(eventData.target.value).toBe('Din5'); // Din + 5
    });

    it('combines select and input values correctly', async () => {
      const user = userEvent.setup();
      const handleBlur = vi.fn();

      render(<SelectInputPairElement {...defaultProps} onBlur={handleBlur} defaultValue="Din1" />);

      const select = screen.getByRole('combobox');
      const input = screen.getByRole('spinbutton');

      // Change select to "Gyro"
      await user.selectOptions(select, 'Gyro');

      // Change input to 10
      await user.clear(input);
      await user.type(input, '10');
      await user.tab(); // Trigger blur

      expect(handleBlur).toHaveBeenCalled();
      const eventData = handleBlur.mock.calls[handleBlur.mock.calls.length - 1][0];
      expect(eventData.target.value).toBe('Gyro10'); // Gyro + 10
    });

    it('passes metaData to onBlur handler', async () => {
      const user = userEvent.setup();
      const handleBlur = vi.fn();
      const metaData = { foo: 'bar', index: 0 };

      render(
        <SelectInputPairElement
          {...defaultProps}
          onBlur={handleBlur}
          metaData={metaData}
          defaultValue="Din1"
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Dout');
      await user.tab();

      expect(handleBlur).toHaveBeenCalled();
      const receivedMetaData = handleBlur.mock.calls[0][1];
      expect(receivedMetaData).toEqual({ foo: 'bar', index: 0 });
    });
  });

  describe('Input Attributes', () => {
    it('applies type attribute to input', () => {
      render(<SelectInputPairElement {...defaultProps} type="number" />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('applies step attribute to input', () => {
      render(<SelectInputPairElement {...defaultProps} step="0.1" />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('step', '0.1');
    });

    it('applies min attribute to input', () => {
      render(<SelectInputPairElement {...defaultProps} min="0" />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '0');
    });

    it('applies placeholder attribute to input', () => {
      render(<SelectInputPairElement {...defaultProps} placeholder="Enter value" />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('placeholder', 'Enter value');
    });

    it('applies name attribute to both select and input', () => {
      render(<SelectInputPairElement {...defaultProps} name="my_field" />);

      const select = screen.getByRole('combobox');
      const input = screen.getByRole('spinbutton');

      expect(select).toHaveAttribute('name', 'my_field');
      expect(input).toHaveAttribute('name', 'my_field');
    });

    it('generates select ID from base ID plus "-list" suffix', () => {
      render(<SelectInputPairElement {...defaultProps} id="my-id" />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('id', 'my-id-list');
    });

    it('applies base ID to input element', () => {
      render(<SelectInputPairElement {...defaultProps} id="my-id" />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('id', 'my-id');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty items array', () => {
      render(<SelectInputPairElement {...defaultProps} items={[]} />);

      const select = screen.getByRole('combobox');
      const options = Array.from(select.querySelectorAll('option'));

      expect(options).toHaveLength(0);
    });

    it('handles single item in array', () => {
      render(<SelectInputPairElement {...defaultProps} items={['OnlyOne']} />);

      const select = screen.getByRole('combobox');
      const options = Array.from(select.querySelectorAll('option'));

      expect(options).toHaveLength(1);
      expect(options[0].textContent).toBe('OnlyOne');
    });

    it('handles undefined defaultValue', () => {
      render(<SelectInputPairElement {...defaultProps} defaultValue={undefined} />);

      const select = screen.getByRole('combobox');
      const input = screen.getByRole('spinbutton');

      // splitTextNumber handles undefined, returns { text: 'Din', number: 1 }
      expect(select).toHaveValue('Din');
      expect(input).toHaveValue(1);
    });

    it('handles null defaultValue', () => {
      render(<SelectInputPairElement {...defaultProps} defaultValue={null} />);

      const select = screen.getByRole('combobox');
      const input = screen.getByRole('spinbutton');

      // splitTextNumber handles null, returns { text: 'Din', number: 1 }
      expect(select).toHaveValue('Din');
      expect(input).toHaveValue(1);
    });

    it('renders without crashing when onBlur is not provided', () => {
      const { container } = render(<SelectInputPairElement {...defaultProps} onBlur={undefined} />);

      expect(container).toBeInTheDocument();
      // defaultProps provides empty function, so this won't crash
    });
  });

  describe('PropTypes Bug', () => {
    it('documents PropTypes typo on line 147', () => {
      // BUG: Line 147 uses `propType` instead of `propTypes`
      // This disables PropTypes validation entirely
      expect(SelectInputPairElement.propType).toBeDefined();
      expect(SelectInputPairElement.propTypes).toBeUndefined();
    });

    it('documents incorrect PropTypes syntax for defaultValue', () => {
      // BUG: Line 159 uses PropTypes.oneOf with array of PropTypes
      // Should be: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
      const propTypesDef = SelectInputPairElement.propType?.defaultValue;
      expect(propTypesDef).toBeDefined();
      // This would fail validation if PropTypes were working
    });
  });
});

describe('splitTextNumber utility function', () => {
  describe('Basic Splitting', () => {
    it('splits "Din1" into { text: "Din", number: 1 }', () => {
      const result = splitTextNumber('Din1');
      expect(result).toEqual({ text: 'Din', number: 1 });
    });

    it('splits "Dout5" into { text: "Dout", number: 5 }', () => {
      const result = splitTextNumber('Dout5');
      expect(result).toEqual({ text: 'Dout', number: 5 });
    });

    it('splits "Accel10" into { text: "Accel", number: 10 }', () => {
      const result = splitTextNumber('Accel10');
      expect(result).toEqual({ text: 'Accel', number: 10 });
    });

    it('splits "Din99" into { text: "Din", number: 99 }', () => {
      const result = splitTextNumber('Din99');
      expect(result).toEqual({ text: 'Din', number: 99 });
    });
  });

  describe('Edge Cases', () => {
    it('returns { text: "Din", number: 1 } for empty string', () => {
      const result = splitTextNumber('');
      expect(result).toEqual({ text: 'Din', number: 1 });
    });

    it('returns { text: "Din", number: 1 } for whitespace string', () => {
      const result = splitTextNumber('   ');
      expect(result).toEqual({ text: 'Din', number: 1 });
    });

    it('returns { text: "Din", number: 1 } for null', () => {
      const result = splitTextNumber(null);
      expect(result).toEqual({ text: 'Din', number: 1 });
    });

    it('returns { text: "Din", number: 1 } for undefined', () => {
      const result = splitTextNumber(undefined);
      expect(result).toEqual({ text: 'Din', number: 1 });
    });
  });

  describe('Text-Only Input', () => {
    it('handles valid text without number (Accel)', () => {
      const result = splitTextNumber('Accel');
      expect(result.text).toBe('Accel');
      expect(result.number).toBe('');
    });

    it('handles invalid text without number (returns empty text)', () => {
      const result = splitTextNumber('InvalidText');
      // Only Din, Dout, Accel, Gyro, Mag are valid behavioral events
      expect(result.text).toBe('');
      expect(result.number).toBe('');
    });

    it('validates text against behavioralEventsDescription list', () => {
      // Valid behavioral events: Din, Dout, Accel, Gyro, Mag
      const validResult = splitTextNumber('Din');
      expect(validResult.text).toBe('Din');

      const invalidResult = splitTextNumber('NotValid');
      expect(invalidResult.text).toBe('');
    });
  });

  describe('Number-Only Input - BUG: Crashes', () => {
    it('documents BUG: number-only input "42" crashes', () => {
      // BUG: Line 38 checks textPart.length without null check
      // When input is "42", textPart is null from line 20: textNumber.match(/[a-zA-Z]+/g)
      // This causes TypeError: Cannot read properties of null (reading 'length')

      expect(() => {
        splitTextNumber('42');
      }).toThrow("Cannot read properties of null (reading 'length')");
    });

    it('documents BUG: number-only input "0" crashes', () => {
      expect(() => {
        splitTextNumber('0');
      }).toThrow("Cannot read properties of null (reading 'length')");
    });

    it('documents BUG: number with leading zeros "007" crashes', () => {
      expect(() => {
        splitTextNumber('007');
      }).toThrow("Cannot read properties of null (reading 'length')");
    });
  });

  describe('Multiple Numbers in Input', () => {
    it('documents behavior: multiple numbers rejected', () => {
      // When input has multiple numbers like "Din12", the regex finds ['1', '2']
      // Line 42 checks numericPart.length === 1, so multi-digit numbers are rejected
      // Also "Din1and2" has textPart = ['Din', 'and'], length 2, so text is rejected too
      const result = splitTextNumber('Din1and2');
      expect(result.text).toBe(''); // Rejected because textPart.length !== 1
      expect(result.number).toBe(''); // Rejected because numericPart.length !== 1
    });

    it('handles multi-digit numbers correctly', () => {
      // Interestingly, "Din12" works because \d+ captures "12" as one match
      const result = splitTextNumber('Din12');
      expect(result.text).toBe('Din');
      expect(result.number).toBe(12);
    });
  });

  describe('Commented Code Documentation', () => {
    it('documents commented validation logic (lines 26-37)', () => {
      // COMMENTED CODE: More strict validation checking if:
      // - Exactly 1 numeric part
      // - Exactly 1 text part
      // - Text part in eventsDescription
      // Current implementation is less strict (lines 38-46)
    });
  });

  describe('Return Value Structure', () => {
    it('always returns object with text and number properties', () => {
      const result = splitTextNumber('Din1');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('number');
    });

    it('text is always a string', () => {
      const result = splitTextNumber('Din1');
      expect(typeof result.text).toBe('string');
    });

    it('number can be string or number depending on input', () => {
      const withNumber = splitTextNumber('Din1');
      expect(typeof withNumber.number).toBe('number');

      const withoutNumber = splitTextNumber('Poke');
      expect(typeof withoutNumber.number).toBe('string'); // Empty string
    });
  });
});
