/**
 * Architecture guard: enforce the domain-boundary ownership contract structurally.
 *
 * Allowed dependency direction only:
 *   - pages → domain/state helpers (the export-truth deciders);
 *   - NEVER domain/state → pages (a reversed import);
 *   - NEVER page → a SIBLING page folder for app-wide domain behavior.
 *
 * The recurring risk this prevents: app-wide validation/repair/converter behavior becoming
 * page-local by accident, so one page silently owns export truth another page depends on.
 * The classifier (`importViolation`) is pure and unit-tested against synthetic inputs (so we
 * prove it actually fails on a reversed import without committing one), then run over the real
 * source tree.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../');

/**
 * Modules that legitimately cross page folders. These are NOT app-wide domain behavior (no
 * validation/repair/converter logic); relocating them to `src/components` is deferred (out of
 * this phase's scope). Any OTHER cross-page import — and any domain/state → page import — is a
 * violation.
 *
 * - `pages/DayEditor/SaveIndicator` — a small shared presentational component.
 * - `pages/AnimalWorkspace/RecordingDaysTab` — the per-animal recording-days pane, DELIBERATELY
 *   shared (Phase 1 — tabbed-workspace-ia) so the legacy Workspace and the new tabbed
 *   `AnimalView` render ONE implementation instead of forking it (the "extract, don't fork"
 *   contract). It owns no domain logic — it composes selectors/domain like any page. Lives under
 *   AnimalWorkspace (its origin); a neutral relocation can follow when `src/components` opens up.
 * - `pages/AnimalEditor/wiring/*` — the extracted animal-setup section containers + their shared
 *   store-binding hook (Phase 3-1), DELIBERATELY shared so the still-live legacy stepper and the
 *   new tabbed `AnimalView` render ONE implementation of the setup wiring instead of forking it
 *   (same "extract, don't fork" contract). They own no app-wide domain logic — they compose
 *   selectors + tested utils (channel-map regen, CSV, identity-safety) and `state/repairCommands`
 *   like any page. They live under AnimalEditor (their origin); a neutral relocation can follow
 *   when `src/components` opens up. Phase 3-2 added the two ephys containers; Phase 3-3 adds the
 *   four catalog/library containers + the `useAnimalFieldUpdate` hook that feeds them.
 *
 * @type {Set<string>}
 */
const CROSS_PAGE_ALLOWLIST = new Set([
  'pages/DayEditor/SaveIndicator',
  'pages/AnimalWorkspace/RecordingDaysTab',
  'pages/AnimalEditor/wiring/ElectrodeGroupsContainer',
  'pages/AnimalEditor/wiring/RecordingSystemContainer',
  'pages/AnimalEditor/wiring/CamerasContainer',
  'pages/AnimalEditor/wiring/TaskTypesContainer',
  // The Day Editor's Tasks & Epochs step reuses the animal TaskTypeModal for inline "define a new
  // task type" quick-add (presentational form; the animal write goes through actions.updateAnimal).
  'pages/AnimalEditor/TaskTypeModal',
  'pages/AnimalEditor/wiring/OptogeneticsContainer',
  'pages/AnimalEditor/wiring/useAnimalFieldUpdate',
  // Phase 3-5: the per-animal Validation & Export tab renders <ValidationSummary animalKey=…> — the
  // SAME component as the standalone page, scoped by a filter (buildAnimalRows), not a fork. The
  // export-truth deciders it consumes (mergeDayMetadata, computeStepStatus, shadowExport) live in
  // domain/state; the page composes them like any page.
  'pages/ValidationSummary/index',
  // Phase 4b: the workspace's inline "+ New Animal" panel hosts the SAME presentational
  // AnimalCreationForm as the Home route (no fork) — the shared subject/metadata builder lives in
  // domain/animalCreation. The form owns no app-wide domain logic; relocating it to src/components
  // can follow when Home is removed in Phase 5.
  'pages/Home/AnimalCreationForm',
  // The "Copy from another animal…" dialog: DELIBERATELY shared so the Electrode Groups tab's
  // copy host (pages/AnimalEditor/wiring/ElectrodeGroupsContainer, same page) AND the per-animal
  // Recording Days setup card (pages/AnimalWorkspace/RecordingDaysTab) render ONE implementation
  // instead of forking it ("extract, don't fork"). It owns no app-wide domain logic — it composes
  // selectors + the tested identity-safety utils (collect*/findIdentityDivergence) + device
  // normalizers like any page. Lives under AnimalEditor (its origin); a neutral relocation to
  // src/components can follow when that opens up.
  'pages/AnimalEditor/CopyFromAnimalDialog',
]);

/**
 * Decide whether an import from `fromRel` to `toRel` (both src-relative POSIX paths, `toRel`
 * already resolved and extension-stripped) violates the boundary contract.
 *
 * @param {string} fromRel - The importing file, src-relative (e.g. `domain/validation.js`).
 * @param {string} toRel - The resolved imported module, src-relative, no extension.
 * @param {Set<string>} [allowlist] - Permitted cross-page presentational modules.
 * @returns {{ rule: string }|null} A violation descriptor, or null when allowed.
 */
