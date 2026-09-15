# Workflow review fixes (2026-09-15)

**Status:** COMPLETE — nine tasks + final fix wave on `fix/workflow-review-findings` (commits 70fe5b38..6d7aa64b, plus this docs commit), fast-forward merged into `feat/first-useful-release`. Response table + follow-ups: docs/reviews/2026-09-14/IMPLEMENTATION_STATUS.md.
**Spec:** [docs/reviews/2026-09-15/WORKFLOW_UX_ARCHITECTURE_REVIEW.md](../../../../docs/reviews/2026-09-15/WORKFLOW_UX_ARCHITECTURE_REVIEW.md) — findings F1–F7 and architecture items 2, 3, 5. The spec's central rule binds every task:

> Reuse definitions and suggest previous values; preserve what was actually true on each recording date. Distinguish a correction to history from a change that starts on a particular date.

**Out of scope (deferred, by ruling):** F8 (quarantined/incomplete imports — a separate import-model feature), architecture items 1 (subsumed by F1–F3), 4 (visual load), 6 (store profiling), 7's multi-browser Playwright, 8 (conversion receipts), README legacy-first wording.

Research notes for implementers (facts with file:line refs, gathered before planning) live in the SDD workspace: `.superpowers/sdd/PLAN/research-*.md`. Read the one named in your task.

## Global Constraints

1. **Scientific infrastructure — zero regressions.** Golden baselines must stay byte-identical: `npx vitest run baselines` passes with NO fixture regeneration. Full suite `npx vitest run` passes. `npm run typecheck` passes (the build does NOT type-check). `npm run lint` clean.
2. **TDD.** Write the failing test first, show RED output, then GREEN. Tests assert real behavior over real state shapes (no mock-behavior tests).
3. **Exported YAML shape is unchanged.** These fixes change app-internal ownership and UI; the YAML keys/order emitted by `mergeDayMetadata` → `encodeYaml` are not altered. New internal fields are never exported.
4. **No `WORKSPACE_SCHEMA_VERSION` bump.** Every persisted-shape change in this plan is ADDITIVE and OPTIONAL (absent ⇒ previous behavior), so no migrator/fixture is needed. If a task finds it truly needs a bump, STOP and report BLOCKED.
5. **Never invent scientific values.** No placeholder weights/dates/calibrations/environments. An unknown stays absent and surfaces at export as a blocking issue with a repair route.
6. **History is preserved by default.** A change to a shared definition (task type, camera, config) defaults to "from now on"; rewriting earlier days is an explicit, scoped, confirmed correction.
7. **Terminology:** never use the word "colony". The collection is "Animals".
8. **Commits:** small, self-contained, one task per commit (or a few logically split commits). `git add` ONLY the files you touched — the working tree contains unrelated untracked review docs and modified plan docs under `docs/reviews/` and `.claude/docs/plans/trodesconf-import/`; never stage those. End commit messages with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
9. **CHANGELOG.md** gets a line per user-visible change (under an "Unreleased" heading; create it if absent).
10. **Styling:** CSS Modules + tokens from `src/index.css :root`; never a raw color/z-index. `npm run lint:css` must not add warnings.
11. **Two architectures coexist**; touch only the workspace (v3) side unless the task says otherwise. Do not edit `src/pages/LegacyFormView.jsx` or `src/state/useLegacyForm.js`.

Repo commands: `source ~/.nvm/nvm.sh && nvm use` first (Node v26.0.0). `npx vitest run <path>` for a focused run.

---

## Task 1: Drafts without weight or date of birth (F4)

**Research:** `research-creation.md` §B.
**Spec:** F4 — "Separate draft validity from export completeness. Require a safe unique identity to create a draft, allow unknown facts, and request weight on the recording day. If baseline weight is retained, label it optional and dated. Keep unresolved required metadata visible at export."

