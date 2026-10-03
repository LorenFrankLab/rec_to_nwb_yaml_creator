/**
 * @file Tests that encodeYaml writes values trodes_to_nwb reads back with the same type
 *
 * Function location: src/io/yaml
 *
 * The app writes YAML with the `yaml` library (YAML 1.2); trodes_to_nwb reads it with PyYAML's
 * `yaml.safe_load` (YAML 1.1). A plain (unquoted) scalar is typed by PyYAML's implicit resolvers,
 * which read more than YAML 1.2 does: `20230622_01` is the int 2023062201, `Off` is False,
 * `1:1.4` is 61.4, `2023-06-22` is a date, and `2e-7` (no dot) is the STRING '2e-7'.
 *
 * The oracle below is PyYAML's own resolver table, so CI (which has no Python) checks every
 * scalar the encoder writes the way the converter will read it. Source: PyYAML 6.0.3
 * yaml/resolver.py, the Resolver.add_implicit_resolver calls (bool, float, int, merge, null,
 * timestamp, value), with the re.X layout whitespace removed.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { decodeYaml, encodeYaml } from '../../../io/yaml';

/** PyYAML 6.0.3 implicit resolvers, in the order PyYAML tries them. */
const PYYAML_IMPLICIT_RESOLVERS = {
  bool: /^(?:yes|Yes|YES|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/,
  float: new RegExp(
    '^(?:[-+]?(?:[0-9][0-9_]*)\\.[0-9_]*(?:[eE][-+][0-9]+)?' +
      '|\\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?' +
      '|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*' +
      '|[-+]?\\.(?:inf|Inf|INF)' +
      '|\\.(?:nan|NaN|NAN))$'
  ),
  int: new RegExp(
    '^(?:[-+]?0b[0-1_]+' +
      '|[-+]?0[0-7_]+' +
      '|[-+]?(?:0|[1-9][0-9_]*)' +
      '|[-+]?0x[0-9a-fA-F_]+' +
      '|[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+)$'
  ),
  merge: /^(?:<<)$/,
  null: /^(?:~|null|Null|NULL|)$/,
  timestamp: new RegExp(
    '^(?:[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' +
      '|[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?' +
      '(?:[Tt]|[ \\t]+)[0-9][0-9]?' +
      ':[0-9][0-9]:[0-9][0-9](?:\\.[0-9]*)?' +
      '(?:[ \\t]*(?:Z|[-+][0-9][0-9]?(?::[0-9][0-9])?))?)$'
  ),
  value: /^(?:=)$/,
};

/**
 * The type PyYAML's safe_load gives a scalar: quoted and block scalars are always strings; a
 * plain scalar takes the first implicit resolver that matches it.
 *
 * @param {import('yaml').Scalar} node - A scalar from YAML.parseDocument
 * @returns {string} 'str', or the matching resolver's name
 */
function pyYamlType(node) {
  if (node.type !== 'PLAIN') {
    return 'str';
  }
  const match = Object.entries(PYYAML_IMPLICIT_RESOLVERS).find(([, pattern]) => pattern.test(node.source));
  return match ? match[0] : 'str';
}

/**
 * The number PyYAML reads from a plain int or float scalar, for the forms a JS number is written
 * in (decimal digits with an optional dot and exponent, .inf, -.inf, .nan).
 *
 * @param {string} plain - The scalar as written
 * @returns {number} The value
 */
function pyYamlNumber(plain) {
  const text = plain.replace(/_/g, '').toLowerCase();
  if (text === '.nan') {
    return NaN;
  }
  if (/^[-+]?\.inf$/.test(text)) {
    return text.startsWith('-') ? -Infinity : Infinity;
  }
  return Number(text);
}

/**
 * Whether a visited scalar is the value of the top-level subject's date_of_birth.
 *
 * @param {number|string|null} key - The scalar's key in its parent ('value' for a map value)
 * @param {Array<object>} ancestors - The document and the nodes above the scalar
 * @returns {boolean} True for subject.date_of_birth's value
 */
function isSubjectDateOfBirth(key, ancestors) {
  const [, root, subjectPair, , pair] = ancestors;
  return (
    key === 'value' &&
    ancestors.length === 5 &&
    YAML.isMap(root) &&
    YAML.isPair(subjectPair) &&
    subjectPair.key?.value === 'subject' &&
    YAML.isPair(pair) &&
    pair.key?.value === 'date_of_birth'
  );
}

/**
 * Asserts that PyYAML reads every scalar in `yamlText` as the type (and number) the app meant:
 * strings as str (subject.date_of_birth as a timestamp, which pynwb needs), numbers as the same
 * int or float, booleans as bool and null as None.
 *
 * @param {string} yamlText - encodeYaml output
 */
function expectPyYamlReadsTheSameValues(yamlText) {
  YAML.visit(YAML.parseDocument(yamlText), {
    Scalar(key, node, ancestors) {
      const read = pyYamlType(node);
      const where = `${JSON.stringify(node.source)} (${key})`;
      if (typeof node.value === 'string') {
        expect(read, where).toBe(isSubjectDateOfBirth(key, ancestors) ? 'timestamp' : 'str');
      } else if (typeof node.value === 'number') {
        expect(['int', 'float'], where).toContain(read);
        expect(pyYamlNumber(node.source), where).toBe(node.value);
      } else if (typeof node.value === 'boolean') {
        expect(read, where).toBe('bool');
      } else {
        expect(read, where).toBe('null');
      }
    },
  });
}

/** Strings PyYAML would read as something else if they were written without quotes. */
const LOOKALIKE_STRINGS = [
  // bool
  'yes', 'Yes', 'YES', 'no', 'No', 'NO', 'on', 'On', 'ON', 'off', 'Off', 'OFF',
  'true', 'True', 'FALSE',
  // int: underscores, binary, octal, hex, base 60
  '20230622_01', '1_000', '0b101', '-0b1_0', '0_17', '017', '0x1F', '+0x1f', '1:30', '-1:30', '190:20:30',
  // float: underscores, base 60, special values
  '1:1.4', '1_0:59.5', '1_000.5', '1.5', '.5', '1.', '-1.', '1.0e+5', '.inf', '-.Inf', '.nan', '.NAN',
  // null, merge, value
  '~', 'null', 'Null', 'NULL', '', '<<', '=',
  // timestamp
  '2023-06-22', '2023-6-2 1:02:03', '2023-06-22T00:00:00', '2023-06-22T00:00:00.000Z',
  '2023-06-22 00:00:00.5 +05:00', '2023-06-22t00:00:00Z',
  // plain numbers
  '12345', '-1', '+1', '0', '00',
];

/** Strings PyYAML already reads as strings; they stay unquoted. */
const PLAIN_STRINGS = [
  'y', 'n', 'Y', 'N', 'nULL', '1:60', '1.2.3', '==', '<', 'Din1', 'tetrode_12.5', 'CA1',
  'Rattus norvegicus', 'session 2023-06-22', 'yes please', '1:1.4 lens', 'remy_20230622',
];

describe('encodeYaml() output read by PyYAML (trodes_to_nwb)', () => {
  describe('strings', () => {
    it('quotes every value PyYAML would read as a bool, int, float, null, timestamp, merge or value', () => {
      const yaml = encodeYaml({ values: LOOKALIKE_STRINGS });

      expectPyYamlReadsTheSameValues(yaml);
      expect(decodeYaml(yaml)).toEqual({ values: LOOKALIKE_STRINGS });
    });

    it('quotes keys PyYAML would read as something else', () => {
      const model = Object.fromEntries(LOOKALIKE_STRINGS.map((text, index) => [text, index]));

      const yaml = encodeYaml(model);

      expectPyYamlReadsTheSameValues(yaml);
      expect(decodeYaml(yaml)).toEqual(model);
    });

    it('writes the reported values in double quotes', () => {
      const yaml = encodeYaml({
        session_id: '20230622_01',
        tasks: [{ task_environment: 'Off' }],
        cameras: [{ lens: '1:1.4' }],
        experiment_description: '2023-06-22',
        yes: 'on',
      });

      expect(yaml).toBe(
        'session_id: "20230622_01"\n' +
          'tasks:\n' +
          '  - task_environment: "Off"\n' +
          'cameras:\n' +
          '  - lens: "1:1.4"\n' +
          'experiment_description: "2023-06-22"\n' +
          '"yes": "on"\n'
      );
    });

    it('leaves strings PyYAML reads as strings unquoted', () => {
      const yaml = encodeYaml({ values: PLAIN_STRINGS });

      expectPyYamlReadsTheSameValues(yaml);
      expect(yaml).toBe(`values:\n${PLAIN_STRINGS.map((text) => `  - ${text}\n`).join('')}`);
    });

    it('keeps subject.date_of_birth plain so PyYAML reads the datetime pynwb needs', () => {
      const model = {
        subject: { subject_id: 'yes', date_of_birth: '2023-06-22T00:00:00.000Z' },
        session_id: '2023-06-22T00:00:00.000Z',
        tasks: [{ date_of_birth: '2023-06-22T00:00:00.000Z' }],
      };

      const yaml = encodeYaml(model);

      expect(yaml).toContain('  date_of_birth: 2023-06-22T00:00:00.000Z\n');
      expect(yaml).toContain('session_id: "2023-06-22T00:00:00.000Z"\n');
      expect(yaml).toContain('  - date_of_birth: "2023-06-22T00:00:00.000Z"\n');
      expect(yaml).toContain('  subject_id: "yes"\n');
      expectPyYamlReadsTheSameValues(yaml);
      expect(decodeYaml(yaml)).toEqual(model);
    });
  });

  describe('numbers', () => {
    it('adds ".0" to an exponent with no dot, which PyYAML would read as a string', () => {
      const yaml = encodeYaml({
        raw_data_to_volts: 2e-7,
        negative: -2e-7,
        tiny: 5e-324,
        huge: 1e21,
        negative_huge: -1e21,
        hundred: 1e100,
      });

      expect(yaml).toBe(
        'raw_data_to_volts: 2.0e-7\n' +
          'negative: -2.0e-7\n' +
          'tiny: 5.0e-324\n' +
          'huge: 1.0e+21\n' +
          'negative_huge: -1.0e+21\n' +
          'hundred: 1.0e+100\n'
      );
      expectPyYamlReadsTheSameValues(yaml);
    });

    it('writes every other number as before', () => {
      const yaml = encodeYaml({
        integer: 42,
        negative: -7,
        decimal: 0.195,
        small_decimal: 0.000001,
        exponent_with_dot: 1.5e-7,
        large_with_dot: 1.5e21,
        large_integer: 123456789012345680000,
        max: Number.MAX_VALUE,
        not_a_number: NaN,
        infinity: Infinity,
        negative_infinity: -Infinity,
      });

      expect(yaml).toBe(
        'integer: 42\n' +
          'negative: -7\n' +
          'decimal: 0.195\n' +
          'small_decimal: 0.000001\n' +
          'exponent_with_dot: 1.5e-7\n' +
          'large_with_dot: 1.5e+21\n' +
          'large_integer: 123456789012345680000\n' +
          'max: 1.7976931348623157e+308\n' +
          'not_a_number: .nan\n' +
          'infinity: .inf\n' +
          'negative_infinity: -.inf\n'
      );
      expectPyYamlReadsTheSameValues(yaml);
    });

    it('writes negative zero as an integer zero', () => {
      const yaml = encodeYaml({ ap_in_mm: -0 });

      expect(yaml).toMatch(/^ap_in_mm: -?0\n$/);
      expect(decodeYaml(yaml).ap_in_mm === 0).toBe(true);
    });

    it('decodes to the same numbers it encoded', () => {
      const numbers = [2e-7, -2e-7, 1e-7, 5e-324, 1e21, -1e21, 1e100, 1.5e-7, 0.000001, 0.1 + 0.2,
        123456789012345680000, Number.MAX_VALUE, Number.MIN_VALUE, NaN, Infinity, -Infinity];

      expect(decodeYaml(encodeYaml({ numbers }))).toEqual({ numbers });
    });
  });

  describe('booleans and null', () => {
    it('writes them as PyYAML reads them', () => {
      const yaml = encodeYaml({ flag: true, other: false, nothing: null });

      expect(yaml).toBe('flag: true\nother: false\nnothing: null\n');
      expectPyYamlReadsTheSameValues(yaml);
    });
  });

  describe('golden fixtures', () => {
    it.each([
      '20230622_sample_metadata.yml',
      '20230622_sample_metadataProbeReconfig.yml',
      'minimal-valid.yml',
      'realistic-session.yml',
    ])('%s is written byte for byte as before and read by PyYAML as intended', (name) => {
      const golden = fs.readFileSync(path.join(__dirname, '../../fixtures/golden', name), 'utf8');

      const yaml = encodeYaml(decodeYaml(golden));

      expect(yaml).toBe(golden);
      expectPyYamlReadsTheSameValues(yaml);
    });
  });
});
