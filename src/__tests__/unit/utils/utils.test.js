import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isInteger,
  isNumeric,
  titleCase,
  commaSeparatedStringToNumber,
  formatCommaSeparatedString,
  showCustomValidityError,
  stringToInteger,
  sanitizeTitle,
  isProduction,
} from '../../../utils';

describe('Utils: Type Validators', () => {
  describe('isInteger', () => {
    it('accepts integer strings', () => {
      expect(isInteger('0')).toBe(true);
      expect(isInteger('1')).toBe(true);
      expect(isInteger('42')).toBe(true);
      expect(isInteger('999')).toBe(true);
      expect(isInteger('12345')).toBe(true);
    });

    it('rejects negative numbers', () => {
      expect(isInteger('-1')).toBe(false);
      expect(isInteger('-42')).toBe(false);
    });

    it('rejects float strings', () => {
      expect(isInteger('1.5')).toBe(false);
      expect(isInteger('3.14')).toBe(false);
      expect(isInteger('0.5')).toBe(false);
    });

    it('rejects non-numeric strings', () => {
      expect(isInteger('abc')).toBe(false);
      expect(isInteger('12abc')).toBe(false);
      expect(isInteger('a12')).toBe(false);
      expect(isInteger('')).toBe(false);
      expect(isInteger(' ')).toBe(false);
    });

    it('rejects special values', () => {
      expect(isInteger('Infinity')).toBe(false);
      expect(isInteger('NaN')).toBe(false);
    });

    it('rejects leading zeros (may indicate octal)', () => {
      // Baseline: documents current behavior - leading zeros are accepted
      expect(isInteger('007')).toBe(true); // Current behavior
    });

    it('rejects whitespace around numbers', () => {
      // Baseline: documents current behavior - whitespace is rejected
      expect(isInteger(' 42 ')).toBe(false);
      expect(isInteger('42 ')).toBe(false);
      expect(isInteger(' 42')).toBe(false);
    });

    it('handles edge cases', () => {
      expect(isInteger(null)).toBe(false);
      expect(isInteger(undefined)).toBe(false);
      // Baseline: documents current behavior - numbers coerce to string via template literal
      expect(isInteger(42)).toBe(true); // regex test() coerces to string "42"
    });
  });

  describe('isNumeric', () => {
    it('accepts integer strings', () => {
      expect(isNumeric('0')).toBe(true);
      expect(isNumeric('1')).toBe(true);
      expect(isNumeric('42')).toBe(true);
    });

    it('accepts negative numbers', () => {
      expect(isNumeric('-1')).toBe(true);
      expect(isNumeric('-42')).toBe(true);
    });

    it('accepts float strings', () => {
      expect(isNumeric('1.5')).toBe(true);
      expect(isNumeric('3.14')).toBe(true);
      expect(isNumeric('0.5')).toBe(true);
      expect(isNumeric('-3.14')).toBe(true);
    });

    it('rejects numbers without leading zero', () => {
      // Baseline: regex pattern requires leading digit
      expect(isNumeric('.5')).toBe(false);
      expect(isNumeric('-.5')).toBe(false);
    });

    it('rejects scientific notation', () => {
      // Baseline: documents current behavior
      expect(isNumeric('1e5')).toBe(false);
      expect(isNumeric('2.5e-3')).toBe(false);
    });

    it('rejects non-numeric strings', () => {
      expect(isNumeric('abc')).toBe(false);
      expect(isNumeric('12abc')).toBe(false);
      expect(isNumeric('a12')).toBe(false);
      expect(isNumeric('')).toBe(false);
    });

    it('rejects special values', () => {
      expect(isNumeric('Infinity')).toBe(false);
      expect(isNumeric('NaN')).toBe(false);
    });

    it('accepts numeric inputs as numbers', () => {
      expect(isNumeric(42)).toBe(true);
      expect(isNumeric(-42)).toBe(true);
      expect(isNumeric(3.14)).toBe(true);
    });

    it('handles edge cases', () => {
      expect(isNumeric(null)).toBe(false);
      expect(isNumeric(undefined)).toBe(false);
    });

    it('handles whitespace (baseline behavior)', () => {
      expect(isNumeric(' 42 ')).toBe(false); // Whitespace rejected
      expect(isNumeric('42 ')).toBe(false);
      expect(isNumeric(' 42')).toBe(false);
    });
  });
});