Facts: `validateWizardIdentity` (`src/viewModels/createAnimalWizardViewModel.ts:161-183`) hard-requires `weight` and `date_of_birth`; every wizard commit path (`tryCommitIdentity`, `commitIdentityIfCreated`, `handleSaveDraft` at `src/pages/Home/CreateAnimalWizard.tsx:519-528`) routes through it. `SubjectMetadata.weight` is already documented optional (`src/state/workspaceTypes.ts:175-179`). The exported weight is the DAY's `session.weight` only (`src/state/workspaceUtils.ts:416-427, 513-516`). `createAnimal` (`src/state/workspaceActions.ts:135-144`) seeds a FABRICATED `weight: 100` when the caller omits one; the wizard's `seedIdentityFromAnimal` (`CreateAnimalWizard.tsx:95-112`) then has to special-case `100` as blank (`SEED_WEIGHT`). Missing DOB blocks export via the AJV `required` error mapped to `subject.date_of_birth` (`src/validation/schemaValidation.ts:34-60`, generic message).

Changes:
1. `validateWizardIdentity`: weight and date_of_birth become OPTIONAL. Keep the format checks when present (weight non-negative; DOB not in the future). Subject id, species, sex, genotype remain required (they are identity).
2. `createAnimal` (`workspaceActions.ts`): stop seeding `weight: 100`. An omitted weight stays absent. Remove the wizard's `SEED_WEIGHT` special case accordingly (it must not treat a real 100 g weight as blank). Keep the `description: 'Subject'` fallback as is (out of scope; note it in your report as an observation).
3. Wizard Identity step UI: label the weight field "Baseline weight (grams, optional)" with help text saying it is only a suggestion for the first recording day and that each day records its own measured weight. Label DOB "Date of birth" with help text "Needed before export; can be filled in later." Remove "Weight is required" copy.
4. Export visibility: in `schemaValidation.ts`, give the `required` error for `/subject/date_of_birth` a friendly message ("Date of birth is missing. Add it in the animal profile.") and ensure the issue routes to the animal-profile repair surface (follow how other animal-owned issues set `ownerSurface`/`repairSurface`/`actionLabel` — see `src/domain/repairRouting.ts`). Verify in a test that a day whose animal lacks DOB shows a blocking issue with that message and an animal-surface repair route.
5. `AnimalProfileDialog` (`src/pages/AnimalEditor/AnimalProfileDialog.tsx`) must accept an empty DOB on open (an animal created as a draft) and let the user fill it — verify it does not crash or reject the initial empty value on open.
6. Wizard step status: the Identity step shows "incomplete" (not "complete") while DOB is absent, using the existing `computeStepStatuses` mechanism.

Tests (TDD): `createAnimalWizardViewModel.test.ts` — blank weight and blank DOB both accepted; negative weight and future DOB still rejected. `CreateAnimalWizard.test.jsx` — "Save draft" with subject id + species + sex + genotype only creates the animal and navigates; the created record has NO `weight` key and NO `date_of_birth` key. `workspaceActions` test — `createAnimal` with a subject lacking weight leaves `weight` undefined. Validation test — merged day for a DOB-less animal has a blocking `subject.date_of_birth` issue with the friendly message and an animal repair route. `dayCarryPolicy` — `previousWeightSuggestion` returns null for a baseline-less animal with no prior days (already true; add the assertion if missing).

CHANGELOG: "New animals can be saved as drafts without a baseline weight or date of birth; both are requested later (weight per recording day, DOB before export)."

---

## Task 2: One identity boundary for Copy-from-animal (F2)

**Research:** `research-creation.md` §A.
**Spec:** F2 — "Reuse one creation/identity boundary for create, copy, and import: preserve entered case, perform case-insensitive duplicate checks, and reject incompatible IDs before creating the animal."

