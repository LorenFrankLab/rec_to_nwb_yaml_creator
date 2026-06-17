# Overview — Scope, integration, byte-identity gate, risks

[← back to PLAN.md](PLAN.md)

## Current codebase integration points

File:line refs into the live code each phase touches (verified against the tree at planning time;
re-confirm before editing — line numbers drift).

- `src/state/workspaceUtils.ts:289` — `resolveDayDataAcqDevice`: `(dayName && catalog.find(...)) || catalog[0]` silently substitutes the first device for a dangling `data_acq_device_name`. **Phase 2** makes it fail closed. The geometry sibling `resolveDayConfig` (`:221-244`) already throws on a dangling pin — the target pattern.
- `src/validation/rules/referenceRules.ts:275-280` — `fsGuiReferences` opto-presence check inlines `?.length > 0` instead of the shared strict `optoFieldsPresence` (`src/domain/optoCompleteness.ts`). **Phase 2** routes it through the helper.
- `src/state/dayTaskCatalog.ts:61-100` — `resolveDayCatalogView`: converts inline `day.tasks` → catalog instances, reusing a catalog `TaskType` **by `task_name`** (`:74`). **Phase 3** addresses the silent-metadata-swap when a same-name type diverges.
- `src/pages/DayEditor/EpochsTab.tsx:134-160` — `applyCommit`: clears inline `day.tasks` (`onFieldUpdate('tasks', [])`) once the day is catalog-derived (the second half of the Phase-3 mechanism).
- `src/state/yamlImportApply.ts:275-280,326-340` — `addToExistingAnimal` / `dayOwnedUpdates`: the "Conflict → add" path writes a day's `tasks`/`associated_video_files` (camera refs) without merging the source animal's camera/data-acq catalogs. **Phase 4**.
- `src/pages/ImportRepair/index.tsx:163-168` — forces `{ [subjectId]: 'add' }` for an existing subject (the trigger for the Phase-4 dangling-ref case).
- `src/state/importRepair.ts:353,410-420` — `task_epoch`→`task_epochs` normalization is listed as a benign "no values changed" shim, but drops the singular value when both keys exist and differ. **Phase 4**.
- `src/pages/DayEditor/EpochsTab.tsx:188-225` — `renumberCommit`/`onDelete`: remap `associated_video_files`/`associated_files`/`fs_gui_yamls` via `remapEpochRefs`, but neither remaps nor snapshots `state.videolessEpochs`. **Phase 5**. Validation reads it at `src/domain/epochVideoValidation.ts:74` (`declaredVideoless`), treating a stale number as an intentional "no video" declaration.
- `src/domain/dayRecovery.ts:71` (`DAY_STATUS`), `src/domain/stepStatus.ts:16,65-70` (`StepStatus`/`STEP_STATUS`), `src/domain/dayLifecycle.ts:28-34` (`DAY_LIFECYCLE`) — closed string sets typed as `Record<string,string>` / hand-written unions; the view-model boundary casts (`src/viewModels/validationSummaryViewModel.ts:107`, `src/viewModels/animalWorkspaceViewModel.ts:213`) are unchecked. **Phase 6**.
- `src/pages/RecoveryReview/index.tsx:123,136-140` — lede hardcodes "Nothing was discarded" and the all-clear branch says every recovered record is in good shape even when `loadWorkspace` discarded the blob and started empty. `src/state/useWorkspacePersistence.ts:54-77` owns the discard-vs-recover distinction (`initialDiscardRef`/`initialRecoverRef`) and currently exposes only `loadNotice`. **Phase 1**.
- `src/layouts/AppLayout.tsx:292-297` (skip link `href="#navigation"`) vs `:330` (the `<nav role="navigation">` has **no** `id="navigation"`). **Phase 1**.
- `src/pages/DayEditor/DayEditorFrame.tsx:414-423` — tab bar renders only `{tab.label}`, dropping the VM-computed `tab.status`/`tab.statusLabel` (`src/viewModels/dayEditorViewModel.ts:103-105,226`). **Phase 1**.
- `src/pages/ValidationSummary/DayStatusTable.tsx:56` — scroll wrapper uses the CSS-module class `styles.tableScroll`; the e2e `e2e/workspace-validation-responsive.spec.js:115` still matches the old global `.validation-summary-table-scroll`. **Phase 1**.
- `src/pages/AnimalEditor/CamerasSection.tsx:156` + `CamerasSection.scss:149-160` — `table-layout: auto` inside a `.cameras-table-scroll` wrapper; long names push the Actions column off-screen (`e2e/workspace-responsive-cameras.spec.js:64`). **Phase 1**.
- `e2e/task-catalog-screenshots.spec.js:21,61` — writes PNGs into committed `docs/testing/screenshots/task-catalog/`; runs under the default `npm run test:e2e` (`playwright test`). **Phase 1**.
- `.github/workflows/test.yml:186` — schema-sync step `exit 0`s when the Python schema file is absent, contradicting `docs/CI_CD_PIPELINE.md:107`. **Phase 7** makes this fail loudly; the workflow already checks out `trodes_to_nwb`, so a missing schema path means the gate is broken.
- Test gaps (**Phase 7**): no guard for the AJV-Draft-7 vs jsonschema-2020-12 divergence (`CLAUDE.md` flags it; `src/nwb_schema.json` uses zero `format` keywords today, so latent); no test enforcing "schema-version bump ⇒ checked-in `vN` fixture exercised through `loadWorkspace`"; `missingChannelMapRows` zero-row branch (`src/validation/electrodeGroupRules.ts:60-101`) untested; `enum`/`uniqueItems`/`minimum` weakly asserted in `src/validation/__tests__`; `e2e/baselines/import-export.spec.js` wraps ~23 assertions in `if (...isVisible())` self-skips; `workspaceSelectors.guard.test.js:80` exempts all of `validation/`; `commandCatalog.ratchet.test.ts:21-25` scans `viewModels/*.ts` non-recursively.