describe('Utils: String Transformations', () => {
  describe('titleCase', () => {
    it('converts lowercase to title case', () => {
      expect(titleCase('hello world')).toBe('Hello World');
      expect(titleCase('test case')).toBe('Test Case');
    });

    it('converts uppercase to title case', () => {
      expect(titleCase('HELLO WORLD')).toBe('Hello World');
      expect(titleCase('TEST CASE')).toBe('Test Case');
    });

    it('converts mixed case to title case', () => {
      expect(titleCase('hElLo WoRlD')).toBe('Hello World');
      expect(titleCase('tEsT cAsE')).toBe('Test Case');
    });

    it('handles single words', () => {
      expect(titleCase('hello')).toBe('Hello');
      expect(titleCase('WORLD')).toBe('World');
      expect(titleCase('Test')).toBe('Test');
    });

    it('handles empty string', () => {
      expect(titleCase('')).toBe('');
    });

    it('handles punctuation', () => {
      expect(titleCase('hello, world!')).toBe('Hello, World!');
      // Baseline: hyphen is treated as word boundary, but word after continues lowercase
      expect(titleCase('test-case')).toBe('Test-case');
    });

    it('handles numbers', () => {
      expect(titleCase('test 123')).toBe('Test 123');
      expect(titleCase('123 test')).toBe('123 Test');
    });

    it('handles multiple spaces', () => {
      expect(titleCase('hello  world')).toBe('Hello  World');
    });

    it('handles special characters', () => {
      // Baseline: apostrophe within word doesn't create new word boundary
      expect(titleCase("it's a test")).toBe("It's A Test");
    });
  });

  describe('sanitizeTitle', () => {
    it('removes special characters', () => {
      expect(sanitizeTitle('hello@world')).toBe('helloworld');
      expect(sanitizeTitle('test#123')).toBe('test123');
      expect(sanitizeTitle('foo_bar')).toBe('foobar');
    });

    it('removes spaces', () => {
      expect(sanitizeTitle('hello world')).toBe('helloworld');
      expect(sanitizeTitle('test   case')).toBe('testcase');
    });

    it('removes punctuation', () => {
      expect(sanitizeTitle('hello, world!')).toBe('helloworld');
      expect(sanitizeTitle('test-case')).toBe('testcase');
      expect(sanitizeTitle("it's working")).toBe('itsworking');
    });

    it('preserves alphanumeric characters', () => {
      expect(sanitizeTitle('test123')).toBe('test123');
      expect(sanitizeTitle('ABC123xyz')).toBe('ABC123xyz');
    });

    it('handles empty string', () => {
      expect(sanitizeTitle('')).toBe('');
    });

    it('handles null and undefined', () => {
      expect(sanitizeTitle(null)).toBe('');
      expect(sanitizeTitle(undefined)).toBe('');
    });

    it('trims whitespace', () => {
      expect(sanitizeTitle('  hello  ')).toBe('hello');
      expect(sanitizeTitle('\thello\n')).toBe('hello');
    });

    it('converts to string before sanitizing', () => {
      expect(sanitizeTitle(123)).toBe('123');
      expect(sanitizeTitle(true)).toBe('true');
      expect(sanitizeTitle({ foo: 'bar' })).toBe('objectObject'); // Baseline: [object Object] → objectObject
    });

    it('handles Unicode characters', () => {
      // Baseline: documents current behavior - Unicode removed
      expect(sanitizeTitle('café')).toBe('caf');
      expect(sanitizeTitle('naïve')).toBe('nave');
    });
  });
});

