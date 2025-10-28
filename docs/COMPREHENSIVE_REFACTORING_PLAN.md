# Plan

The NWB Metadata Creator migration plan defines a structured, incremental roadmap for evolving the current YAML creation tool into a modular, schema-driven React application optimized for neuroscience experiments that span multiple animals and multiple recording days. In this workflow, each recording day corresponds to a single NWB file and thus a single YAML file, so users must often create and manage many YAMLs per experiment. The existing app already produces valid metadata, but its monolithic design limits scalability, validation consistency, and efficiency when handling dozens of sessions across animals. This plan aims to improve the creation, validation, and batch management of YAML files by introducing a clearer data hierarchy (animal → days), shared defaults, autosave, and robust schema validation. Each milestone isolates low-risk, testable steps to modernize the architecture—adding modular components, centralized state management (via the **existing Context store**), and cross-day validation—while preserving bit-for-bit compatibility with existing YAML outputs to ensure continuity and scientific reproducibility.

## Global Goals

* Preserve current YAML output bit-for-bit until we explicitly switch (shadow export from PR1).
* Keep the current UI as the default; gate new pages with a feature flag.
* Reuse the existing **Context/hooks** state system (no new state library).
* Stay single-page and bookmark-safe (hash-based navigation; no router initially).
* Use existing Vitest infrastructure; add tests rather than replace frameworks.
* Use schema **version** validation (not hash) and keep Python converter compatibility.
* Enforce accessibility in every PR (not a final pass).

---

## PR0 – Repo Prep & Safety Rails (no behavior change)

**Intent:** Add safety rails that align with the current codebase; don’t disrupt behavior.

**Edits**

1. Feature flags
   Create `src/featureFlags.js`:

```js
export const FLAGS = {
  newNavigation: false,
  newDayEditor: false,
  channelMapEditor: false,
  shadowExportStrict: true, // block on mismatch in CI/prod
  shadowExportLog: true     // log mismatches in dev
};
```

2. Schema **version** check (not hash)

* Add `"version"` to `src/assets/schema/nwb_schema.json`.
* Create `scripts/check-schema-version.mjs` that fails CI if schema version differs from the expected trodes_to_nwb target.

3. Test infra audit (reuse, don’t rebuild)

* Keep Vitest and existing test layout.
* Ensure baseline and integration suites run in CI.

**DoD**

* App behavior unchanged with flags off.
* CI runs lint, tests, and `check-schema-version.mjs` successfully.

---

## PR0.5 – Type System Strategy (docs + light JSDoc)

**Intent:** Decide on typing without churn.

**Edits**

* Add `docs/types_migration.md` with the plan:

  * Phase 1: Use **JSDoc** in new/updated modules; enable `checkJs: true` (warning-only).
  * Phase 2 (later): Optionally run `ts-migrate` after core refactor stabilizes.
* Add ESLint rules to encourage JSDoc on exported functions/types.

**DoD**

* Documented approach; no file renames; build remains green.

---

## PR1 – Extract Pure Utilities + Shadow Export (No UI changes)

**Intent:** Centralize YAML and validation; enable regression-proofing immediately.

**Edits**

1. YAML writer
   Create `src/utils/yamlExport.js`:

```js
import YAML from "yaml";

/** @param {unknown} obj @returns {string} */
export function toYaml(obj) {
  return YAML.stringify(obj, { aliasDuplicateObjects: false });
}
```

2. JSON Schema validator
   Create `src/utils/schemaValidator.js`:

```js
import Ajv from "ajv";
import schema from "@/assets/schema/nwb_schema.json";

const ajv = new Ajv({ allErrors: true, strict: true });
const validateFn = ajv.compile(schema);

/** @typedef {{path:string,severity:'error'|'warning',message:string}} ValidationIssue */

/** @param {unknown} data @returns {{ok:boolean, errors:ValidationIssue[]}} */
export function validateSchema(data) {
  const ok = validateFn(data);
  const errors = (validateFn.errors ?? []).map(e => ({
    path: e.instancePath || e.schemaPath,
    severity: "error",
    message: e.message || "invalid"
  }));
  return { ok: !!ok, errors };
}
```

3. Shadow export comparator (enforced from now on)
   Create `src/utils/shadowExport.js`:

