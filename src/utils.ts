import { useEffect, type EffectCallback } from 'react';
import {
  sanitizeTitle as sanitizeTitleUtil,
  formatCommaSeparatedString as formatCommaSeparatedStringUtil,
  commaSeparatedStringToNumber as commaSeparatedStringToNumberUtil,
  isInteger as isIntegerUtil,
} from './utils/stringFormatting';

/**
 * Makes a useEffect hook be called only once
 *
 * @param fn function
 * @returns function wrapped around useEffect
 */
// eslint-disable-next-line react-hooks/exhaustive-deps
export const useMount = (fn: EffectCallback): void => useEffect(fn, []);

// Re-exported from utils/stringFormatting.js
export const isInteger = isIntegerUtil;

/**
 * Checks if value is a numeric
 *
 * @param num Value to verify if numeric
 *
 * @returns true if numeric, false otherwise
 */
export const isNumeric = (num: string | number): boolean =>
  /^-?[0-9]+(?:\.[0-9]+)?$/.test(`${num}`);

/**
 * Converts a string to title case
 *
 * @param str Makes text title case
 * @returns Text in title case
 */
export const titleCase = (str: string): string => {
  // based on https://stackoverflow.com/a/196991/178550
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

// Re-exported from utils/stringFormatting.js
export const commaSeparatedStringToNumber = commaSeparatedStringToNumberUtil;

// Re-exported from utils/stringFormatting.js
export const formatCommaSeparatedString = formatCommaSeparatedStringUtil;

/**
 * Displays an error message in input tag. It does nothing if the tag in not input
 *
 * @param element Javascript element
 * @param message Message to show
 *
 * @returns undefined
 */
export const showCustomValidityError = (
  element: HTMLElement | null,
  message: string
): void => {
  if (!element || element.tagName !== 'INPUT') {
    return;
  }

  // tagName === 'INPUT' guarantees this is an <input> (setCustomValidity lives on it).
  (element as HTMLInputElement).setCustomValidity(message);
  (element as HTMLInputElement).reportValidity();

  setTimeout(() => {
    (element as HTMLInputElement).setCustomValidity('');
  }, 2000);
};

/**
 * Converts a string to a number
 *
 * @param stringValue string hold a number-like value
 *
 * @returns number-type
 */
export const stringToInteger = (stringValue: string): number => {
  return parseInt(stringValue, 10);
};

// Re-exported from utils/stringFormatting.js
export const sanitizeTitle = sanitizeTitleUtil;


/**
 * Checks if running in Production
 *
 * @returns True if running in Production, false otherwise
 */
export const isProduction = (): boolean => {
  // Security: Check hostname directly to prevent substring injection attacks
  // BEFORE: window.location.href.includes('https://lorenfranklab.github.io')
  //   - Vulnerable: https://evil.com/https://lorenfranklab.github.io would match
  // AFTER: window.location.hostname === 'lorenfranklab.github.io'
  //   - Secure: Only matches actual GitHub Pages domain
  return window.location.hostname === 'lorenfranklab.github.io';
};
