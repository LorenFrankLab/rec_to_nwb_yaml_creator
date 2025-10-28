
# Plan

The NWB Metadata Creator migration plan defines a structured, incremental roadmap for evolving the current YAML creation tool into a modular, schema-driven React application optimized for neuroscience experiments that span multiple animals and multiple recording days. In this workflow, each recording day corresponds to a single NWB file and thus a single YAML file, so users must often create and manage many YAMLs per experiment. The existing app already produces valid metadata, but its monolithic design limits scalability, validation consistency, and efficiency when handling dozens of sessions across animals. This plan aims to improve the creation, validation, and batch management of YAML files by introducing a clearer data hierarchy (animal → days), shared defaults, autosave, and robust schema validation. Each milestone isolates low-risk, testable steps to modernize the architecture—adding modular components, centralized state management, and cross-day validation—while preserving bit-for-bit compatibility with existing YAML outputs to ensure continuity and scientific reproducibility.

## Global Goals

* Preserve current YAML output bit-for-bit until we explicitly switch.
* Keep the current UI as the default; gate new pages with a feature flag.
* Add tests and “shadow export” comparisons so regressions are impossible.

---

## PR0 – Repo Prep & Safety Rails

**Intent**: Add infra without changing behavior.

**Edits**

1. Add feature flags

* Create `src/featureFlags.ts`

```ts
export const FLAGS = {
  newNavigation: false,
  newDayEditor: false,
  channelMapEditor: false,
} as const;
```

2. Add TypeScript baseline (keep JS allowed)

* Add `tsconfig.json` (JS interop: `"allowJs": true`, `"checkJs": false`).
* Rename nothing yet. Add one `.ts` file to prove pipeline.

3. Add testing utilities

* Ensure Jest/Vitest is installed (keep what you have).
* Add `tests/helpers/yamlDiff.ts`:

```ts
import YAML from "yaml";
export function yamlEqual(a: string, b: string) {
  return YAML.parse(a) && YAML.parse(b) &&
         JSON.stringify(YAML.parse(a)) === JSON.stringify(YAML.parse(b));
}
```

4. Schema hash check (non-blocking for now)

* Add `scripts/check-schema-hash.mjs` (reads local schema JSON and known hash).
* Add a CI job that runs it and only warns (will turn blocking later).

**DoD**

* Build passes. Tests run locally and in CI.
* App behavior unchanged with flags off.

---

## PR1 – Extract Pure Utilities (No UI changes)

**Intent**: Move YAML & validation logic to stable, unit-tested modules.

**Edits**

1. Extract YAML writer

* Create `src/utils/yamlExport.ts`

```ts
import YAML from "yaml";
export function toYaml(obj: unknown): string {
  return YAML.stringify(obj, { aliasDuplicateObjects: false });
}
```

* Add tests: `tests/yamlExport.test.ts` (snapshot and round-trip).

2. Extract JSON Schema validation

* Create `src/utils/schemaValidator.ts`

```ts
import Ajv from "ajv";
import schema from "@/assets/schema/nwb_schema.json";
const ajv = new Ajv({ allErrors: true, strict: true });
const validateFn = ajv.compile(schema);
export type ValidationIssue = { path: string; severity: "error"|"warning"; message: string };
export function validateSchema(data: unknown) {
  const ok = validateFn(data);
  return { ok: !!ok, errors: (validateFn.errors ?? []).map(e => ({
    path: e.instancePath || e.schemaPath, severity: "error", message: e.message || "invalid"
  })) as ValidationIssue[] };
}
```

* Add unit tests: valid/invalid fixtures.

3. Shadow export comparator

* Add `src/utils/shadowExport.ts`

```ts
import { toYaml } from "./yamlExport";
export function shadowCompare(legacyYaml: string, data: unknown) {
  const candidate = toYaml(data);
  return { equal: legacyYaml === candidate, candidate };
}
```

* Add tests verifying equality against current exporter on 2–3 real fixtures.

**Refactor**

* Change current exporter call sites to use `toYaml` internally (no behavior change).

**DoD**

* YAML output is bit-for-bit identical on fixtures.
* Schema validator callable from anywhere; no UI changes yet.

---

## PR2 – Introduce Router + New Skeleton (Flagged Off by Default)

**Intent**: Add routing & page shells, but keep old UI as default.

**Edits**

1. Router

* Install React Router if needed.
* Create `src/AppRouter.tsx`

