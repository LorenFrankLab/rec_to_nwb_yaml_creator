**Practical fix and release plan**

Proposed plan following the [review](REVIEW.md). This defines implementation scope and acceptance criteria; application changes have not started.

Build the first release around one complete user outcome: **a scientist configures an animal once, logs a subsequent recording day by entering only the changes, resumes unfinished work later, and exports metadata that the converter associates with the correct recording.** The same flow must accept a past date safely. This is the minimum useful unit, including the reliability needed to trust it.

The first pilot should use a small set of representative animals with setup metadata available, beginning with the common electrophysiology/task/video workflow. Preserve existing features while working. Add an optogenetic participant only once that path passes its own conversion fixture. Complete arbitrary historical-batch repair is a later milestone, rather than a prerequisite for learning whether daily entry is faster.

**Design decisions to settle before the main implementation**

Use the following as the proposed contract and walk it through with scientists using a normal day, a backfilled day, and a day after a configuration change. Make a simple prototype of the day list, daily entry screen, and export review. Stop the design pass when those scenarios have an unambiguous behavior and can be exercised in the prototype.

| Kind of information | Proposed ownership | What a later edit does |
|---|---|---|
| Exact subject ID, species, sex, DOB, genotype | Animal identity | A correction explicitly identifies affected days; exported content becomes changed |
| Experiment description, default team, task templates, rig/camera defaults | Defaults for creating days | Changes future entries; existing days change only through an explicit apply/correct action |
| Probe geometry and channel mapping | Existing configuration revisions, pinned by day | A physical change creates a revision with an effective date; old pins remain |
| Actual team, measured weight, day description, selected rig | Recording day | Changes that day's metadata |
| Tasks, used cameras, files, stimulation conditions | Day/epoch facts | Changes the selected day/epochs; keeps downstream references consistent |
| Bad-channel annotations | Day-owned assessments, with earlier marks suggested | A correction does not overwrite later annotations; affected later days can be reviewed |

For a practical implementation, **copy small resolved metadata into a day at creation/import and continue referencing large probe configurations by immutable revision.** Small snapshots can include the lab/experiment values, recording system, used-camera definitions, task definitions, and optogenetics setup. Existing catalogs remain the pickers/default sources. Source IDs and copy provenance explain where the values came from; changing a catalog item does not change the stored day values implicitly.

This provides one consistent export rule: resolve animal identity, the day's stored metadata, and its pinned probe revision. Keep snapshot construction and export resolution centralized. Avoid maintaining a second writable copy of a value within the same day. Decide the exact field placement once, update the canonical types, and migrate the existing model into it.

The camera/task identity rules must still examine the resolved historical values. Snapshotting does not make it valid to reuse a Spyglass identity with conflicting calibration or task description. Preserve the existing new-camera-versus-correction interaction and make explicit corrections update named days. For probe corrections, create a revised snapshot and reassign the selected days; retain the previous revision.

Do not tie an optogenetics-only change to a new probe-map version: that must not accidentally reset failed-channel carry-forward. Do not turn every keystroke into a historical revision. Save the current draft, a last known good checkpoint, and the most recent exported artifact/receipt; a complete event history can wait.

Separate three dates: **recording date**, **setup effective date**, and **metadata-entry timestamp**. For a backfill, select the setup applicable to the recording date. If its effective period is unknown, ask the user to choose it and keep the day incomplete until resolved. The creation time of a newly entered animal is not evidence of when its implant became effective.

Define a field-specific carry policy:

- Copy stable day defaults and the intended rig/reference choices from the nearest eligible earlier day, with the source date visible. Allow an explicit different source.
- Show the previous weight and measurement date as a suggestion. Do not silently convert it into a new observation.
- Copy an epoch sequence as a plan for the scientist to confirm or adjust. Clear session-specific file selections and export/review status.
- Carry bad-channel annotations only against compatible probe mapping; show their source. Do not infer permanent hardware failure from every exclusion.
- Derive paths from a date-aware folder pattern or let the scientist enter the actual day folder. Never copy an old dated folder silently.
- An explicit choice to copy a later day can help backfilling, but it must not override the applicable historical probe revision automatically.

