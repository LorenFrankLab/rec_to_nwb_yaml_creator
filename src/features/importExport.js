/**
 * Import/Export Logic
 *
 * Extracted from App.js to improve modularity and testability.
 * Handles YAML file import/export operations with validation.
 *
 * @module features/importExport
 */

import {
  validate,
  blockingIssues,
  isBlockingIssue,
  isSchemaIssue,
  rulesValidation,
  unknownSubjectFields,
} from '../validation';
import { removeStaleCameraReferences } from '../utils/cameraReferences';
import {
  canonicalizeFileBadChannels,
  toFileBadChannels,
  toFormBadChannels,
} from '../utils/badChannels';
import { withLegacyConverterKeys } from '../io/legacyCompat';
import {
  decodeYaml,
  encodeYaml,
  downloadYamlFile,
  formatDeterministicFilename
} from '../io/yaml';
import { arrayDefaultValues, emptyFormData, genderAcronym } from '../valueList';

/** Every message for an import that fails says so: the page keeps the form it already has. */
const FORM_NOT_CHANGED = 'The form was not changed.';

/**
 * Repairs the rule problems an imported file can have that the form has no input to fix, and
 * says what it did. A section is left out of an import only for a schema error, and a rule error
 * the form can fix is loaded for the download gate to block, so these are the rest:
 * - a channel-map row naming an electrode group the file does not define is left out (the form
 *   shows rows only under their group, and trodes_to_nwb fails looking the group up);
 * - an optical fiber or virus injection without a coordinate reference gets the one the form
 *   writes for every new item (trodes_to_nwb requires it; leaving the item out would lose its
 *   coordinates and leave the optogenetics incomplete);
 * - a subject age, age__reference or strain pynwb rejects is left out (the form has no field
 *   for them).
 *
 * @param {object} content - The parsed file (not changed)
 * @returns {{content: object, leftOut: Array<{field: string, reason: string}>,
 *   changed: Array<{field: string, reason: string}>}} The repaired copy, and what was left out
 *   or changed
 */
function repairForImport(content) {
  const repaired = { ...content };
  const leftOut = [];
  const changed = [];
  const isSet = (value) => value !== undefined && value !== null;

  const groups = content.electrode_groups;
  const ntrodes = content.ntrode_electrode_group_channel_map;
  if (Array.isArray(groups) && Array.isArray(ntrodes)) {
    const groupIds = new Set(groups.map((group) => group?.id).filter(isSet));
    repaired.ntrode_electrode_group_channel_map = ntrodes.filter((ntrode) => {
      const groupId = ntrode?.electrode_group_id;
      if (!isSet(groupId) || groupIds.has(groupId)) return true;
      leftOut.push({
        field: `ntrode_electrode_group_channel_map (ntrode ${ntrode.ntrode_id})`,
        reason:
          `Left out: ntrode ${ntrode.ntrode_id} belongs to electrode group ${groupId}, which the ` +
          'file does not define. trodes_to_nwb fails looking the group up.',
      });
      return false;
    });
  }

  [
    ['optical_fiber', 'optical fiber'],
    ['virus_injection', 'virus injection'],
  ].forEach(([key, label]) => {
    if (!Array.isArray(content[key])) return;
    repaired[key] = content[key].map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const { reference } = item;
      if (typeof reference === 'string' && reference.trim() !== '') return item;
      // The coordinate reference the form gives every optical fiber and virus injection
      const formReference = arrayDefaultValues[key].reference;
      changed.push({
        field: `${key}[${index}].reference`,
        reason:
          `Set to "${formReference}"` +
          `${reference === undefined ? '' : ` (was ${JSON.stringify(reference)})`}: trodes_to_nwb ` +
          `requires a coordinate reference, and this is the one the form gives every ${label}. ` +
          'If the coordinates were measured from another point, correct it in the file and ' +
          'import it again.',
      });
      return { ...item, reference: formReference };
    });
  });

  const subjectIssues = rulesValidation({ subject: content.subject }).filter(
    (issue) => issue.code === 'subject_value_type'
  );
  if (subjectIssues.length > 0) {
    const subject = { ...content.subject };
    subjectIssues.forEach((issue) => {
      delete subject[issue.path.replace('subject.', '')];
      leftOut.push({
        field: issue.path,
        reason: `Left out (the form has no field to correct it): ${issue.message}`,
      });
    });
    repaired.subject = subject;
  }

  return { content: repaired, leftOut, changed };
}

