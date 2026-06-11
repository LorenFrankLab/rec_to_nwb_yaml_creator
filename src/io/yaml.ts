/**
 * @file YAML I/O Module
 * @description Single source of truth for all YAML encoding/decoding operations.
 * Ensures deterministic output for scientific reproducibility.
 *
 * This module replaces src/utils/yamlExport.js and centralizes all YAML I/O logic.
 *
 * Guarantees:
 * - Byte-for-byte reproducible output (same input -> same output)
 * - Object keys are emitted in the input object's insertion order (NOT sorted)
 * - Unix line endings (\n)
 * - UTF-8 encoding
 * - Consistent quoting rules
 *
 * @module io/yaml
 */

import YAML from 'yaml';

/**
 * Encodes a JavaScript value to deterministic YAML string format.
 *
 * The value is assigned directly to a fresh `Document`'s `contents` (rather than
 * passed to the constructor) so it is serialized as-is — this exact behavior is
 * what the golden baselines pin, so do not change it.
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
export function encodeYaml(model: unknown): string {
  const doc = new YAML.Document();
  // `yaml` accepts a plain JS value as `contents` and serializes it directly, but
  // its published types narrow the setter to `Node | null`; assert through `unknown`
  // (compile-time only — no runtime change).
  doc.contents = (model || {}) as unknown as typeof doc.contents;

  return doc.toString();
}

/**
 * Decodes a YAML string to a JavaScript value.
 *
 * @throws {YAMLParseError} If YAML string is malformed or has syntax errors
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
 */
export function decodeYaml(text: string): unknown {
  return YAML.parse(text);
}

/**
 * The subset of a form-data model that {@link formatDeterministicFilename} reads.
 * Callers pass the full model; only these fields are consulted.
 */
interface FilenameModel {
  EXPERIMENT_DATE_in_format_mmddYYYY?: string;
  subject?: { subject_id?: string };
}

/**
 * Generates a deterministic filename for metadata YAML export.
 *
 * Format: {EXPERIMENT_DATE_in_format_mmddYYYY}_{subject_id}_metadata.yml
 *
 * This filename format is required by trodes_to_nwb Python package. The file scanner
 * expects this pattern to group files by recording session.
 *
 * @example
 * const model = {
 *   EXPERIMENT_DATE_in_format_mmddYYYY: '06222023',
 *   subject: { subject_id: 'Rat01' }
 * };
 * const filename = formatDeterministicFilename(model);
 * // Returns: "06222023_rat01_metadata.yml"
 */
export function formatDeterministicFilename(model: FilenameModel): string {
  const experimentDate = model.EXPERIMENT_DATE_in_format_mmddYYYY || '{EXPERIMENT_DATE_in_format_mmddYYYY}';
  // `toLowerCase` (not `toLocaleLowerCase`): the download filename must be locale-INDEPENDENT, so
  // the same metadata produces the same filename on every machine (e.g. a Turkish locale lowercases
  // "I" to a dotless "ı"). ASCII subject ids — the norm — are unaffected.
  const subjectId = (model.subject?.subject_id || '').toLowerCase();
  return `${experimentDate}_${subjectId}_metadata.yml`;
}

/**
 * Creates and triggers download of a YAML file in the browser.
 *
 * Creates a blob URL for the YAML content and immediately revokes it after
 * triggering the download to prevent memory leaks.
 *
 * @example
 * const yamlContent = encodeYaml({ key: 'value' });
 * downloadYamlFile('config.yml', yamlContent);
 * // Triggers browser download of config.yml
 */
export function downloadYamlFile(fileName: string, content: string): void {
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
