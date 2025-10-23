import { expect } from 'vitest';
import { jsonschemaValidation } from '../../App';

/**
 * Custom matchers for YAML validation testing
 */
expect.extend({
  toBeValidYaml(received) {
    const result = jsonschemaValidation(received);

    return {
      pass: result.valid,
      message: () =>
        result.valid
          ? `Expected YAML to be invalid`
          : `Expected YAML to be valid, but got errors:\n${JSON.stringify(
              result.errors,
              null,
              2
            )}`,
    };
  },

  toHaveValidationError(received, expectedError) {
    const result = jsonschemaValidation(received);

    const hasError = result.errors?.some(err =>
      err.message.includes(expectedError)
    );

    return {
      pass: hasError,
      message: () =>
        hasError
          ? `Expected validation to NOT have error containing "${expectedError}"`
          : `Expected validation to have error containing "${expectedError}", but got:\n${JSON.stringify(
              result.errors,
              null,
              2
            )}`,
    };
  },
});
