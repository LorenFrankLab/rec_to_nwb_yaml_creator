/**
 * Guard: `App.scss` must not own a class that a NON-legacy screen renders.
 *
 * `src/App.scss` is imported by `pages/LegacyFormView`, which is a lazily-loaded route — so every
 * rule in it reaches the DOM only once a visitor has opened the legacy metadata form. A class that
 * an app-shell or workspace screen renders therefore goes UNSTYLED on a direct load of its own URL
 * and then changes appearance after a detour through legacy (finding R4: an oversized logo, inline
 * skip links, 18px footer links — and, caught by this guard, the Optogenetics step's
 * `.form-container` losing its column gap).
 *
 * Shared rules belong in `layouts/AppShell.scss`, which `AppLayout` imports eagerly.
 *
 * The "legacy tree" is DERIVED, never hand-listed: every module reachable by import from
 * `layouts/AppLayout` — WITHOUT descending into `pages/LegacyFormView` — is what the shell and the
 * workspace routes can render. Anything else is legacy-only. So a component that starts out
 * legacy-only and is later reused by a workspace screen (as `components/DeviceFields` was, by
 * `AnimalEditor/DataAcqSection`) is picked up automatically.
 *
 * Limit: class names are read from `className` / `class` / `classList` literals. A class assembled
 * at runtime out of variables is invisible here, as it is to any static check.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');
const APP_SCSS = path.join(SRC, 'App.scss');
const SHELL_ROOT = path.join(SRC, 'layouts/AppLayout.tsx');
const LEGACY_ROOT = path.join(SRC, 'pages/LegacyFormView.jsx');
const SOURCE_EXT = ['.tsx', '.ts', '.jsx', '.js'];

/**
 * Resolve a relative import specifier to a source file on disk.
 *
 * @param {string} fromFile - The importing file.
 * @param {string} spec - The specifier as written.
 * @returns {string|null} The resolved absolute path, or null when it is not a source module.
 */
function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base, ...SOURCE_EXT.map((ext) => base + ext), ...SOURCE_EXT.map((ext) => path.join(base, `index${ext}`))]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * Every source module reachable from `entry` by static or dynamic import, excluding `stopAt`.
 *
 * @param {string} entry - The entry module.
 * @param {string} stopAt - A module whose subtree must not be walked.
 * @returns {Set<string>} Absolute paths of the reachable modules.
 */
function reachableFrom(entry, stopAt) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file) || file === stopAt) continue;
    seen.add(file);
    const text = fs.readFileSync(file, 'utf8');
    const specs = [
      ...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g),
    ].map((m) => m[1]);
    for (const spec of specs) {
      const resolved = resolveImport(file, spec);
      if (resolved && SOURCE_EXT.includes(path.extname(resolved))) queue.push(resolved);
    }
  }
  return seen;
}

/**
 * The class names each file puts in the DOM via a `className` / `class` / `classList` literal.
 *
 * @param {string} file - The source file.
 * @returns {Set<string>} The class names.
 */
function renderedClasses(file) {
  const text = fs.readFileSync(file, 'utf8');
  const found = new Set();
  const attribute = /(?:className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\}|\{\s*'([^']*)'\s*\}|\{\s*"([^"]*)"\s*\})/g;
  for (const m of text.matchAll(attribute)) {
    const value = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '';
    for (const token of value.split(/\s+/)) {
      if (token && !token.includes('$') && !token.includes('{')) found.add(token);
    }
  }
  for (const m of text.matchAll(/classList\.(?:add|remove|toggle)\(\s*['"]([\w-]+)['"]/g)) {
    found.add(m[1]);
  }
  return found;
}

/**
 * Every rule in a stylesheet as its chain of nested selectors, with the line it starts on.
 *
 * @param {string} scss - The stylesheet source (comments already stripped).
 * @returns {Array<{ chain: string[], line: number }>} One entry per rule.
 */
function ruleChains(scss) {
  const chains = [];
  const stack = [];
  let buffer = '';
  let line = 1;
  for (const char of scss) {
    if (char === '\n') line += 1;
    if (char === '{') {
      stack.push(buffer.trim());
      chains.push({ chain: [...stack], line });
      buffer = '';
    } else if (char === '}') {
      stack.pop();
      buffer = '';
    } else if (char === ';') {
      buffer = '';
    } else {
      buffer += char;
    }
  }
  return chains;
}

/**
 * Class names in one selector level (`&`-prefixed nesting included).
 * @param selector
 */
const classesIn = (selector) => [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);

describe('App.scss owns only the legacy form (R4 guard)', () => {
  const shellReachable = reachableFrom(SHELL_ROOT, LEGACY_ROOT);
  const renderedOutsideLegacy = new Set();
  for (const file of shellReachable) {
    for (const cls of renderedClasses(file)) renderedOutsideLegacy.add(cls);
  }

  const scss = fs
    .readFileSync(APP_SCSS, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

  // A rule is STRANDED when every level of its selector chain can be satisfied outside the legacy
  // form: a level with no class (a bare element selector) always can, and a level with classes can
  // when one of them is rendered by a shell-reachable module. `.file-upload-region .visually-hidden`
  // is therefore NOT stranded — its container is legacy-only — while a top-level `.form-container`
  // is, because `DeviceFields` (via `AnimalEditor/DataAcqSection`) renders it.
  const stranded = ruleChains(scss)
    .filter(({ chain }) => {
      const own = classesIn(chain[chain.length - 1]);
      if (own.length === 0) return false;
      return chain.every((level) => {
        const classes = classesIn(level);
        return classes.length === 0 || classes.some((cls) => renderedOutsideLegacy.has(cls));
      });
    })
    .map(({ chain, line }) => `App.scss:${line}  ${chain.join(' ')}`);

  it('walks a non-trivial shell import graph (the scan must not pass vacuously)', () => {
    expect(shellReachable.size).toBeGreaterThan(50);
    expect(renderedOutsideLegacy.size).toBeGreaterThan(50);
    expect(shellReachable.has(LEGACY_ROOT)).toBe(false);
  });

  it('has no rule a shell or workspace screen depends on', () => {
    expect(
      stranded,
      'These App.scss rules are rendered outside the legacy form, so they load only after a detour '
        + 'through the legacy route. Move them to layouts/AppShell.scss (or the component\'s own '
        + `CSS module):\n${stranded.join('\n')}`
    ).toEqual([]);
  });
});
