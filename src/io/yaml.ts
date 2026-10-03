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
import type { ScalarTag } from 'yaml';

/**
 * Plain (unquoted) scalars PyYAML reads as something other than a string.
 *
 * trodes_to_nwb reads the file with PyYAML's yaml.safe_load (YAML 1.1). It types a plain scalar
 * by these implicit resolvers, which match more than YAML 1.2 does: `20230622_01` is the int
 * 2023062201, `Off` is False, `1:1.4` is 61.4 and `2023-06-22` is a date. {@link encodeYaml}
 * writes a string that matches one in double quotes. Copied from PyYAML 6.0.3, yaml/resolver.py
 * (the Resolver.add_implicit_resolver calls) with the re.X layout whitespace removed; Python's `$`
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
const PYYAML_NON_STRING_SCALARS: readonly RegExp[] = [
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
 * YAML 1.2 but the STRING '2e-7' to PyYAML, whose float pattern needs a dot (see above). This tag
 * writes it with `.0` (`2.0e-7`, `1.0e+21`), which both read as the same number.
 * {@link encodeYaml} puts it first in the tag list so the `yaml` library picks it over its own
 * number tags.
 */
const EXPONENT_FLOAT_WITH_DOT: ScalarTag = {
  identify: (value) => typeof value === 'number' && /^-?[0-9]+e[-+][0-9]+$/.test(String(value)),
  default: true,
  tag: 'tag:yaml.org,2002:float',
  test: /^[-+]?[0-9]+\.0e[-+][0-9]+$/,
  resolve: (text) => parseFloat(text),
  stringify: ({ value }) => String(value).replace('e', '.0e'),
};

/** Whether `node` is a map entry whose key is the plain string `name`. */
function isPairNamed(node: unknown, name: string): boolean {
  return YAML.isPair(node) && YAML.isScalar(node.key) && node.key.value === name;
}

/**
 * Whether a visited scalar is the value of the top-level `subject.date_of_birth`. That value stays
 * a plain scalar: pynwb needs a datetime there, and PyYAML reads the plain ISO timestamp as one.
 *
 * @param key - The scalar's key in its parent (`'value'` for a map value).
 * @param ancestors - The document and the nodes above the scalar.
 * @returns True for subject.date_of_birth's value.
 */
function isSubjectDateOfBirth(key: unknown, ancestors: readonly unknown[]): boolean {
  if (key !== 'value' || ancestors.length !== 5) {
    return false;
  }
  const [, root, subjectPair, , pair] = ancestors;
  return YAML.isMap(root) && isPairNamed(subjectPair, 'subject') && isPairNamed(pair, 'date_of_birth');
}

/**
 * Encodes a JavaScript value to deterministic YAML string format.
 *
 * The output is meant for trodes_to_nwb, which reads it with PyYAML (YAML 1.1): a string PyYAML
 * would read as another type is double-quoted ({@link PYYAML_NON_STRING_SCALARS}; the value of
 * `subject.date_of_birth` excepted), and a number is written so PyYAML reads the same number
 * ({@link EXPONENT_FLOAT_WITH_DOT}).
 *
 * The nodes are created with the same `createNode` the `Document` would otherwise call while
 * stringifying a plain value, so the output is what the golden baselines pin — except that an
 * object appearing in more than one place is written out in full each time, never as an anchor
 * (`&a1`) and aliases (`*a1`): trodes_to_nwb would read those back as ONE dict, and it edits some
 * in place (it wraps each associated file's `task_epochs` in a list).
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
  const doc = new YAML.Document(undefined, {
    customTags: (tags) => [EXPONENT_FLOAT_WITH_DOT, ...tags],
  });
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

/** Why {@link decodeYaml} refuses a file whose alias points back into its own anchor. */
const SELF_REFERENCE_MESSAGE =
  'The YAML refers to itself: an alias (*name) is used inside the block its anchor (&name) ' +
  'marks, so the data never ends. Replace that alias with the values it stands for.';

