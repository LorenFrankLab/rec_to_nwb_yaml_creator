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
 *   - `validation/` and the `domain/` day-validation family (raw-shape DETECTION must inspect
 *     the corrupt shape on purpose — a selector would hide it). That family is the Phase 9a split
 *     of the formerly-single `domain/validation.js` (`DOMAIN_VALIDATION_MODULES` below); exempting
 *     the split modules preserves the SAME coverage the one exempt file had pre-split,
 *   - `pages/DayEditor/validation.js` (page-only field-blur helper; no raw collection reads).
 */

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

// Ad-hoc guards on RAW animal/day fields that must instead go through a selector. Covers
// EVERY selector-owned field — `<expr> || []` and `Array.isArray(<expr>)`/`isRecord(<expr>)`
// — so the migration's promise ("no ad-hoc access left to get wrong") is actually locked in
// and a future component can't quietly re-derive safety for one of these fields.
const SELECTOR_OWNED = [
  'animal\\.cameras',
  'animal\\.behavioral_events',
  'animal\\.configurationHistory',
  'animal\\.days',
  'animal\\.subject',
  'animal\\.experimenters',
  'experimenters\\.experimenter_name',
  'day\\.tasks',
  'day\\.session',
  'day\\.keywords',
  'day\\.fs_gui_yamls',
  'day\\.behavioral_events',
  'day\\.associated_files',
  'day\\.associated_video_files',
  'days\\[[^\\]]+\\]\\.tasks',
  // Nested device collections — HOLDER-AGNOSTIC: `<anyVar>.devices(?.).<field>`, so a raw
  // read off ANY holder (animal mirror, snapshot, config) is fenced, not just a few named
  // variables. These belong to getAnimal*/getProbe* selectors.
  '\\w+(?:\\?\\.|\\.)devices(?:\\?\\.|\\.)electrode_groups',
  '\\w+(?:\\?\\.|\\.)devices(?:\\?\\.|\\.)ntrode_electrode_group_channel_map',
  '\\w+(?:\\?\\.|\\.)devices(?:\\?\\.|\\.)data_acq_device',
  // A ProbeConfiguration exposes electrode_groups / ntrode map at TOP level (no `.devices`);
  // configDiff reads them off prev/next config — own them via getProbe* too.
  '(?:prev|next)Config\\.electrode_groups',
  '(?:prev|next)Config\\.ntrode_electrode_group_channel_map',
];
const FORBIDDEN = SELECTOR_OWNED.flatMap((field) => [
  new RegExp(`${field}\\s*\\|\\|\\s*\\[\\]`),
  new RegExp(`Array\\.isArray\\(\\s*${field}\\s*\\)`),
  new RegExp(`isRecord\\(\\s*${field}\\s*\\)`),
  new RegExp(`\\b(?:const|let)\\s+\\w+\\s*=\\s*${field}\\b`),
  new RegExp(`\\.\\.\\.\\s*${field}\\b`),
  new RegExp(`\\{\\s*${field}\\s*\\}`),
  new RegExp(`${field}\\.(?:map|flatMap|filter|find|some|forEach|reduce|entries)\\s*\\(`),
]);

// The `domain/` day-validation family — the Phase 9a split of the formerly-single
// `domain/validation.js`. Like `validation/`, these modules perform raw-shape DETECTION and must
// inspect corrupt day/animal collections on purpose (a selector would hide what they exist to
// surface). Exempting the split set preserves the identical coverage the one file had pre-split.
const DOMAIN_VALIDATION_MODULES = new Set([
  'validation.js', // public barrel
  'dayValidationComposer.js',
  'dayOverrideValidation.js',
  'stepStatus.js',
  'geometryProvenance.js',
  'repairRouting.js',
]);

const isExempt = (file) =>
  file.endsWith('workspaceSelectors.js') ||
  file.endsWith('deviceNormalization.js') ||
  file.includes(`${path.sep}validation${path.sep}`) ||
  (file.includes(`${path.sep}domain${path.sep}`) && DOMAIN_VALIDATION_MODULES.has(path.basename(file))) ||
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
