import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Structural guard: raw animal/day collection fields must be read through the canonical
 * shape-safe selectors (`workspaceSelectors`), never via ad-hoc `x || []` /
 * `Array.isArray(x) ? x : []` at a call site. That ad-hoc pattern is exactly the recurring
 * bug — one component guards, another lags, a `cameras || []` preserves a corrupt string
 * and crashes. This test fails if any shipped source reintroduces it for these fields, so
 * the "read through the selector" contract can't silently regress.
 *
 * Allowed exceptions (NOT consumers — they DEFINE or DETECT canonical/corrupt state):
 *   - `workspaceSelectors.js` (the guards live here),
 *   - `deviceNormalization.js` (the normalizer that PRODUCES canonical state),
 *   - `validation/` and `pages/DayEditor/validation.js` (raw-shape DETECTION must inspect
 *     the corrupt shape on purpose — a selector would hide it).
 */

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

// Ad-hoc guards on RAW animal/day fields that must instead go through a selector.
const FORBIDDEN = [
  /\banimal\.cameras\s*\|\|\s*\[\]/,
  /Array\.isArray\(\s*animal\.cameras\s*\)/,
  /\banimal\.configurationHistory\s*\|\|\s*\[\]/,
  /Array\.isArray\(\s*animal\.configurationHistory\s*\)/,
  /animal\.devices\?\.data_acq_device\s*\|\|\s*\[\]/,
  /\bday\.tasks\s*\|\|\s*\[\]/,
];

const isExempt = (file) =>
  file.endsWith('workspaceSelectors.js') ||
  file.endsWith('deviceNormalization.js') ||
  file.includes(`${path.sep}validation${path.sep}`) ||
  file.endsWith(`DayEditor${path.sep}validation.js`) ||
  file.includes(`${path.sep}__tests__${path.sep}`);

describe('canonical read layer — no ad-hoc `|| []` on raw collection fields', () => {
  it('every shipped consumer reads these fields through workspaceSelectors', () => {
    const files = readdirSync(srcDir, { recursive: true })
      .map((rel) => path.join(srcDir, rel))
      .filter((f) => /\.(js|jsx)$/.test(f) && !isExempt(f));

    // Sanity: the walk actually found the source tree (guards against a vacuous pass).
    expect(files.length).toBeGreaterThan(100);

    const offenders = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        if (pattern.test(text)) {
          offenders.push(`${path.relative(srcDir, file)} :: ${pattern}`);
        }
      }
    }
    expect(offenders, `read these through workspaceSelectors:\n${offenders.join('\n')}`).toEqual([]);
  });
});