Facts: `src/pages/CopyFromAnimal/index.tsx:121-131` lowercases the id and accepts `[a-zA-Z0-9_-]+` (underscore allowed), then `createAnimal` (no normalization) creates it; the wizard adopts it via `#/home?animal=<id>` with the subject-id field `readOnly` (`CreateAnimalWizard.tsx:638-646`) and its stricter check (`recordingFilenameIssue` → underscores rejected, `createAnimalWizardViewModel.ts:131-134`) then traps the user. The shared rules live in `src/domain/animalCreation.ts` (`subjectLookupKey`, `findAnimalIdByLookup`, `subjectIdCollision`, `buildAnimalFromForm`) and `recordingFilenameIssue` (find its module via grep). The converter splits `.rec` filenames on `_` (`/Users/edeno/Documents/GitHub/trodes_to_nwb/src/trodes_to_nwb/data_scanner.py:45`).

Changes:
1. Extract the subject-id rule from `validateWizardIdentity` into ONE exported pure function in `src/domain/animalCreation.ts`, e.g. `validateSubjectId(candidate, existingAnimals, exceptAnimalId?) → { ok: true, subjectId } | { ok: false, message }`, that: trims, PRESERVES case, rejects empty/spaces/slashes/underscores/unsafe filename characters (reuse `recordingFilenameIssue`), and detects case-insensitive collisions (message names the existing animal). `validateWizardIdentity` and `CopyFromAnimal` both call it (no duplicated regexes). Same messages in both places.
2. `CopyFromAnimal`: use the returned case-preserved `subjectId` as BOTH the store key and `subject.subject_id`; show the shared error message inline (below the field) and disable Copy while invalid. The `#/home?animal=` handoff carries the case-preserved id.
3. Verify the YAML import path's animal-id derivation (`yamlImportPlan.ts`/`yamlImportApply.ts`) already preserves case and uses `findAnimalIdByLookup` for collisions; if it uses a different normalization, route it through the same function. Report what you found.

Tests (TDD): `animalCreation.test.js` — `validateSubjectId`: keeps `ReviewCase` as `ReviewCase`; rejects `Review_Rat` with the underscore message; rejects a slash; detects `rs10` vs existing `RS10` as a collision naming `RS10`; allows the animal's own id when `exceptAnimalId` is set. `CopyFromAnimal` component test — copying to `ReviewCase` creates `animals.ReviewCase` with `subject.subject_id === 'ReviewCase'`; `Review_Rat` shows the underscore message and never calls `createAnimal`. Wizard test — adopting `#/home?animal=ReviewCase` shows `ReviewCase` (case kept) and passes identity validation.

CHANGELOG: "Copy setup from another animal keeps the new subject ID's capitalization and rejects converter-incompatible IDs before creating the animal."

---

## Task 3: Task occurrences own their environment and cameras (F3)

**Research:** none beyond this brief; key code is cited inline.
**Spec:** F3 — "Keep task identity reusable. Store effective environment/camera selections on task occurrences, defaulting them at creation. Provide 'this epoch / this day / change default for future days,' and a separate scoped correction flow for history." Spyglass: `Task` identity = name/description; environment and cameras belong to `TaskEpoch` (`/Users/edeno/Documents/GitHub/spyglass/src/spyglass/common/common_task.py:128`).

Facts: `TaskInstance` (`src/state/workspaceTypes.ts:627-638`) already declares an optional `camera_id` day-owned override that the resolver ignores. `resolveTaskInstances` (`src/state/taskCatalog.ts:224-245`) copies the whole type definition. `deriveAnimalTaskCatalog` (`taskCatalog.ts:148-209`) records a later occurrence with a different definition as a `task_definition_reconciled` record and DROPS its values from the instance (first occurrence wins). `mergeDayMetadata` resolves via `resolveDayTasks` (`src/state/workspaceUtils.ts:311-317`). Editing a task type (`src/pages/AnimalEditor/wiring/TaskTypesContainer.tsx:74-93`, `updateTaskType`) rewrites every day's effective environment/cameras. The epoch editor (`src/pages/DayEditor/EpochsTab.tsx`) renders rows from `epochGridViewModel.ts:229-293` (`taskEnvironment`, `cameras` per row) and has a "Review task catalog match" conflict block (`EpochsTab.tsx:701-728`, handlers `keepCatalogDefinition`/`keepDayValues` at 275-282, `preserveInlineTaskDefinitions`). Real-corpus case: SC38's task `forkTrack_handleAlternation_HaightRight_twoSecondDelay` ran with environment `HaightRight` on 2023-06-06 and `HaightLeft` on 2023-06-13 — both must survive.

