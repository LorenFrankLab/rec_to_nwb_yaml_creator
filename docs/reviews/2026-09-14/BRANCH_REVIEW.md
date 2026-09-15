**Branch review: `feat/first-useful-release` at `4d07e9dd`**

Reviewed the six commits after `modern` / `57b3b41b`, including the daily workflow, and re-exercised the earlier findings against the committed branch. The five pre-existing uncommitted Trodes configuration import planning documents are outside this commit comparison and were left untouched.

**Recommendation: request changes.** The automated suite is green and the ordinary daily workflow works, but the eight previously reported correctness issues remain reproducible. The new surfaces introduce additional identity, source-change, and setup-consistency problems. This review changed no application source.

**New findings**

1. **P1 — An edited subject ID can collide with another animal and produce identical export filenames.**

   [AnimalProfileDialog.tsx:82](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/components/AnimalProfileDialog.tsx:82) checks filename syntax only. The new editable identity is accepted through the normal profile confirmation without checking the other animals' subject IDs. [animalCreation.ts:84](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/domain/animalCreation.ts:84) also looks up workspace keys, so an animal renamed to an otherwise unused subject ID is not subsequently found under that scientific identity.

   **Browser reproduction:** create two fixture animals under keys `remy` and `OtherRat`, both with a June 22 recording. Through the actual profile dialog, change `remy`'s subject ID to `OtherRat`. Both days then pass `validateDay` with zero errors and both export as `20230622_OtherRat_metadata.yml`. This conflates distinct animals' identity and recording grouping downstream. Separately, renaming the only animal to `OtherRat` leaves `findAnimalIdByLookup('OtherRat', animals)` returning null.

   **Fix:** enforce subject-ID uniqueness at the shared mutation boundary and in profile feedback. Resolve identity lookup from the stored subject IDs while retaining stable internal keys. Batch export should also reject colliding output filenames. Preserve legitimate case corrections for the same animal.

2. **P1 — The optogenetics editor and export disagree about whether a recording used optogenetics.**

   The new export ownership rule in [workspaceUtils.ts:390](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/workspaceUtils.ts:390) correctly reads `day.optogenetics`, but [epochGridViewModel.ts:206](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/viewModels/epochGridViewModel.ts:206) still uses `animal.optogenetics` to enable the epoch controls. That unchanged consumer is incompatible with the new ownership model. The header chips also still consult the animal default.

   **Reproduced with production functions:** a historical day with a saved laser setup exports one excitation source after the animal default is disabled, but `buildEpochGrid(...).isOpto` becomes false, hiding its power/pulse controls. Conversely, a day explicitly storing `optogenetics: null` shows optogenetics controls when the animal default is enabled, while its export contains no excitation sources. `applyAnimalDefaultsToDays` exists but has no production UI caller, so changing the animal setup does not provide an explicit correction path for the saved day setup.

   **Fix:** use a single day-level optogenetics resolver for export, header, epoch controls, and validation. Expose the existing explicit apply/correct action for selected days when setup is entered or corrected later. Test both directions of default change and an existing day initially entered without its optogenetics setup.

3. **P2 — Changing a day's source overwrites a recorded description the dialog promises to keep.**

   [ChangeSourceDialog.tsx:48](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/pages/DayEditor/ChangeSourceDialog.tsx:48) says the operation keeps the day's descriptions. [workspaceTransitions.ts:744](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/workspaceTransitions.ts:744) nevertheless replaces `session.experiment_description` with the source's value.

   **Reproduced:** a target with `TARGET recorded protocol` becomes `SOURCE protocol` after `reseedDayFromSource`. Its session description and measured weight remain, so this can appear to be a harmless copy of the epoch plan while changing scientific context in the next export.

   **Fix:** preserve the existing experiment description as promised, or explicitly preview and obtain a field-specific decision before replacing it. Add a test with different nonempty source and target descriptions.

