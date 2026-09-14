/**
 * @fileoverview Key-order-insensitive JSON serialization, for structural equality.
 *
 * Two objects that differ only in key order serialize identically, so `canonicalJson(a) ===
 * canonicalJson(b)` is a deep-equality test that ignores key order (arrays stay order-sensitive:
 * `[0, 1]` and `[1, 0]` are different exported bytes). NOT for byte-identity checks of an export
 * — those need the insertion order preserved (see `domain/shadowExport`).
 */

/**
 * Serialize a JSON-safe value with object keys sorted at every level.
 *
 * @param value - Any JSON-serializable value.
 * @returns A deterministic serialization; `'null'` for `undefined`.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
