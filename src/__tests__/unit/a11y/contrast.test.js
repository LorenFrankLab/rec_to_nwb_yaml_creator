/**
 * Unit-level WCAG contrast guard for the workspace color tokens.
 *
 * Reads the design tokens straight from `src/index.css` so that a future change
 * lowering a token below AA fails here. Each audited foreground/background pair must
 * meet WCAG 2.1: >= 4.5:1 for normal text, >= 3:1 for large text / UI boundaries.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexCss = fs.readFileSync(path.join(__dirname, '../../../index.css'), 'utf8');

/**
 * Parse `--token: #hex;` declarations from the :root block into a lookup.
 *
 * @param {string} css - CSS source text.
 * @returns {Record<string, string>} token name → hex value.
 */
function parseTokens(css) {
  const tokens = {};
  const re = /--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    tokens[m[1]] = m[2];
  }
  return tokens;
}

const TOKENS = parseTokens(indexCss);

/**
 * Relative luminance per WCAG 2.1.
 *
 * @param {string} hex - Color as `#rgb` or `#rrggbb`.
 * @returns {number} Relative luminance in [0, 1].
 */
function luminance(hex) {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two colors.
 *
 * @param {string} a - First color hex.
 * @param {string} b - Second color hex.
 * @returns {number} Contrast ratio (1–21).
 */
function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Resolve a token name (or pass through a literal hex).
 *
 * @param {string} nameOrHex - A `--color-*` token name (without `--`) or a hex literal.
 * @returns {string} The resolved hex color.
 */
const color = (nameOrHex) => (nameOrHex.startsWith('#') ? nameOrHex : TOKENS[nameOrHex]);

// Audited pairs: [label, foreground, background, minRatio].
// Tokens by name (kept in sync with index.css); literals for page-local colors.
const PAIRS = [
  // Primary used both as text-on-white and as button background with white text.
  ['primary text on white', 'color-primary', 'color-white', 4.5],
  ['white text on primary (button)', 'color-white', 'color-primary', 4.5],
  ['primary on primary-light', 'color-primary', 'color-primary-light', 3],
  // Status as text on white and on their tinted backgrounds.
  ['success on white', 'color-success', 'color-white', 4.5],
  ['success on success-light', 'color-success', 'color-success-light', 4.5],
  ['white on success (filled badge)', 'color-white', 'color-success', 4.5],
  ['warning on white', 'color-warning', 'color-white', 4.5],
  ['warning on warning-light', 'color-warning', 'color-warning-light', 4.5],
  ['error on white', 'color-error', 'color-white', 4.5],
  ['error on error-light', 'color-error', 'color-error-light', 4.5],
  ['white on error (filled badge)', 'color-white', 'color-error', 4.5],
  ['grey-600 hint text on white', 'color-grey-600', 'color-white', 4.5],
  ['grey-900 body text on white', 'color-grey-900', 'color-white', 4.5],
  // ValidationSummary status chips (page-local literals).
  ['validation chip: valid', '#2e7d32', '#e8f5e9', 4.5],
  ['validation chip: error', '#c62828', '#fdecea', 4.5],
  ['validation chip: incomplete', '#bf360c', '#fff3e0', 4.5],
  // CalendarDayCreator muted/day-number text. The muted secondary text (weekday
  // headers, legend, close button) sits on the off-white legend panel (#fafafa);
  // adjacent-month day numbers sit on white and the grey hover background (#f5f5f5).
  // grey-600 keeps all of these >= 4.5:1 (off-white 5.50:1, hover 5.27:1).
  ['calendar muted text on off-white legend', 'color-grey-600', '#fafafa', 4.5],
  ['calendar other-month day number on hover grey', 'color-grey-600', '#f5f5f5', 4.5],
  // CopyFromAnimalDialog copy-preview text on its primary-light panel.
  ['copy-preview text on primary-light panel', 'color-primary', 'color-primary-light', 4.5],
];

describe('color contrast (audited workspace pairs meet AA)', () => {
  it.each(PAIRS)('%s', (label, fg, bg, min) => {
    const fgHex = color(fg);
    const bgHex = color(bg);
    expect(fgHex, `missing token for ${fg}`).toBeTruthy();
    expect(bgHex, `missing token for ${bg}`).toBeTruthy();
    const ratio = contrastRatio(fgHex, bgHex);
    expect(ratio, `${label}: ${fgHex} on ${bgHex} = ${ratio.toFixed(2)}:1 (need ${min}:1)`).toBeGreaterThanOrEqual(min);
  });
});

/**
 * Resolve a CSS color value that may be a hex literal or a `var(--token)` reference.
 *
 * @param {string} value - Declaration value, e.g. `#bf360c` or `var(--color-warning)`.
 * @returns {string|undefined} The hex color, or undefined if unresolvable.
 */
function resolveValue(value) {
  const varRef = /var\(\s*--([\w-]+)\s*\)/.exec(value);
  if (varRef) return TOKENS[varRef[1]];
  const hex = /#[0-9a-fA-F]{3,6}/.exec(value);
  return hex ? hex[0] : undefined;
}

/**
 * Is this an orange/amber "warning" color rather than a grey, red, green or blue?
 *
 * Hue 10°–55° with real saturation: the warning family (`#bf360c`, `#e65100`, `#f57c00`,
 * `#d84315`, `#8a3b00`, `#5a4a13`). Excludes near-greys like `#46443d` (saturation 0.13)
 * and reds like `#c62828`/`#7a241c` (hue < 10°), which have their own tokens and ratios.
 *
 * @param {string} hex - Color as `#rgb` or `#rrggbb`.
 * @returns {boolean} True when the color is in the warning hue family.
 */
function isWarningFamily(hex) {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0 || (max - min) / max < 0.25) return false;
  if (max !== r) return false; // Orange/amber is red-dominant.
  const hue = (60 * (g - b)) / (max - min);
  return hue >= 10 && hue < 55;
}

