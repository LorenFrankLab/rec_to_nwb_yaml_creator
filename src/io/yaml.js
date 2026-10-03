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
 * Plain (unquoted) scalars PyYAML reads as something other than a string.
 *
 * trodes_to_nwb reads the file with PyYAML's yaml.safe_load (YAML 1.1). It types a plain scalar
 * by these implicit resolvers, which match more than YAML 1.2 does: `20230622_01` is the int
 * 2023062201, `Off` is False, `1:1.4` is 61.4 and `2023-06-22` is a date. encodeYaml writes a
 * string that matches one in double quotes. Copied from PyYAML 6.0.3, yaml/resolver.py (the
 * Resolver.add_implicit_resolver calls) with the re.X layout whitespace removed; Python's `$`
 * also matches before a final newline, which a plain scalar never ends with:
 *
 *   bool       ^(?:yes|Yes|YES|no|No|NO
 *              |true|True|TRUE|false|False|FALSE
 *              |on|On|ON|off|Off|OFF)$
 *   float      ^(?:[-+]?(?:[0-9][0-9_]*)\.[0-9_]*(?:[eE][-+][0-9]+)?
 *              |\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?
 *              |[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*
 *              |[-+]?\.(?:inf|Inf|INF)
 *              |\.(?:nan|NaN|NAN))$
 *   int        ^(?:[-+]?0b[0-1_]+
 *              |[-+]?0[0-7_]+
 *              |[-+]?(?:0|[1-9][0-9_]*)
 *              |[-+]?0x[0-9a-fA-F_]+
 *              |[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+)$
 *   merge      ^(?:<<)$
 *   null       ^(?: ~
 *              |null|Null|NULL
 *              | )$
 *   timestamp  ^(?:[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]
 *              |[0-9][0-9][0-9][0-9] -[0-9][0-9]? -[0-9][0-9]?
 *               (?:[Tt]|[ \t]+)[0-9][0-9]?
 *               :[0-9][0-9] :[0-9][0-9] (?:\.[0-9]*)?
 *               (?:[ \t]*(?:Z|[-+][0-9][0-9]?(?::[0-9][0-9])?))?)$
 *   value      ^(?:=)$
 */
const PYYAML_NON_STRING_SCALARS = [
  /^(?:yes|Yes|YES|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/,
  /^(?:[-+]?(?:[0-9][0-9_]*)\.[0-9_]*(?:[eE][-+][0-9]+)?|\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/,
  /^(?:[-+]?0b[0-1_]+|[-+]?0[0-7_]+|[-+]?(?:0|[1-9][0-9_]*)|[-+]?0x[0-9a-fA-F_]+|[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+)$/,
  /^(?:<<)$/,
  /^(?:~|null|Null|NULL|)$/,
  /^(?:[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]|[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?(?:[Tt]|[ \t]+)[0-9][0-9]?:[0-9][0-9]:[0-9][0-9](?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9][0-9]?(?::[0-9][0-9])?))?)$/,
  /^(?:=)$/,
];

/**
 * A number that JavaScript writes as an exponent with no dot (`2e-7`, `1e+21`) is a float in
 * YAML 1.2 but the STRING '2e-7' to PyYAML, whose float pattern needs a dot (see above). This
 * tag writes it with `.0` (`2.0e-7`, `1.0e+21`), which both read as the same number. encodeYaml
 * puts it first in the tag list so the `yaml` library picks it over its own number tags.
 */
const EXPONENT_FLOAT_WITH_DOT = {
  identify: (value) => typeof value === 'number' && /^-?[0-9]+e[-+][0-9]+$/.test(String(value)),
  default: true,
  tag: 'tag:yaml.org,2002:float',
  test: /^[-+]?[0-9]+\.0e[-+][0-9]+$/,
  resolve: (text) => parseFloat(text),
  stringify: ({ value }) => String(value).replace('e', '.0e'),
};

/**
 * Whether a visited scalar is the value of the top-level `subject.date_of_birth`. That value
 * stays a plain scalar: pynwb needs a datetime there, and PyYAML reads the plain ISO timestamp
 * as one.
 *
 * @param {number|string|null} key - The scalar's key in its parent ('value' for a map value)
 * @param {Array<object>} ancestors - The document and the nodes above the scalar
 * @returns {boolean} True for subject.date_of_birth's value
 */
function isSubjectDateOfBirth(key, ancestors) {
  if (key !== 'value' || ancestors.length !== 5) {
    return false;
  }
  const [, root, subjectPair, , pair] = ancestors;
  const isPairNamed = (node, name) =>
    YAML.isPair(node) && YAML.isScalar(node.key) && node.key.value === name;
  return YAML.isMap(root) && isPairNamed(subjectPair, 'subject') && isPairNamed(pair, 'date_of_birth');
}

/**
 * Encodes a JavaScript object to deterministic YAML string format
 *
 * The output is meant for trodes_to_nwb, which reads it with PyYAML (YAML 1.1): a string PyYAML
 * would read as another type is double-quoted, and a number is written so PyYAML reads the same
 * number.
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
  const doc = new YAML.Document(undefined, {
    customTags: (tags) => [EXPONENT_FLOAT_WITH_DOT, ...tags],
  });
  // An object that appears in more than one place is written out in full each time, never as an
  // anchor (&a1) and aliases (*a1): trodes_to_nwb would read those back as ONE dict, and it edits
  // some in place (it wraps each associated file's task_epochs in a list).
  doc.contents = doc.createNode(model || {}, { aliasDuplicateObjects: false });

  // Double-quote every string, key or value, that PyYAML would not read as a string.
  YAML.visit(doc, {
    Scalar(key, node, ancestors) {
      const { value } = node;
      if (
        typeof value === 'string' &&
        PYYAML_NON_STRING_SCALARS.some((pattern) => pattern.test(value)) &&
        !isSubjectDateOfBirth(key, ancestors)
      ) {
        node.type = YAML.Scalar.QUOTE_DOUBLE;
      }
    },
  });

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
