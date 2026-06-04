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