```js
import { toYaml } from "./yamlExport";
import { convertObjectToYAMLString as legacyExport } from "@/legacy/exporter"; // existing call

/** @param {any} formData */
export function shadowCompare(formData) {
  const legacy = legacyExport(formData);
  const candidate = toYaml(formData);
  return { equal: legacy === candidate, legacy, candidate };
}
```

4. Tests

* Add baseline tests that run shadow comparison against golden fixtures; CI **fails** on mismatch.
* Refactor legacy export call sites to use `toYaml` internally (no behavior change).

**DoD**

* YAML parity proven on fixtures.
* Schema validator callable project-wide.
* CI blocks merges on parity regressions.

---

## PR2 – UI Skeleton (hash-based) + A11y Baseline (Flagged Off)

**Intent:** Introduce page shells without routing library; embed accessibility early.

**Edits**

1. Conditional “routing” (hash parsing)
   Create `src/AppShell.jsx`:

```jsx
import { FLAGS } from "@/featureFlags";
import LegacyApp from "@/App";

export default function AppShell() {
  if (!FLAGS.newNavigation) return <LegacyApp />;

  const parseHash = () => window.location.hash.slice(1) || "workspace";
  const [view, setView] = React.useState(parseHash);
  React.useEffect(() => {
    const onHash = () => setView(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // #/workspace | #/day/<id> | #/validation
  if (view.startsWith("day/")) return <DayEditor dayId={view.split("/")[1]} />;
  if (view === "validation") return <ValidationSummary />;
  return <AnimalWorkspace />;
}
```

2. Page stubs
   Create minimal, accessible stubs for:

* `src/pages/AnimalWorkspace/index.jsx`
* `src/pages/DayEditor/index.jsx`
* `src/pages/ValidationSummary/index.jsx`

3. A11y scaffold

* Add `<main>`, `<nav>`, ARIA labels, focus styles.
* Add `aria` integration tests (axe) to CI.

**DoD**

* With flags off → legacy UI. With flags on → stubs render via `#/…`.
* No axe violations.

---

## PR3 – Extend Existing **Context** Store for Animal/Day (No UI break)

**Intent:** Keep one state system; add workspace concepts.

**Edits**

* Update `src/state/store.js` and `src/state/StoreContext.js`:

  * Add `workspace: { animals, days, currentAnimal, currentDay }`.
  * Actions: `addAnimal`, `addDay(animalId, date)`, `updateDay(id, partial)`, `cloneDay(id)`.
  * Selectors: `getAnimalDays(id)`, `getDay(id)`.
* Add `localStorage` autosave for workspace (namespaced key, versioned).

**DoD**

* Legacy flows unchanged; tests pass.
* New reducers/selectors covered by unit tests.
* `docs/ANIMAL_WORKSPACE_DESIGN.md` merged.

---

## PR4 – Animal Workspace MVP (Flagged)

**Intent:** Make multi-day management visible and useful.

**Edits**

* Render animal card and per-day list with status chips.
* “Add Recording Day” clones defaults.
* Skeleton `BatchCreateDialog` (UI only).

**DoD**

* Adding a day updates store and shows in UI.
* A11y checks pass; unit/integration tests for creation.

---

## PR5 – Day Editor (Stepper) – Overview

**Intent:** Introduce guided flow starting with Overview.

**Edits**

* `DayEditorStepper` with steps (Overview, Devices, Epochs, Validation, Export).
* `OverviewStep` bound to Context store; debounced field-level `validateSchema`.
* Inline errors with ARIA live regions; “scroll-to-field” links.
* Validation panel shows issues.

**DoD**

* Overview edits persist; export stays disabled.
* A11y and tests pass.

---

## PR6 – Devices Step + Channel Map Editor (Feature-gated)

**Intent:** Build Devices UI, minimal Channel Map grid w/ CSV round-trip.

**Edits**

* `DevicesStep` with device/group editing and early logic checks (duplicates, missing refs).
* `ChannelMapEditor` (behind `FLAGS.channelMapEditor`): columns = channel, shank, group, notes; CSV import/export; inline validation.
* `components/validation/useValidation.js` orchestrates schema + logic + cross-ref.

**DoD**