Two scientific policies need short decisions with pilot users: how to handle an unmeasured/unknown weight under the converter's current required field, and whether they use bad-channel marks for permanent failure, temporary exclusion, or both. For the first pilot, save unknown weight as an incomplete draft and state the export requirement. Never invent a number or treat the baseline as a measurement. Resolve broader unknown-value support with the converter before including users who need it.

**Build in five increments**

Each increment should leave the app runnable and have observable acceptance criteria. Safety work and the day workflow are part of the same first release; completing only the underlying refactor is not a user milestone.

| Increment | Concrete scope | Done when |
|---|---|---|
| 1. Establish a reliable save/export path | Recording-compatible filename and exact subject token; focused-input saving; explicit Save flush; single active editing tab; recovery copy; portable workspace backup/restore | An existing day survives reload/transfer and its downloaded filename groups with the sample recording; a stale tab cannot overwrite it |
| 2. Preserve dated facts | Adopt the ownership contract; migrate day snapshots; fix backfill/configuration selection and carry policy; preserve imported session differences; track last-exported content | Ordinary edits to defaults leave past day exports unchanged; a backfill picks the right revision; correcting a day changes its export freshness |
| 3. Deliver the daily workflow | Import one supported YAML or finish animal setup once; Log today/Choose date; compact daily form plus existing epoch editor; visible source/setup; simple review/export | A returning scientist creates a complete day without repeating setup or editing YAML outside the app |
| 4. Validate with a small pilot | Observe scientists doing routine entry, backfill, resume/transfer, and correction; execute real conversion/ingestion checks on representative fixtures | Covered tasks are faster, historical facts remain correct, and emitted files work downstream without manual filename repair |
| 5. Expand catch-up and import | Date-range grid; paste dated measurements; reviewed batch application; ZIP export; resumable repair queue; common legacy repairs | Scientists can complete a recording week or supported legacy batch without repeating the same correction file by file |

**Increment 1 implementation details**

Fix the filename/ID contract early so all later golden and integration tests use the intended convention. Keep internal lookup normalization separate from exported identity. Existing lowercased IDs cannot reveal their original recording case; preserve original import/source tokens where available and ask for the exact recording token where it is unknown. Do not guess or silently rename established records.

Make field drafts observable while typing. Persistence may be debounced; validation may happen on blur. Save and before-unload behavior must include pending field drafts. In setup dialogs, clearly distinguish an applied edit from an unapplied draft and preserve or guard the latter. The save indicator must describe actual durability.

Use a single-editor policy for the pilot: a second tab opens read-only with an explanation. Implement an actual lock/transactional ownership mechanism for the supported browsers; a storage-event listener alone does not prevent races. Leave collaborative merging for later.

Retain the original persisted bytes before migration or recovery. Provide Download workspace and Restore workspace, including incomplete days. Show a restore preview before replacement. Keep a last known good checkpoint and distinguish a normal save from a portable backup.

Keep storage behind its existing persistence boundary. Retaining localStorage for the pilot is acceptable only if a representative long-study workspace, checkpoint, and export receipts fit with headroom and saving does not disrupt typing. Test that explicitly. If it fails, use IndexedDB before the pilot. A new storage engine is not a substitute for backup, draft tracking, or writer protection.

**Increment 2 implementation details**

Implement snapshot construction and date resolution in pure domain/state functions before changing the screens. Update the inaccurate canonical metadata types in the same work, scoped to the types being used. The importer must populate the day facts from each source file rather than pick the latest animal-wide value.

Preserve the original workspace envelope during migration and verify old effective exports where the old model contains enough information. Mark unresolved historical choices for review. Do not manufacture original teams, weights, or identity case that earlier code has already discarded. Pre-production permits removing obsolete representations after migration; it does not justify dropping someone's saved work.

