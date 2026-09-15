**Revision review — `feat/first-useful-release` at `5906074f`**

Reviewed the three commits after `3c4458a2`, including the response to [REVISION_3_REVIEW.md](REVISION_3_REVIEW.md). **Request changes for three remaining restore correctness issues.** The two previous browser reproductions now pass: cancellation preserves subsequent edits, and failure of the workspace-blob write preserves memory, storage, and the original comparison YAML. The new hash check also prevents mismatched bytes from being shown as the earlier download.

1. **P1 — Failure of the revision-marker write still partially commits a refused restore.**

   The new storage-first restore [calls `saveWorkspace` before replacing memory](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:450), treating a thrown error as proof that nothing changed. That helper performs two separate localStorage writes: [the workspace blob](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:461), then [the revision marker](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:464). If the second write fails, the new workspace is already in durable storage, while the old workspace remains in memory and the dialog claims “Nothing was replaced.” A quota failure can occur on the second write when the first consumed the remaining capacity.

   **Browser reproduction:** restore the 480 g backup over an active 485 g day, allowing writes to the workspace key but injecting a quota failure on its `.meta` key. The refusal says `Nothing was replaced. Could not save the restored workspace: Quota full on revision marker`. The current tab displays 485 g, localStorage holds 480 g, and a newly opened read-only tab displays 480 g. This is a partial durable replacement despite the refusal, not just a stale comparison. In an earlier exploratory reload the old tab's final-save handler happened to rewrite its old in-memory state; that incidental write is not rollback and does not prevent the contradictory second-tab result.

   **Fix:** make the save success/failure boundary cover both keys. Put the authoritative revision in the same atomic storage record, or restore the previous blob and marker when the second write fails before claiming refusal. Keep memory consistent with the durable outcome. Add a test that fails only the second write and verifies both the current tab and a fresh tab.

2. **P2 — Restore reports success before artifact promotion, then can discard the only durable copy after promotion fails.**

   [useWorkspacePersistence.ts:461](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:461) starts `commitStagedArtifacts` without awaiting it, returns success, and releases the restore guard. The saved receipt already says `yamlStored: true` based on staging. [persistence.ts:624](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:624) ignores the result of the final `putBlob` and deletes the staged copy regardless. A durable staging write therefore does not establish that the artifact will exist at the key the app reads.

   **Browser reproduction:** accept the staging write, but reject the later IndexedDB write to `receipt:remy-2023-06-22`. The UI reports `Workspace restored from "restore.json".` After the promotion attempt and reload, the receipt has `yamlStored: true`, the active artifact is absent, and the staging artifact is also absent. The backup arrived with valid bytes, but the successful-looking restore loses them. The hash check correctly avoids showing a false comparison; it cannot recover the discarded bytes.

   **Fix:** make the completed restore refer to an acknowledged, durable artifact. Keep the operation active through any required promotion, honor its write result, and retain the staged copy if promotion fails. Alternatively, write once to an immutable artifact key and persist that reference, avoiding the second copy. Surface a partial artifact failure truthfully and keep `yamlStored` consistent. Test staging success followed by promotion failure and a fresh document.

3. **P2 — Cleanup from a cancelled restore can delete a retry's staged artifacts.**

   [persistence.ts:590](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:590) uses `receipt-staging:<dayId>` for every restore. [Cancellation](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:396) immediately permits another restore while the cancelled operation's asynchronous writes and cleanup remain live. When its stale continuation calls `discardStagedArtifacts`, it deletes that shared key even if the retry has replaced its contents. The operation token protects workspace commits but does not isolate artifact writes or cleanup.

   **Browser reproduction:** hold restore A's staging acknowledgement, cancel A, and start restore B for the same day at 499 g. Let B's staging write finish but hold its acknowledgement too. Release A: its cancelled-operation cleanup deletes B's staged bytes. Release B: it reports success and restores 499 g with `yamlStored: true`. After reload, neither an active artifact nor a staged artifact exists. This reproduction needs delayed callbacks and a normal Cancel/retry sequence, without any storage failure.

   **Fix:** include a unique restore-operation identity in staging keys and restrict each operation's cleanup to its own keys. Do not use a day ID alone for temporary storage. Cover cancellation followed immediately by a retry for the same day, releasing the first operation after the second has staged its bytes.

These fixes stay within the existing persistence boundary. The remaining work is to define one completed restore outcome across the workspace record, revision marker, and referenced YAML, with isolated temporary storage for each attempt.

**Verification on this revision**

- `npm run typecheck`: passed, exit 0.
- `npx vitest run`: **385 files / 5,463 tests passed in one full run**, 92.14 seconds, exit 0.
- Existing daily-workflow, workspace-workflows, and persistence-recovery browser specs: **25 passed**, 28.3 seconds, two workers, no retries, exit 0.
- Repeated previous browser reproductions: Cancel followed by a saved 777 g edit now leaves 777 g intact; failure of the main workspace write now leaves memory and storage at 485 g, preserves the original receipt hash, and correctly compares `485 → 499` afterward.
- Additional isolated Chromium checks reproduced the three findings above, exit 0. Fixtures are synthetic. Storage faults target only the named final write; delayed cases hold IndexedDB completion callbacks to make ordering deterministic. No application source is altered by these checks.
- [revision-4-review-evidence](revision-4-review-evidence/) contains the scripts, observed JSON results, browser configuration, and verification output. The new failure harness asserts observed bugs, not desired acceptance behavior.
- Build, lint, converter, NWB Inspector, DANDI validation, and Spyglass ingestion were not rerun. Earlier downstream reports are not claimed as new verification.

Only review documentation and evidence were added. The five pre-existing uncommitted Trodes configuration import planning documents were left untouched.
