/**
 * Retire-sweep guard (epoch-editor Phase 8).
 *
 * The day-editor redesign replaced the legacy multi-step `DayEditorStepper` + its six step
 * components with the sectioned `DayEditorFrame` and the `ExportPreview` surface. This guard locks
 * the retirement structurally so a step file can never
 * reappear — as a real file OR as a live import — and silently re-fork the day-editor flow.
 *
 * It scans the real source tree (not a curated list) so a re-introduced step is caught wherever it
 * lands. Pure helpers (`importSpecifiers`, `resolveSpecifier`) are unit-tested against synthetic
 * inputs so the real-tree scan's correctness doesn't rest on an untested extractor.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../');

/**
 * The retired legacy day-editor modules — the stepper shell and its six step components. None may
 * exist as a source file or be imported anywhere. Matched on the module BASENAME (no extension), so
 * `OverviewStep.tsx`, `./OverviewStep`, and `@/pages/DayEditor/OverviewStep` all resolve to the same
 * forbidden name.
 */
const RETIRED_MODULES: readonly string[] = [
  'DayEditorStepper',
  'OverviewStep',
  'DevicesStep',
  'TasksEpochsStep',
  'BehavioralEventsStep',
  'ValidationStep',
  'ExportStep',
];

/**
 * Recursively collect every source file under `src/`, src-relative with POSIX separators. Tests and
 * mocks are included for the FILE-existence check but excluded by the caller for the import scan
 * (a test may legitimately name a retired module in a string assertion).
 *
 * @returns The src-relative file paths.
 */
function allSourceFiles(): string[] {
  return readdirSync(srcDir, { recursive: true })
    .map((rel) => String(rel).split(path.sep).join('/'))
    .filter((rel) => /\.(jsx?|tsx?)$/.test(rel));
}

/**
 * Extract the specifiers of every static/dynamic import + re-export in `text`. Mirrors the
 * architecture-boundary guard's extractor (kept local so this guard is self-contained).
 *
 * @param text - The file source.
 * @returns The import specifiers found.
 */
export function importSpecifiers(text: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /\bimport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) specs.push(m[1]);
  }
  return specs;
}

/**
 * The basename of an import specifier with any extension stripped (`./a/OverviewStep.jsx` →
 * `OverviewStep`). Bare modules keep their last path segment; that's harmless here since no retired
 * module shares a name with an npm package.
 *
 * @param spec - The import specifier.
 * @returns The extension-stripped basename.
 */
export function resolveSpecifier(spec: string): string {
  return spec.replace(/\.(jsx?|tsx?)$/, '').split('/').pop() ?? spec;
}

describe('retire-sweep guard — helpers (synthetic)', () => {
  it('extracts every import form the real-tree scan relies on', () => {
    const src = [
      "import Stepper from './DayEditorStepper';",
      "import { ExportStep } from '../DayEditor/ExportStep.jsx';",
      "export { default } from './OverviewStep';",
      "const m = await import('@/pages/DayEditor/DevicesStep');",
    ].join('\n');
    expect(importSpecifiers(src).map(resolveSpecifier).sort()).toEqual(
      ['DayEditorStepper', 'DevicesStep', 'ExportStep', 'OverviewStep'].sort()
    );
  });

  it('strips extensions and path prefixes down to the module basename', () => {
    expect(resolveSpecifier('@/pages/DayEditor/OverviewStep')).toBe('OverviewStep');
    expect(resolveSpecifier('./TasksEpochsStep.tsx')).toBe('TasksEpochsStep');
    expect(resolveSpecifier('react')).toBe('react');
  });
});

describe('retire-sweep guard — real source tree', () => {
  const files = allSourceFiles();

  it('found the source tree (guards against a vacuous pass)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no retired day-editor step/stepper file exists', () => {
    const offenders = files.filter((rel) => RETIRED_MODULES.includes(resolveSpecifier(rel)));
    expect(offenders, `retired step files still present:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no source module imports a retired day-editor step/stepper', () => {
    const offenders: string[] = [];
    for (const rel of files) {
      // The retired names may legitimately appear inside a test's string assertions (e.g. this
      // guard, or the architecture-boundary classifier examples), so the IMPORT scan skips tests.
      if (rel.includes('__tests__/') || rel.includes('__mocks__/')) continue;
      const text = readFileSync(path.join(srcDir, rel), 'utf8');
      for (const spec of importSpecifiers(text)) {
        if (RETIRED_MODULES.includes(resolveSpecifier(spec))) {
          offenders.push(`${rel} → ${spec}`);
        }
      }
    }
    expect(offenders, `live imports of retired steps:\n${offenders.join('\n')}`).toEqual([]);
  });
});
