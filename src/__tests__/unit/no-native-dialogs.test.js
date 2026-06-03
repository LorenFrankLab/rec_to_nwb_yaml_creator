import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC = path.resolve(__dirname, '../..');

/**
 * Directories whose new-UI surfaces must use the in-app Modal/AlertModal/ConfirmDialog
 * components instead of blocking native dialogs.
 */
const SCOPED_DIRS = [
  path.join(SRC, 'pages'),
  path.join(SRC, 'components', 'CalendarDayCreator'),
];

// The legacy form is the frozen safety net and is intentionally exempt.
const EXEMPT = [path.join(SRC, 'pages', 'LegacyFormView.jsx')];

/** Native blocking-dialog calls: bare alert()/confirm() or window.alert/confirm(). */
const NATIVE_DIALOG = /(^|[^.\w])(alert|confirm)\s*\(|window\.(alert|confirm)\s*\(/;

/**
 * Recursively collect .js/.jsx source files (excluding tests) under a directory.
 * @param {string} dir Directory to walk.
 * @returns {string[]} Absolute file paths.
 */
function collectSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') return [];
      return collectSourceFiles(full);
    }
    if (!/\.(js|jsx)$/.test(entry.name)) return [];
    if (/\.(test|spec)\.(js|jsx)$/.test(entry.name)) return [];
    return [full];
  });
}

/**
 * Find native-dialog call sites in a file, ignoring comment lines/segments so that
 * doc comments mentioning "alert()" or "window.confirm()" don't trip the scan.
 * @param {string} file Absolute file path.
 * @returns {string[]} Offending "relpath:line" entries.
 */
function findNativeDialogs(file) {
  const offenders = [];
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    const code = line.split('//')[0]; // drop trailing line comments
    if (NATIVE_DIALOG.test(code)) {
      offenders.push(`${path.relative(SRC, file)}:${i + 1}`);
    }
  });
  return offenders;
}

describe('no native dialogs in the new UI', () => {
  it('uses Modal/AlertModal/ConfirmDialog instead of alert()/window.confirm()', () => {
    const offenders = SCOPED_DIRS.flatMap(collectSourceFiles)
      .filter((file) => !EXEMPT.includes(file))
      .flatMap(findNativeDialogs);

    expect(offenders, `Native dialog calls found:\n${offenders.join('\n')}`).toEqual([]);
  });
});
