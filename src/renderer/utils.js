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
  return stringSet
    .trim()
    .split(',')
    .filter((number) => isInteger(number))
    .map((number) => parseInt(number, 10));
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
