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
 *   - `taskCatalogMigration.ts` (a v2→v3 workspace→workspace MIGRATION that rewrites raw
 *     persisted shapes — like a normalizer, it must read the old/raw shape it is converting),
 *   - `validation/` and `domain/validation.js` (raw-shape DETECTION must inspect
 *     the corrupt shape on purpose — a selector would hide it),
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

// Exemptions are extension-agnostic: the definers/detectors (`workspaceSelectors`,
// `deviceNormalization`, the `validation/` raw-shape detectors, the `domain/validation` barrel)
// have migrated to TypeScript, so match `.js` and `.ts` alike.
const isExempt = (file) =>
  file.endsWith('workspaceSelectors.js') || file.endsWith('workspaceSelectors.ts') ||
  file.endsWith('deviceNormalization.js') || file.endsWith('deviceNormalization.ts') ||
  // Born-.ts detectors/producers (never standalone `.js`, so the original `.js`-only scan never
  // saw them): the catalog producer + its migration read raw `day.tasks` to build/convert the
  // catalog; `domain/stepStatus` (extracted from the exempt `domain/validation.js` in Phase 9a)
  // inspects the raw day shape to compute step status. All DETECT/PRODUCE, never plain consumers.
  file.endsWith('taskCatalogMigration.ts') ||
  file.endsWith(`state${path.sep}taskCatalog.ts`) ||
  file.endsWith(`domain${path.sep}stepStatus.ts`) ||
  file.includes(`${path.sep}validation${path.sep}`) ||
  file.endsWith(`domain${path.sep}validation.js`) || file.endsWith(`domain${path.sep}validation.ts`) ||
  file.includes(`${path.sep}__tests__${path.sep}`);

describe('canonical read layer — no ad-hoc `|| []` on raw collection fields', () => {
  it('every shipped consumer reads these fields through workspaceSelectors', () => {
    const files = readdirSync(srcDir, { recursive: true })
      .map((rel) => path.join(srcDir, rel))
      .filter((f) => /\.(js|jsx|ts|tsx)$/.test(f) && !isExempt(f));

    // Sanity: the walk actually found the source tree (guards against a vacuous pass). The scan
    // covers `.ts`/`.tsx` too so the "read through the selector" contract holds for the
    // TypeScript-migrated consumers (every such file was previously `.js` and already passed here).
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
