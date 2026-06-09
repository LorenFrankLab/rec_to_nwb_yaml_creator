# Overview — workspace enhancements roadmap

[← PLAN.md](PLAN.md)

## Goals

Make the workspace faster to enter data into and able to ingest existing data, without changing the exported YAML for existing recordings. Specifically: a new day defaults from the last day; days can be duplicated; setup can be copied between animals; cameras-used is explicit; bad channels are day-owned and carry forward; existing YAML files can be imported into the workspace; and the Day Editor uses the same tabbed navigation as the Animal view.

## Non-goals (this roadmap)

- Changing the legacy single-page form (frozen) or making the workspace the default `#/` landing (the **cutover** — held; see Open questions).
- Promoting shared hardware to a dataset tier, or a task-type catalog — both blocked on the tier decision (see Open questions).

## Architecture context (verified)

The full legacy↔workspace relationship, the merge-seam integration map, and the data-entry efficiency audit live in [../scope-tiers-ia/design-note.md](../scope-tiers-ia/design-note.md). Mockups of the proposed UI: [../scope-tiers-ia/mockup-efficiency-patterns.html](../scope-tiers-ia/mockup-efficiency-patterns.html), [../scope-tiers-ia/mockup-tabbed-day-editor-interactive.html](../scope-tiers-ia/mockup-tabbed-day-editor-interactive.html), [../scope-tiers-ia/mockup-dataset-tier.html](../scope-tiers-ia/mockup-dataset-tier.html). The single fact every phase depends on:

**The export seam is `mergeDayMetadata(animal, day) → encodeYaml`** (`src/state/workspaceUtils.js`). One workspace day exports byte-identical YAML to the legacy form for the same session. The golden-baseline assertions (`npx vitest run baselines`) lock that output. So:

- **🟢 merge-neutral** changes (UI/state that don't alter the emitted YAML) leave baselines untouched — phases 1, 2, 3, 4, 6, 7.
- **🟡 merge-changing** changes (alter the emitted YAML) must keep it **byte-identical for existing data** (no fixture exercises the new path) AND migrate existing data — phase 5.

Express new structure as *what the merge resolves*, never as new exported keys.

## Integration points (file:line, verified)

- Day creation: `src/state/workspaceTransitions.js:288` (`createDayRecord`) ← `src/state/useWorkspace.js:392` (`createDay`) ← `src/pages/AnimalWorkspace/RecordingDaysTab.jsx:131` (`handleCreateDays`, the create loop ≈ 150).
- Day-owned selectors: `src/state/workspaceSelectors.js:89-112` (`getAnimalDayIds`, `getDaySession`, `getDayTasks`, `getDayBehavioralEvents`, `getDayKeywords`, …).
- Copy-from-animal: `src/pages/AnimalEditor/CopyFromAnimalDialog.jsx:26` (props `open/currentAnimalId/animals/onCopy/onCancel`; `handleCopy` at :89 emits `onCopy({ electrode_groups, ntrode_electrode_group_channel_map })` ≈ :127); `handleCopyConfirm` is defined at `src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.jsx:256`, wired via the dialog render at `:309-313`.
- Cameras-used: `src/state/cameraUsage.js` (`referencedCameraKeys`, `resolveDayCameraUsage`) — usage is INFERRED from `tasks[].camera_id` / `associated_video_files[].camera_id` / `fs_gui_yamls[].camera_id`.
- Bad channels: day overrides in `src/pages/DayEditor/BadChannelsEditor.jsx` (checkbox grid) written to `day.deviceOverrides.bad_channels.<ntrodeId>`; the animal-level base is edited in `src/pages/AnimalEditor/ChannelMapEditor.jsx` (`bad_channels` on each group's first ntrode row); the merge applies the day override onto the resolved ntrode map in `src/state/workspaceUtils.js` (`resolveDayConfig` + the `deviceOverrides.bad_channels` block ≈ :234).
- Import (legacy): `src/features/importExport.js` (`importFiles`, parse + `validate`) → `setFormData`; the inverse target is `mergeDayMetadata` in `src/state/workspaceUtils.js`.
- Day Editor stepper: `src/pages/DayEditor/DayEditorStepper.jsx:39` (`currentStep`), `:43` (`stepOrderRef = ['overview','devices','epochs','validation','export']`), `:287-294` (step→component config), `:341` (`StepNavigation`), `src/pages/DayEditor/stepGate.js` (`isExportEnabled`). The tabbed model to mirror: `src/pages/AnimalView/index.jsx` (the `navigation "Animal sections"` section-nav).

## Dependency / sequencing policy

Phases are independent PRs; the only hard ordering is **phase 5 reuses the carry-forward machinery from phase 1** (the bad-channel carry-forward is config-version-guarded — see [shared-contracts.md](shared-contracts.md)). Suggested order is in [PLAN.md](PLAN.md). Every phase: full `npx vitest run` green, `npx vitest run baselines` byte-identical, `npm run lint` 0 errors, `npm run build`, and the per-phase `Review` (independent `code-reviewer`) before merge.

## Risks

- **Bad-channel config-version drift (phase 5/1):** marks are keyed by `ntrode_id`, which belongs to a configuration version. Carrying marks across a config change would mis-target ntrodes. Mitigation: carry only when the new day pins the same config version as the source.
- **Cameras-used additivity (phase 4):** an explicit checklist must not change the exported camera set for existing data. Mitigation: the resolver unions the explicit set with today's inferred refs; with no explicit set stored, the union equals today's output (baselines unmoved).
- **Import attribution (phase 6):** decomposing a flat YAML into animal vs day vs config must use the SAME inheritance contract the merge uses, or round-trip parity breaks. Mitigation: the round-trip-byte-identical test on every golden fixture is the gate.

## Open questions (decision-gated — NOT planned here)

- **D-TIER:** are recording systems / cameras / DIO types / opto **animal-level** or **dataset-level**? Blocks a **task-type catalog** and a **dataset-tier** phase. Mockup: `../scope-tiers-ia/mockup-dataset-tier.html`.
- **D-CUTOVER:** when does `#/workspace` become the default front door / legacy retire? **Held.** Hard prerequisite: the importer (phase 6), so users with existing YAMLs can move them in.
- **D-CATALOG-MERGE:** how does "Copy from animal" (phase 3) bring a camera / recording-system catalog into a **non-empty** target? Phase 3 deliberately offers those sections only when the target catalog is **empty** — appending blindly risks duplicate camera `id` (the catalog key `tasks[].camera_id` / `associated_video_files[].camera_id` / `fs_gui_yamls[].camera_id` reference) and duplicate `data_acq_device[].name` (the Spyglass identity), which whole-object `uniqueItems` won't catch. A future affordance needs **merge-by-identity**, not append: name **new** → add with a fresh next-available id; name present + **identical** fields → skip (idempotent); name present + **divergent** fields → surface the existing `findIdentityDivergence` / `identity-divergence` table as an interactive *resolve* step (keep mine / take theirs / add-as-new-name) instead of a hard block. A blunt **replace** (overwrite the whole catalog) is acceptable only behind a type-to-confirm that names the blast radius (which days reference the cameras being changed/removed). **Synergy — build the reconciler once:** this is the SAME operation phase 6b performs (decompose an imported YAML's catalogs, merge them into an existing animal by identity). Factor a shared `reconcileCatalog(targetItems, incomingItems, identityKey) → { adds, skips, conflicts }` in phase 6 and have BOTH the copy-merge affordance and the import-reconcile UI consume it; don't write camera/device merge logic twice. **Recommendation:** defer the copy-merge affordance until phase 6 so it lands on the shared reconciler.

When either is decided, add the corresponding phase(s) here and refresh this file in place (don't rewrite).
