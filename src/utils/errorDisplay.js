import { showCustomValidityError, titleCase } from '../utils';

/**
 * Displays an error message to the user if Ajv fails validation
 *
 * @param {object} error Ajv's error object
 * @returns
 */
export const showErrorMessage = (error) => {
  const { message, instancePath } = error;
  const idComponents = error.instancePath.split('/').filter((e) => e !== '');
  let id = '';

  if (idComponents.length === 1) {
    // eslint-disable-next-line prefer-destructuring
    id = idComponents[0];
  } else if (idComponents.length === 2) {
    id = `${idComponents[0]}-${idComponents[1]}`;
  } else {
    id = `${idComponents[0]}-${idComponents[2]}-${idComponents[1]}`;
  }

  const element = document.querySelector(`#${id}`);
  const sanitizeMessage = (validateMessage) => {
    if (validateMessage === 'must match pattern "^.+$"') {
      return `${id} cannot be empty nor all whitespace`;
    }
    return validateMessage;
  };

  const userFriendlyMessage = sanitizeMessage(message);

  // setCustomValidity is only supported on input tags
  if (element?.tagName === 'INPUT') {
    showCustomValidityError(element, userFriendlyMessage);
    return;
  }

  if (element?.focus) {
    element.focus();
  }

  // If here, element not found or cannot show validation message with
  // setCustomValidity/reportValidity; so show a pop-up message
  const itemName = titleCase(
    instancePath.replaceAll('/', ' ').replaceAll('_', ' ')
  );

  let errorMessage = userFriendlyMessage;

  if (instancePath === '/subject/date_of_birth') {
    errorMessage = 'Date of birth needs to comply with ISO 8061 format (https://en.wikipedia.org/wiki/ISO_8601)';
  }

  // eslint-disable-next-line no-alert
  window.alert(`${itemName} - ${errorMessage}`);
};

/**
 * Display HTML custom validity errors on input tags
 * @param {string} id id of input tag
 * @param {string} message error-text to pop up
 * @returns null
 */
export const displayErrorOnUI = (id, message) => {
  const element = document.querySelector(`#${id}`);

  if (element?.focus) {
    element.focus();
  }

  // setCustomValidity is only supported on input tags
  if (element?.tagName === 'INPUT') {
    showCustomValidityError(element, message);
    return;
  }

  // eslint-disable-next-line no-alert
  window.alert(message);
};