/**
 * Says where an issue is, in words: `cameras[0].meters_per_pixel` → "Cameras 1, meters per pixel",
 * `subject.subject_id` → "Subject, subject id". List positions are counted from 1.
 *
 * @param {string} issuePath - Normalized issue path (dot + bracket notation)
 * @returns {string} The location, or "File" for an issue about the whole file
 */
function describeIssueLocation(issuePath) {
  if (typeof issuePath !== 'string' || issuePath === '') return 'File';
  const parts = [];
  issuePath.split('.').forEach((segment) => {
    const [name, ...indices] = segment.split('[');
    const words = name.replace(/_/g, ' ');
    const positions = indices.map((index) => ` ${parseInt(index, 10) + 1}`).join('');
    parts.push(`${words}${positions}`);
  });
  const [first, ...rest] = parts;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(', ');
}

/**
 * The one confirm message for a download that has warnings: one line per warning (where, then
 * what), so they can all be read before choosing.
 *
 * @param {Array<{path: string, message: string}>} warnings - Advisory issues
 * @returns {string} The confirm message
 */
function warningsConfirmMessage(warnings) {
  const count = `${warnings.length} warning${warnings.length === 1 ? '' : 's'}`;
  const lines = warnings.map(
    (warning) => `- ${describeIssueLocation(warning.path)}: ${warning.message}`
  );
  return (
    `This file has ${count}:\n\n${lines.join('\n')}\n\n` +
    'Download it anyway? Choose Cancel to go back and fix them.'
  );
}

/**
 * Import YAML files and prepare form data
 *
 * Parses YAML content, validates against schema and rules, and prepares
 * form data with appropriate defaults. Handles partial imports when some
 * fields have validation errors.
 *
 * @param {File} file - File object to import
 * @param {Object} [options] - Optional configuration
 * @param {Function} [options.onProgress] - Progress callback (not implemented yet)
 * @returns {Promise<Object>} Result object
 * @returns {boolean} result.success - Whether import succeeded
 * @returns {string|null} result.error - Error message if failed
 * @returns {Object|null} result.formData - Validated form data; null when nothing can be imported
 *   (no file, unreadable, rich text, not valid YAML, no metadata fields, or an unexpected error),
 *   so the caller keeps the form it already has
 * @returns {Object} [result.importSummary] - Import summary (only present on success)
 * @returns {number} result.importSummary.totalFields - Total fields in YAML file
 * @returns {string[]} result.importSummary.importedFields - Successfully imported field names
 * @returns {Array<{field: string, reason: string}>} result.importSummary.excludedFields - Excluded fields with validation reasons
 * @returns {boolean} result.importSummary.hasExclusions - Whether any fields were excluded
 * @returns {Array<{field: string, reason: string}>} result.importSummary.changedFields - Values the
 *   import set because the form has no input for them, with what was set and why
 *
 * @example
 * const result = await importFiles(file);
 * if (result.success) {
 *   actions.loadImportedFormData(result.formData);
 *   if (result.importSummary) {
 *     showImportSummary(result.importSummary);
 *   }
 * } else {
 *   alert(result.error);
 * }
 */