/**
 * Copies a parsed YAML value so that no object in it is shared.
 *
 * `YAML.parse` turns an anchor (`&id001`) and its aliases (`*id001`), which PyYAML writes when a
 * lab script dumps one dict in several places, into ONE shared object. The legacy form edits
 * objects in place, so ticking a bad channel on one ntrode marked it on every ntrode sharing the
 * map. Here every alias becomes its own copy. The copy keeps no record of objects already copied
 * (that would bring the sharing back); it tracks only the objects on the path from the root,
 * which is how an alias inside its own anchor (a loop) is caught. The `yaml` library's
 * alias-count limit has already capped how far aliases can expand.
 *
 * @param value - A value returned by `YAML.parse`.
 * @param ancestors - Objects on the path from the root to `value`.
 * @returns A copy of `value` in which no object appears twice.
 * @throws {Error} If an alias points back into its own anchor.
 */
function copyWithoutSharing(value: unknown, ancestors: Set<object> = new Set()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (ancestors.has(value)) {
    throw new Error(SELF_REFERENCE_MESSAGE);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item: unknown) => copyWithoutSharing(item, ancestors));
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
 * Decodes a YAML string to a JavaScript value.
 *
 * Every alias (`*id001`) is returned as its own copy of the anchored block, so editing one place
 * never changes another. Every path that reads a user's YAML file (the legacy form's import and
 * the workspace import) decodes it here.
 *
 * @throws {YAMLParseError} If YAML string is malformed or has syntax errors
 * @throws {Error} If an alias points back into its own anchor (the data would never end)
 * @throws {ReferenceError} If aliases expand too far (the `yaml` library's alias-count limit)
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
  return copyWithoutSharing(YAML.parse(text));
}

/**
 * The subset of a form-data model that {@link formatDeterministicFilename} reads.
 * Callers pass the full model; only these fields are consulted.
 */
interface FilenameModel {
  /** Recording date as `YYYYMMDD`, when the caller knows it (the legacy form has no date field). */
  EXPERIMENT_DATE_in_format_YYYYMMDD?: string;
  subject?: { subject_id?: string };
}

/**
 * Generates a deterministic filename for metadata YAML export.
 *
 * Format: {EXPERIMENT_DATE_in_format_YYYYMMDD}_{subject_id}_metadata.yml
 *
 * trodes_to_nwb groups a session's files by name (data_scanner.py): it splits the name on `_`,
 * reads the first part as the integer date and the second as the animal, and matches them with
 * the recordings, named `{YYYYMMDD}_{animal}_{epoch}_{tag}.rec`. So the date is year-first and
 * the subject id is written exactly as entered: a month-first date or a lower-cased animal puts
 * the file in another group, and the session converts without it ("There must be exactly one
 * metadata file per session"). This is the contract workspace downloads follow through
 * `formatRecordingMetadataFilename` (src/domain/recordingFilename.ts). The legacy form has no
 * date field, so without `EXPERIMENT_DATE_in_format_YYYYMMDD` the name starts with that
 * placeholder for the user to replace with the recording date.
 *
 * @example
 * formatDeterministicFilename({ subject: { subject_id: 'Rat01' } });
 * // Returns: "{EXPERIMENT_DATE_in_format_YYYYMMDD}_Rat01_metadata.yml"
 *
 * @example
 * const model = {
 *   EXPERIMENT_DATE_in_format_YYYYMMDD: '20230622',
 *   subject: { subject_id: 'Rat01' }
 * };
 * const filename = formatDeterministicFilename(model);
 * // Returns: "20230622_Rat01_metadata.yml"
 */
export function formatDeterministicFilename(model: FilenameModel): string {
  const experimentDate = model.EXPERIMENT_DATE_in_format_YYYYMMDD || '{EXPERIMENT_DATE_in_format_YYYYMMDD}';
  const subjectId = model.subject?.subject_id || '';
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
