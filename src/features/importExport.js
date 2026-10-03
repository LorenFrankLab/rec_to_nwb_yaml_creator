/**
 * Import/Export Logic
 *
 * Extracted from App.js to improve modularity and testability.
 * Handles YAML file import/export operations with validation.
 *
 * @module features/importExport
 */

import { validate } from '../validation';
import { removeStaleCameraReferences } from '../utils/cameraReferences';
import {
  canonicalizeFileBadChannels,
  toFileBadChannels,
  toFormBadChannels,
} from '../domain/badChannels';
import { withLegacyConverterKeys } from '../io/legacyCompat';
import {
  decodeYaml,
  encodeYaml,
  downloadYamlFile,
  formatDeterministicFilename
} from '../io/yaml';
import { emptyFormData, genderAcronym } from '../valueList';
import { blockingIssues, isBlockingIssue } from '../validation/issueTypes';
import { subjectValueRules, unknownSubjectFields } from '../validation/rules/subjectValueRules';
import { legacyFormRules } from '../validation/rules/legacyFormRules';

/**
 * The legacy form's validation: the shared schema + rules, plus the rules only this form needs
 * (the workspace enforces those through its own day model; see legacyFormRules).
 *
 * @param {object} model - The form data (or a parsed file).
 * @returns {Array<object>} Validation issues.
 */
function validateLegacyForm(model) {
  return [...validate(model), ...legacyFormRules(model)];
}

/**
 * Extracts the top-level form field id from a normalized validation path.
 *
 * Partial import excludes by top-level section, so the section parsed here must be a
 * real `emptyFormData` key. Robust to every path shape `validate` can produce:
 *   - `cameras[0].camera_name` → `cameras`
 *   - `subject.weight`         → `subject`
 *   - `cameras`                → `cameras`
 *   - `''` / non-string        → `''` (callers filter these out)
 *
 * @param {string} issuePath - Normalized issue path (dot + bracket notation).
 * @returns {string} The top-level field id, or `''` when the path is empty/invalid.
 */
function topLevelFieldFromPath(issuePath) {
  if (typeof issuePath !== 'string' || issuePath.length === 0) return '';
  return issuePath.split('[')[0].split('.')[0];
}

/**
 * Blocking issues an upload does NOT leave a section out for: the value stops trodes_to_nwb, but
 * the user can fix it in the form, so it is imported and the download stays blocked until it is.
 * Leaving out the section threw away every other value in it (all the fibers, or the whole
 * subject). Files written by earlier versions often have repeated opto names: Add copied the name.
 */
const FIXED_IN_FORM = new Set([
  'duplicate_opto_device_name', // rename the fiber, injection or source
  'invalid_injection_hemisphere', // choose left or right
  'subject_date_of_birth_format', // pick the date of birth again
  'subject_value_type', // only a numeric age is left by now (see below): retype it in the Age field
  'no_tasks', // add a task
]);

/** Every message for an import that fails says so: the page keeps the form it already has. */
const FORM_NOT_CHANGED = 'The form was not changed.';

