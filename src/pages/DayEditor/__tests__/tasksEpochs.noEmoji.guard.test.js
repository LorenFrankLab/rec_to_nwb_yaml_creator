/**
 * Guard: the Tasks & Epochs surface uses plain text + tokens, never decorative emoji or
 * status-by-glyph. Per the UX rubric, decoration is extraneous cognitive load and a glyph-only
 * status is perceptually dishonest (color/shape without text). This scans the source of the
 * Tasks & Epochs components for emoji / pictographic / dingbat glyphs (🧩 📹 🔒 ✓ ⚠ ❌ …) and
 * fails if any remain. Typographic punctuation (em/en dashes, curly quotes, ·) is allowed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const dayEditor = path.resolve(here, '..');

const GUARDED_FILES = [
  'TasksEpochsStep.jsx',
  'TasksTable.tsx',
  'TaskModal.jsx',
  'BehavioralEventsDisplay.jsx',
];

// Emoji + pictographs (U+1F000–1FAFF), misc symbols + dingbats (U+2600–27BF, incl. ⚠ ✓ ✗ ❌),
// misc symbols/arrows (U+2B00–2BFF), and the emoji variation selector (U+FE0F). Deliberately
// excludes general punctuation (—, –, ·, curly quotes) and geometric shapes used as plain markers.
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

describe('Tasks & Epochs surface contains no decorative emoji or glyph-only status', () => {
  it.each(GUARDED_FILES)('%s has no emoji/glyph characters', (file) => {
    const text = readFileSync(path.join(dayEditor, file), 'utf8');
    const offenders = text
      .split('\n')
      .map((line, i) => ({ line: i + 1, text: line }))
      .filter(({ text: line }) => EMOJI_RE.test(line));
    expect(
      offenders,
      `emoji/glyph found in ${file}:\n${offenders.map((o) => `  ${o.line}: ${o.text.trim()}`).join('\n')}`
    ).toEqual([]);
  });
});
