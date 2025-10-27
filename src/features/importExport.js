/**
 * Import/Export Logic
 *
 * Extracted from App.js to improve modularity and testability.
 * Handles YAML file import/export operations with validation.
 *
 * @module features/importExport
 */

import YAML from 'yaml';
import { validate } from '../validation';
import {
  encodeYaml,
  downloadYamlFile,
  formatDeterministicFilename
} from '../io/yaml';
import { emptyFormData, genderAcronym } from '../valueList';

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
 * @returns {Object|null} result.formData - Validated form data
 * @returns {Object} [result.importSummary] - Import summary (only present on success)
 * @returns {number} result.importSummary.totalFields - Total fields in YAML file
 * @returns {string[]} result.importSummary.importedFields - Successfully imported field names
 * @returns {Array<{field: string, reason: string}>} result.importSummary.excludedFields - Excluded fields with validation reasons
 * @returns {boolean} result.importSummary.hasExclusions - Whether any fields were excluded
 *
 * @example
 * const result = await importFiles(file);
 * if (result.success) {
 *   setFormData(result.formData);
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

    reader.onerror = () => {
      // eslint-disable-next-line no-alert
      window.alert('Error reading file. Please try again.');
      resolve({
        success: false,
        error: 'Error reading file. Please try again.',
        formData: structuredClone(emptyFormData),
      });
    };

    reader.onload = (evt) => {
      if (onProgress) {
        onProgress({ stage: 'parsing', progress: 30 });
      }

      // Parse YAML with error handling
      let jsonFileContent;
      try {
        jsonFileContent = YAML.parse(evt.target.result);
      } catch (parseError) {
        // eslint-disable-next-line no-alert
        window.alert(
          `Invalid YAML file: ${parseError.message}\n\n` +
          `The file could not be parsed. Please check the YAML syntax and try again.`
        );
        resolve({
          success: false,
          error: `Invalid YAML file: ${parseError.message}`,
          formData: structuredClone(emptyFormData),
        });
        return;
      }

      if (onProgress) {
        onProgress({ stage: 'validating', progress: 50 });
      }

      // Validate YAML content
      const issues = validate(jsonFileContent);

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
          formData: structuredClone(jsonFileContent),
          importSummary: {
            totalFields: formContentKeys.filter(key => Object.hasOwn(jsonFileContent, key)).length,
            importedFields,
            excludedFields: [],
            hasExclusions: false,
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

      resolve({
        success: true,
        error: null,
        formData: structuredClone(formContent),
        importSummary: {
          totalFields: formContentKeys.filter(key => Object.hasOwn(jsonFileContent, key)).length,
          importedFields,
          excludedFields,
          hasExclusions: excludedFields.length > 0,
        },
      });
    };

    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Export form data as YAML file
 *
 * Validates form data, encodes as YAML, and triggers browser download.
 * Returns validation issues if validation fails instead of downloading.
 *
 * @param {Object} model - Form data to export
 * @param {Object} [options] - Optional configuration
 * @param {Function} [options.onProgress] - Progress callback (not implemented yet)
 * @returns {Object} Result object with success, error, validationIssues, yaml, and filename
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

  // Clone to avoid mutations
  const form = structuredClone(model);

  // Validate using unified validation API (schema + rules)
  const issues = validate(form);

  // If validation passes, generate and download YAML
  if (issues.length === 0) {
    if (onProgress) {
      onProgress({ stage: 'encoding', progress: 50 });
    }

    const yAMLForm = encodeYaml(form);
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
      yaml: yAMLForm,
      filename: fileName,
    };
  }

  // Validation failed - return issues
  return {
    success: false,
    error: 'Validation failed',
    validationIssues: issues,
    yaml: null,
    filename: null,
  };
}