/**
 * Says where an issue is, in words: `cameras[0].meters_per_pixel` → "Cameras 1, meters per pixel",
 * `subject.subject_id` → "Subject, subject id". List positions are counted from 1.
 *
 * @param {string} issuePath - Normalized issue path (dot + bracket notation).
 * @returns {string} The location, or "File" for an issue about the whole file.
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
 * @param {Array<{path: string, message: string}>} warnings - Advisory issues.
 * @returns {string} The confirm message.
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
 * fields have validation ERRORS; warning-severity issues never exclude a
 * section — the value is imported so the user can see and fix it in the form.
 * Neither do the errors the form can fix (FIXED_IN_FORM): those are imported and
 * listed in `importSummary.toFix`, and they block the download until fixed.
 *
 * @param {File} file - File object to import
 * @param {object} [options] - Optional configuration
 * @param {Function} [options.onProgress] - Progress callback (not implemented yet)
 * @returns {Promise<object>} Result object
 * @returns {boolean} result.success - Whether import succeeded
 * @returns {string|null} result.error - Error message if failed
 * @returns {object | null} result.formData - Validated form data; null when nothing can be imported
 *   (no file, unreadable, rich text, not valid YAML, no metadata fields, or an unexpected error),
 *   so the caller keeps the form it already has
 * @returns {object} [result.importSummary] - Import summary (only present on success)
 * @returns {number} result.importSummary.totalFields - Total fields in YAML file
 * @returns {string[]} result.importSummary.importedFields - Successfully imported field names
 * @returns {Array<{field: string, reason: string, paths: string[]}>} result.importSummary.excludedFields - Excluded fields with the first validation reason and the full nested paths under that section
 * @returns {boolean} result.importSummary.hasExclusions - Whether any fields were excluded
 * @returns {Array<{path: string, location: string, code: string, message: string}>} result.importSummary.toFix - Errors in imported values that block the download until fixed in the form
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
      const leftOutSubjectFields = unknownSubjectFields(jsonFileContent.subject).map((key) => ({
        field: `subject.${key}`,
        reason: `Left out: "${key}" is not a field of the NWB subject, and trodes_to_nwb fails on it.`,
        paths: [],
      }));
      // The same for a subject value of a type pynwb rejects that the form has no field to fix: a
      // strain or age__reference (no field), or an age that is not text (a number shows in the Age
      // field, so it is kept and retyped there).
      const subjectAge = jsonFileContent.subject?.age;
      const uneditableSubjectValues = subjectValueRules({ subject: jsonFileContent.subject })
        .filter((issue) => issue.code === 'subject_value_type')
        .filter((issue) => !(issue.field === 'age' && typeof subjectAge === 'number'));
      leftOutSubjectFields.push(
        ...uneditableSubjectValues.map((issue) => ({
          field: `subject.${issue.field}`,
          reason: `Left out: ${issue.message}`,
          paths: [],
        }))
      );
      if (leftOutSubjectFields.length > 0) {
        const subject = { ...jsonFileContent.subject };
        unknownSubjectFields(subject).forEach((key) => delete subject[key]);
        uneditableSubjectValues.forEach((issue) => delete subject[issue.field]);
        jsonFileContent = { ...jsonFileContent, subject };
      }

      // Validate YAML content. Only ERRORS exclude a section: a warning is advisory (a
      // placeholder subject id, a non-absolute associated-file path) and the value must survive
      // the import so the user can see and fix it in the form. Excluding on a warning silently
      // discards a whole section of a scientifically valid file. Nor do the errors the user can
      // fix in the form (FIXED_IN_FORM): those are listed in the summary and block the download.
      const errors = blockingIssues(validateLegacyForm(jsonFileContent));
      const issues = errors.filter((issue) => !FIXED_IN_FORM.has(issue.code));
      const issuesToFix = (excludedSections) =>
        errors
          .filter((issue) => FIXED_IN_FORM.has(issue.code))
          .filter((issue) => !excludedSections.includes(topLevelFieldFromPath(issue.path)))
          .map(({ path: issuePath, code, message }) => ({
            path: issuePath,
            location: describeIssueLocation(issuePath),
            code,
            message,
          }));

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
            excludedFields: leftOutSubjectFields,
            hasExclusions: leftOutSubjectFields.length > 0,
            toFix: issuesToFix([]),
          },
        });
        return;
      }

      // Validation errors found - partial import
      if (onProgress) {
        onProgress({ stage: 'partial-import', progress: 70 });
      }

      // Extract top-level field IDs from paths (e.g., "cameras[0].id" → "cameras").
      // A nested-required path such as "cameras[0].camera_name" must resolve to the
      // real section "cameras" so the invalid section is excluded — not the bare
      // missing property, which is not a top-level key and would let it slip through.
      const allErrorIds = [
        ...new Set(issues.map(issue => topLevelFieldFromPath(issue.path)).filter(Boolean))
      ];

      const formContent = structuredClone(emptyFormData);
      const formContentKeys = Object.keys(formContent);

      // Import only fields that don't have validation errors and match the expected
      // type. Track what was ACTUALLY assigned (and what was skipped on a type mismatch)
      // so the summary reports the truth rather than inferring it from presence alone.
      const importedFields = [];
      const typeMismatchedFields = [];
      formContentKeys.forEach((key) => {
        if (allErrorIds.includes(key) || !Object.hasOwn(jsonFileContent, key)) {
          return;
        }
        const expectedType = typeof formContent[key];
        const actualType = typeof jsonFileContent[key];

        if (expectedType === actualType) {
          formContent[key] = structuredClone(jsonFileContent[key]);
          importedFields.push(key);
        } else {
          // Skipped: the YAML value's type doesn't match the form's. Don't claim it was
          // imported, and don't silently drop it — record it for the excluded summary.
          typeMismatchedFields.push({ key, expectedType, actualType });
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
      const excludedFields = allErrorIds.map(fieldId => {
        const fieldIssues = issues.filter(
          issue => topLevelFieldFromPath(issue.path) === fieldId
        );
        return {
          field: fieldId,
          reason: fieldIssues.map(issue => issue.message)[0] || 'Validation error',
          // The full nested validation paths under this section (e.g.
          // "cameras[0].camera_name"), so the notice can name the exact field at
          // fault — not just that "cameras" was dropped.
          paths: [...new Set(fieldIssues.map(issue => issue.path).filter(Boolean))],
        };
      });

      // Document-level issues (empty top-level field, e.g. a root type error) map to no
      // form section, so they're dropped from `allErrorIds` above. Surface them in their
      // own summary entry rather than silently swallowing them — every validation issue
      // must be accounted for in the summary.
      const documentLevelIssues = issues.filter(
        issue => topLevelFieldFromPath(issue.path) === ''
      );
      if (documentLevelIssues.length > 0) {
        excludedFields.push({
          field: 'document',
          reason: documentLevelIssues.map(issue => issue.message)[0] || 'Validation error',
          paths: [...new Set(documentLevelIssues.map(issue => issue.path).filter(Boolean))],
        });
      }

      // Subject fields left out before validation (see above).
      excludedFields.push(...leftOutSubjectFields);

      // Fields skipped on a type mismatch are excluded too — surface them so a skipped
      // field is never silently absent from both the imported and excluded lists.
      typeMismatchedFields.forEach(({ key, expectedType, actualType }) => {
        excludedFields.push({
          field: key,
          reason: `Type mismatch: expected ${expectedType}, but the file had ${actualType}`,
          paths: [],
        });
      });

      resolve({
        success: true,
        error: null,
        formData: structuredClone(toFormBadChannels(formContent)),
        importSummary: {
          totalFields: formContentKeys.filter(key => Object.hasOwn(jsonFileContent, key)).length,
          importedFields,
          excludedFields,
          hasExclusions: excludedFields.length > 0,
          toFix: issuesToFix(allErrorIds),
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
 * @param {object} model - Form data to export
 * @param {object} [options] - Optional configuration
 * @param {Function} [options.onProgress] - Progress callback (not implemented yet)
 * @returns {object} Result object with success, error, validationIssues (the errors that blocked
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

  // Validate using unified validation API (schema + rules) plus the legacy-form rules
  const issues = validateLegacyForm(form);
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