* Devices and channel map edits persist; CSV import/export validated.
* Issues appear in Validation panel; tests pass.

---

## PR7 – Epochs/Tasks + Cross-Reference Checks

**Intent:** Add temporal and reference logic.

**Edits**

* `EpochsStep` CRUD with `end > start`.
* Cross-refs: `camera_id` exists; task indices valid.
* Link errors to fields; keyboard focus management.

**DoD**

* Invalid refs clearly flagged and navigable.
* Tests/A11y pass.

---

## PR8 – Export Step + Filename Enforcement + (Continuous) Shadow Export

**Intent:** Safe export only when fully valid; parity guaranteed.

**Edits**

* `ExportStep` with enforced template `YYYY-MM-DD_<animal>_metadata.yml`.
* Export button enabled only if no **error** issues across schema/logic/xref/devices/naming.
* On export, run `shadowCompare`; if mismatch and `shadowExportStrict`, block and show diff; in dev, log.

**DoD**

* Exported YAML equals legacy on fixtures.
* Filename pattern enforced; tests cover success/fail paths.

---

## PR9 – Validation Summary + Batch Tools + Autosave

**Intent:** Improve multi-day workflows.

**Edits**

* `ValidationSummary` table for all days with reasons for invalid states.
* “Validate All” and “Export Valid Only”.
* `useAutosave.js` poller to persist drafts to `localStorage`; restore on reload.

**DoD**

* Batch ops work; autosave/restore verified in tests.

---

## PR10 – Probe Reconfiguration Wizard

**Intent:** Safely propagate device changes forward in time.

**Edits**

* Detect structural diffs vs previous day; show wizard; “apply forward” to future days; optional update to animal defaults snapshot.

**DoD**

* Wizard detects and applies changes; tests simulate multi-day progression.

---

## PR11 – Accessibility & Keyboarding Enhancements (Continuous hardening)

**Intent:** Ensure top-tier usability.

**Edits**

* Global shortcuts: Save (Ctrl/Cmd+S), Next/Prev step, Add Epoch.
* Verify ARIA/focus across all pages; reduced-motion mode.

**DoD**

* Axe clean; end-to-end keyboard flow validated.

---

## PR12 – Flip Default Flags

**Intent:** Make the new experience the default—safely.

**Edits**

* Set `newNavigation`, `newDayEditor`, `channelMapEditor` to `true`.
* Provide a temporary “Use legacy editor” toggle for one release.

**DoD**

* New flow is default; parity maintained; telemetry/logs clean.

---

## Shared Validation Pipeline (from PR5)

```js
// src/components/validation/pipeline.js
import { validateSchema } from "@/utils/schemaValidator";

/** @typedef {'schema'|'logic'|'xref'|'naming'|'devices'} Source */
/** @typedef {{path:string,severity:'error'|'warning',message:string,source:Source}} Issue */

/** @param {any} dayData @returns {{ok:boolean, issues:Issue[]}} */
export function runValidation(dayData) {
  const schema = validateSchema(dayData);
  const logic = [];   // end > start, duplicates, etc.
  const xref  = [];   // ids exist, indices valid
  const naming= [];   // filename template tokens present
  const devices=[];   // channel map integrity

  const issues = [
    ...schema.errors.map(e => ({ ...e, source: 'schema' })),
    ...logic, ...xref, ...naming, ...devices
  ];
  const ok = issues.every(i => i.severity !== "error");
  return { ok, issues };
}
```

---

## Rollback Strategy

* Each PR is self-contained and reversible (`git revert` should build & test).
* Keep the legacy exporter callable until after PR12 ships; keep shadow export checks for at least one release thereafter.
* Tag milestones (`v3.0.0-mN`) for quick rollbacks.

---

## Acceptance Gates (per PR)

1. **Tests:** Unit + at least one integration test.
2. **Parity:** Shadow export equality on relevant fixtures (from PR1 onward).
3. **Flags:** New features behind flags until PR12.
4. **A11y:** No new axe violations.
5. **DX:** Lint clean; CI green; JSDoc on exported APIs.

---

**Next steps:**

* Approve this plan.
* Land PR0 and PR0.5.
* Start PR1 to unlock shadow-guarded, incremental refactors.
