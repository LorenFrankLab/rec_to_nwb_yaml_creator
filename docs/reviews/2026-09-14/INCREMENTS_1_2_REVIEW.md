**Review of increment 1 and increment 2 in progress — 2026-09-14**

**Verdict:** reopen increment 1 before calling the persistence work complete. The new filename and focused-field save paths work in the checks below, but recovery and ownership changes still have reproducible data-loss cases. Increment 2 has useful domain changes, including per-file teams and optogenetics, but duplication and baseline-weight migration still violate the intended scientific safeguards.

Scope: [FIX_PLAN.md](FIX_PLAN.md), [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), and the uncommitted working tree on `modern`, based on `57b3b41b05f2435e27ba2cd5d142ecc2989ab9f8`. Files changed during this review, so browser reproductions and follow-up checks use a temporary snapshot captured **2026-09-14 16:12:42 America/Los_Angeles**. The runtime files cited by the eight findings were subsequently checked against the working tree and were unchanged at that check. Later edits may supersede individual findings. No application source was changed by this review.

**Findings, in priority order**

1. **P1 · Increment 1: handover relinquishes ownership even when the final save fails.**

   [writerLock.ts:184](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/writerLock.ts:184) unconditionally releases the lock after invoking the handover callbacks. [useWorkspacePersistence.ts:245](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:245) supplies a save function that catches failures without returning a success result. A revision stamp cannot recover observations that were never written.

   **Reproduced in Chromium:** tab A contains a new observation; its workspace write throws `QuotaExceededError`; tab B requests editing and becomes the writer anyway. B loads the last saved data. When B makes another edit and saves, A follows that save and its unsaved observation disappears from both tabs. Also guard unapplied dialog drafts: flushing the registry deliberately cannot apply them.

   **Fix:** make handover conditional on confirmed persistence and resolution/preservation of unapplied drafts. Keep A's ownership and work intact when either fails; explain the failure in B. Add a two-tab browser regression with an injected final-save failure.

2. **P1 · Increment 1: read-only tabs still accept mutations that are subsequently discarded.**

   [ReadOnlyTabBanner.tsx:30](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/components/ReadOnlyTabBanner.tsx:30) adds explanatory text, but inputs and workspace mutation actions remain enabled. [useWorkspacePersistence.ts:121](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:121) replaces that tab's workspace when the writer saves.

   **Reproduced in Chromium:** the reader's session-description input reports `editable: true`; it accepts “Reader entered observations.” After the writer saves “Writer saved observations,” the reader's text is replaced with the writer's text. Preventing localStorage writes alone does not make the user interface read-only.

   **Fix:** enforce ownership at the mutation boundary and disable editing controls while retaining navigation and backup access. A reader should request ownership before it can create local edits. Verify typing, adding/deleting records, dialogs, and export receipt mutations, not only the lease helper.

3. **P1 · Increment 1: the original recovery source is deleted before its durable copy is confirmed.**

   [persistence.ts:203](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:203) queues preservation without checking success. [useWorkspacePersistence.ts:139](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/useWorkspacePersistence.ts:139) immediately announces that a copy was kept and clears the main key. [blobStore.ts:84](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/blobStore.ts:84) silently falls back to memory. Its write helper also resolves at request success rather than transaction completion.

   **Reproduced in Chromium with IndexedDB unavailable:** an unreadable original exists in the in-memory quarantine and the main key is already absent. After reload the quarantine is null and storage contains an empty workspace. The original bytes are lost despite the preservation notice. A blocked/failed IndexedDB write has the same unacknowledged failure path.

   **Fix:** await an acknowledged IndexedDB transaction before clearing or replacing the original. If durable preservation fails, retain the original and offer its download; do not report a durable recovery copy. Test actual IndexedDB failure and reload, rather than only the memory fallback.

4. **P1 · Increment 1: a discarded workspace can leave the new workspace permanently unable to save.**

   The discard return in [persistence.ts:307](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:307) bypasses revision adoption, while `clearWorkspace` removes only the workspace key. Its companion `.meta` revision remains. The new sole writer still starts with `lastSeenRevision = 0`.

   **Reproduced in Chromium:** seed an unreadable workspace plus revision 9 from a closed previous tab. The app takes the writer lock and starts empty, but saving is rejected with “Another tab has saved a newer version of this workspace.” No other tab exists. Reload does not reconcile the leftover stamp on the missing-blob path either.

   **Fix:** reconcile/reset the envelope and revision as one ownership-protected recovery operation, after preserving the original. Verify that the recovered workspace accepts and durably saves new observations with an existing prior-session revision stamp.

5. **P1 · Increment 2: duplicate-day bypasses date-based setup selection and confirms an obsolete setup.**

   [workspaceActions.ts:493](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/workspaceActions.ts:493) explicitly passes the source day's configuration into `createDayRecord`. Confirmation checks only whether that version started before the target date, not whether another version superseded it; see [configurationSelection.ts:92](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/domain/configurationSelection.ts:92).

   **Reproduced:** v1 starts June 1, v2 starts July 1. Duplicating a June 22 day to July 5 pins v1 and returns `status: confirmed`, without a scientific setup choice. Normal creation of a June 25 backfill correctly chooses v1, so testing that path alone misses this case.

   **Fix:** use the target date's setup for duplication as well as creation. Treat source selection and setup selection separately. An intentional exception must require explicit setup confirmation; carry bad-channel annotations only after resolving compatibility with the target setup. Add both forward and backward duplication cases across a configuration change.