/**
 * Parse a stylesheet into a tree of rule blocks with their own declarations.
 *
 * SCSS nesting means a warning color's surface is often declared on an ANCESTOR block
 * (`.identity-divergence { background: …; .identity-divergence-title { color: … } }`), so a
 * flat regex over one block cannot tell what the text actually sits on.
 *
 * @param {string} css - CSS/SCSS source text (block comments stripped).
 * @returns {object} Root node: `{selector, decls, children, parent}`.
 */
function parseBlocks(css) {
  const root = { selector: '(file)', decls: [], children: [], parent: null };
  let node = root;
  let buf = '';
  /** Record a `prop: value` declaration on the current node. */
  const flush = () => {
    const m = /^\s*([\w-]+)\s*:\s*([^:]*)$/.exec(buf.replace(/\/\/.*$/gm, ''));
    if (m) node.decls.push({ prop: m[1].toLowerCase(), value: m[2].trim() });
    buf = '';
  };
  for (const ch of css) {
    if (ch === '{') {
      const selector = buf.replace(/\/\/.*$/gm, '').trim().replace(/\s+/g, ' ');
      const child = { selector, decls: [], children: [], parent: node };
      node.children.push(child);
      node = child;
      buf = '';
    } else if (ch === '}') {
      flush();
      node = node.parent ?? root;
      buf = '';
    } else if (ch === ';') {
      flush();
    } else {
      buf += ch;
    }
  }
  return root;
}

/**
 * Every warning-colored text declaration in a stylesheet, paired with the surface it
 * sits on (the nearest self-or-ancestor background, else the sheet's default surface).
 *
 * @param {string} css - CSS/SCSS source text.
 * @param {string} file - Path label used in test names/messages.
 * @param {string} defaultSurface - Hex of the sheet's page/panel background.
 * @returns {{name: string, color: string, background: string}[]} Audited declarations.
 */
function auditWarningText(css, file, defaultSurface) {
  const audits = [];
  /**
   * Nearest declared background hex walking up from `node`, else the default surface.
   * @param node
   */
  const surfaceOf = (node) => {
    for (let n = node; n; n = n.parent) {
      const bg = n.decls.find((d) => d.prop === 'background' || d.prop === 'background-color');
      const hex = bg ? resolveValue(bg.value) : undefined;
      if (hex) return hex;
    }
    return defaultSurface;
  };
  /**
   * Depth-first walk collecting warning-family `color` declarations.
   * @param node
   * @param trail
   */
  const walk = (node, trail) => {
    const path_ = node.selector === '(file)' ? trail : [...trail, node.selector];
    const colorDecl = node.decls.find((d) => d.prop === 'color');
    const hex = colorDecl ? resolveValue(colorDecl.value) : undefined;
    if (hex && isWarningFamily(hex)) {
      audits.push({ name: `${file} ${path_.join(' ')}`, color: hex, background: surfaceOf(node) });
    }
    node.children.forEach((child) => walk(child, path_));
  };
  walk(parseBlocks(css), []);
  return audits;
}

// Stylesheets carrying warning-colored text, with the surface their un-backgrounded blocks
// sit on. Every one of these had a sub-AA orange at some point: the fix is the shared
// `--color-warning` token, and this audit fails if any of them regresses to a raw orange.
const AUDITED_SHEETS = [
  ['pages/DayEditor/DayEditor.scss', '#ffffff'],
  ['pages/AnimalEditor/CamerasSection.scss', '#ffffff'],
  ['pages/AnimalEditor/CameraModal.scss', '#ffffff'],
  ['pages/AnimalEditor/CopyFromAnimalDialog.scss', '#ffffff'],
  ['pages/AnimalEditor/DataAcqSection.scss', '#ffffff'],
  ['components/SuggestionCombobox.scss', '#ffffff'],
  ['App.scss', '#ffffff'],
];

const WARNING_TEXT_AUDITS = AUDITED_SHEETS.flatMap(([file, surface]) => {
  const css = fs
    .readFileSync(path.join(__dirname, '../../../', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return auditWarningText(css, file, surface);
});

describe('warning-colored text meets AA on its own surface', () => {
  it('finds the warning-colored declarations to audit', () => {
    // Guards the scan itself: a parser or path regression must fail loudly rather than
    // pass vacuously over zero declarations.
    expect(WARNING_TEXT_AUDITS.length).toBeGreaterThanOrEqual(10);
  });

  it.each(WARNING_TEXT_AUDITS)('$name', ({ name, color: fg, background: bg }) => {
    const ratio = contrastRatio(fg, bg);
    expect(
      ratio,
      `${name}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (need 4.5:1)`
    ).toBeGreaterThanOrEqual(4.5);
  });
});
