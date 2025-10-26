import { expect } from 'vitest';
import { validate } from '../../validation';

/**
 * Custom matchers for YAML validation testing
 */
expect.extend({
  toBeValidYaml(received) {
    const issues = validate(received);
    const isValid = issues.length === 0;

    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected YAML to be invalid`
          : `Expected YAML to be valid, but got errors:\n${JSON.stringify(
              issues,
              null,
              2
            )}`,
    };
  },

  toHaveValidationError(received, expectedError) {
    const issues = validate(received);

    const hasError = issues.some(issue =>
      issue.message.includes(expectedError)
    );

    return {
      pass: hasError,
      message: () =>
        hasError
          ? `Expected validation to NOT have error containing "${expectedError}"`
          : `Expected validation to have error containing "${expectedError}", but got:\n${JSON.stringify(
              issues,
              null,
              2
            )}`,
    };
  },
});
