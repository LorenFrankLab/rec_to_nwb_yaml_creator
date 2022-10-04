export const ASYNC_TOPICS = {
  jsonFileRead: 'RESPONSE_AFTER_READING_OF_JSON_SCHEMA_FILE',
  cameraIdsUpdated: 'CAMERA_ID_EITHER_ADDED_OR_DELETED',
  templateFileRead: 'RESPONSE_OPEN_TEMPLATE_FILE_BOX',
};

export const checkValidity = (e) => {
  e.stopPropagation();
  e.nativeEvent.stopImmediatePropagation();

  const { target } = e;
  const { value } = target;
  const marker = target.getAttribute('data-marker');
  const format = target.getAttribute('data-format');
};

/** Checks if value is an integer */
export const isInteger = (value) => {
  return /^\d+$/.test(value);
};

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

export const commaSeparatedFilesDataFormats = [
  'comma-separated-numbers',
  'comma-separated-numbers-camera-dependent',
];

export const cameraIdsDependentDataForms = [
  'comma-separated-numbers-camera-dependent',
];

export const stringToInteger = (stringValue) => {
  return parseInt(stringValue, 10);
};

/**
 * Takes in a string consting of text and a number, like abc5, and returns
 * an array with the text and number split, like- { text: 'abc', number: 5, }
 *
 * @param {string} textNumber String consisting of text and number, like Din1
 * @returns Array with text and number separated
 */
export const splitTextNumber = (textNumber) => {
  if (!textNumber || textNumber.trim() === '') {
    return ['', ''];
  }

  const numericPart = textNumber.match(/\d+/g);
  const textPart = textNumber.match(/[a-zA-Z]+/g);

  return { text: textPart, number: numericPart };
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