4. **P2 — Setting an effective date can leave contradictory days automatically confirmed.**

   [workspaceActions.ts:577](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/workspaceActions.ts:577) updates the snapshot date without reconsidering the days' automatic confirmation state. [configurationSelection.ts:92](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/domain/configurationSelection.ts:92) treats any `confirmed: true` as conclusive, including confirmations produced automatically by date selection.

   **Reproduced through the action factory:** create June 25 using v1 effective June 1; set v1's effective date to July 1. The June 25 day remains `confirmed` and produces no configuration-choice issue despite preceding the newly recorded effective date. The same state can arise when an entry-stamped setup date is marked unknown and its actual effective date is supplied later.

   **Fix:** distinguish explicit scientific confirmation from an automatically satisfied date rule. Re-evaluate automatic choices against the current effective interval; flag affected days after a date correction. Do not silently re-pin their geometry.

**Earlier findings: current branch status**

All eight issues in [INCREMENTS_1_2_REVIEW.md](INCREMENTS_1_2_REVIEW.md) remain open. Each was rechecked against this branch; the applicable production functions or browser reproductions still show the following results.

| Priority | Finding | Current result and relevant code |
| --- | --- | --- |
| P1 | Handover after a failed save | A quota failure does not prevent release; a later save from the new writer replaces the old writer's unsaved observation. [writerLock.ts:186](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/writerLock.ts:186) |
| P1 | Read-only tabs accept edits | The second tab's team input remains editable. Its entered observations disappear when the writer saves. The new e2e test explicitly permits typing in the reader; it verifies refusal to persist, not read-only editing. [useWorkspacePersistence.ts:129](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:129) |
| P1 | Recovery copy is not durably acknowledged | With IndexedDB unavailable, the original is cleared and its memory-only quarantine disappears on reload. [useWorkspacePersistence.ts:147](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:147), [persistence.ts:203](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:203) |
| P1 | Recovery leaves a stale revision | An unreadable workspace plus revision 9 from a closed tab leaves the new sole writer unable to save; it reports another-tab conflict. [persistence.ts:307](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:307) |
| P1 | Duplication bypasses date selection | Duplicating June 22 to July 5 keeps v1 and confirms it even with v2 effective July 1. [workspaceActions.ts:494](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/workspaceActions.ts:494) |
| P1 | Migrated baseline is exportable without measurement confirmation | A validated but never downloaded day with no measured weight migrates to 485 g with zero blocking validation errors. [datedFactsMigration.ts:78](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/datedFactsMigration.ts:78) |
| P2 | Backup does not transfer receipt artifacts | A fresh browser restores `yamlStored: true` but has no corresponding YAML in IndexedDB. The new diff UI cannot retrieve it. [persistence.ts:406](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:406) |
| P2 | ISO dated folder is copied unchanged | Copying `/data/remy/2023-06-22/` to June 23 returns the June 22 folder as a stable copied path. [dayCarryPolicy.ts:153](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/domain/dayCarryPolicy.ts:153) |

These are acceptance failures, not requests for a larger framework or more features. The fixes can remain within the existing persistence boundary, day ownership model, and UI components.

**Verification**

- `npm run typecheck`: passed.
- `npx vitest run`: **376 files, 5,406 tests passed**, 58.71 seconds.
- Existing `workspace-daily-workflow.spec.js` and `workspace-workflows.spec.js`, run against the local branch server with two workers: **10 passed**. This includes the ordinary backfill at desktop and phone widths, focused-field save, backup/restore, export freshness, and batch export.
- The prior four test failures are fixed. The prior same-day browser seeding failure is also fixed; that workflow now reaches the editor and exports successfully.
- Additional disposable Chromium checks reproduced the safety cases above. [branch-review-evidence](branch-review-evidence/) contains the outputs and reproduction harnesses for the new findings. Existing review harnesses were also rerun, using the new team field in place of the now-collapsed description field.
- This review did not rerun conversion, NWB Inspector, Spyglass ingestion, build, or lint. The branch contains a downstream-check report, but those earlier executions are not presented as new verification here.

Resolve the persistence data-loss cases and scientific identity/setup errors before merging this as the first useful release. Green tests currently cover ordinary flows and encode some weaker guarantees than the fix plan requires.