export function importViolation(fromRel, toRel, allowlist = CROSS_PAGE_ALLOWLIST) {
  const inDomainOrState = fromRel.startsWith('domain/') || fromRel.startsWith('state/');
  if (inDomainOrState && toRel.startsWith('pages/')) {
    return { rule: 'domain-or-state-imports-page' };
  }

  const fromPage = fromRel.match(/^pages\/([^/]+)\//);
  const toPage = toRel.match(/^pages\/([^/]+)\//);
  if (fromPage && toPage && fromPage[1] !== toPage[1] && !allowlist.has(toRel)) {
    return { rule: 'page-imports-sibling-page' };
  }

  return null;
}

/**
 * Extract the specifiers of all static/dynamic imports + re-exports in `text`. Exported so the
 * real-tree scan's whole correctness (it rests on this extractor) can be locked by a unit test.
 * @param text
 */
export function importSpecifiers(text) {
  const specs = [];
  const patterns = [
    /\bimport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g, // import x from 'y'
    /\bimport\s*['"]([^'"]+)['"]/g, // import 'y'
    /\bexport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g, // export ... from 'y'
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import('y')
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) specs.push(m[1]);
  }
  return specs;
}

/**
 * Resolve a specifier to a src-relative POSIX path with the extension stripped. Handles both
 * relative specifiers and the `@/*` → `src/*` alias (configured in vitest.config.js's
 * resolve.alias), so an aliased `@/pages/...` import cannot bypass the guard. Returns null
 * for bare modules (react, prop-types, …), which are out of scope.
 * @param fromRel
 * @param spec
 */
export function resolveToSrcRel(fromRel, spec) {
  const stripExt = (p) => p.replace(/\.(jsx?|tsx?)$/, '');
  if (spec.startsWith('@/')) return stripExt(spec.slice(2)); // alias → src-relative
  if (!spec.startsWith('.')) return null; // bare module (react, prop-types, …) — out of scope
  return stripExt(path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec)));
}

describe('architecture boundaries — classifier (synthetic)', () => {
  it('flags a domain module importing a page (reversed import)', () => {
    expect(importViolation('domain/validation.js', 'pages/DayEditor/ExportStep'))
      .toEqual({ rule: 'domain-or-state-imports-page' });
  });

  it('flags a state module importing a page (reversed import)', () => {
    expect(importViolation('state/useWorkspace.js', 'pages/DayEditor/validation'))
      .toEqual({ rule: 'domain-or-state-imports-page' });
  });

  it('flags a page importing app-wide behavior from a sibling page folder', () => {
    expect(importViolation('pages/AnimalView/index.jsx', 'pages/DayEditor/validation'))
      .toEqual({ rule: 'page-imports-sibling-page' });
  });

  it('allows pages → domain and pages → state (the permitted direction)', () => {
    expect(importViolation('pages/DayEditor/ExportStep.jsx', 'domain/validation')).toBeNull();
    expect(importViolation('pages/AnimalView/index.jsx', 'state/repairCommands')).toBeNull();
  });

  it('allows a same-folder page import and the allowlisted presentational component', () => {
    expect(importViolation('pages/DayEditor/ExportStep.jsx', 'pages/DayEditor/RepairActions')).toBeNull();
    expect(importViolation('pages/AnimalView/index.jsx', 'pages/AnimalEditor/wiring/CamerasContainer')).toBeNull();
  });

  it('allows domain → core validation / io / utils', () => {
    expect(importViolation('domain/validation.js', 'validation/index')).toBeNull();
    expect(importViolation('domain/shadowExport.js', 'io/yaml')).toBeNull();
    expect(importViolation('domain/badChannels.js', 'ntrode/probeCatalog')).toBeNull();
  });

  it('importSpecifiers extracts every import form the real-tree scan relies on', () => {
    const src = [
      "import a from './a';",
      "import { b, c } from '../b';",
      "import {\n  d,\n  e,\n} from '@/domain/validation';", // multi-line named
      "import defaultExp, { f } from './mix';", // default + named
      "import * as ns from '../ns';", // namespace
      "import './side-effect';", // bare side-effect
      "export { g } from './reexport';", // re-export
      "const x = await import('./dynamic');", // dynamic
    ].join('\n');
    expect(importSpecifiers(src).sort()).toEqual(
      ['./a', '../b', '@/domain/validation', './mix', '../ns', './side-effect', './reexport', './dynamic'].sort()
    );
  });

  it('resolves the @/* alias so an aliased page import cannot bypass the guard', () => {
    expect(resolveToSrcRel('domain/validation.js', '@/pages/DayEditor/ExportStep'))
      .toBe('pages/DayEditor/ExportStep');
    // …and the resolved alias path is then caught as a reversed import.
    expect(importViolation('domain/validation.js', resolveToSrcRel('domain/validation.js', '@/pages/DayEditor/ExportStep')))
      .toEqual({ rule: 'domain-or-state-imports-page' });
    // A bare module still resolves to null (out of scope).
    expect(resolveToSrcRel('domain/validation.js', 'react')).toBeNull();
  });
});

describe('architecture boundaries — real source tree', () => {
  it('has no forbidden domain/state→page or page→sibling-page imports', () => {
    const files = readdirSync(srcDir, { recursive: true })
      .map((rel) => String(rel).split(path.sep).join('/'))
      .filter((rel) => /\.(jsx?)$/.test(rel) && !rel.includes('__tests__/') && !rel.includes('__mocks__/'));

    // Sanity: the walk found the tree (guards against a vacuous pass).
    expect(files.length).toBeGreaterThan(100);

    const violations = [];
    for (const rel of files) {
      const text = readFileSync(path.join(srcDir, rel), 'utf8');
      for (const spec of importSpecifiers(text)) {
        const toRel = resolveToSrcRel(rel, spec);
        if (!toRel) continue;
        const v = importViolation(rel, toRel);
        if (v) violations.push(`${rel} → ${toRel} [${v.rule}]`);
      }
    }

    expect(violations, `forbidden imports:\n${violations.join('\n')}`).toEqual([]);
  });
});
