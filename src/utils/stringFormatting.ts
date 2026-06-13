/**
 * String Formatting Utilities
 *
 * Extracted from src/utils.js. These utilities handle string transformations and sanitization.
 */

/**
 * Validates if a value is a positive integer string
 *
 * @param value - Value to verify
 * @returns true if value is a positive integer, false otherwise
 */
export const isInteger = (value: string): boolean => {
  return /^\d+$/.test(value);
};

/**
 * Remove special characters from text
 *
 * Converts input to string, trims whitespace, and removes all
 * non-alphanumeric characters. Useful for creating HTML IDs/keys.
 *
 * @param title - Title to sanitize
 * @returns Sanitized title with only alphanumeric characters
 */
export const sanitizeTitle = (title: string): string => {
  if (!title) {
    return '';
  }
  return title
    .toString()
    .trim()
    .replace(/[^a-z0-9]/gi, '');
};

/**
 * Convert a comma-separated string to an array of trimmed strings
 *
 * Splits on commas, trims whitespace, removes empty strings, and deduplicates.
 *
 * @param stringSet - A string with comma-separated values
 * @returns Array of unique non-empty strings
 *
 * @example
 * formatCommaSeparatedString('apple, banana, cherry')
 * // Returns: ['apple', 'banana', 'cherry']
 *
 * formatCommaSeparatedString('a, b, a, c')
 * // Returns: ['a', 'b', 'c'] (deduplicated)
 */
export const formatCommaSeparatedString = (stringSet: string): string[] => {
  return [
    ...new Set(
      stringSet
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '')
    ),
  ];
};

/**
 * Converts a comma-separated string into an array of integers
 *
 * Splits on commas, filters for valid positive integers, and deduplicates.
 * Non-numeric values, floats, and negative numbers are excluded.
 *
 * @param stringSet - A string with comma-separated numbers
 * @returns Array of unique positive integers
 *
 * @example
 * commaSeparatedStringToNumber('1, 2, 3')
 * // Returns: [1, 2, 3]
 *
 * commaSeparatedStringToNumber('1, 2.5, 3, abc')
 * // Returns: [1, 3] (floats and non-numbers filtered out)
 *
 * commaSeparatedStringToNumber('1, 2, 2, 3')
 * // Returns: [1, 2, 3] (deduplicated)
 */
export const commaSeparatedStringToNumber = (stringSet: string): number[] => {
  return [
    ...new Set(
      stringSet
        .split(',')
        .map((number) => number.trim())
        .filter((number) => isInteger(number))
        .map((number) => parseInt(number, 10))
    ),
  ];
};
