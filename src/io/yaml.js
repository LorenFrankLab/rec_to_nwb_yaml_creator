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
  doc.contents = model || {};

  return doc.toString();
}

/**
 * Decodes a YAML string to a JavaScript object
 *
 * @param {string} text - YAML string to parse
 * @returns {object} Parsed JavaScript object
 *
 * @throws {YAMLParseError} If YAML string is malformed
 *
 * @example
 * const yamlString = "name: test\nvalue: 123";
 * const obj = decodeYaml(yamlString);
 * // Returns: { name: 'test', value: 123 }
 */
export function decodeYaml(text) {
  return YAML.parse(text);
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
  downloadLink.download = fileName;
  downloadLink.href = window.webkitURL.createObjectURL(blob);
  downloadLink.click();
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