Model (additive, no schema bump):
- `TaskInstance` gains `task_environment?: string` beside the existing `camera_id?` override. Semantics: PRESENT ⇒ this day's actual value; ABSENT ⇒ the type's current default. Both documented on the type.
- `resolveTaskInstances`: apply instance overrides for `task_environment` and `camera_id` over the type definition (output keys unchanged: `task_name, task_description, task_environment, camera_id, task_epochs`). Byte-identical for instances without overrides (golden baselines prove it).
- `deriveAnimalTaskCatalog`: when a later occurrence of a name differs ONLY in `task_environment` and/or `camera_id`, keep the canonical type and store the differing values as instance overrides — NO reconciliation record (nothing was lost). A differing `task_description` (Spyglass identity) still reconciles as today. Round-trip property: derive → resolve reproduces the original inline tasks byte-for-byte for environment/camera differences.
- Import: confirm the YAML import path (`yamlImportApply.ts`) reaches days through `deriveAnimalTaskCatalog` or an equivalent; the two-file SC38-style import must end with day 1 exporting `HaightRight` and day 2 `HaightLeft`.

UI:
1. **This day.** In the epoch editor, each task occurrence's environment and cameras are editable for THIS day: an "Edit for this day" affordance on the row (or the task cell) opening a small inline form/popover with "Environment" (text, prefilled with the effective value, placeholder = type default) and "Cameras used" (checklist of the animal's cameras, prechecked with the effective set). Saving writes the instance overrides; a "Use task default" action clears them. The row shows a compact "differs from task default" marker when an override is present. Keyboard accessible; no new raw colors.
2. **Change default for future days / correct history.** In the Task Type edit modal (`TaskTypeModal.tsx` via `TaskTypesContainer.tsx`), when the edit changes `task_environment` or `camera_id` and existing days reference the type, show the affected-day count and a scope choice, default first: (a) "Keep earlier days as recorded (N days) — new default applies to days created from now on": before saving the new default, pin every existing referencing instance that lacks an override with the OLD value(s) as explicit overrides; (b) "Also correct those N earlier days": save the default without pinning (the confirm names the dates). Implement the pinning as a pure function in `src/state/taskCatalog.ts` (e.g. `pinTaskContextOnDays(days, taskTypeId, fields) → updated days`) and apply it through the existing store actions (`updateDay`).
3. The existing "Review task catalog match" block: `keepDayValues` must preserve environment/camera differences as instance overrides (not by forking the type) and only fall back to today's behavior for a `task_description` difference. Read `preserveInlineTaskDefinitions` and adjust.
4. The Recording Setup camera checklist "cannot remove a camera inherited from the task": with the instance override, the effective camera set for the day is what the resolved tasks say. Do NOT change the checklist; just confirm `resolveDayCameraUsage` sees the overridden cameras (it already receives the resolved tasks) and add a test.

Tests (TDD): `taskCatalog.test` — resolver applies overrides; absent overrides byte-identical; derive keeps SC38-style environment difference as an override with no reconciliation; description difference still reconciles; `pinTaskContextOnDays` pins only instances lacking overrides. `workspaceUtils` merge test — a day whose instance overrides environment exports it, and `cameras` follows the overridden `camera_id`. Golden baselines untouched. `TaskTypesContainer`/modal test — editing environment with 2 referencing days shows the scope choice; default choice leaves both days' exported environment unchanged and future instances get the new default; "also correct" changes both. EpochsTab test — editing a row's environment for this day writes the override and the row shows the marker; "Use task default" clears it. Import test — two files, same task name, different environment → each day exports its own.

