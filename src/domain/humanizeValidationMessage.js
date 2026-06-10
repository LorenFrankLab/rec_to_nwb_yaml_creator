/**
 * humanizeValidationMessage — DISPLAY-ONLY presentation of validation messages.
 *
 * The validation core ({@link module:validation/schemaValidation}) intentionally emits the RAW
 * AJV message (e.g. `must have required property 'task_environment'`). That raw shape is parsed by
 * downstream consumers — notably ImportYamlDialog's `remediationHint`, which extracts the missing
 * field name — so it must NOT be humanized at the source. This helper rewrites the message into a
 * user-facing sentence at the single point it is rendered to a person (the export-blocked issue
 * list, the day-row "Needs fixing" status). It is pure and conservative: anything it does not
 * recognize is returned unchanged.
 *
 * It MUST NOT be called by `validate()` / `schemaValidation` or by any code that parses message
 * text — only by display components.
 */

/**
 * Friendly labels for high-traffic required properties. Keys are the schema property names; values
 * are full user-facing sentences. Any property not listed falls back to {@link humanizeKey}.
 */
const REQUIRED_PROP_LABELS = {
  task_environment: 'Task environment (room/apparatus) is required',
  camera_id: 'A camera selection is required',
  data_acq_device: 'A data acquisition device is required',
  meters_per_pixel: 'Camera meters-per-pixel calibration is required',
  targeted_location: 'A brain region/location is required',
  location: 'A brain region/location is required',
};

/**
 * Humanize a snake_case schema key into sentence case (e.g. `some_prop` → "Some prop"). A
 * dotted path is reduced to its last segment first (`subject.date_of_birth` → "Date of birth").
 *
 * @param {string} key - The raw schema property name or dotted path.
 * @returns {string} The sentence-cased, space-separated label.
 */
function humanizeKey(key) {
  const lastSegment = String(key).split('.').pop();
  const words = lastSegment.replace(/_/g, ' ').trim();
  if (!words) {
    return key;
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// A leading raw field token we are willing to sentence-case: a snake_case or dotted-path
// identifier (must contain an underscore or dot so we never touch ordinary leading words like
// "must"), captured up to the first space. Conservative by design.
const LEADING_FIELD_TOKEN = /^([a-z][a-z0-9]*(?:[._][a-z0-9]+)+)(\s+.*)$/;

/**
 * Rewrite a raw validation message into user-facing text. Pure; returns '' for empty/non-string
 * input and passes through anything it does not recognize unchanged.
 *
 * @param {string} message - The raw validation message.
 * @returns {string} The display message.
 */
export function humanizeValidationMessage(message) {
  if (!message || typeof message !== 'string') {
    return '';
  }

  // Raw AJV "required property" jargon → friendly sentence.
  const requiredMatch = message.match(/^must have required property '(.+)'$/);
  if (requiredMatch) {
    const prop = requiredMatch[1];
    if (Object.prototype.hasOwnProperty.call(REQUIRED_PROP_LABELS, prop)) {
      return REQUIRED_PROP_LABELS[prop];
    }
    return `${humanizeKey(prop)} is required`;
  }

  // A leading raw snake_case/dotted field token in any other message (e.g.
  // "experiment_description cannot be empty …") → sentence-cased field name + remainder.
  const leadingMatch = message.match(LEADING_FIELD_TOKEN);
  if (leadingMatch) {
    return `${humanizeKey(leadingMatch[1])}${leadingMatch[2]}`;
  }

  return message;
}

export default humanizeValidationMessage;
