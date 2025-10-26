import { useEffect } from 'react';

/**
 * Makes a useEffect hook be called only once
 *
 * @param {object} fn function
 * @returns function wrapped around useEffect
 */
// eslint-disable-next-line react-hooks/exhaustive-deps
export const useMount = (fn) => useEffect(fn, []);

/** Checks if value is an integer */
export const isInteger = (value) => {
  return /^\d+$/.test(value);
};

/**
 * Checks if value is a numeric
 *
 * @param {object} num Value to verify if numeric
 *
 * @returns true if numeric, false otherwise
 */
export const isNumeric = (num) => /^-?[0-9]+(?:\.[0-9]+)?$/.test(`${num}`);

/**
 * Converts a string to title case
 *
 * @param {string} str Makes text title case
 * @returns Text in title case
 */
export const titleCase = (str) => {
  // based on https://stackoverflow.com/a/196991/178550
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

/**
 * Converts a comma-separated string into an array
 *
 * @param {string} stringSet A string with comma-separated numbers
 *
 * @returns An array where the comma in a comma-separated string is used as
 * the basis of the split. Non-numbers are not included in the returned string
 */
export const commaSeparatedStringToNumber = (stringSet) => {
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

/**
 * Convert a comma-separated string to an array
 *
 * @param {string} stringSet A string with comma-separated strings
 */
export const formatCommaSeparatedString = (stringSet) => {
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
 * Displays an error message in input tag. It does nothing if the tag in not input
 *
 * @param {element} element Javascript element
 * @param {*} message Message to show
 *
 * @returns undefined
 */
export const showCustomValidityError = (element, message) => {
  if (!element || element.tagName !== 'INPUT') {
    return;
  }

  element.setCustomValidity(message);
  element.reportValidity();

  setTimeout(() => {
    element.setCustomValidity('');
  }, 2000);
};

/**
 * Converts a string to a number
 *
 * @param {string} stringValue string hold a number-like value
 *
 * @returns number-type
 */
export const stringToInteger = (stringValue) => {
  return parseInt(stringValue, 10);
};

/**
 * Remove special characters from text
 * @param {string} title  Title
 */
export const sanitizeTitle = (title) => {
  if (!title) {
    return '';
  }
  return title
    .toString()
    .trim()
    .replace(/[^a-z0-9]/gi, '');
};


/**
 * Checks if running in Production
 *
 * @returns True if running in Production, false otherwise
 */
export const isProduction = () => {
  // Security: Check hostname directly to prevent substring injection attacks
  // BEFORE: window.location.href.includes('https://lorenfranklab.github.io')
  //   - Vulnerable: https://evil.com/https://lorenfranklab.github.io would match
  // AFTER: window.location.hostname === 'lorenfranklab.github.io'
  //   - Secure: Only matches actual GitHub Pages domain
  return window.location.hostname === 'lorenfranklab.github.io';
};