CHANGELOG: "A task's room/environment and cameras can differ per recording day; editing a task type's defaults no longer rewrites earlier days unless you choose to correct them."

---

## Task 4: Import keeps every camera calibration (F1)

**Research:** `research-F1-import-cameras.md`.
**Spec:** F1 — "Resolve same-name/different-calibration conflicts before commit. Offer a new named calibration/camera version for the affected dates, or an explicit correction of a chosen date range. Show source filename/date and both values, remap dependent references, and retain the original values. An existing catalog entry must not silently settle historical calibration disagreements." The converter uses `meters_per_pixel` as the position scale (`trodes_to_nwb/src/trodes_to_nwb/convert_position.py:1062`); Spyglass keys cameras by name (`spyglass/src/spyglass/common/common_device.py:291`). The app's own rule (CameraModal help text, `identitySafety.ts:60-76`): a different calibration IS a different camera. Real corpus: 17 animals have a repeated camera name with several calibrations (e.g. Emmett `sleep_camera` 0.00102 → 0.001073 → 0.001173 across 2025-11 → 2026-02).

Facts: `unionCameras` (`src/state/yamlImportPlan.ts:389-507`) collapses a same-name/different-field camera onto the first-seen row (line 459-467) and remaps the later file's refs onto it (476-486); `Divergence` (34-39) is display text only; `materializePlanDay` (680-686) applies `cameraIdRemap.add|replace` through `remapCameraRefs` (`src/state/cameraUsage.ts`) which rewrites `tasks[].camera_id`, `associated_video_files[].camera_id`, `fs_gui_yamls[].camera_id`, `cameras_used`. The preview (`src/pages/ImportRepair/index.tsx:862-913`, `AnimalPreviewCard`) renders divergences as inert text and only has a per-ANIMAL add/skip/replace fieldset (`conflictResolutions`, lines 72,176-179,492-496 → `applyImportPlan` `resolutions`). Existing tests: `src/state/__tests__/planImport.test.js` (140-159 asserts only that a flag exists), `applyImportPlan.test.js:347-390` (different NAMES preserved).

Design:
1. **Structured conflicts in the plan.** Add to `ImportPlanAnimal` a `cameraConflicts: CameraCalibrationConflict[]` where each is `{ key: string /* stable: `${subjectId}:${camera_name}` */, cameraName, candidates: [{ fields: {meters_per_pixel, lens, model, manufacturer}, firstSourceName, firstDate, sourceNames: string[], fromExisting: boolean }] }` — one candidate per DISTINCT identity-field tuple, in first-seen (date) order; an existing animal's catalog row is candidate 0 with `fromExisting: true` (add space only). Keep the human-readable `Divergence` too.
2. **Resolution input.** `planImport(...)` (find its signature) accepts `options.cameraConflictResolutions?: Record<key, CameraConflictResolution>` where `CameraConflictResolution = { kind: 'split' } | { kind: 'unify', candidateIndex: number }`. Default when absent: `split`.
   - `split`: candidate 0 keeps the original name (and, in the add space, the existing row); every later candidate becomes its OWN catalog camera named `${cameraName}_${YYYYMMDD}` using that candidate's `firstDate` (date digits only); if that name is taken, append `_2`, `_3`… Each day's refs are remapped to the row matching ITS file's calibration tuple. `catalogAdditions.cameras` includes the new rows.
   - `unify`: one row with the chosen candidate's fields; all days remap onto it (today's behavior, but with an explicit choice and the chosen value).
   Both spaces (`add`/`replace`) honor the resolution.
