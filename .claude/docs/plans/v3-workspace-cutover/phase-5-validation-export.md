# Phase 5 — Day validation step + Export with shadow parity

[← overview](overview.md) · [shared contracts](shared-contracts.md)

This is the critical phase: it is the first time the new workspace UI produces a downloadable
YAML file. Until now the legacy single-page form
([overview "two parallel UIs"](overview.md#background-the-executor-needs)) is the only path that can
export. After this phase a user can validate a day and download byte-identical YAML entirely in the
new UI, with downloads gated by an encoder-stability/schema pre-download check and the byte-for-byte
legacy-parity guarantee enforced by the golden round-trip tests.

**Depends on:** [Phase 2](phase-2-navigation-stub-honesty.md)'s flag-aware routing — new routes stay
renderable in dev/tests with flags toggled, which the full-stepper render and export tests in this
phase's validation slice rely on.

**Inputs to read first:**

- [src/pages/DayEditor/ValidationStub.jsx](../../../../src/pages/DayEditor/ValidationStub.jsx) — placeholder replaced by the real Validation step this phase.
- [src/pages/DayEditor/ExportStub.jsx](../../../../src/pages/DayEditor/ExportStub.jsx) — placeholder replaced by the real Export step this phase.
- [src/pages/DayEditor/DayEditorStepper.jsx:104-110](../../../../src/pages/DayEditor/DayEditorStepper.jsx) — the `steps` array wires `validation` → `ValidationStub` and `export` → `ExportStub` (imports at `:11-12`). Swap both component references; the stepper already passes `animal`, `day`, `mergedDay`, `onFieldUpdate` to the current step (`:151-156`).
- [src/pages/DayEditor/validation.js:52-65](../../../../src/pages/DayEditor/validation.js) — `computeStepStatus(day, mergedDay)`. `validation` is hardcoded `'incomplete'` (`:62`); `export` is already derived from real issues (`:63`). `groupErrorsByStep` (`:117-148`) already buckets issues into `overview/devices/epochs/validation/export`. Reuse it; do not fork.
- [src/pages/DayEditor/StepNavigation.jsx:118-121](../../../../src/pages/DayEditor/StepNavigation.jsx) — `isExportEnabled()` requires `overview/devices/epochs/validation` all `'valid'`. **Do not loosen.** It is unblocked by making statuses real (Phase 2 → `devices`, Phase 4 → `epochs`, this phase → `validation`).
- [src/state/workspaceUtils.js:34-103](../../../../src/state/workspaceUtils.js) — `mergeDayMetadata(animal, day)` (2-arg; config derived internally from `day.configurationVersion`). The single bridge from workspace → flat YAML model.
- [src/io/yaml.js:37,107,127](../../../../src/io/yaml.js) — `encodeYaml(model)` (`:37`), `formatDeterministicFilename(model)` (`:107`), `downloadYamlFile(fileName, content)` (`:127`). Filename format is `${experimentDate}_${subjectId.toLocaleLowerCase()}_metadata.yml` where `experimentDate = model.EXPERIMENT_DATE_in_format_mmddYYYY` and `subjectId = model.subject.subject_id` (`:108-110`).
- [src/validation/index.js:27,50](../../../../src/validation/index.js) — `validate(model)` (`:27`) returns sorted `{ path, code, severity, message }[]`; `validateField(model, fieldPath)` (`:50`) filters to a subtree.
- [src/features/importExport.js:244-293](../../../../src/features/importExport.js) — `exportAll(model)`: the **legacy export path**. It clones the model, validates, then `encodeYaml(structuredClone(model))` + `formatDeterministicFilename(form)` + `downloadYamlFile(...)`, where `model` is the full legacy flat `formData` object — built independently of `mergeDayMetadata`. **Note:** the legacy export operates on a *different* object than `mergeDayMetadata`'s output, so a runtime same-object re-encode cannot prove parity with this path. The byte-for-byte parity guarantee against legacy comes from the golden round-trip tests below (parse a golden fixture → build the equivalent workspace → `encodeYaml(mergeDayMetadata(animal, day))` → assert byte-identical to the fixture). The runtime gate is a cheaper, narrower check (see the shadow-gate task).
- [src/__tests__/baselines/golden-yaml.baseline.test.js](../../../../src/__tests__/baselines/golden-yaml.baseline.test.js) — parity harness pattern: read fixture → `YAML.parse` → `encodeYaml` → `expect(...).toBe(golden)`. The 4 fixtures live in [src/__tests__/fixtures/golden/](../../../../src/__tests__/fixtures/golden/): `20230622_sample_metadata.yml`, `minimal-valid.yml`, `realistic-session.yml`, `20230622_sample_metadataProbeReconfig.yml`.
- [src/featureFlags.js:60,72](../../../../src/featureFlags.js) — `shadowExportStrict` (`:60`, default `true`) and `shadowExportLog` (`:72`, default `true`) **already exist** (declared under the M1 group). This phase wires them into the runtime download path; it does not redeclare them. Read `isFeatureEnabled` (`:328`) for the access helper.

**Contracts referenced:**

- [YAML parity / shadow-export contract](shared-contracts.md#yaml-parity--shadow-export-contract) — new export path is `encodeYaml(mergeDayMetadata(animal, day))` + `formatDeterministicFilename` + `downloadYamlFile`. Two distinct safeguards: (1) a cheap runtime pre-download gate that proves the encoder is stable / does not mutate its input in place and that the output is schema-valid — `shadowExportStrict` (default true) gates whether a failure blocks the download; and (2) the byte-for-byte **legacy-parity** guarantee, enforced by the golden round-trip tests in this phase's validation slice (and `golden-yaml.baseline.test.js`) every phase. The runtime gate does **not** prove legacy parity; the golden tests do. **Do not weaken the golden tests.**
- [Validation & step-status contract](shared-contracts.md#validation--step-status-contract) — reuse `validate()` / `computeStepStatus()`; wire `validation` to real status; do not loosen `isExportEnabled`; only export is hard-gated on zero `error`-severity issues (data-entry steps stay non-blocking).
- [`mergeDayMetadata` contract](shared-contracts.md#mergedaymetadata-contract) — the returned object maps 1:1 onto the legacy YAML schema; `encodeYaml(mergeDayMetadata(animal, day))` must equal the legacy export byte-for-byte. (Phase 1 made the result safe to own; this phase consumes it read-only.)

## Tasks

- **Replace `ValidationStub` with a real per-day Validation step.** Create
  `src/pages/DayEditor/ValidationStep.jsx` accepting the props the stepper already passes
  (`animal`, `day`, `mergedDay`). Call `validate(mergedDay)` (reuse `src/validation/index.js:27` — do
  not reimplement), then group with `groupErrorsByStep` from
  [validation.js:117](../../../../src/pages/DayEditor/validation.js). Render issues grouped by
  severity (`error` / `warning` / `info`) and, within each, by step, each issue showing its `message`
  and `path`. Surface a top-line summary ("N errors, M warnings") and a clear "ready to export" /
  "blocked" indicator keyed on whether any `error`-severity issue exists. Update
  `DayEditorStepper.jsx:11` and `:108` to import and render `ValidationStep`.
- **Wire `validation` step status to real results.** In `computeStepStatus`
  ([validation.js:58-64](../../../../src/pages/DayEditor/validation.js)), replace the hardcoded
  `validation: 'incomplete'` (`:62`) with a status derived from the `validation` bucket of
  `groupErrorsByStep(issues)`: `'error'` if that bucket contains any `error`-severity issue, else
  `'valid'`. This is the catch-all bucket (anything not routed to overview/devices/epochs), so a clean
  catch-all reports `'valid'` and stops permanently disabling Export. Leave `devices` (Phase 2) and
  `epochs` (Phase 4) untouched; **do not edit `isExportEnabled`** in `StepNavigation.jsx`.
- **Replace `ExportStub` with a real Export step.** Create
  `src/pages/DayEditor/ExportStep.jsx` (props `animal`, `day`). Build the flat model once via
  `mergeDayMetadata(animal, day)`, compute `const yaml = encodeYaml(merged)` and
  `const fileName = formatDeterministicFilename(merged)`, and render: (a) the resolved filename, (b) a
  YAML preview (read-only `<pre>` of `yaml`, behind a "Show preview" toggle for large output), and (c)
  a Download button. The Download button must run the **shadow-export gate** (next task) before calling
  `downloadYamlFile(fileName, yaml)`. The Export step is only reachable when every prerequisite step is
  `'valid'` (enforced by the existing `isExportEnabled` gate now that `validation` is real) — the
  button itself does not re-implement the gate, but it must still hard-stop on the shadow check.
  Update `DayEditorStepper.jsx:12` and `:109` to import and render `ExportStep`.
- **Implement the encoder-stability pre-download gate.** Add a pure helper module
  `src/pages/DayEditor/shadowExport.js` that, before every download, recomputes the YAML and verifies
  the encoder is **stable** — i.e. it does not mutate its input in place — returning a structured
  result the Export step consumes. **Be precise about what this proves and what it does not:** it
  compares `encodeYaml(merged)` against `encodeYaml(structuredClone(merged))`, where *both* sides
  derive from the **same** `mergeDayMetadata` output. That detects only whether `encodeYaml` mutates
  its argument in place (an encoder-stability / no-in-place-mutation check); it does **not** prove
  byte-for-byte parity with the legacy export path, because the legacy path (`exportAll`) encodes a
  *different*, independently-built flat `formData` object. The **real** legacy-parity guarantee is the
  golden round-trip tests in this phase's validation slice (parse golden fixture → build workspace →
  `encodeYaml(mergeDayMetadata(animal, day))` → assert byte-identical to the fixture), which run every
  phase. Keep this cheap runtime guard as a defense-in-depth pre-download check, optionally combined
  with a schema-validity (`validate(merged)`) assertion. The gate runs **before every download**; on a
  stability/schema failure it blocks the download, surfaces a diff in the UI, and logs details (gated
  by `shadowExportLog`). A debug override is permitted **only** when `shadowExportStrict` is false;
  when it is true (the default) a failure is unconditionally fatal for that download.

  ```js
  // src/pages/DayEditor/shadowExport.js
  import { encodeYaml } from '../../io/yaml';
  import { mergeDayMetadata } from '../../state/workspaceUtils';
  import { isFeatureEnabled } from '../../featureFlags';

  /**
   * Cheap pre-download encoder-stability check. Recomputes the export YAML and
   * verifies that encodeYaml does NOT mutate its input in place, by comparing
   * encodeYaml(merged) against encodeYaml(structuredClone(merged)) — both derived
   * from the SAME mergeDayMetadata output.
   *
   * What this proves: encodeYaml is stable / has no in-place-mutation side effect
   * on its argument.
   * What this does NOT prove: byte-for-byte parity with the legacy export path.
   * The legacy path (src/features/importExport.js exportAll) encodes a different,
   * independently-built flat formData object, so comparing two encodings of the
   * same merged object cannot establish legacy parity. That guarantee is enforced
   * by the golden round-trip tests (parse fixture → build workspace → encode →
   * assert byte-identical), which run every phase. A failure here is a
   * data-integrity bug (encoder instability), never a feature.
   *
   * @param {object} animal
   * @param {object} day
   * @returns {{ ok: boolean, yaml: string, stableYaml: string, diff: string|null }}
   */
  export function checkShadowExport(animal, day) {
    const merged = mergeDayMetadata(animal, day);

    // First encode (what we are about to download).
    const yaml = encodeYaml(merged);

    // Second encode of an independent clone: if encodeYaml mutated `merged` in
    // place, these two strings diverge. (Stability check, NOT legacy parity.)
    const stableYaml = encodeYaml(structuredClone(merged));

    if (yaml === stableYaml) {
      return { ok: true, yaml, stableYaml, diff: null };
    }

    const diff = firstLineDiff(yaml, stableYaml);

    if (isFeatureEnabled('shadowExportLog')) {
      console.error('[shadow-export] encoder instability — download blocked', {
        fileName: undefined, // filled in by caller if desired
        diff,
      });
    }

    return { ok: false, yaml, stableYaml, diff };
  }

  /**
   * Produce a compact, human-readable first-difference report between two
   * YAML strings (line number + both sides). Used for the blocking UI notice.
   */
  export function firstLineDiff(a, b) {
    const aLines = a.split('\n');
    const bLines = b.split('\n');
    const max = Math.max(aLines.length, bLines.length);
    for (let i = 0; i < max; i += 1) {
      if (aLines[i] !== bLines[i]) {
        return [
          `First difference at line ${i + 1}:`,
          `  encode A: ${JSON.stringify(aLines[i] ?? '<missing>')}`,
          `  encode B: ${JSON.stringify(bLines[i] ?? '<missing>')}`,
        ].join('\n');
      }
    }
    return 'Strings differ in length but share all compared lines.';
  }
  ```

  In `ExportStep.jsx` the Download handler is:

  ```js
  const handleDownload = () => {
    const { ok, yaml, diff } = checkShadowExport(animal, day);
    const fileName = formatDeterministicFilename(mergeDayMetadata(animal, day));

    if (!ok && isFeatureEnabled('shadowExportStrict')) {
      // BLOCKING: never download when the encoder-stability check fails in strict mode.
      setBlockingError({ message: 'Export blocked: encoder-stability check failed.', diff });
      return;
    }
    if (!ok) {
      // shadowExportStrict === false: debug-only override; warn loudly but proceed.
      setOverrideWarning({ message: 'Encoder-stability mismatch overridden (strict mode off).', diff });
    }
    downloadYamlFile(fileName, yaml);
  };
  ```

  Render `blockingError.diff` in a `<pre>` inside an alert region when present, and gate the Download
  button's `disabled` state on `blockingError` until the user retries.
- **Confirm the `shadowExportStrict` / `shadowExportLog` feature-flag entries.** Both already exist in
  `src/featureFlags.js` (`:60`, `:72`). This phase does **not** add new flag keys; it consumes them via
  `isFeatureEnabled`. If their JSDoc still reads "in tests" (`:56-60`), update the `shadowExportStrict`
  comment to note it now also gates the runtime download override (the encoder-stability pre-download
  check), default `true`. Do not change the default value.
- **Documentation.** Add a short "Shadow export safety" note to `docs/REFACTOR_CHANGELOG.md` describing
  that new-UI downloads are gated on an encoder-stability pre-download check (no in-place mutation +
  schema-valid), that byte-for-byte legacy parity is proven by the golden round-trip tests, and that
  `shadowExportStrict` (default true) is a debug-only override for the runtime gate. No
  README/getting-started changes are required this phase (the new UI is still behind flags until
  [Phase 10](overview.md#rollout-strategy)).

## Deliberately not in this phase

- **Batch "Export Valid Only" and any cross-day export summary** — Phase 7. This phase exports exactly
  one day from the Export step.
- **`store.js` decomposition** — Phase 6. Do not refactor the store while wiring export; behavior must
  stay identical so the golden baselines and full suite cover Phase 6's mechanical split.
- **Optogenetics editor UI** — out of scope for the whole plan
  ([overview Non-Goals](overview.md#non-goals)). Optogenetics keys still flow through
  `mergeDayMetadata` when `animal.optogenetics` is present; that path is exercised by the
  `20230622_sample_metadata.yml` fixture but no editor is built.
- **Any change to the YAML schema or `encodeYaml`.** A parity change is a blocker requiring explicit
  fixture regeneration per CLAUDE.md's protocol — never regenerate to make a test pass.
- **Flipping `newDayEditor` / `animalWorkspace` defaults or default route** — Phase 10. New routes stay
  reachable only for testing this phase.

## Validation slice

| Test | Asserts |
| --- | --- |
| `export-parity: build → export matches sample fixture` *(integration)* | Parse `20230622_sample_metadata.yml`, build an equivalent workspace `animal`+`day`, `encodeYaml(mergeDayMetadata(animal, day))` is byte-identical to the fixture file. |
| `export-parity: minimal-valid round-trips` *(integration)* | Same harness for `minimal-valid.yml`; byte-identical. |
| `export-parity: realistic-session round-trips` *(integration)* | Same harness for `realistic-session.yml`; byte-identical. |
| `export-parity: probe-reconfig round-trips` *(integration)* | Same harness for `20230622_sample_metadataProbeReconfig.yml`; byte-identical. |
| `shadow gate: stable encoder returns ok` | `checkShadowExport(animal, day)` returns `{ ok: true, diff: null }` when `encodeYaml` is stable; `downloadYamlFile` is invoked. |
| `shadow gate: injected instability blocks download` | With a stubbed/spied `encodeYaml` (or a forced divergence) so the two encodes differ, the Download handler sets a blocking error, renders the diff, and `downloadYamlFile` is **not** called while `shadowExportStrict` is true. |
| `shadow gate: firstLineDiff reports line + both sides` | `firstLineDiff('a\nb', 'a\nc')` returns a string naming line 2 and both `"b"` / `"c"` values. |
| `shadow gate: strict-off override proceeds with warning` | With `overrideFlags({ shadowExportStrict: false })` and an injected instability, the handler warns and still calls `downloadYamlFile`; restore flags after. |
| `filename: matches legacy format` | `formatDeterministicFilename(merged)` equals `${EXPERIMENT_DATE_in_format_mmddYYYY}_${subject_id.toLowerCase()}_metadata.yml` (e.g. `06222023_<subject>_metadata.yml`); identical to `exportAll`'s computed filename for the equivalent flat model. |
| `validation step: surfaces error/warning/info` | Given a `mergedDay` yielding mixed-severity issues, `ValidationStep` renders each issue under the correct severity heading with its message and path. |
| `step status: validation valid when catch-all clean` | `computeStepStatus(day, mergedDay)` returns `validation: 'valid'` when the catch-all bucket has no `error` issue, and `'error'` when it does. |
| `export gate: disabled until all steps valid, then enabled` *(integration)* | With `devices`/`epochs`/`validation` all `'valid'`, `StepNavigation` enables the Export tab; if any is non-`valid`, the Export button is `disabled` (no edit to `isExportEnabled`). |
| `golden baselines unchanged` | The existing `golden-yaml.baseline.test.js` suite still passes byte-identical for all 4 fixtures (regression guard, every phase). |

Mark the build→export round-trip tests and the full-stepper render tests as integration; the
`firstLineDiff` / `checkShadowExport` / `computeStepStatus` tests are pure unit tests. Use Vitest
(`describe`/`it`/`expect`), matching the existing baseline suite.

## Fixtures

- The 4 existing golden fixtures in
  [src/__tests__/fixtures/golden/](../../../../src/__tests__/fixtures/golden/) are the source of truth
  for parity — never regenerate them in this phase.
- Add **one** workspace-shaped fixture (a checked-in helper or `conftest`-style builder under
  `src/__tests__/fixtures/`) that constructs an `animal` + `day` whose `mergeDayMetadata` output
  reproduces one golden fixture exactly (prefer `realistic-session.yml` — no optogenetics, typical
  shape). This proves the build→merge→export chain end-to-end, not just `encodeYaml` round-tripping.
  The other 3 fixtures can be covered by the parse→build→export harness without a hand-built workspace
  each.
- For the injected-mismatch test, force divergence by spying on `encodeYaml` to mutate the second
  (legacy) call's output, or by passing the gate a wrapper that perturbs one line — do not modify the
  real fixtures or the encoder.

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** run this phase's Validation slice + `npx vitest run` (no regressions; baseline 2747/1 skipped) + `npx vitest run baselines` (byte-identical). **Golden round-trip parity is the headline of this phase and is mandatory** — the byte-identical baselines, not the runtime gate, are what prove legacy parity. No change to `encodeYaml`, `mergeDayMetadata`, the schema, or any golden fixture; `isExportEnabled` stays unchanged.
- **Playwright UI (§2):** complete a day → Validation step shows issues → Export step previews and downloads the YAML file; then inject a mismatch and confirm the export gate blocks with a diff shown (and `downloadYamlFile` is not called). 0 console errors.
- **Reviewers:** `pr-review-toolkit:code-reviewer` (always), plus `silent-failure-hunter` (the export / shadow gate), `pr-test-analyzer` (validation + export behavior), and `ux-reviewer`.
- **Checklist (§6):** every task implemented; "Deliberately not in this phase" honored; tests non-trivial (the mismatch test asserts the download is blocked, not merely that a spy was set up); no plan/phase/milestone strings (no "M9", "Phase 5") in code/test/module names or docstrings; old code flagged for removal is removed (`ValidationStub`/`ExportStub` replaced, no orphan imports; `validation.js:62` hardcode gone); user-facing docs updated (`docs/REFACTOR_CHANGELOG.md` shadow-export note added, not deferred).