Store the most recent exported YAML, filename, timestamp, and content hash. Derive freshness by comparing the current effective export with that artifact; the comparison must cover filename/identity changes too. A saved `exported: true` boolean is insufficient. Keep validation readiness and export freshness conceptually separate.

Present a small vocabulary: Draft, Needs attention, Ready to export, and Downloaded; add Changed since download when content diverges. Do not make scientists perform a separate “save validation” step just to advance an indicator. Downloads and downstream conversion are different events.

**Increment 3: what the scientist sees**

The animal page offers Log today, Choose recording date, recent days, and unfinished work. Creating a day opens it directly. On the daily screen, put the actual recording date, weight, and experimenters first, followed by the existing epoch sequence editor. Show a compact statement such as “Started from June 22 · Probe setup v1 · Rig A.” Include a clear way to change the source or setup.

Keep experiment description, identity, and technical defaults visible as a compact summary with editing available when needed. Do not require revisiting the setup wizard. Reuse the existing camera protection, task pickers, epoch-reference handling, and dialogs. On narrow screens, collapse the long navigation rail into a compact section control.

Review should focus on missing facts, high-impact exceptions, and changes since the last download. An unchanged, previously checked configuration should not require another full review. Saving an incomplete day must always be possible even when export is blocked. No video and no optogenetics must be explicit, supported states where applicable.

Starting with one representative existing YAML is enough for this release. Include the repairs required by the pilot animals and preserve the source. Do not claim that all historical files are supported. If an unsupported import is encountered, explain the limitation and preserve a usable path to set up the animal; do not silently omit the file or guess at its scientific metadata.

**Pilot acceptance and release scope**

Use a few real animals and three related dates: an ordinary day, a day before a known probe change entered later, and a day after the change. Include a rig/team change and a corrected past weight. Add video and optogenetic examples for any workflows included in the release.

Essential automated cases are focused-field save/reload, stale-tab protection, backup/restore, old-workspace migration, date-aware configuration choice, field-specific copy behavior, multi-date import preservation, changed-export detection, and scanner grouping. Test the meaningful boundaries rather than adding tests that merely mirror implementation details.

Run a small actual conversion from app-produced metadata and inspect the resulting NWB values and objects. Verify the expected Spyglass subject/session, electrode flags/linkage, task epochs, and cameras in a disposable environment. Include optogenetic objects before enabling that workflow for pilot users. Begin with a repeatable fixture run if wiring a full cross-repository CI lane would delay the first assessment; automate the stable checks for release.

Observe 3–5 scientists completing the covered tasks with realistic data and compare against their existing method. A useful initial target is roughly halving routine-day entry time, with no unnoticed wrong-date, wrong-setup, or copied-measurement errors in those sessions. This is a target to test, not a speed claim or statistical guarantee. Record where help was needed. Fix observed friction before adding another major surface.

The first user milestone is complete only when the scientist can **set up once → log another day → leave/resume → export → convert**. Successful unit tests, a redesigned screen, or a migration alone do not meet it.

**Deliberately later**

Defer multi-user accounts/synchronization, a lab-wide catalog service, a complete experiment-management hierarchy, universal legacy-YAML repair, automatic scanning of recording storage, a full event/audit-history system, and a broad framework rewrite. Defer speculative performance work until representative data shows a problem. Keep straightforward accessibility corrections in scope; defer a larger visual redesign.

Bulk catch-up is the next user milestone because it directly extends the same day model. Implement a week/date-range table, pasted dated weights, a preview of which setup applies to each date, selected-day changes to stable facts, and ZIP download with a manifest. Then prioritize legacy repairs using the measured corpus frequencies and actual pilot blockers.

For broad rollout, complete the supported optogenetic and behavior-only cases, verify the intended browser set, document storage/backup and converter compatibility, and switch the public default route from the legacy form. Keep the release criteria tied to the user workflows actually being advertised.