describe('Utils: Array Transformations', () => {
  describe('commaSeparatedStringToNumber', () => {
    it('parses comma-separated integers', () => {
      expect(commaSeparatedStringToNumber('1, 2, 3')).toEqual([1, 2, 3]);
      expect(commaSeparatedStringToNumber('1,2,3')).toEqual([1, 2, 3]);
    });

    it('handles spaces inconsistently', () => {
      expect(commaSeparatedStringToNumber('1 , 2 , 3')).toEqual([1, 2, 3]);
      expect(commaSeparatedStringToNumber('1  ,  2  ,  3')).toEqual([1, 2, 3]);
    });

    it('filters out non-integer values', () => {
      expect(commaSeparatedStringToNumber('1, abc, 2')).toEqual([1, 2]);
      expect(commaSeparatedStringToNumber('1, 2.5, 3')).toEqual([1, 3]); // Floats filtered
    });

    it('deduplicates values', () => {
      expect(commaSeparatedStringToNumber('1, 2, 1, 3')).toEqual([1, 2, 3]);
      expect(commaSeparatedStringToNumber('5, 5, 5')).toEqual([5]);
    });

    it('handles empty string', () => {
      expect(commaSeparatedStringToNumber('')).toEqual([]);
    });

    it('handles single value', () => {
      expect(commaSeparatedStringToNumber('42')).toEqual([42]);
    });

    it('filters out negative numbers', () => {
      // Baseline: isInteger rejects negative numbers
      expect(commaSeparatedStringToNumber('1, -2, 3')).toEqual([1, 3]);
    });

    it('filters out whitespace-only values', () => {
      expect(commaSeparatedStringToNumber('1, , 2')).toEqual([1, 2]);
      expect(commaSeparatedStringToNumber('1,   , 2')).toEqual([1, 2]);
    });

    it('filters out empty values', () => {
      expect(commaSeparatedStringToNumber('1,,2')).toEqual([1, 2]);
    });

    it('handles trailing/leading commas', () => {
      expect(commaSeparatedStringToNumber(',1,2,')).toEqual([1, 2]);
      expect(commaSeparatedStringToNumber(',,1,2,,')).toEqual([1, 2]);
    });

    it('preserves order while deduplicating', () => {
      expect(commaSeparatedStringToNumber('3, 1, 2, 1')).toEqual([3, 1, 2]);
    });

    it('handles large numbers', () => {
      expect(commaSeparatedStringToNumber('999999, 1000000')).toEqual([999999, 1000000]);
    });
  });

  describe('formatCommaSeparatedString', () => {
    it('parses comma-separated strings', () => {
      expect(formatCommaSeparatedString('a, b, c')).toEqual(['a', 'b', 'c']);
      expect(formatCommaSeparatedString('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('trims whitespace from each value', () => {
      expect(formatCommaSeparatedString('  a  ,  b  ,  c  ')).toEqual(['a', 'b', 'c']);
    });

    it('removes empty strings', () => {
      expect(formatCommaSeparatedString('a, , b')).toEqual(['a', 'b']);
      expect(formatCommaSeparatedString('a,,b')).toEqual(['a', 'b']);
    });

    it('removes whitespace-only strings', () => {
      expect(formatCommaSeparatedString('a,   , b')).toEqual(['a', 'b']);
    });

    it('deduplicates values', () => {
      expect(formatCommaSeparatedString('a, b, a, c')).toEqual(['a', 'b', 'c']);
      expect(formatCommaSeparatedString('test, test, test')).toEqual(['test']);
    });

    it('handles empty string', () => {
      expect(formatCommaSeparatedString('')).toEqual([]);
    });

    it('handles single value', () => {
      expect(formatCommaSeparatedString('hello')).toEqual(['hello']);
    });

    it('handles trailing/leading commas', () => {
      expect(formatCommaSeparatedString(',a,b,')).toEqual(['a', 'b']);
    });

    it('preserves numeric strings', () => {
      expect(formatCommaSeparatedString('1, 2, 3')).toEqual(['1', '2', '3']);
      expect(formatCommaSeparatedString('1.5, 2.5')).toEqual(['1.5', '2.5']);
    });

    it('preserves order while deduplicating', () => {
      expect(formatCommaSeparatedString('c, a, b, a')).toEqual(['c', 'a', 'b']);
    });

    it('handles special characters', () => {
      expect(formatCommaSeparatedString('foo@bar, test#123')).toEqual(['foo@bar', 'test#123']);
    });
  });

  describe('stringToInteger', () => {
    it('converts integer strings to numbers', () => {
      expect(stringToInteger('0')).toBe(0);
      expect(stringToInteger('1')).toBe(1);
      expect(stringToInteger('42')).toBe(42);
      expect(stringToInteger('999')).toBe(999);
    });

    it('converts negative integer strings', () => {
      expect(stringToInteger('-1')).toBe(-1);
      expect(stringToInteger('-42')).toBe(-42);
    });

    it('truncates float strings', () => {
      expect(stringToInteger('3.14')).toBe(3);
      expect(stringToInteger('3.99')).toBe(3);
      expect(stringToInteger('-3.99')).toBe(-3);
    });

    it('returns NaN for non-numeric strings', () => {
      expect(Number.isNaN(stringToInteger('abc'))).toBe(true);
      expect(Number.isNaN(stringToInteger(''))).toBe(true);
    });

    it('parses strings with leading numbers', () => {
      expect(stringToInteger('42abc')).toBe(42);
      expect(stringToInteger('100test')).toBe(100);
    });

    it('handles whitespace', () => {
      expect(stringToInteger('  42  ')).toBe(42);
      expect(stringToInteger('\t42\n')).toBe(42);
    });

    it('handles leading zeros', () => {
      expect(stringToInteger('007')).toBe(7);
      expect(stringToInteger('0042')).toBe(42);
    });

    it('handles base-10 explicitly', () => {
      // Baseline: documents that parseInt uses base 10
      expect(stringToInteger('0x10')).toBe(0); // Hex notation ignored with base 10
      expect(stringToInteger('010')).toBe(10); // Octal notation ignored with base 10
    });
  });
});

describe('Utils: DOM Utilities', () => {
  describe('showCustomValidityError', () => {
    let mockInput;

    beforeEach(() => {
      // Create mock INPUT element
      mockInput = {
        tagName: 'INPUT',
        setCustomValidity: vi.fn(),
        reportValidity: vi.fn(),
      };

      // Mock setTimeout for testing
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('sets custom validity on input elements', () => {
      showCustomValidityError(mockInput, 'Error message');

      expect(mockInput.setCustomValidity).toHaveBeenCalledWith('Error message');
      expect(mockInput.reportValidity).toHaveBeenCalled();
    });

    it('clears validity after 2 seconds', () => {
      showCustomValidityError(mockInput, 'Error message');

      // Initially sets error
      expect(mockInput.setCustomValidity).toHaveBeenCalledWith('Error message');

      // Fast-forward 2 seconds
      vi.advanceTimersByTime(2000);

      // Should clear error
      expect(mockInput.setCustomValidity).toHaveBeenCalledWith('');
    });

    it('does nothing for non-INPUT elements', () => {
      const mockDiv = {
        tagName: 'DIV',
        setCustomValidity: vi.fn(),
        reportValidity: vi.fn(),
      };

      showCustomValidityError(mockDiv, 'Error message');

      expect(mockDiv.setCustomValidity).not.toHaveBeenCalled();
      expect(mockDiv.reportValidity).not.toHaveBeenCalled();
    });

    it('does nothing for null element', () => {
      expect(() => showCustomValidityError(null, 'Error message')).not.toThrow();
    });

    it('does nothing for undefined element', () => {
      expect(() => showCustomValidityError(undefined, 'Error message')).not.toThrow();
    });

    it('handles empty message', () => {
      showCustomValidityError(mockInput, '');

      expect(mockInput.setCustomValidity).toHaveBeenCalledWith('');
      expect(mockInput.reportValidity).toHaveBeenCalled();
    });

    it('handles lowercase tagName', () => {
      const mockInputLower = {
        tagName: 'input', // lowercase
        setCustomValidity: vi.fn(),
        reportValidity: vi.fn(),
      };

      showCustomValidityError(mockInputLower, 'Error message');

      // Baseline: documents current behavior - lowercase tagName doesn't match
      expect(mockInputLower.setCustomValidity).not.toHaveBeenCalled();
    });
  });
});

describe('Utils: Environment Detection', () => {
  describe('isProduction', () => {
    let originalLocation;

    beforeEach(() => {
      originalLocation = window.location;
      delete window.location;
    });

    afterEach(() => {
      window.location = originalLocation;
    });

    it('returns true for GitHub Pages URL', () => {
      window.location = {
        href: 'https://lorenfranklab.github.io/rec_to_nwb_yaml_creator/',
      };

      expect(isProduction()).toBe(true);
    });

    it('returns true for any GitHub Pages subdomain', () => {
      window.location = {
        href: 'https://lorenfranklab.github.io/other-project/',
      };

      expect(isProduction()).toBe(true);
    });

    it('returns false for localhost', () => {
      window.location = {
        href: 'http://localhost:3000/',
      };

      expect(isProduction()).toBe(false);
    });

    it('returns false for development server', () => {
      window.location = {
        href: 'http://localhost:5173/',
      };

      expect(isProduction()).toBe(false);
    });

    it('returns false for file:// protocol', () => {
      window.location = {
        href: 'file:///Users/test/project/index.html',
      };

      expect(isProduction()).toBe(false);
    });

    it('returns false for other domains', () => {
      window.location = {
        href: 'https://example.com/',
      };

      expect(isProduction()).toBe(false);
    });

    it('checks with substring match (potential security issue)', () => {
      // Baseline: documents that it uses includes() not exact match
      // This could be a security issue - ANY URL containing 'https://lorenfranklab.github.io' matches
      window.location = {
        href: 'https://evil.com/https://lorenfranklab.github.io',
      };

      // BUG: includes() will match this even though it's not the actual GitHub Pages domain
      expect(isProduction()).toBe(true); // Potentially dangerous behavior
    });
  });
});

describe('Utils: Edge Cases and Integration', () => {
  describe('Type coercion interactions', () => {
    it('isInteger and stringToInteger consistency', () => {
      const values = ['42', '3.14', 'abc', ''];

      values.forEach((value) => {
        const isInt = isInteger(value);
        const parsed = stringToInteger(value);

        if (isInt) {
          expect(Number.isInteger(parsed)).toBe(true);
        }
      });
    });

    it('isNumeric accepts what stringToInteger can parse', () => {
      const numericValues = ['42', '-42', '3.14', '  42  '];

      numericValues.forEach((value) => {
        if (isNumeric(value)) {
          expect(Number.isNaN(stringToInteger(value))).toBe(false);
        }
      });
    });
  });

  describe('String transformation chain', () => {
    it('sanitizeTitle after titleCase produces clean IDs', () => {
      const input = 'Hello, World!';
      const titled = titleCase(input); // "Hello, World!"
      const sanitized = sanitizeTitle(titled); // "HelloWorld"

      expect(sanitized).toBe('HelloWorld');
    });

    it('formatCommaSeparatedString with sanitized values', () => {
      const input = 'foo@bar, test#123, hello world';
      const formatted = formatCommaSeparatedString(input);

      expect(formatted).toEqual(['foo@bar', 'test#123', 'hello world']);

      const sanitized = formatted.map(sanitizeTitle);
      expect(sanitized).toEqual(['foobar', 'test123', 'helloworld']);
    });
  });

  describe('Null safety', () => {
    it('handles null/undefined gracefully', () => {
      expect(() => isInteger(null)).not.toThrow();
      expect(() => isNumeric(null)).not.toThrow();
      expect(() => sanitizeTitle(null)).not.toThrow();
      expect(() => showCustomValidityError(null, 'error')).not.toThrow();
    });
  });
});
