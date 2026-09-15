import { describe, it, expect } from 'vitest';
import { diffLines, compactDiff } from '../lineDiff';

describe('diffLines', () => {
  it('reports a changed value as a removed + added pair with unchanged context', () => {
    const before = 'a: 1\nweight: 520\nc: 3';
    const after = 'a: 1\nweight: 530\nc: 3';
    expect(diffLines(before, after)).toEqual([
      { kind: 'same', text: 'a: 1' },
      { kind: 'removed', text: 'weight: 520' },
      { kind: 'added', text: 'weight: 530' },
      { kind: 'same', text: 'c: 3' },
    ]);
  });
  it('is empty-change for identical text', () => {
    expect(diffLines('x\ny', 'x\ny').every((r) => r.kind === 'same')).toBe(true);
  });
  it('compacts unchanged runs to an ellipsis with context', () => {
    const rows = diffLines(['a', 'b', 'c', 'd', 'e', 'f', 'g'].join('\n'), ['a', 'b', 'c', 'd', 'e', 'f', 'G'].join('\n'));
    const compact = compactDiff(rows, 1);
    expect(compact[0]).toEqual({ kind: 'same', text: '…' });
    expect(compact.slice(-3)).toEqual([
      { kind: 'same', text: 'f' },
      { kind: 'removed', text: 'g' },
      { kind: 'added', text: 'G' },
    ]);
  });
});