3. **Preview UI.** In `AnimalPreviewCard`, render one fieldset per conflict: heading "Camera "overhead_camera" has N calibrations across the files"; a table of candidates showing `meters_per_pixel` (and any other differing field), first file name, first date, and day count; radio choices: "Keep as separate cameras (recommended) — later calibrations become `overhead_camera_20230623`…" and "Use one calibration for every day: [radio per candidate]". Changing a choice re-plans (plan is pure; re-run with the resolutions map) and the preview re-renders. When `unify` is selected, show a warning line naming the calibration values that will NOT be exported. Confirm import passes the same resolutions through so the applied plan equals the previewed one.
4. **Result summary.** The import result lists, per animal, the camera rows created by splitting (name → calibration → dates) and, for unify, the discarded values with their source files.
5. `applyImportPlan` needs no new branch if the plan already carries the resolved catalog + per-day remaps; verify and keep the executor unchanged where possible.

Tests (TDD, on real-shaped inputs): `planImport.test.js` — two remy files (0.001 / 0.002): default plan has one conflict with two candidates and the `split` catalog holds `overhead_camera` (0.001) + `overhead_camera_20230623` (0.002); day 1 refs → id of first, day 2 refs (`tasks[].camera_id`, `associated_video_files[].camera_id`, `cameras_used`) → id of second; `unify` with candidateIndex 1 gives one row at 0.002 and both days on it. Existing-animal add space: existing `overhead_camera` at 0.001, file at 0.002 → split creates `overhead_camera_<date>` and does NOT touch the existing row. Three-calibration Emmett-style sequence yields three rows in date order; name collision suffixing covered. `applyImportPlan.test.js` — after apply + `mergeDayMetadata`, day 1 exports 0.001 and day 2 exports 0.002 under split. ImportRepair preview test — the conflict fieldset renders both values with file names/dates; choosing unify shows the discard warning; Confirm passes the resolutions.

CHANGELOG: "Batch import no longer collapses a camera's differing calibrations onto the first file's value; each conflict is shown with both values and resolved (separate cameras by default) before import."

---

## Task 5: Daily log readiness and the data-folder prerequisite (F6)

**Research:** `research-day-editor.md` §B.
**Spec:** F6 — "Put the folder field or a direct 'Set data folder' action next to generation. Define files as linked / expected but unresolved / not recorded or not needed, and use the same state in rows and export readiness. Do not force nonexistent statescripts into every recording."

Facts: the notice at `src/pages/DayEditor/EpochsTab.tsx:730-734` says "needs Daily Setup" (no such section) and the disabled generator is the "Statescripts (N)" button (`:662-663`). The folder lives at `day.dataFolder`, edited in `DayTab.tsx:322-332` inside a collapsed `<details>` BELOW the epoch editor, written via `onFieldUpdate('dataFolder', …)`. The "N statescripts missing" chip (`EpochsTab.tsx:539, 639`) is a filter count styled as an error although a missing statescript is, by the project's settled policy, a non-blocking amber WARNING (memory: run epochs always expected; sleep epochs expected only if the animal's prior same-configuration days logged sleep statescripts). Row `status` (`epochGridViewModel.ts:266-275`) blocks only on missing video. Export gate: `dayEditorViewModel.ts:860-924`.

