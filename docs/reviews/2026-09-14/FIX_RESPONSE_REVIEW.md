**Branch review after the fix response — `feat/first-useful-release` at `51bc3430`**

**Recommendation: request changes.** This review examines the seven commits after the previously reviewed `4d07e9dd`, in the context of the full branch against `modern` (`57b3b41b`). The earlier report remains a record of that earlier revision, not the current status. Several earlier reproductions are now fixed, but the asynchronous persistence changes introduce new data-loss and export-status failures.

The five pre-existing uncommitted Trodes configuration import planning documents were left untouched. No application source was changed for this review.

1. **P1 — A delayed receipt acknowledgement marks edited metadata as already downloaded.**

   [exportDay.ts:101](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/domain/exportDay.ts:101) applies the captured export receipt again after `putBlob` resolves. That update passes through [workspaceTransitions.ts:854](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/workspaceTransitions.ts:854), which stamps the receipt with the current day's modification time. An intervening edit is consequently covered by the freshness cache even though it was absent from the downloaded bytes.

   **Browser reproduction:** hold the receipt transaction's completion acknowledgement; download the fixture's 485 g day; edit its measured weight to 499 g and save. The UI correctly says `Changed since download` until the acknowledgement arrives, then changes to `Downloaded` / `current`. This incorrect status survives reload. The current artifact hash and the receipt hash are different, while `exportFreshness` returns `current`.

   **Fix:** acknowledge storage only for the matching, still-current receipt identity, without refreshing its scientific-content cache stamps. Acknowledgements must not replace newer receipts or imply that intervening edits were downloaded. Cover edit-before-acknowledgement and a second download before the first acknowledgement in regression tests.

2. **P1 — Recovery can delete a new workspace saved while preservation is pending.**

   [useWorkspacePersistence.ts:107](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:107) initializes the protection flag to false and only sets it after preservation fails. While [the asynchronous discard runs](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:179), normal saving remains enabled. [persistence.ts:246](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:246) subsequently clears the main key without checking that it still contains the original being quarantined.

   **Browser reproduction:** delay the quarantine completion acknowledgement, create `NewData` through the animal wizard, and press Ctrl+S. Local storage contains the newly created animal. Release the acknowledgement: the main workspace key becomes null. Reload: the new animal is gone.

   **Fix:** enter a pending-preservation state before any save can run. Gate all writes until preservation finishes, then save accumulated edits. Discard must also verify that the key still contains the original bytes and that the tab owns the operation; it must never clear a replacement written during the asynchronous interval.

3. **P1 — A restore can overwrite the writer after its own tab has become read-only.**

   [useWorkspacePersistence.ts:359](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:359) checks ownership before awaiting receipt restoration, but [the continuation](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:363) replaces the workspace, adopts the latest revision, and writes without checking ownership again. A pending restore does not veto handover.

   **Browser reproduction:** tab A starts restoring a backup with a 480 g day; delay receipt-store completion. Tab B takes over normally and saves a new 777 g measurement. When A's acknowledgement is released, A—now a reader—writes 480 g over B's saved workspace. B continues displaying 777 g because a writer does not follow other tabs' storage events.

   **Fix:** hold ownership for the restore operation and refuse handover while it is in flight, or cancel the restore when ownership changes. Recheck ownership and the expected workspace revision immediately before mutation. Do not unconditionally adopt a newer revision that arrived after the user's restore confirmation. Stage receipt artifacts so a cancelled restore cannot replace the active workspace's artifacts either.

4. **P1 — Restoring a backup bypasses protection of the only unreadable original.**

   [restoreWorkspace](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:358) never checks `originalUnpreservedRef`, unlike Save and autosave. Its direct `saveWorkspace` call can overwrite the only original even while the UI says nothing will be saved until that original has been downloaded.

   **Browser reproduction:** make IndexedDB unavailable and reject the localStorage quarantine copy. The app retains the unreadable original and displays the protection notice. Choose a valid backup and confirm Replace workspace without downloading the original: the restore overwrites the main key. After reload, `readPreservedBlob(WORKSPACE_QUARANTINE_KEY)` returns null; the original is gone.

   **Fix:** apply the same pending/unpreserved-original guard to restore and every other replacement path. Keep the original until preservation or the explicit original-download recovery action completes. A generic workspace-replacement confirmation does not establish that the promised recovery copy exists.

