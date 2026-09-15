**Revision review — `feat/first-useful-release` at `3c4458a2`**

Reviewed the five commits after `51bc3430`, including the response to [FIX_RESPONSE_REVIEW.md](FIX_RESPONSE_REVIEW.md). The earlier report describes the previous revision. The new fixes address its seven reproductions, and the current tests pass. **Request changes for two remaining restore problems**, both reproduced through the browser UI.

1. **P1 — Cancelling an in-flight restore does not cancel the replacement, so subsequent saved edits are overwritten.**

   [WorkspaceBackupPanel.tsx:254](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/components/WorkspaceBackupPanel.tsx:254) and [the Cancel button](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/components/WorkspaceBackupPanel.tsx:264) only clear the dialog's candidate. They remain available after Replace workspace starts. The pending [restore continuation](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:398) has no cancellation check. Its new in-flight flag prevents another tab from taking over, but does not stop this tab from editing, saving, or starting another restore.

   **Browser reproduction:** start restoring a backup containing a 480 g day and hold the receipt transaction completion callback. Click the enabled Cancel button; the dialog closes. Open the day, enter 777 g, and press Ctrl+S; localStorage confirms 777 g. Release the callback: the supposedly cancelled restore replaces both the saved workspace and the displayed measurement with 480 g.

   **Practical fix:** expose restore progress and make the operation exclusive. Either make Cancel abort the pending operation before it can commit, or make an already-started restore explicitly non-cancellable and prevent closing/navigation/editing until it finishes. Reject concurrent restore calls. The final mutation must belong to the still-active operation. Add a browser regression for Cancel/Escape during delayed storage followed by a saved edit.

2. **P2 — A failed restore changes memory and destroys the active receipt artifact while saying “Nothing was replaced.”**

   [useWorkspacePersistence.ts:398](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:398) calls `restoreBackupArtifacts` before the workspace write succeeds. That helper [deletes/replaces active artifact keys](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:581). The hook then calls `replaceWorkspace(next)` before attempting the localStorage write. On a quota failure it returns false without restoring either memory or the old receipt artifact, and the new [refusal message](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/components/WorkspaceBackupPanel.tsx:152) claims nothing changed.

   **Browser reproduction:** download a 485 g day, then attempt to restore a backup containing the same day at 480 g while workspace writes throw a quota error. The dialog says `Nothing was replaced. Could not save the restored workspace: Quota full`. Dismissing it reveals 480 g in memory while localStorage still holds 485 g. Reload returns to 485 g, but the original receipt's YAML has already been replaced by the backup's 480 g artifact. Correct the day to 499 g: the comparison shows `480 → 499`, although the actual earlier download contained 485 g. The stored artifact hash does not match the active receipt hash. [DownloadStatusCard.tsx:40](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/pages/DayEditor/DownloadStatusCard.tsx:40) accepts those mismatched bytes without verification.

   **Practical fix:** stage incoming artifacts without overwriting the active workspace's artifacts. Commit the replacement only after its durable write succeeds; failure or cancellation must preserve the original memory state and receipt bytes. Verify an artifact against the active receipt hash before presenting it as the previous download. Report a partial restore honestly if a partial change can still occur. Test a quota failure after successful artifact staging, followed by reload and comparison with the original download.

These are two aspects of finishing the existing restore operation: cancellation/exclusivity and failure atomicity. They do not require a broader workspace redesign.

**Status of the preceding seven findings**

| Earlier finding | Current review result |
| --- | --- |
| Delayed receipt acknowledgement hides edits | Fixed in the repeated browser reproduction: the 485 g download remains `changed` after a saved 499 g edit, acknowledgement, and reload. The acknowledgement matches receipt identity and preserves modification stamps. |
| Pending recovery deletes newly saved work | Fixed in the repeated browser reproduction: Save preserves the unreadable original while pending; the entered animal is saved after preservation completes and survives reload. |
| Restore writes after tab handover | The in-flight restore now vetoes handover and checks ownership again after its asynchronous work. Added unit tests pass. The remaining same-tab cancellation gap is finding 1 above. |
| Restore overwrites an unpreserved original | Shared write guard added; the new browser regression passes. |
| Setup confirmation ignores the next effective setup | Derived pins are checked against current date selection and surface `superseded`; the new action/validation tests pass. |
| Restored receipts claim failed storage | `yamlStored` now follows `putBlob`'s durability result; durable and memory-only restore tests pass. The comparison card handles absent bytes. Finding 2 concerns mismatched bytes left by failed restore. |
| Optogenetics correction changes every divergent day | A date checklist now passes only selected IDs; selective-application tests pass. |

**Verification on this revision**

- `npm run typecheck`: passed, exit 0.
- `npx vitest run`: **383 files / 5,455 tests passed in one full run**, 88.72 seconds, exit 0.
- Existing daily-workflow, workspace-workflows, and persistence-recovery browser specs: **24 passed**, 29.0 seconds, two workers, no retries, exit 0.
- Three additional isolated Chromium scripts completed, exit 0: the two remaining restore failures, the fixed delayed-export case, and the fixed pending-recovery case. Delayed cases hold transaction completion callbacks to make the ordering deterministic; the quota case rejects only writes to the workspace key. Fixtures are synthetic.
- [revision-3-review-evidence](revision-3-review-evidence/) contains scripts, observed JSON results, browser configuration, and verification output. The failure harness asserts observed failures, not desired acceptance behavior.
- Build, lint, converter, NWB Inspector, DANDI validation, and Spyglass ingestion were not rerun. Prior downstream execution reports are not claimed as new verification.

No application source was changed. The five pre-existing uncommitted Trodes configuration import planning documents were left untouched.
