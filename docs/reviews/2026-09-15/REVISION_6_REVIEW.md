**Revision review — `feat/first-useful-release` at `036b9591`**

Reviewed `5fa83f98..036b9591`: the restore-cleanup fix (`01540fe4`), its regression test, and the review-response documentation. **No new actionable findings in this revision.** The P2 from [REVISION_5_REVIEW.md](REVISION_5_REVIEW.md) is addressed.

[The cleanup guard](../../../src/state/persistence.ts#L662) skips the reusable `receipt:<dayId>` key. Ordinary downloads can safely overwrite that key while cleanup of old immutable restore artifacts remains pending. Cleanup still preserves keys referenced by the incoming workspace and deletes superseded immutable artifacts.

**Independent browser verification**

The Chromium diagnostic uses two previously downloaded days: the first has an immutable artifact from a prior restore, and the second has a reusable per-day artifact. It holds completion of the first artifact's cleanup, waits for restore success, and downloads the second day through the UI. After releasing cleanup:

- Only the first day's superseded immutable artifact was deleted.
- The second day's new artifact survived reload and matched its receipt hash.
- A subsequent workspace backup included the exact new YAML.
- Editing the weight from 480 to 499 g produced the correct comparison in the UI.

This mixed-key fixture keeps cleanup genuinely pending under the fixed implementation. Simply replaying the old diagnostic would time out waiting for deletion of a reusable key that the fix correctly skips. No failed storage write was injected, and no application source was modified.

**Verification on this revision**

- `npm run typecheck`: exit 0.
- `npx vitest run`: **385 files / 5,469 tests passed in one full run**, 59.43 seconds, exit 0.
- ESLint on both changed source/test files with `--max-warnings 0`: exit 0; dependency-age notices only.
- Existing daily-workflow, workspace-workflows, and persistence-recovery browser specs: **26 passed**, 16.6 seconds, two workers, no retries, exit 0.
- Additional isolated Chromium cleanup/reload/backup/comparison diagnostic: exit 0.
- `git diff --check 5fa83f98..HEAD`: exit 0.

[revision-6-review-evidence](revision-6-review-evidence/) contains the diagnostic, observed results, browser configuration, and verification output. Build, full-repository lint, other browser engines, converter, NWB Inspector, DANDI validation, and Spyglass ingestion were not rerun. This review assesses the latest revision, not every historical branch change or the human pilot.

Keeping unreferenced reusable per-day artifacts is the deliberate tradeoff in this minimal fix. They can be overwritten by later downloads. Future garbage collection should preserve this concurrency guarantee; it is not required to resolve the reported bug.

Only this review and its evidence were added. The five pre-existing uncommitted Trodes configuration import planning documents were left untouched.
