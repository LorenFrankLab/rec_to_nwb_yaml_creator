**Revision review — `feat/first-useful-release` at `5fa83f98`**

Reviewed the three commits after `5906074f`, including the response to [REVISION_4_REVIEW.md](../2026-09-14/REVISION_4_REVIEW.md). The previous three fixes are supported by the current code and passing regression tests. **One P2 finding remains in the new cleanup code.**

1. **P2 — Delayed cleanup after restore can delete the YAML from a subsequent download.**

   [releaseReplacedArtifacts](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:647) decides which keys to delete using the workspace snapshots captured at restore time. [Its deletion loop](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:661) awaits each deletion, while [the restore returns success and releases its guard](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:467) without waiting for cleanup. Ordinary downloads still write to the reusable `receipt:<dayId>` key. That key can hold a new, actively referenced download by the time cleanup reaches it.

   **Browser reproduction:** restore a workspace with two previously downloaded days. Hold completion of cleanup's deletion for the first day. The restore reports success. Open the second day and download it again; its receipt says `yamlStored: true`, and the artifact at `receipt:remy-2023-06-22` matches that receipt's hash. Release cleanup: it reaches the second day and deletes the newly written artifact. After reload, `yamlStored` remains true but the referenced artifact is absent. A later weight correction shows that the previous download's bytes are unavailable, so comparison is lost.

   This requires no failed storage write: the diagnostic only delays a cleanup completion callback. The reproduced impact is loss of the newly downloaded comparison artifact. The recording metadata and the file delivered to the browser's Downloads folder remain intact.

   **Smallest practical fix:** skip automatic cleanup of reusable `receipt:<dayId>` keys. Only collect immutable keys that a later download cannot reuse. Alternatively, give ordinary downloads immutable artifact keys too. Checking only the two restore-time workspace snapshots is insufficient. Add a regression with two days, delayed cleanup of the first, a new download of the second, and reload.

**Previous findings**

- Revision-marker failure: the marker is written first; failure leaves the old workspace intact. The new browser regression verifies storage and a fresh tab both retain 485 g. Main-blob failure rolls back the marker; unit tests pass.
- Failed promotion: there is no promotion step. A restored receipt names the unique key whose write was already acknowledged.
- Cancel followed by retry: attempts have distinct keys. An additional browser check staged both attempts, released the cancelled attempt first, and confirmed the retry's artifact survived cleanup and reload. A subsequent workspace backup included those exact bytes, and the comparison UI correctly showed a later `499 → 505` g edit.

**Verification on this revision**

- `npm run typecheck`: passed, exit 0.
- `npx vitest run`: **385 files / 5,468 tests passed in one full run**, 52.63 seconds, exit 0.
- Existing daily-workflow, workspace-workflows, and persistence-recovery browser specs: **26 passed**, 18.3 seconds, two workers, no retries, exit 0.
- Additional isolated Chromium checks: the remaining cleanup failure and the successful retry/backup/comparison path, both exit 0. Synthetic fixtures; no application source modifications.
- `git diff --check 5906074f..HEAD`: passed.
- [revision-5-review-evidence](revision-5-review-evidence/) contains scripts, observed JSON results, browser configuration, and verification output. The cleanup harness asserts the observed failure; the retry harness asserts the intended behavior.
- Build, lint, converter, NWB Inspector, DANDI validation, and Spyglass ingestion were not rerun. Earlier downstream reports are not claimed as new verification.

Only review documentation and evidence were added. The five pre-existing uncommitted Trodes configuration import planning documents were left untouched.
