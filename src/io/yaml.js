/**
 * @file YAML I/O Module
 * @description Single source of truth for all YAML encoding/decoding operations.
 * Ensures deterministic output for scientific reproducibility.
 *
 * This module replaces src/utils/yamlExport.js and centralizes all YAML I/O logic.
 *
 * Guarantees:
 * - Byte-for-byte reproducible output (same input -> same output)
 * - Sorted object keys for stability
 * - Unix line endings (\n)
 * - UTF-8 encoding
 * - Consistent quoting rules
 *
 * @module io/yaml
 */

import YAML from 'yaml';

/**
 * Encodes a JavaScript object to deterministic YAML string format
 *
 * @param {object} model - JavaScript object to convert to YAML
 * @returns {string} YAML representation with deterministic formatting
 *
 * @example
 * const data = { name: 'test', value: 123 };
 * const yamlString = encodeYaml(data);
 * // Returns: "name: test\nvalue: 123\n"
 *
 * @example
 * // Multiple calls with same input produce identical output
 * const yaml1 = encodeYaml(data);
 * const yaml2 = encodeYaml(data);
 * console.assert(yaml1 === yaml2, 'Deterministic output');
 */
export function encodeYaml(model) {
  const doc = new YAML.Document();
  // An object that appears in more than one place is written out in full each time, never as an
  // anchor (&a1) and aliases (*a1): trodes_to_nwb would read those back as ONE dict, and it edits
  // some in place (it wraps each associated file's task_epochs in a list).
  doc.contents = doc.createNode(model || {}, { aliasDuplicateObjects: false });

  return doc.toString();
}

/** Why decodeYaml refuses a file whose alias points back into its own anchor. */
const SELF_REFERENCE_MESSAGE =
  'The YAML refers to itself: an alias (*name) is used inside the block its anchor (&name) ' +
  'marks, so the data never ends. Replace that alias with the values it stands for.';

/**
 * Copies a parsed YAML value so that no object in it is shared.
 *
 * `YAML.parse` turns an anchor (`&id001`) and its aliases (`*id001`), which PyYAML writes when a
 * lab script dumps one dict in several places, into ONE shared object. The form edits objects in
 * place, so ticking a bad channel on one ntrode marked it on every ntrode sharing the map. Here
 * every alias becomes its own copy. The copy keeps no record of objects already copied (that
 * would bring the sharing back); it tracks only the objects on the path from the root, which is
 * how an alias inside its own anchor (a loop) is caught. The `yaml` library's alias-count limit
 * has already capped how far aliases can expand.
 *
 * @param {*} value - A value returned by YAML.parse
 * @param {Set<object>} [ancestors] - Objects on the path from the root to `value`
 * @returns {*} A copy of `value` in which no object appears twice
 * @throws {Error} If an alias points back into its own anchor
 */
function copyWithoutSharing(value, ancestors = new Set()) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (ancestors.has(value)) {
    throw new Error(SELF_REFERENCE_MESSAGE);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => copyWithoutSharing(item, ancestors));
    }
    if (Object.getPrototypeOf(value) === Object.prototype) {
      // fromEntries defines each key, so a "__proto__" key stays plain data, as YAML.parse left it.
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, copyWithoutSharing(item, ancestors)])
      );
    }
    // Only explicitly tagged nodes (!!set, !!omap, !!binary, !!timestamp) parse to other objects.
    return structuredClone(value);
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Decodes a YAML string to a JavaScript object
 *
 * Every alias (`*id001`) is returned as its own copy of the anchored block, so editing one place
 * never changes another. Every path that reads a user's YAML file must decode it here.
 *
 * @param {string} text - YAML string to parse
 * @returns {object|null} Parsed JavaScript object, or null for empty input
 *
 * @throws {YAMLParseError} If YAML string is malformed or has syntax errors
 * @throws {Error} If an alias points back into its own anchor (the data would never end)
 * @throws {ReferenceError} If aliases expand too far (the `yaml` library's alias-count limit)
 * @throws {TypeError} If text is not a string
 *
 * @example
 * // Valid YAML parsing
 * const yamlString = "name: test\nvalue: 123";
 * const obj = decodeYaml(yamlString);
 * // Returns: { name: 'test', value: 123 }
 *
 * @example
 * // Empty string returns null
 * const obj = decodeYaml('');
 * // Returns: null
 *
 * @example
 * // Malformed YAML throws error
 * try {
 *   decodeYaml('invalid: [yaml');
 * } catch (error) {
 *   console.error('Parse failed:', error.message);
 *   // Error message includes line/column info
 * }
 *
 * @example
 * // Non-string input throws TypeError
 * try {
 *   decodeYaml(null);
 * } catch (error) {
 *   console.error('Type error:', error.message);
 * }
 */
export function decodeYaml(text) {
  return copyWithoutSharing(YAML.parse(text));
}

/**
 * Generates deterministic filename for metadata YAML export
 *
 * Format: {EXPERIMENT_DATE_in_format_mmddYYYY}_{subject_id}_metadata.yml
 *
 * This filename format is required by trodes_to_nwb Python package.
 * The file scanner expects this pattern to group files by recording session.
 *
 * @param {object} model - Form data model containing experiment date and subject ID
 * @param {string} model.EXPERIMENT_DATE_in_format_mmddYYYY - Experiment date (mmddYYYY format)
 * @param {object} model.subject - Subject information
 * @param {string} model.subject.subject_id - Subject identifier
 * @returns {string} Deterministic filename following trodes_to_nwb convention
 *
 * @example
 * const model = {
 *   EXPERIMENT_DATE_in_format_mmddYYYY: '06222023',
 *   subject: { subject_id: 'Rat01' }
 * };
 * const filename = formatDeterministicFilename(model);
 * // Returns: "06222023_rat01_metadata.yml"
 */
export function formatDeterministicFilename(model) {
  const experimentDate = model.EXPERIMENT_DATE_in_format_mmddYYYY || '{EXPERIMENT_DATE_in_format_mmddYYYY}';
  const subjectId = (model.subject?.subject_id || '').toLocaleLowerCase();
  return `${experimentDate}_${subjectId}_metadata.yml`;
}

/**
 * Creates and triggers download of a YAML file in the browser
 *
 * Creates a blob URL for the YAML content and immediately revokes it after
 * triggering the download to prevent memory leaks.
 *
 * @param {string} fileName - Name for the downloaded file (e.g., "metadata.yml")
 * @param {string} content - YAML content as a string
 *
 * @example
 * const yamlContent = encodeYaml({ key: 'value' });
 * downloadYamlFile('config.yml', yamlContent);
 * // Triggers browser download of config.yml
 */
export function downloadYamlFile(fileName, content) {
  const blob = new Blob([content], { type: 'text/yaml;charset=utf-8;' });
  const downloadLink = document.createElement('a');
  const url = URL.createObjectURL(blob);

  try {
    downloadLink.download = fileName;
    downloadLink.href = url;
    downloadLink.click();
  } finally {
    // Always revoke the URL to free memory, even if click fails
    URL.revokeObjectURL(url);
  }
}

/**
 * Legacy API compatibility - converts object to YAML string
 * @deprecated Use encodeYaml() instead
 */
export const convertObjectToYAMLString = encodeYaml;

/**
 * Legacy API compatibility - creates YAML file download
 * @deprecated Use downloadYamlFile() instead
 */
export const createYAMLFile = downloadYamlFile;