6. **P1 · Increment 2: migration makes an unmeasured baseline exportable without confirmation.**

   [datedFactsMigration.ts:78](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/datedFactsMigration.ts:78) copies the current animal baseline into `session.weight` when the old day was exported **or merely validated**. [datedFactsValidation.ts:67](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/domain/datedFactsValidation.ts:67) gives this only warning severity.

   **Reproduced:** a day with no recorded measurement and `validated: true, exported: false` migrates to 485 g. Full `validateDay` returns zero errors, allowing export. The warning also claims that an earlier download contained this value even though this example was never downloaded. The newly added migration test explicitly expects warning severity, so a green test does not establish the intended safeguard.

   **Fix:** retain the prior effective value for recovery/comparison, but require an explicit measurement confirmation or correction before a new export. A legacy baseline fallback is not evidence of a day measurement. Keep the warning's explanation accurate for validated-only records. Do not silently fabricate an old exported artifact from today's baseline.

7. **P2 · Increments 1/2: portable backups omit the exact exported artifacts.**

   [persistence.ts:406](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/state/persistence.ts:406) serializes only the workspace. Receipt YAML lives separately in IndexedDB. [exportDay.ts:85](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/domain/exportDay.ts:85) also sets `yamlStored: true` without awaiting the result of storing it.

   **Reproduced across fresh browser contexts:** serialize a workspace whose receipt bytes were successfully stored, then parse the backup in a clean context. The receipt still says `yamlStored: true`, but `receipt:<dayId>` is absent. The hash survives, so basic freshness comparison remains possible; inspecting/recovering the actual last export does not.

   **Fix:** make backup export/import include the referenced artifacts and verify their hashes. Update availability flags from actual successful writes. Restore must not accidentally attach unrelated existing bytes under the same day key. Test transfer between independent IndexedDB stores, rather than round-tripping only the JSON in one environment.

8. **P2 · Increment 2: ISO-formatted dated folders are silently carried to another day.**

   [dayCarryPolicy.ts:144](/Users/edeno/Documents/GitHub/rec_to_nwb_yaml_creator/src/domain/dayCarryPolicy.ts:144) classifies any folder without an eight-digit token as undated. **Reproduced:** copying `/data/remy/2023-06-22/` to June 23 returns `kind: copied` with the June 22 path unchanged.

   **Fix:** recognize the source ISO date as well as its compact token, and require confirmation/entry for unsupported or ambiguous date patterns. Do not interpret “not recognized by this regex” as “stable across days.” Test ISO, compact, conflicting-date, and genuinely shared folders.

**Increment 2 completion checks, separate from the defects above**

- Per-file team and optogenetics preservation is now implemented and its three focused tests pass. Keep it. The ordinary backfill and no-weight-copy domain helpers also behave correctly in covered cases.
- The daily view still derives displayed experimenters from the animal and renders them as inherited/read-only (`dayEditorViewModel.ts`, around lines 580 and 668), although export now uses `day.experimenters`. Update presentation and the correction path to show the day's actual facts. Similar animal-derived optogenetics displays need to use the day's resolved state. Do not mark the new ownership model complete while the scientist reviews different facts from those exported.
- Camera definitions, recording-system definitions, and task definitions still resolve through the animal catalogs. The plan calls for small resolved day snapshots. Complete that contract, or explicitly document and verify an equivalent immutable-reference design; the current team/opto snapshots alone do not establish preservation for every default. Retain the existing downstream identity-conflict checks.
- Keep increment 3's broader daily-layout work and the actual scientist pilot separate. They are not treated as missing increment 1 features in this review.

**Verification and limits**

- Initial targeted run: **127 passed** across writer ownership, preservation, storage budget, backup panel, focused-field save, configuration selection, carry policy, and workspace transitions.
- Full run against the working tree while edits were occurring: **5,385 passed, 4 failed; 370 test files passed, 2 failed**. Failures: the lifecycle expectation in `types.smoke.test.ts`, and three command-catalog ratchets for the unregistered `confirmConfigurationChoice` repair. The same four failures were reproduced in the fixed snapshot (13 other tests in those two files passed).
- Snapshot migration/import run: **13 passed**. TypeScript checking passed on the original checkout and snapshot.
- The real `trodes_to_nwb.data_scanner` groups `20230622_sample_metadata.yml` with both supplied sample `.rec` filenames. This validates naming, not a complete conversion.
- The existing same-day Playwright test fails before reaching the editor with “Day not found.” Its helper writes seed data over a mounted app and reloads; the new `pagehide` handler saves the mounted workspace back over that seed. Seed before app initialization or through an explicit restore path, then restore this browser regression lane. Do not remove the required pagehide behavior to accommodate the old helper.
- The eight findings above were reproduced through disposable Chromium contexts or production domain functions in that browser. Raw results and review harnesses are in [increment-review-evidence](increment-review-evidence/). No production browser data, recordings, or downstream database was modified.
- This review did not run a full NWB conversion, NWB inspection, or Spyglass insertion, and does not establish pilot readiness. It did not rerun a production build or the lint lanes.

**Practical order:** fix ownership handover and read-only enforcement together; make recovery durable and revision-consistent; then fix duplication and migration confirmation. Include artifact transfer and the browser test-harness correction before re-closing increment 1. Complete the remaining increment 2 ownership/UI alignment before investing in the increment 3 layout.
