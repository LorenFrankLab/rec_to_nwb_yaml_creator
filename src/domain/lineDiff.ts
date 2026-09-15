/**
 * @fileoverview A small line diff (LCS-based) for "what changed since the last download".
 *
 * Good enough for YAML metadata files (a few hundred lines): O(n·m) memory on the line counts,
 * capped so a pathological input degrades to a whole-file replace rather than a hang. Pure.
 */

/** One diff row. */
export interface DiffLine {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

/** Above this many lines on either side the diff falls back to removed-all / added-all. */
const MAX_LINES = 4000;

/**
 * Line diff of `before` → `after`.
 *
 * @param before - The previous text.
 * @param after - The current text.
 * @returns The diff rows in order.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return [...a.map((text) => ({ kind: 'removed' as const, text })), ...b.map((text) => ({ kind: 'added' as const, text }))];
  }
  // LCS table (length only), then walk back.
  const n = a.length;
  const m = b.length;
  const table = new Uint32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[at(i, j)] = a[i] === b[j] ? table[at(i + 1, j + 1)] + 1 : Math.max(table[at(i + 1, j)], table[at(i, j + 1)]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] });
      i += 1;
      j += 1;
    } else if (table[at(i + 1, j)] >= table[at(i, j + 1)]) {
      out.push({ kind: 'removed', text: a[i] });
      i += 1;
    } else {
      out.push({ kind: 'added', text: b[j] });
      j += 1;
    }
  }
  while (i < n) out.push({ kind: 'removed', text: a[i++] });
  while (j < m) out.push({ kind: 'added', text: b[j++] });
  return out;
}

/**
 * Only the changed rows with a little context, for a compact "what changed" view.
 *
 * @param rows - Full diff rows.
 * @param context - Unchanged lines to keep around each change.
 * @returns Rows with `{ kind: 'same', text: '…' }` separators where lines were elided.
 */
export function compactDiff(rows: DiffLine[], context = 2): DiffLine[] {
  const keep = new Array<boolean>(rows.length).fill(false);
  rows.forEach((row, index) => {
    if (row.kind === 'same') return;
    for (let k = Math.max(0, index - context); k <= Math.min(rows.length - 1, index + context); k += 1) keep[k] = true;
  });
  const out: DiffLine[] = [];
  let elided = false;
  rows.forEach((row, index) => {
    if (keep[index]) {
      out.push(row);
      elided = false;
    } else if (!elided) {
      out.push({ kind: 'same', text: '…' });
      elided = true;
    }
  });
  return out;
}