```tsx
import { FLAGS } from "@/featureFlags";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LegacyApp from "@/App"; // existing
import AnimalWorkspace from "@/pages/AnimalWorkspace/AnimalWorkspace"; // stub
import DayEditor from "@/pages/DayEditor/DayEditor"; // stub
import ValidationSummary from "@/pages/ValidationSummary/ValidationSummary"; // stub

export default function AppRouter() {
  if (!FLAGS.newNavigation) return <LegacyApp />;
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AnimalWorkspace />} />
        <Route path="/animal/:animalId" element={<AnimalWorkspace />} />
        <Route path="/animal/:animalId/day/:dayId" element={<DayEditor />} />
        <Route path="/animal/:animalId/validation" element={<ValidationSummary />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

2. Switch entry

* In `src/main.jsx|tsx`, render `<AppRouter />` instead of `<App />`.

3. Page stubs (minimal placeholders)

* `AnimalWorkspace.jsx/tsx`, `DayEditor.jsx/tsx`, `ValidationSummary.jsx/tsx` with “TODO” text.

**DoD**

* With flags off, legacy UI loads.
* With `newNavigation: true`, new routes load stubs, no crashes.

---

## PR3 – State Stores & Data Model (No Visual Change)

**Intent**: Centralize animal/default/day state; keep legacy UI reading from existing state until we flip.

**Edits**

1. Create Zustand stores (or Context if you prefer)

* `src/state/useAnimalStore.ts`

```ts
import create from "zustand";
export type Animal = { id: string; subject: any; devices: any; cameras: any; days: string[] };
export const useAnimalStore = create<{
  animals: Record<string, Animal>;
  upsert: (a: Animal)=>void;
  addDay: (animalId: string, dayId: string)=>void;
}>(() => ({ animals: {}, upsert: ()=>{}, addDay: ()=>{} }));
```

* `src/state/useDayStore.ts`

```ts
import create from "zustand";
export type Day = { id: string; animalId: string; session: any; devices: any; epochs: any[]; validation?: any; draft?: any; exported?: string };
export const useDayStore = create<{
  days: Record<string, Day>;
  upsert: (d: Day)=>void;
  patch: (id: string, partial: Partial<Day>)=>void;
}>(() => ({ days: {}, upsert: ()=>{}, patch: ()=>{} }));
```

* `src/state/useDefaultsStore.ts` for defaults & versioning.

2. Migrate nothing yet—just wire in stores and add unit tests for reducers.

**DoD**

* Stores compile and have tests.
* No UI changes; legacy code still works.

---

## PR4 – Animal Workspace MVP (List + Add Day, Flagged)

**Intent**: Build the first new screen that’s obviously useful; still non-blocking.

**Edits**

1. `AnimalWorkspace` MVP

* Displays one selected animal (for now) with list of Day cards.
* “Add Recording Day” → creates a Day from defaults (placeholder defaults).

2. Batch create dialog (skeleton only)

* `BatchCreateDialog` with date range picker (no logic yet).

3. Acceptance Tests

* Render page, add a day, verify state store updated.

**DoD**

* With flag on, you can add days and see cards.
* No export yet. Legacy still unchanged.

---

## PR5 – Day Editor (Stepper) – Step 1: Overview

**Intent**: Introduce the guided flow one step at a time.

**Edits**

1. `DayEditorStepper`

* Renders step nav (Overview, Devices, Epochs, Validation, Export).
* Only “Overview” is active; others disabled.

2. `OverviewStep`

* Fields for session info. Bind to `useDayStore`.
* Inline schema validation (field-level AJV on change) using `validateSchema`.

3. Validation Summary (inline panel in editor)

* Shows current errors/warnings for the day (from `validateSchema`).

**DoD**

* Editing Overview persists to store and shows live validation errors.
* Export button disabled (not implemented).

---

## PR6 – Devices Step + Channel Map Editor (MVP, feature-gated)

**Intent**: Add Devices UI and a minimal Channel Map grid (CSV import/export only).

**Edits**

1. `DevicesStep`

* Confirm devices/electrode groups. Bind to store.
* Immediate checks for duplicates/missing references (logical validator placeholder).

2. `ChannelMapEditor` (flagged by `FLAGS.channelMapEditor`)

* Minimal grid: columns = channel, shank, group, notes.
* CSV import/export buttons with validation.

3. Logical validation utilities

* `src/components/validation/useValidation.ts` orchestrates:

  * schema → logical → cross-reference (stubs for now)
  * returns structured issues array

**DoD**

* Devices step edits saved; channel map CSV round-trip works.
* Errors appear in Validation Summary.

---

## PR7 – Epochs/Tasks Step + Cross-Refs

**Intent**: Implement epochs and cross-ref checks (e.g., camera ids, task indices).

**Edits**

1. `EpochsStep`

* CRUD list of epochs with start/end; guard `end > start`.
* Link tasks to epochs; autogenerate IDs.

2. Cross-reference validation

* Ensure references exist (camera_id present, etc.).

**DoD**

* Invalid references surface as actionable errors that link to fields.

---

## PR8 – Export Step + Filename Enforcement + Shadow Export

**Intent**: Keep export locked until all checks pass; prove identical output.

**Edits**

1. `ExportStep`

* Shows generated filename template: `YYYY-MM-DD_<animal>_metadata.yml`
* Enforce format (non-editable or templated with locked tokens).

2. Unlock export only if:

* `validateSchema` passes, and no “error” severity logical/cross-ref issues.

3. Shadow export (temporary safety)

* On export, also compute legacy YAML and compare. If mismatch → show diff and block (configurable).
* Add test: export 3 fixtures and assert equality.

**DoD**

* For migrated steps, exported YAML equals legacy output on fixtures.
* Filename is enforced.

---

## PR9 – Batch Tools & Validation Summary Page

**Intent**: Make multi-day workflows efficient.

**Edits**

1. `ValidationSummary` page

* Table of all days: status (valid/invalid/incomplete) with tooltips.

2. Batch actions

* “Validate All” runs pipeline for each day; stores results.
* “Export Valid” exports only days with no errors.

3. Background autosave

* Add `useAutosave.ts` that periodically saves animal/day drafts to localStorage.

**DoD**

* Batch validate/export works; invalid days list reasons.
* Autosave restores after refresh.

---

## PR10 – Probe Reconfiguration Wizard

**Intent**: Only add once Devices and Channel Map are stable.

**Edits**

1. `ProbeReconfigWizard`

* Compare current vs previous day device/electrode structure.
* If changed, show diff → apply forward to subsequent new days (optionally update defaults snapshot).

2. Tests

* Given two consecutive days, toggling group structure triggers wizard; applying changes updates a new day’s default.

**DoD**

* Wizard detects structural changes, applies cleanly, updates defaults snapshot history.

---

## PR11 – Accessibility & Keyboarding Pass

**Intent**: Hardening pass once UI shape stabilizes.

**Edits**

* Add ARIA roles, live regions for validation messages, visible focus, skip links.
* Keyboard shortcuts: save (⌘/Ctrl+S), add epoch (A), next/prev step.
* Reduced motion mode for steppers/dialogs.

**DoD**

* Axe checks pass on critical pages.
* Keyboard-only workflows are viable.

---

## PR12 – Flip the Default Flags

**Intent**: Make new app primary once parity confirmed.

**Edits**

* `FLAGS.newNavigation = true`, `FLAGS.newDayEditor = true`, `FLAGS.channelMapEditor = true`.
* Keep a temporary “Use legacy editor” toggle in a Settings panel for 1–2 releases.

**DoD**

* New flow is default. Legacy still accessible (temporary).

---

# Shared Validation Pipeline (Used from PR5 onward)

```ts
// src/components/validation/pipeline.ts
import { validateSchema } from "@/utils/schemaValidator";
export type Issue = { path: string; severity: "error"|"warning"; message: string; source: "schema"|"logic"|"xref"|"naming"|"devices" };
export function runValidation(dayData: unknown): { ok: boolean; issues: Issue[] } {
  const schema = validateSchema(dayData);
  const logic = [];   // end > start, duplicates, etc.
  const xref  = [];   // ids exist, indices valid
  const naming= [];   // filename template tokens present
  const devices=[];   // channel map integrity
  const issues = [...schema.errors, ...logic, ...xref, ...naming, ...devices];
  const ok = issues.every(i => i.severity !== "error");
  return { ok, issues };
}
```

---

# Rollback Strategy

* Each PR is self-contained and reversible (git revert).
* Keep the legacy exporter available until PR12 passes.
* Shadow export comparison stays enabled for one release post-flip.

---

# Acceptance Gates You Can Hand to Claude Code

For every PR, require Claude to satisfy:

1. **Tests**: unit tests for new modules + at least one integration test.
2. **Parity**: YAML equality on existing fixtures (starting PR1, enforced PR8+).
3. **Flags**: New code behind flags until PR12.
4. **A11y**: No axe violations introduced (from PR11).
5. **DX**: Types compile; lints clean; CI green.