Changes:
1. Replace the notice with an inline "Data folder" input bound to `day.dataFolder` (same `onFieldUpdate('dataFolder')`, same validation/help as DayTab's field — extract a shared small component if DayTab's field has logic worth sharing; otherwise a plain labelled input), placed directly above/beside the generate buttons, shown whenever the folder is empty. Copy: "Set the data folder to generate statescript and video file names." No reference to "Daily Setup".
2. Three-state file vocabulary, one source: extend `EpochGridRow` with `statescriptState: 'linked' | 'expected' | 'not_expected'` computed in `epochGridViewModel.ts` using the settled expectation rule (implement `isStatescriptExpected(row, animal, day)` as a pure function in `src/domain/` if none exists — grep `statescript` in `src/domain/epochGeneratedFiles.ts`/`associatedFiles.ts` first and reuse). The chip becomes "N statescripts expected" (amber/warning styling, tokens) counting `expected` only; the filter uses the same state; the row's collapsed statescript cell label shows "expected" / "not expected" / the linked name. Video keeps its existing `videoPresence` (missing video blocks; that is unchanged).
3. Readiness text: when the gate is open and warnings exist, the Fix & Export "Ready to export" line reads "Ready to export · N warnings to review" (reuse the view-model's warning count; do not invent a new count). Never show "Ready to export" next to an error-styled file badge.

Tests (TDD): `epochGridViewModel` — statescriptState for linked/expected/not_expected (run epoch always expected; sleep epoch expected iff a prior same-config day linked a sleep statescript); chip count equals the number of `expected` rows. EpochsTab test — empty folder renders the inline input and typing a folder enables "Statescripts (N)"; the text "Daily Setup" does not appear. ExportPreview/DayEditor test — open gate with 2 warnings renders "Ready to export · 2 warnings to review".

CHANGELOG: "The daily log names the data folder right where file names are generated and shows statescripts as expected / linked / not expected instead of a red 'missing' count."

---

## Task 6: Readable review on the single-day export path (F7)

**Research:** `research-day-editor.md` §C.
**Spec:** F7 — reuse `EffectiveDayReview`/`buildPreflightSummary` inline beside Download on the day editor's Fix & Export page; interruption only for unresolved conflicts.

Facts: `src/pages/DayEditor/ExportPreview.tsx:147-236` renders actions + gate + history + raw YAML; `EffectiveDayReview` (`src/pages/ValidationSummary/EffectiveDayReview.tsx`) takes `{animal, day}`, merges itself, and renders the 9 preflight rows + rig constants; its CSS import is relative, no import cycle exists (verified). `buildPreflightSummary` (`src/domain/preflightSummary.ts:80-152`) rows: Animal & day, Configuration version, Probes & failed channels, Cameras / calibration, Data acquisition, Tasks & videos, Optogenetics, Subject & session, Non-blocking warnings.

Changes:
1. Move `EffectiveDayReview` to a shared location (`src/components/EffectiveDayReview.tsx` + its own `.module.css` holding the rows' styles currently in `ValidationSummary.module.css`); update the ValidationSummary import. No visual change there.
2. Extend `buildPreflightSummary` with two rows the spec asks for: "Weight & team" (`subject.weight` g or "not recorded"; `experimenter_name` joined) placed after "Animal & day", and make "Tasks & videos" list each task as `name (epochs) — environment` when ≤ 6 tasks (count form otherwise). Update its unit test; the Validation summary shows the same rows (shared function).
3. In `ExportPreview`, render `<EffectiveDayReview animal={animal} day={day} />` between the readiness line and the Download/Copy actions whenever the gate is open (blocked days keep the repair list first, review below). Caption: "Check these values before downloading."

Tests (TDD): `preflightSummary.test.js` — new rows; weight absent → "not recorded". `ExportPreview.test.jsx` — open gate renders the review with the day's weight, experimenters, camera calibration, and each task's environment; blocked gate still renders the repair list first.

CHANGELOG: "Fix & Export shows a readable summary of what the file will say (weight, team, tasks and rooms, calibrations, failed channels, stimulation) before you download."

---

## Task 7: Keyboard-reachable day sections, badge contrast, footer targets (F5 + arch item 3)

**Research:** `research-day-editor.md` §A, `research-arch.md` §2.
**Spec:** F5 — "Use ordinary focusable route links/buttons"; arch 3 — failed-channel badge text contrast 2.46:1 (needs ≥ 4.5:1) and footer links target size (15 px tall; needs 24 px).

Batch of three small edits:
1. `src/pages/DayEditor/DayEditorSectionNav.tsx:85`: remove `tabIndex={step.active ? 0 : -1}` so every section button is in the normal Tab order (keep `aria-current`). Update `DayEditorSectionNav.test.jsx` to assert no item has `tabindex="-1"` and that Tab reaches each.
2. Badge: the rule that actually styles the Failed Channels warning badge is the nested `.status-warning.status-badge` in `src/pages/DayEditor/DayEditor.scss` (~line 1116: `color: #f57c00` on `#fff3e0`). Change the text color to `var(--color-warning)` (`#bf360c`, 5.60:1 on that background per research). Sweep the same file for any other `.status-warning` text color below 4.5:1 and fix with the token (fix the class, not just the cited line). Add a small unit test that renders the badge and asserts the computed class/token if the project has a pattern for it; otherwise document the contrast ratio in the commit message.
3. Footer links (`src/layouts/AppLayout.tsx:449-451`, styled by `.footer` in `src/App.scss:479-487`): give the links `display: inline-block; min-height: 24px; line-height: 24px; padding: 0 var(--spacing-xs)` (or the project's spacing token) so the target is ≥ 24 px tall without changing the font size.

Run `npx vitest run src/pages/DayEditor/__tests__/DayEditorSectionNav.test.jsx` plus the DayFrame and useGlobalShortcuts tests (Alt+←/→ must keep working).

CHANGELOG: "Day editor sections are reachable with Tab; failed-channel badges and footer links meet contrast and target-size guidelines."

---

## Task 8: Correct the electrode-group coordinate types (arch item 2)

**Research:** `research-arch.md` §3.

Facts: `ElectrodeGroup` (`src/state/workspaceTypes.ts:209-226`) declares `targeted_location?: number[]` and `targeted_x/y/z?: string`; `src/nwb_schema.json`, every golden fixture, and every read site treat `targeted_location` as a string (a region label) and `targeted_x/y/z` as numbers, and `units` is a string field the type omits. Research lists ~20 read sites.

Changes: fix the interface (`targeted_location?: string`, `targeted_x?: number`, `targeted_y?: number`, `targeted_z?: number`, `units?: string`) with doc comments matching the schema; then fix whatever `npm run typecheck` surfaces (casts that papered over the wrong type, test fixtures typed against it). No runtime behavior change; golden baselines and the electrode-group editor tests must pass unchanged. Also tighten the `TaskInstance.camera_id` doc comment only if Task 3 did not already (it should have).

CHANGELOG: none (internal types).

---

## Task 9: Load route bundles lazily (arch item 5)

**Research:** `research-arch.md` §1.

Facts: routing is custom hash-based in `src/layouts/AppLayout.tsx` (routes at ~211-252), all 9 page components imported eagerly; no `React.lazy`/`Suspense` anywhere; `vite.config.ts` has no `manualChunks`; 11 tests/e2e specs render `AppLayout` and assume synchronous mounting. The production JS is one 1,310 kB asset.

Changes:
1. Convert the top-level page imports in `AppLayout.tsx` to `React.lazy(() => import(...))` for: `LegacyFormView`, `ImportRepair`, `CopyFromAnimal`, `CreateAnimalWizard`/Home, `AnimalView`/AnimalEditor, `DayEditor`, `ValidationSummary`, `AnimalWorkspace`, and the recovery screen — i.e. every route component. Wrap the route outlet in ONE `<Suspense fallback={<RouteLoading />}>` where `RouteLoading` is a small accessible placeholder (`role="status"`, text "Loading…", tokens only).
2. Keep the layout chrome (header, nav, footer, skip links) eager so the shell paints immediately.
3. Tests: update the 11 suites that render `AppLayout` to await the route (`await screen.findBy…`), never by adding artificial timeouts. E2E specs already wait on conditions; run the relevant ones (`npm run test:e2e -- <spec>`) for at least the workspace and legacy routes — kill any stale dev server on :3000 first (see memory: stale server ⇒ every spec fails "element not found").
4. Verify with `npm run build`: report the per-chunk sizes before/after (the main chunk must shrink substantially; state the numbers in your report). Do not add `manualChunks` unless a single chunk still exceeds Vite's warning threshold, and then only by route.

CHANGELOG: "The app loads only the screen you open; other screens download on demand."

---

## Final review

Whole-branch review against the spec, on the most capable model (Fable). Then merge locally into `feat/first-useful-release` (fast-forward or merge commit) — do NOT push. Update this file's **Status** line with the merge commit in the same commit as the merge.