### Phases 8–12 — data-grounded app improvements (from `yaml-corpus-2`)

Verified against the live tree at planning time; re-confirm before editing.

- `src/validation/rules/referenceRules.ts:200-228` (`orphaned_file`) + `:146-196` (`orphaned_video`) — `taskEpochSet.has(epoch)` false-positives when the referencing `task_epochs` is a **list** `[2]`; `src/nwb_schema.json:617-623` declares the field scalar `integer`. **Phase 8** (the list-vs-scalar bug; ~63% of real imports). Cover both `associated_files` and `associated_video_files`, including singular-only `task_epoch` legacy video rows and mixed singular/plural video rows, because the corpus shows video epoch linkage is the largest downstream drop-risk if normalized incorrectly.
- `src/state/yamlImportPlan.ts:94-121` (`extractRecordingDate`) — parses only the template's `mmddYYYY_..._metadata.yml` + `session_id` ending `_YYYYMMDD`; real `YYYYMMDD_<subject>.yml` → `null` → `planImport` dead-end. **Phase 8**. (`src/state/importRepair.ts:348-420` is the normalization seam shared with **Phase 4**.)
- `src/validation/rules/optoRules.ts` — `optogeneticsRules` has **no `power_in_W` magnitude check**; `src/nwb_schema.json:36042` is the field; `src/pages/AnimalEditor/OptogeneticsStep.tsx:56` has the misleading `placeholder: 'e.g. 10'`. **Phase 9**.
- `src/validation/rules/identityRules.ts:56-60` — the camera-name divergence signature **already includes `meters_per_pixel`** (within-file aliasing is done). Gaps: `meters_per_pixel > 0` (`src/nwb_schema.json:716`), placeholder names, and the cross-day case at the `src/state/yamlImportApply.ts:270-340` catalog-merge seam (shared with **Phase 4**). **Phase 10**.
- `src/validation/rules/dandiSubjectRules.ts:24-36` — already rejects free-text `species` (`invalid_species`); add genotype-vs-strain + placeholder-`subject_id` nudges. `src/validation/rules/identityRules.ts` — add the experimenter name-shape rule (Spyglass `decompose_name`). `src/validation/rules/electrodeGroupRules.ts:105-160` — `empty_location` + the case warning; add a typo nudge. `src/ntrode/probeCatalog.ts:75-96` already has **all 12** probes (only `CLAUDE.md`'s "Current Supported Device Types" doc is stale at 8). **Phase 11**.
- `src/validation/rules/referenceRules.ts` (sibling to `orphaned_file`) — no `associated_files` *internal* checks today (duplicate name → trodes `pynwb ValueError` hard-fail; duplicate path / missing statescript description-keyword / bad path-shape → silent drop). **Phase 12**.

### Phases 13–14 — UX efficiency & clarity (from the live UX walkthrough)

Verified against the live tree; re-confirm line numbers before editing. Full findings:
[../../research/yaml-corpus-2/13-ux-live-walkthrough.md](../../research/yaml-corpus-2/13-ux-live-walkthrough.md).

- `src/pages/DayEditor/DayEditorFrame.tsx:144-157,407` — `readinessIssues` → the `ReadinessBar` banner (the surface to group/tier/collapse). `src/pages/ValidationSummary/index.tsx:200-302` already has the grouped/collapsed + `warningsAcknowledged` pattern to reuse. **Phase 13.**
- `src/domain/humanizeValidationMessage.ts` (+ applied at `src/viewModels/dayEditorViewModel.ts:545`) — `HUMANIZE_LABELS` misses `must have required property '<X>'` / `must NOT have fewer than 1 items`; extend **at display**, leaving raw `issue.message` intact (a downstream parser reads it — the file says so). **Phase 13.**
- `src/domain/dayLifecycle.ts:28-34` — `DAY_LIFECYCLE.DRAFT` already exists; `src/viewModels/animalWorkspaceViewModel.ts:62-170` rolls a fresh day straight to the export-gate "Needs fixing". Gate the surfacing on "touched yet?" so untouched = DRAFT. `src/pages/AnimalEditor/CamerasSection.tsx:154-158` fires the calibration warning on an empty step (same punish-early class). **Phase 13.**
- `src/pages/Home/CreateAnimalWizard.tsx:108-204` (`TeamStep`) — collects `lab`/`institution` from blank seeds; `experiment_description` collected nowhere. `src/domain/animalCreation.ts:134,149,157` has the defaults that don't reach the step. **Phase 14.**
- `src/pages/DayEditor/DayTab.tsx:400-433` — the inherited-subject-metadata disclosure that writes the animal record for all days behind a grey "UPDATES ALL DAYS" label; `src/pages/AnimalView/index.tsx` is the correct edit path. **Phase 14.**
- `src/pages/AnimalEditor/ElectrodeGroupModal.tsx` (+ CSS) modal scroll; `src/pages/Home/CreateAnimalWizard.tsx:245-268` stepper + Save-draft; `src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.tsx` device-type label. **Phase 1** (pure layout/label).

## Scope and dependency policy

### Goals

- Eliminate the **silent** failure modes: a merge that substitutes a different device, an epoch edit that swaps exported task metadata, an import that adds dangling refs, a normalization that drops a value while labeled "benign", a recovery screen that says "nothing discarded" when data was discarded.
- Keep the off-export epoch state (`videolessEpochs`) consistent with the epoch numbers it annotates.
- Recover the two "known-14" e2e failures that are genuinely fixable (cameras layout; validation-responsive stale selector).
- Tighten the closed-set type invariants and the test/CI safety net so these classes can't silently regress, including a schema-sync check that fails when the downstream schema path disappears.

### Non-Goals

- **No change to exported YAML for equivalent valid input.** Every fix here either (a) changes behavior only for input that is already invalid/dangling/divergent (and therefore already export-blocked or malformed), or (b) touches off-export state / presentation / tests. The four golden baselines stay byte-identical (see Metrics).
- Not re-architecting the task catalog or the import model — only closing the silent-failure edges.
- Not addressing the data-directory binding (an explicit prior Non-Goal) or pushing `modern` to origin.
- Not closing every medium/low UX/a11y finding from the review. Deferred follow-ups, tracked here so they do not disappear: Day Editor route focus should include the visible page context; Epochs popup menus should either implement true menu keyboard behavior or drop `role="menu"`; Validation batch preflight should move focus or announce itself when inserted; CopyFromAnimal should expose duplicate/invalid ID reasons and a no-source escape action; static issue content should avoid assertive `role="alert"` where it is not a live error.

### Dependency policy

No new runtime dependencies. (`@axe-core/playwright` already added during the epoch-editor work.)

### Phase handoffs

Most phases can be reviewed independently, but these handoffs are intentional and should be reflected in
branch order or same-PR coordination:

- **Phase 8 before Phase 12** (or one coordinated diff): both touch `referenceRules`; Phase 8 owns epoch-reference normalization, Phase 12 owns `associated_files` entry internals.
- **Phase 4 before/with Phase 8:** Phase 8's legacy key-shape tests rely on Phase 4's dual-key conflict reconcile path; if Phase 8 lands first, keep conflicting singular/plural values explicitly unresolved rather than silently normalizing.
- **Phase 4 before/with Phase 10:** both touch existing-animal import/catalog merge; Phase 4 blocks dangling refs, Phase 10 adds cross-day camera calibration divergence at the same seam.
- **Phase 2 before/with Phase 9:** both can touch opto validation helpers; Phase 9 should reuse the Phase-2 helper shape if Phase 2 lands first.
- **Phase 13 before Phases 8-12:** Phase 13 bounds and tiers the Day Editor validation banner so the new data-quality guards do not create an attention/working-memory wall.
- **Phase 14 before or with Phase 13:** Phase 14 removes wizard-created first-day errors; Phase 13 controls when/how any remaining validation results surface.
- **Phase 7 before any deliberate schema migration:** this plan avoids schema changes; if one becomes unavoidable, the schema-sync and AJV/jsonschema divergence gates must already be hard.

## Metrics

- **Byte-identity (hard gate, every export-touching phase):** `npx vitest run baselines` stays green —
  the 4 golden fixtures (`src/__tests__/fixtures/golden/*`) round-trip byte-for-byte, AND the
  `exportParity` / `legacyParity` integration tests (`src/pages/DayEditor/__tests__/`) stay green. A
  baseline diff means the fix changed equivalent-input output and is wrong until proven a deliberate,
  coordinated schema change (it is not, in this plan).
- **Full gate (every phase):** `npx vitest run`, `npm run lint:ci`, `npm run typecheck`,
  `npm run check:schema`, `npm run build` all pass.
- **e2e:** the known-14 baseline. Phases 1 must *reduce* it by 2 (cameras + validation-responsive)
  with zero new regressions; all other phases hold at the then-current baseline. Run
  `--reporter=line` to a file; identify failures from `test-results/` dir names; `git checkout --
  docs/testing/screenshots/` after every run.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| A fail-closed merge change (Phase 2) accidentally moves a golden baseline. | The golden fixtures store *resolvable* devices, so the changed branch (dangling ref) is never hit by them; assert `npx vitest run baselines` explicitly in Phase 2. |
| The task-catalog collision fix (Phase 3) changes the inline→catalog conversion for *non-colliding* days too. | Gate the new behavior on detected divergence only; the no-collision path (and `mergeTaskCatalogResolution.test.js`) must be unchanged. |
| `videolessEpochs` remap (Phase 5) is off-export, so a regression wouldn't show in baselines. | Add explicit unit tests asserting the remapped/restored set after renumber/delete/undo, and that `epochVideoValidation` reads the remapped numbers. |
| The `as const` enum derivations (Phase 6) accidentally change a string value. | The derivation only tightens *types*; assert the runtime values are unchanged (the consts keep their literals) + baselines green. |

## Rollout Strategy

All-at-once per phase (no feature flags). `modern` is local-only and unpushed; these land on `modern`
the same way the epoch-editor phases did (branch off `modern` → full gate → independent review →
`git merge --ff-only`; do not push unless asked). Suggested order: land the original review fixes
low-risk-first (`1 → 7`), land the UX-presentation prep (`14` if convenient, then **13**), then land the
data-grounded guard fixes (`8 → 12`) with the handoffs above. If a later phase is pulled forward,
explicitly re-check its handoff partner before merging.

## Open Questions

1. **Phase 3 — task-catalog collision resolution.** When `resolveDayCatalogView` converts an inline
   `day.tasks` entry whose `task_name` matches a catalog `TaskType` with **different**
   description/environment/camera, what should happen? Current best answer: **do not silently reuse**
   — surface it. Recommended default: detect the divergence and surface a one-time review/confirm
   ("this day's inline 'Run' differs from the animal's catalog 'Run'; keep the catalog definition, or
   add a distinct type"), defaulting to *no write* until acknowledged (so an epoch edit can't silently
   change exported metadata). Alternative: auto-mint a distinct same-named type. Confirm before
   implementing Phase 3 — this is the one finding whose fix shape is a genuine product decision.
2. **Phase 4 — `task_epoch`/`task_epochs` dual-key conflict.** When both keys exist with different
   values, treat it as a reconcile item (like the `volume_in_uL`/`volume_in_ul` precedent), not a
   benign normalization. Current best answer: **reconcile** — surface a repair row, never silently
   drop. Low ambiguity; confirm the wording, not the approach.
3. **Phase 1 — cameras Actions reachability.** Keep the actions reachable without horizontal scroll.
   Recommended default: a **sticky Actions column** (`position: sticky; right: 0`) so name columns
   scroll under it; alternative is to accept scroll-to-reach and relax the e2e assertion. Recommend
   sticky (best UX, recovers the e2e honestly).
4. **Phase 8 — schema vs normalize for list-typed `associated_files.task_epochs`.** Real files use a
   list; the shared `nwb_schema.json` says scalar. Recommended default: **normalize on import** (list→
   scalar) and leave the schema scalar — avoids a cross-repo `nwb_schema.json` change and keeps export
   byte-identical. Alternative (relax the schema to `oneOf [integer, array]`) needs trodes_to_nwb
   coordination + the AJV/jsonschema divergence check (Phase 7). Confirm the normalize approach.
5. **Phase 9 — `power_in_W` threshold + severity.** Recommended: **warn-to-confirm at `> 1 W`** (typical
   2–50 mW; only correct corpus value was 0.077). Warning, not block — a real high-power source must be
   enterable. Confirm the threshold and that it's a warning.
6. **Phase 10 — cross-day camera calibration.** The within-file aliasing guard exists; the across-days
   case lives at the existing-animal catalog merge (**Phase 4**'s seam). Recommended: surface a
   `divergent_camera_identity` repair when an imported day's `camera_name` matches an existing catalog
   camera with a different `meters_per_pixel`, defaulting to no silent overwrite. Confirm whether this
   ships inside Phase 4 or Phase 10 (they touch the same merge code); default is Phase 10 rebased on
   Phase 4 unless implementation proves the same repair row should be shared.
7. **Phase 11 — experimenter name-shape severity + `empty_location` active-scoping.** (a) Name-shape:
   recommend **warning** (blocking risks rejecting an unusual-but-real name). (b) Active-scoping the
   `empty_location` error so it doesn't fire on deliberately-unused/all-bad tetrodes needs a first-class
   **disabled-group** concept — recommend **deferring** it (its own phase) rather than scoping it here.
8. **`screw` / `single_electrode` (66 files / 17 animals).** A real non-probe electrode class trodes
   can't resolve (FileNotFoundError) and the app can't express. Genuine product decision: add a
   first-class non-probe electrode path (needs pipeline coordination) vs. document as unsupported.
   **Not** a Phase-11 catalog edit. Track here; decide before building.
9. **Associated-video rows with no epoch key.** The corpus has real `associated_video_files` rows without
   either `task_epoch` or `task_epochs`. Phase 8 must preserve/flag known singular/plural forms, but the
   no-key shape needs a product decision before gating: is it a valid videoless/Guidera workflow marker,
   or should Import & Repair require an epoch assignment?

## Estimated Effort

Small per phase. Rough diff sizing: Phase 1 ~150 LOC across 6 files (+ test updates); Phase 2 ~40 LOC;
Phase 3 ~120 LOC (the only non-trivial one — depends on Q1); Phase 4 ~100 LOC; Phase 5 ~60 LOC; Phase 6
~60 LOC (mechanical, multi-file); Phase 7 ~250 LOC (mostly new tests). Data-grounded phases: Phase 8
~160 LOC plus import fixtures; Phase 9 ~40 LOC; Phase 10 ~120 LOC; Phase 11 ~100 LOC; Phase 12 ~90 LOC.
UX phases: Phase 13 ~180 LOC plus focused VM/component tests; Phase 14 ~120 LOC plus wizard/day-scope tests.
