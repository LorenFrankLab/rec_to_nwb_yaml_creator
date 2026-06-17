import { describe, it, expect } from 'vitest';
import schema from '../../nwb_schema.json';

const DIVERGENT_KEYWORDS = new Set([
  // AJV only enforces formats through ajv-formats, while python-jsonschema's behavior can differ by
  // draft/version. Keep format-like constraints in explicit custom rules unless a dual-validator
  // harness is added.
  'format',
  // A future schema with references needs a real AJV-vs-python-jsonschema compatibility harness.
  '$ref',
  '$dynamicRef',
  '$recursiveRef',
  // 2019-09/2020-12 keywords are outside the Draft-7 AJV instance used by the app today.
  'unevaluatedProperties',
  'unevaluatedItems',
  'dependentSchemas',
  'dependentRequired',
  'minContains',
  'maxContains',
]);

/**
 * Collect JSON pointers for schema keywords whose semantics can diverge between the app's AJV
 * Draft-7 validator and the downstream Python jsonschema validator.
 *
 * @param {unknown} value - Schema node to inspect.
 * @param {string} pointer - JSON pointer for the current node.
 * @returns {string[]} Pointers to divergent keyword occurrences.
 */
function collectDivergentKeywords(value, pointer = '#') {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectDivergentKeywords(item, `${pointer}/${index}`));
  }

  const hits = [];
  for (const [key, child] of Object.entries(value)) {
    const childPointer = `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
    if (DIVERGENT_KEYWORDS.has(key)) hits.push(childPointer);
    hits.push(...collectDivergentKeywords(child, childPointer));
  }
  return hits;
}

describe('schema draft divergence guard', () => {
  it('keeps nwb_schema.json free of AJV-Draft-7-vs-jsonschema-2020-12 divergent keywords', () => {
    expect(collectDivergentKeywords(schema)).toEqual([]);
  });

  it('is non-vacuous: the guard detects an introduced divergent keyword', () => {
    const poisoned = {
      type: 'object',
      properties: {
        date_of_birth: { type: 'string', format: 'date-time' },
      },
    };
    expect(collectDivergentKeywords(poisoned)).toContain('#/properties/date_of_birth/format');
  });
});