export async function importFiles(file, options = {}) {
  const { onProgress } = options;

  // Validate input
  if (!file) {
    return {
      success: false,
      error: 'No file provided',
      formData: null,
    };
  }

  // Call progress callback if provided
  if (onProgress) {
    onProgress({ stage: 'reading', progress: 0 });
  }

  // Read file content
  return new Promise((resolve) => {
    const reader = new FileReader();

    // A file that cannot be read leaves the form as it was: formData is null, and the page applies
    // formData only when it is set. (An empty form here would wipe what the user had loaded.)
    reader.onerror = () => {
      // eslint-disable-next-line no-alert
      window.alert(`Error reading file. Please try again.\n\n${FORM_NOT_CHANGED}`);
      resolve({
        success: false,
        error: 'Error reading file. Please try again.',
        formData: null,
      });
    };

    const handleLoad = (evt) => {
      if (onProgress) {
        onProgress({ stage: 'parsing', progress: 30 });
      }

      // TextEdit saves a new document as rich text unless it is made plain text first. The
      // parser's error for that says nothing useful, so say what to do instead.
      if (/^\s*\{\\rtf/.test(evt.target.result)) {
        // eslint-disable-next-line no-alert
        window.alert(
          'This file is saved as rich text (RTF), not plain text, so it cannot be read.\n\n' +
          'In TextEdit, choose Format > Make Plain Text, save the file, and upload it again.\n\n' +
          FORM_NOT_CHANGED
        );
        resolve({
          success: false,
          error: 'The file is rich text (RTF), not plain-text YAML.',
          formData: null,
        });
        return;
      }

      // Parse YAML with error handling
      let jsonFileContent;
      try {
        jsonFileContent = decodeYaml(evt.target.result);
      } catch (parseError) {
        // eslint-disable-next-line no-alert
        window.alert(
          `Invalid YAML file: ${parseError.message}\n\n` +
          `The file could not be parsed. Please check the YAML syntax and try again.\n\n` +
          FORM_NOT_CHANGED
        );
        resolve({
          success: false,
          error: `Invalid YAML file: ${parseError.message}`,
          formData: null,
        });
        return;
      }

      // An empty file, plain text, a list, or a mapping with none of the form's fields (`{}`, or
      // another tool's YAML picked by mistake) parses without error but holds no metadata.
      // Importing it would replace the form with an empty one.
      if (
        jsonFileContent === null ||
        typeof jsonFileContent !== 'object' ||
        Array.isArray(jsonFileContent) ||
        !Object.keys(emptyFormData).some((key) => Object.hasOwn(jsonFileContent, key))
      ) {
        // eslint-disable-next-line no-alert
        window.alert(
          'No metadata was found in this file, so nothing was imported.\n\n' +
          'The file is empty, or it is not a metadata YAML file (one with fields such as lab, ' +
          'session_id and subject).\n\n' +
          FORM_NOT_CHANGED
        );
        resolve({
          success: false,
          error: 'The file does not contain any metadata fields.',
          formData: null,
        });
        return;
      }

      if (onProgress) {
        onProgress({ stage: 'validating', progress: 50 });
      }

      // Files written by earlier versions carry a shank's bad channels on that
      // shank's row, which trodes_to_nwb never reads: move them to the group's
      // first row, as electrode ids, before validating the file.
      jsonFileContent = canonicalizeFileBadChannels(jsonFileContent);

      // Files written before stale camera references were cleaned up may
      // reference cameras that no longer exist; drop those references rather
      // than excluding the whole section on validation.
      jsonFileContent = removeStaleCameraReferences(jsonFileContent);

      // trodes_to_nwb passes the subject to pynwb's Subject, which fails on any field it does not
      // know, and the form has no way to remove one. Leave such fields out before validating (so
      // they cannot cost the whole subject) and name each one in the summary.
      const leftOutFields = unknownSubjectFields(jsonFileContent.subject).map((key) => ({
        field: `subject.${key}`,
        reason: `Left out: "${key}" is not a field of the NWB subject, and trodes_to_nwb fails on it.`,
      }));
      if (leftOutFields.length > 0) {
        const subject = { ...jsonFileContent.subject };
        unknownSubjectFields(subject).forEach((key) => delete subject[key]);
        jsonFileContent = { ...jsonFileContent, subject };
      }

      // Rule problems the form has no input to fix: repair them, or leave out just the item or
      // field, and name each one in the summary.
      const repairs = repairForImport(jsonFileContent);
      jsonFileContent = repairs.content;
      leftOutFields.push(...repairs.leftOut);

      // Validate YAML content. Only SCHEMA errors leave a section out. A business-rule error (a
      // repeated name, a stale choice, a duplicate ntrode id) is one the form can fix, so it is
      // loaded and the download gate blocks it until it is fixed: leaving out the section would
      // lose every item in it. A warning is advisory, so its value is imported too.
      const issues = blockingIssues(validate(jsonFileContent)).filter(isSchemaIssue);

      if (issues.length === 0) {
        // No validation errors - ensure relevant keys exist and load all data
        const formContentKeys = Object.keys(emptyFormData);
        formContentKeys.forEach((key) => {
          if (!Object.hasOwn(jsonFileContent, key)) {
            jsonFileContent[key] = emptyFormData[key];
          }
        });

        if (onProgress) {
          onProgress({ stage: 'complete', progress: 100 });
        }

        // Build import summary for successful import
        const importedFields = formContentKeys.filter(key =>
          Object.hasOwn(jsonFileContent, key) &&
          jsonFileContent[key] !== emptyFormData[key]
        );

        resolve({
          success: true,
          error: null,
          // The form ticks each bad channel on the row and channel that map to it
          formData: structuredClone(toFormBadChannels(jsonFileContent)),
          importSummary: {
            totalFields: formContentKeys.filter(key => Object.hasOwn(jsonFileContent, key)).length,
            importedFields,
            excludedFields: leftOutFields,
            hasExclusions: leftOutFields.length > 0,
            changedFields: repairs.changed,
          },
        });
        return;
      }

      // Validation errors found - partial import
      if (onProgress) {
        onProgress({ stage: 'partial-import', progress: 70 });
      }

      // Extract top-level field IDs from paths (e.g., "cameras[0].id" → "cameras")
      const allErrorIds = [
        ...new Set(
          issues.map(issue => {
            const topLevelField = issue.path.split('[')[0].split('.')[0];
            return topLevelField;
          })
        )
      ];

      const formContent = structuredClone(emptyFormData);
      const formContentKeys = Object.keys(formContent);

      // Import only fields that don't have validation errors
      // and match the expected type
      formContentKeys.forEach((key) => {
        if (
          !allErrorIds.includes(key) &&
          Object.hasOwn(jsonFileContent, key)
        ) {
          // Check type compatibility before importing
          const expectedType = typeof formContent[key];
          const actualType = typeof jsonFileContent[key];

          // Only import if types match
          if (expectedType === actualType) {
            formContent[key] = structuredClone(jsonFileContent[key]);
          }
        }
      });

      // Ensure subject exists
      if (!formContent.subject) {
        formContent.subject = structuredClone(emptyFormData.subject);
      }

      // Validate and fix subject.sex
      const genders = genderAcronym();
      if (!genders.includes(formContent.subject.sex)) {
        formContent.subject.sex = 'U';
      }

      if (onProgress) {
        onProgress({ stage: 'complete', progress: 100 });
      }

      // Build import summary
      const importedFields = formContentKeys.filter(key =>
        !allErrorIds.includes(key) && Object.hasOwn(jsonFileContent, key)
      );

      const excludedFields = allErrorIds.map(fieldId => ({
        field: fieldId,
        reason: issues
          .filter(issue => issue.path.split('[')[0].split('.')[0] === fieldId)
          .map(issue => issue.message)[0] || 'Validation error'
      }));

      // Subject fields, and items, left out before validation (see above).
      excludedFields.push(...leftOutFields);

      // A change to a section that is left out did not happen.
      const changedFields = repairs.changed.filter(
        ({ field }) => !allErrorIds.includes(field.split(/[.[]/)[0])
      );

      resolve({
        success: true,
        error: null,
        formData: structuredClone(toFormBadChannels(formContent)),
        importSummary: {
          totalFields: formContentKeys.filter(key => Object.hasOwn(jsonFileContent, key)).length,
          importedFields,
          excludedFields,
          hasExclusions: excludedFields.length > 0,
          changedFields,
        },
      });
    };

    // An error nothing above expects must still settle the import with a message: uncaught, it
    // left the upload doing nothing at all.
    reader.onload = (evt) => {
      try {
        handleLoad(evt);
      } catch (error) {
        // eslint-disable-next-line no-alert
        window.alert(
          `The file could not be imported because of an unexpected error: ${error.message}\n\n` +
          FORM_NOT_CHANGED
        );
        resolve({
          success: false,
          error: `The file could not be imported: ${error.message}`,
          formData: null,
        });
      }
    };

    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Export form data as YAML file
 *
 * Validates form data, encodes as YAML, and triggers browser download.
 * Errors block the download and are returned instead. Warnings are advisory: they are listed
 * in one confirm dialog, and the file downloads only if the user chooses OK.
 *
 * @param {Object} model - Form data to export
 * @param {Object} [options] - Optional configuration
 * @param {Function} [options.onProgress] - Progress callback (not implemented yet)
 * @returns {Object} Result object with success, error, validationIssues (the errors that blocked
 *   the download), warnings, yaml, and filename; `cancelled` is true when the user chose Cancel
 *
 * @example
 * const result = exportAll(formData);
 * if (result.success) {
 *   // Download triggered automatically
 *   console.log(`Downloaded: ${result.filename}`);
 * } else {
 *   displayErrors(result.validationIssues);
 * }
 */
export function exportAll(model, options = {}) {
  const { onProgress } = options;

  if (onProgress) {
    onProgress({ stage: 'validating', progress: 0 });
  }

  // Clone to avoid mutations. The file carries bad channels as trodes_to_nwb
  // reads them (electrode ids on each group's first row), so translate the
  // form's ticked channels before validating and encoding.
  const form = toFileBadChannels(structuredClone(model));

  // Validate using unified validation API (schema + rules)
  const issues = validate(form);
  const errors = blockingIssues(issues);
  const warnings = issues.filter((issue) => !isBlockingIssue(issue));

  // Errors block the download - return them for the form to show
  if (errors.length > 0) {
    return {
      success: false,
      error: 'Validation failed',
      validationIssues: errors,
      warnings,
      yaml: null,
      filename: null,
    };
  }

  // Warnings are advisory: ask once, listing them all, and download only on OK
  // eslint-disable-next-line no-alert
  if (warnings.length > 0 && !window.confirm(warningsConfirmMessage(warnings))) {
    return {
      success: false,
      cancelled: true,
      error: 'Download cancelled',
      validationIssues: [],
      warnings,
      yaml: null,
      filename: null,
    };
  }

  if (onProgress) {
    onProgress({ stage: 'encoding', progress: 50 });
  }

  // Duplicate keys released trodes_to_nwb versions still read; validation
  // above ran on the canonical model.
  const yAMLForm = encodeYaml(withLegacyConverterKeys(form));
  const fileName = formatDeterministicFilename(form);

  if (onProgress) {
    onProgress({ stage: 'downloading', progress: 80 });
  }

  downloadYamlFile(fileName, yAMLForm);

  if (onProgress) {
    onProgress({ stage: 'complete', progress: 100 });
  }

  return {
    success: true,
    error: null,
    validationIssues: [],
    warnings,
    yaml: yAMLForm,
    filename: fileName,
  };
}