5. **P2 — Derived setup confirmation still ignores the end of the effective interval.**

   [configurationSelection.ts:117](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/domain/configurationSelection.ts:117) considers a non-explicit pin confirmed whenever its own start date precedes the recording. It does not check whether another setup became effective before that recording. The fix covers moving the pinned setup's start after the day, but not a correction that moves the next setup's start before the day.

   **Domain reproduction through the public action factory:** v1 is effective June 1 and v2 July 1. Create June 25, automatically pinned to v1. Correct v2's effective date to June 20. `selectConfigurationForDate` selects v2, but the existing v1 day remains `confirmed` with no configuration-choice issue. This proof exercises production actions and validators; it does not claim a browser workflow for editing an already-known effective date.

   **Fix:** for derived confirmations, compare the pin against the currently selected effective interval, including its end. Flag disagreements for explicit confirmation or correction, preserving the existing geometry. Keep the explicit-confirmation exemption.

6. **P2 — Restored receipt artifacts claim durability even when the write failed.**

   [persistence.ts:577](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:577) ignores `putBlob`'s boolean result and sets `stored = true` unconditionally. `putBlob` resolves false when only its memory fallback accepted the bytes. Export now handles this result correctly; restore does not.

   **Reproduction:** restore a matching receipt artifact with IndexedDB unavailable, then clear the memory fallback to simulate a new document. The restored receipt retains `yamlStored: true` while the artifact lookup returns null. The new unit test's successful restore runs in that same memory-only environment and explicitly expects true, so it does not verify durable storage.

   **Fix:** derive `yamlStored` from the acknowledged write result and handle unavailable artifacts in the comparison UI. Test a failed transaction/no IndexedDB followed by a fresh document, separately from a successful durable restore.

7. **P2 — The optogenetics correction UI only permits changing every divergent day.**

   [OptogeneticsContainer.tsx:69](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/pages/AnimalEditor/wiring/OptogeneticsContainer.tsx:69) always passes the complete `divergent` list to `applyAnimalDefaultsToDays`; there is no day selection. For an animal with historical non-opto days and one recent opto day whose setup is entered late, all those days initially differ from the new default. The scientist can apply to all of them or cancel, but cannot correct just the recent recording through this new action.

   **Evidence:** the rendered container offers one all-days button and confirmation, and its sole apply call uses the complete list. The store already accepts selected day IDs. This is a code-reviewed workflow gap, not a claim that a user unknowingly accepted the clearly worded all-days confirmation.

   **Fix:** let the scientist select the recording dates to correct, with their current setup and downloaded status visible. Apply only those IDs. A small date checklist is sufficient; no new revision framework is needed. This completes the prior review's requested selected-day correction path.

**What improved**

The new tests and code now cover refusal of handover after a failed ordinary save, disabled fields in the routed read-only view, durable localStorage fallback for quarantine, adoption of a stale recovery revision, date-based duplication, subject-ID collision rejection and renamed-ID lookup, preservation of an existing experiment description, blocking migrated baseline weight, consistent day-owned optogenetics/team readers, and ISO folder rewriting. Normal backup transfer now includes receipt artifacts. These fixes should be retained; the failures above occur in additional states and interleavings.

**Verification performed on this revision**

- `npm run typecheck`: passed, exit 0.
- `npx vitest run`: **381 files / 5,443 tests passed**, 96.72 seconds, exit 0.
- Existing `workspace-daily-workflow.spec.js`, `workspace-workflows.spec.js`, and `workspace-persistence-recovery.spec.js`: **23 passed**, 22.8 seconds, two workers, no retries, exit 0. Includes desktop/phone backfill and the newly added browser regressions.
- Additional isolated Chromium reproductions above: completed, exit 0. Delayed-storage cases hold transaction completion callbacks until after user actions, making the asynchronous ordering deterministic. They use synthetic fixtures and do not alter application source.
- [fix-response-review-evidence](fix-response-review-evidence/) contains the scripts, observed JSON results, browser configuration, and verification summary. Diagnostic assertions encode the observed failures; they are not acceptance tests for fixes.
- Build, lint, converter execution, NWB Inspector, DANDI validation, and Spyglass ingestion were not rerun in this review. The earlier implementation reports are not presented as fresh verification.

The practical next change is to make preservation, restore, ownership, and receipt acknowledgement obey the existing persistence guarantees at their final write boundaries. Resolve those data-loss and false-freshness cases before treating this branch as ready for the pilot.
