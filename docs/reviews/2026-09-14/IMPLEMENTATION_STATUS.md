# Implementation status — first useful release (FIX_PLAN increments 1–4)

Working tree on `modern` (base `57b3b41b`). **Nothing is committed yet** — every change below is in the
working tree; commit per increment when ready. This file is the resume point for another session.

## Increment 1 — reliable save/export path: DONE (verified)

| Piece | Where | Evidence |
|---|---|---|
| Converter-compatible filename `{YYYYMMDD}_{exact subject}_metadata.yml` | `src/domain/recordingFilename.ts`; wired in `domain/exportDay.ts`, `pages/DayEditor/ExportPreview.tsx`, `pages/DayEditor/exportPreviewBatch.ts` | `domain/__tests__/recordingFilename.test.ts` (JS port of `data_scanner._process_path`); **real scanner run** `scripts/check-scanner-grouping.py` (trodes_to_nwb venv, checkout 6603412): `20230622_sample_metadata.yml` groups with `20230622_sample_01_a1.rec`; `06222023_…` (old spelling), `20230622_Sample_…` (case) and `20230622_my_rat_…` (underscore) do NOT |
| Exact subject identity, lookup-only normalization | `domain/animalCreation.ts` (`buildAnimalFromForm` no longer lower-cases; `subjectLookupKey` / `findAnimalIdByLookup`), `viewModels/createAnimalWizardViewModel.ts` (case-insensitive collision message, underscore rejected up front) | `animalCreation.test.js`, `createAnimalWizardViewModel.test.ts` |
| Export blocker for a subject id the scanner cannot group | `domain/dayValidationComposer.ts` → `recordingFilenameIssues` (workspace path only; the frozen legacy form keeps its own filename behavior and blocks on every issue, so the shared rule set is untouched) | `dayValidation.contract.test.js` |
| Draft-field tracking (F3) | `state/draftRegistry.ts`, `hooks/useDraftField.ts`, `components/ui/DraftFields.tsx`; applied to DayTab (folder, session/experiment description, weight), DayTechnicalSection, EpochsTab opto power/pulse; dialogs register unflushable drafts (`hooks/useUnappliedDraftGuard.ts`) | `hooks/__tests__/useDraftField.test.jsx`, **`pages/DayEditor/__tests__/focusedFieldSave.integration.test.jsx`** (type without blur → Ctrl+S → fresh store hydrates the text; pagehide writes; debounce commits) |
| Explicit save flushes drafts; Ctrl/Cmd+S works inside a focused field; `pagehide` writes synchronously | `state/useWorkspacePersistence.ts`, `hooks/useGlobalShortcuts.ts` | `useGlobalShortcuts.test.jsx`, focusedFieldSave test |
| All record-mutating actions commit through the ref-lockstep `commitWorkspace` (so a flushed draft is in the ref for the synchronous write) | `state/workspaceActions.ts` | store tests unchanged/green |
| Save indicator honesty: "Unsaved edits" while a draft is pending | `pages/DayEditor/SaveIndicator.tsx`, `PersistenceStatus.hasPendingDrafts` | `SaveIndicator.test.jsx` |
| Single-writer ownership (F4): Web Locks exclusive lease (`ifAvailable`), localStorage-lease fallback, revision stamp refusing stale writes, reader tab follows saves live and auto-promotes when the writer closes, take-over handshake over BroadcastChannel | `state/writerLock.ts`, `state/persistence.ts` (`WORKSPACE_META_KEY`, `WorkspaceConflictError`), `state/useWorkspacePersistence.ts`, `components/ReadOnlyTabBanner.tsx` | `state/__tests__/writerLock.test.js` (lease + revision conflict); browser two-tab check: **pending (Playwright, below)** |
| Recovery copies (F8): quarantine of unusable bytes BEFORE the main key is cleared; pre-migration copy; last-known-good checkpoint (clean load + explicit save) | `state/persistence.ts` (`hydrateRaw`), `state/blobStore.ts` (IndexedDB side store, in-memory fallback) | `state/__tests__/persistence.preservation.test.js` |
| Portable backup / restore with replacement preview (incomplete days included) | `domain/workspaceBackup.ts`, `components/WorkspaceBackupPanel.tsx` (on `#/workspace`), `persistence.restoreWorkspace` | `components/__tests__/WorkspaceBackupPanel.test.jsx` |

### Storage decision (measured, `state/__tests__/storageBudget.test.js`)

Synthetic representative long study (`__tests__/fixtures/longStudyWorkspace.js`: 3 animals × 200 days,
32 tetrodes/128 ch, 8 epochs/day, 19 DIO lines, bad channels, receipts):

- autosave envelope **without** receipt YAML bytes: **2.6 MiB = 52 % of the 5 MiB Safari quota** (4.2 KiB/day);
  1 animal × 200 days = 838 KiB; 5 × 300 days = 6.2 MiB (exceeds — documented limitation, surfaced by
  the >60 % usage warning on the backup panel).
- with per-day YAML receipts (16.5 KiB/day): 12.9 MiB per copy → **not localStorage-viable**.
- `saveWorkspace(600 days)` = **3.4 ms** (jsdom) — well inside the 500 ms debounce; typing is unaffected.

**Decision:** the autosave blob stays in localStorage (synchronous hydrate + synchronous pagehide write are
load-bearing for F3); the recovery copies (checkpoint / pre-migration / quarantine) and receipt YAML bytes
live in IndexedDB (`state/blobStore.ts`). A workspace above ~1000 populated days needs the main blob in
IndexedDB too — deferred with a concrete trigger (the usage warning).

### Verification run for increment 1
- `npx vitest run` → 368 files, **5349 passed**, 0 failed (2026-09-14).
- `npm run typecheck` → clean. `npx eslint src --max-warnings 0` → clean.
- Tests updated to the verified contract (old `MMDDYYYY` expectations): `ExportPreview*.test.jsx`,
  `batchResult.test.jsx`, `exportPreviewBatch.test.ts`, `dayRowMenu.test.jsx`, `ValidationSummary*.test.jsx`,
  e2e `workspace-export/optogenetics/workflows.spec.js`.

## Increment 2 — preserve dated facts: DONE (domain + state; UI surfaces land in increment 3)

Ownership contract as implemented (`src/state/workspaceTypes.ts`):

| Kind of information | Owner | Later edit |
|---|---|---|
| Subject identity (`animal.subject`) | Animal | live for every day; subject id change is a filename change → "Changed since download" |
| Default team / experiment description / opto setup (`animal.experimenters`, `animal.experiment_description`, `animal.optogenetics`) | Animal DEFAULTS for new days | existing days untouched; explicit `actions.applyAnimalDefaultsToDays(animalId, dayIds, fields)` names the days it corrects |
| Actual team / description / opto as recorded (`day.experimenters`, `session.experiment_description`, `day.optogenetics`) | Day (copied at creation / import / migration; `provenance.fields` says from where) | changes that day only |
| Measured weight (`session.weight`) | Day — never copied, never substituted by the animal baseline (`subject.weight` is a dated suggestion) | a day without a weight is not exportable |
| Rig (`data_acq_device_name`), cameras, task types | Animal CATALOGS (Spyglass identity-locked) referenced by the day; day copies `data_acq_device_name` on carry | existing camera "new identity vs correction" dialog unchanged |
| Probe geometry / channel map | `configurationHistory` revisions pinned by `day.configurationVersion`; chosen by RECORDING DATE (`domain/configurationSelection.ts`) | unconfirmed choice (before every known effective date, or pinned to a later version) = export blocker `configuration_effective_date_unconfirmed` with a `confirmConfigurationChoice` repair |
| Bad channels | Day; carried only within the same configuration version | unchanged |
| Download history | `day.exportReceipt` (filename, timestamp, SHA-256 of filename+bytes, app/schema version; bytes in IndexedDB `receipt:<dayId>`) | "Changed since download" is DERIVED (`domain/exportReceipt.ts`), incl. filename changes |

Other increment-2 pieces:
- `createDayRecord` (`state/workspaceTransitions.ts`): date-aware pin; carry policy per field (`domain/dayCarryPolicy.ts`: nearest EARLIER source, weight = dated suggestion, `deriveDataFolderForDate`, rig preserved, files/receipt cleared); `provenance` (entry timestamp ≠ recording date ≠ setup effective date). `createDay` `carryForwardFromDayId: 'auto' | id | null` (default blank; the days table passes `'auto'`).
- Export merge (`state/workspaceUtils.ts`): team / opto from the day copy; experiment description day-only; weight day-only. Golden fixtures unchanged (the realistic fixture's day now carries its 485 g as a measurement).
- Lifecycle vocabulary (`domain/dayLifecycle.ts`): Draft · Ready to export · Downloaded · Changed since download · Needs attention (the dead `validated` word retired — nothing in production wrote it).
- Import (`state/yamlImportPlan.ts` / `yamlImportApply.ts`): each planned day carries ITS file's team and opto; divergences are informational.
- Migration v3→v4 (`state/datedFactsMigration.ts`, registered in `workspaceMigrations.ts`, fixture `v4-workspace.json`): copies animal defaults onto every day (reproducing every v3 export), fills a downloaded day's baseline weight with review flag `weight_from_baseline`, leaves drafts without a weight, stamps `effectiveDateKnown: false` on entry-stamped v1 snapshots, flags days pinned to a later-effective version as unconfirmed, converts `state.exported` into an `unverified` receipt naming the v3 download filename. Original bytes kept (pre-migration copy, increment 1).
- Validation (`domain/datedFactsValidation.ts`): `configuration_effective_date_unconfirmed` (error) + `weight_from_baseline` (warning); codes registered in routing / categories / ownership / command catalog.

Boundary tests (all green): `domain/__tests__/configurationSelection.test.ts`, `dayCarryPolicy.test.ts`,
`state/__tests__/datedFactsBoundaries.test.js` (#5 June-25 backfill, #8 copy rules, #9 stale download incl.
filename), `defaultsLeaveDaysUnchanged.test.js` (#6), `importPreservesSessionFacts.test.js` (#7),
`datedFactsMigration.test.js` + `workspaceMigrations.test.js` (#4), `workspaceTransitions.test.js`
(opto-only edit leaves revisions/carry alone).

### Verification run for increment 2
- `npx vitest run` → 375 files, 5399 passed; 2 failures are `src/__tests__/integration/import-export-workflow.test.jsx`
  / `sample-metadata-modification.test.jsx` — legacy-form UI tests that pass in isolation and time out
  (30 s budget) only under full-suite load; **reproduced on the pristine tree** (git stash), i.e. pre-existing
  flakiness, not a regression. typecheck + eslint clean.

## Increment 3 — daily workflow UI: DONE (verified in a real browser at 1280×720 and 390×844)

Surfaces (all on the workspace routes; the legacy form is untouched):
- **Animal page → "Log a recording day"** (`pages/AnimalWorkspace/LogDayPanel.tsx`): **Log today** (or "Open
  today's day" when it exists), **Choose recording date** typed directly (no month paging), a live preview of
  what the day will start from — the nearest *earlier* day and the probe setup effective on that date, with a
  warning when the only setup became effective later — then **Create & open** lands in the day editor.
  The carry toggle reads "Start each new day from the nearest earlier day (latest: …)". An **unfinished days**
  list (`data-testid="unfinished-days"`, one "Resume <date>" link per draft) sits under the log panel.
- **Day editor → "Daily log"** (`pages/DayEditor/DayTab.tsx` rewritten; rail folded from 6 to 5 sections,
  `epochs`/`tasks` roll up into `daily`): date · **Weight measured today (grams)** with the dated
  "Previous measurement: N g on <date>" / **Use N g** suggestion (never pre-filled) · **Experimenters present**
  (one per line) · provenance line (`DayProvenanceLine.tsx`: "Started from <date> · Probe setup vN
  (effective <date>)" / "entered <date>") with **Change source** (`ChangeSourceDialog.tsx` → `reseedDayFrom`) ·
  the epoch/task editor embedded · descriptions, data folder, keywords, lab/institution collapsed under
  one `<details>`. Read-only context (animal defaults) is labelled as such.
- **Setup confirmation** (`ConfigVersionPanel.tsx`, `data-testid="config-choice-unconfirmed"`): a day pinned
  to a setup that became effective *after* the day's date (or whose effective date is unknown, i.e. an
  entry-stamped v1 from a migrated workspace) shows why and offers **Confirm this setup** / re-pin.
  `AnimalView/ConfigurationCard.tsx` shows "effective <date>" vs "entered <date> (effective date not
  recorded)" and lets the scientist record the real effective date (`setConfigurationEffectiveDate`).
- **Export review** (`DownloadStatusCard.tsx`, `data-status=never|current|changed|unverified`): "Never
  downloaded" / "Downloaded <when> as <filename>" / **Changed since download** with a "Show what changed"
  line diff against the stored receipt YAML / "Downloaded before this version (unverified)" for migrated days.
- **Filenames**: `{YYYYMMDD}_{subject_id}_metadata.yml` everywhere on the workspace path; the subject id is
  editable in the animal profile with an inline "must match the recording filenames" rule (`-`, letters,
  digits only; `_` rejected because the converter's scanner splits on it).
- **Narrow screens** (≤720 px, `hooks/useMediaQuery.ts`): the day-editor rail and the animal section nav
  become a labelled `<select>`; no horizontal page scroll at 390 px (asserted in e2e).
- **Accessibility fixes made while building**: unique accessible names for the Today/Open buttons and
  per-day links, `aria-live` preview, labelled section selects, save indicator exposes "Unsaved edits"
  while a focused field holds text, read-only tab banner is an `alert`.

### Verification run for increment 3
- `e2e/workspace-daily-workflow.spec.js` (new, 7 tests, **7 pass**): backfill June 25 by typed date starts
  from June 22 and pins v1 not v2 (desktop **and** 390×844, incl. overflow ≤ 1 px), Log today, focused-field
  Ctrl+S + reload (F3), two-tab read-only + take-over (F4), backup → wipe → restore with preview (F8),
  Downloaded → Changed since download with diff (F6).
- Manual Playwright-MCP walkthrough screenshots: `daily-desktop.png`, `epochs-desktop.png`, `epochs-mobile.png`.

## Increment 4 — technical checks + pilot prep: EXECUTABLE CHECKS DONE; HUMAN PILOT PENDING

All numbers below are from runs on 2026-09-14 against the uncommitted working tree.

| Check | Command | Result |
| --- | --- | --- |
| Unit/integration suite | `npx vitest run` | **376 files / 5,406 tests pass** (144 s). Earlier full runs saw 2 legacy integration files time out under load only; reproduced on the pristine tree (pre-existing flakiness), and the final run had none. |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npx eslint . --max-warnings 0` | exit 0 |
| Stylesheets | `npm run lint:css` | exit 0; **0 warnings in the 11 touched stylesheets** (126 pre-existing warn-level items elsewhere) |
| Schema version | `npm run check:schema` | pass |
| Build | `npm run build` | built in 1.3 s; pre-existing >500 kB chunk warning (1,297.93 kB) |
| Playwright | `npx playwright test` | **122 pass, 7 fail** — the 7 are `e2e/baselines/visual-regression.spec.js` screenshots of the *legacy* form, which fail identically on the pristine tree (verified with `git stash`). Responsive specs run at 1280×720 and 390×844. |
| Scanner grouping (F10) | `python scripts/check-scanner-grouping.py` (real `trodes_to_nwb.data_scanner`) | `20230622_sample_metadata.yml` groups with the sample recordings; `06222023_…`, `20230622_Sample_…`, `20230622_my_rat_…` do not |
| Real conversion | `downstream-checks/run_convert.py` (trodes_to_nwb `6603412`, v0.1.10.dev35, venv `.venv`) on an **app-produced** file (import → edit → export, subject `sample`, ntrode 1 channel 2 marked bad) + `~/Downloads/trodes_to_nwb_test_data` | exit 0 → `sample20230622.nwb`. `inspect_nwb.py` (log checked in): subject `sample`, weight `100 g`, 2 experimenters, 32 electrode groups / 128 electrodes with `bad_channel`/`probe_shank`/`probe_electrode`/`ref_elect_id`, **1 bad electrode in group 0 = YAML ntrode 1 [2]**, 2 cameras keyed by `camera_name`, tasks with camera ids + epochs, 2 epochs, associated files, behavioral_events + position, opto epochs present. |
| NWB Inspector | `nwbinspector` report checked in | 2 CRITICAL = `check_image_series_external_file_valid` (video files not colocated with the NWB output dir — a fixture-layout artifact, not metadata); 57 best-practice suggestions (missing descriptions on probes/devices — the converter's device metadata, not app fields). |
| Spyglass (disposable) | `docker run … datajoint/mysql:8.0 -p 3399:3306` (container `rec2nwb-disposable-mysql`, **removed afterwards**; `spyglass-db`/`spyglass-pytest-main`/`spyglass-eeg` never touched) + `downstream-checks/spyglass_ingest.py` (spyglass `e9e9a3b6`, datajoint 0.14.9, `test_mode`, base dir under `tests/`, `DJ_SUPPORT_FILEPATH_MANAGEMENT=TRUE`) | `insert_sessions(raise_err=True)` **succeeded, 0 errors**. Session (`sample`, session_id 12345, UCSF / Loren Frank Lab), Subject (`Rattus pyctoris`, M), Probe `tetrode_12.5`, 32 ElectrodeGroup / 128 Electrode with **0 NULL probe_id**, `Electrode(group 0, probe_electrode 2).bad_channel = True`, CameraDevice ×2, Task `Sleep`/`wtrack`, TaskEpoch 1→camera 1 / 2→camera 2, DIOEvents `Light_1 Light_2 Poke_1`, IntervalList epochs + pos valid times. Log: `downstream-checks/spyglass_ingest.log`. |

Two blockers hit and resolved on the way (repeatable in the script): DataJoint refuses `filepath` attributes
unless `DJ_SUPPORT_FILEPATH_MANAGEMENT=TRUE`; Spyglass `test_mode` requires the base directory to contain a
`tests` path component.

**Not run / pending**
- **Human pilot (3–5 scientists, routine entry / backfill / resume-transfer / correction, timing vs. their
  current method)** — pending; runbook in `PILOT_RUNBOOK.md`. No pilot results are claimed.
- `dandi validate` — not run (no DANDI env in the converter venv; the plan's release gate lists it, the
  pilot gate does not).
- Optogenetic conversion was exercised because the sample fixture includes opto sections and the NWB carries
  opto epochs and devices; a *pilot user* with an optogenetics workflow should still be added only after their
  own fixture converts (plan §"Pilot acceptance").

### Deferred (out of this release, with the trigger to pick each up)
- Legacy single-page form still names files `MMDDYYYY_subject_metadata.yml` — change when the legacy route is
  retired or a legacy user reports a scanner miss.
- `TaskInstance.camera_id` per-day override exists in the type but is not written by import or editable in the
  UI (tasks reference the catalog camera) — pick up with bulk catch-up.
- Main autosave blob stays in localStorage (receipt YAML in IndexedDB); measured headroom covers 3 animals ×
  200 days ×128 ch at 52 % of Safari's 5 MiB. Move the main blob to IndexedDB when a workspace approaches
  ~1,000 days.
- The 7 legacy visual-regression baselines and the two load-sensitive legacy integration tests are pre-existing
  and untouched.

## Review response (BRANCH_REVIEW.md + INCREMENTS_1_2_REVIEW.md, 2026-09-14): all 12 findings fixed

Each fix landed with a test that failed first (unit) and, where the finding was reproduced in a
browser, a Playwright regression. Numbers refer to the reviews' own lists.

| Finding | Fix | Failing-first test |
| --- | --- | --- |
| P1 Hand-over after a failed save | `onBeforeHandOver` callbacks now VETO (`HandOverOutcome`); `handOverOnRequest` releases only when the final write succeeded and no dialog holds unapplied edits; the requester is told why (`release-refused` message → `takeOver` error). | `state/__tests__/ownershipSafety.test.js`; e2e "hand-over is REFUSED while the editing tab cannot save" (injected quota failure, two tabs) |
| P1 Read-only tabs accept edits | Ownership enforced at the mutation boundary: `commitWorkspace` throws `ReadOnlyWorkspaceError` in a reader (`replaceWorkspace` stays open for live-follow; the last raw `setWorkspace` action was routed through it). The routed page is wrapped in a `<fieldset disabled>` while read-only, so every editing control is inert; the banner keeps take-over + backup download; links keep working. | `ownershipSafety.test.js`, `layouts/__tests__/AppLayout.readOnlyTab.test.jsx`; e2e F4 updated (reader's field is disabled) |
| P1 Recovery copy not durably acknowledged | `blobStore` resolves on transaction COMPLETE; `discardUnusableWorkspace()` awaits the IndexedDB ack, falls back to a localStorage quarantine copy, and only then clears the main key. If neither store takes it, the original stays under the main key and every save is refused (`originalUnpreserved`) until the user downloads it from the backup panel (`acknowledgeUnpreservedOriginal`). | `state/__tests__/recoveryDurability.test.js`, `store-persistence.test.js`; e2e "without IndexedDB, the discarded original is still downloadable after a reload" |
| P1 Stale revision after recovery | The discard adopts the leftover stamp (`syncRevisionFromStorage`) after clearing; a missing blob with a leftover stamp adopts it on load. | `recoveryDurability.test.js`; e2e "a leftover revision stamp … never blocks the sole writer" |
| P1 Duplication bypasses date selection | `duplicateDay` no longer passes the source's version: the setup is chosen by the NEW date like creation; bad-channel marks carry only when that is the source's version. In-app v1 snapshots are now `effectiveDateKnown: false` (entry-stamped) and entry-stamped snapshots sort FIRST in selection (the earliest setup by construction). | `datedFactsBoundaries.test.js` #5b (forward / backward / same-setup), `configurationSelection.test.ts` (entry-stamped v1), `workspace-animal.test.js`; e2e "duplicating June 22 (setup v1) to July 5 pins … v2" |
| P1 Migrated baseline exportable | Migration copies the baseline only for DOWNLOADED days (validated-only days stay without a weight); `weight_from_baseline` is now an ERROR with the `confirmWeightMeasurement` repair; entering a weight clears it. | `datedFactsMigration.test.js` |
| P2 Backups omit receipt artifacts | `buildWorkspaceBackup` embeds the receipt YAML bytes (hash-verified, format 2); `parseWorkspaceBackup` returns `artifacts`; `restoreBackupArtifacts` writes them into the receiving store, clears stale bytes under restored day ids and sets `yamlStored` truthfully. `exportDay` sets `yamlStored` only after the write is acknowledged. | `state/__tests__/backupArtifacts.test.js` (independent stores, missing bytes, tampered artifact) |
| P2 ISO dated folders | `deriveDataFolderForDate` rewrites `YYYY-MM-DD` too and treats any other date-like token (6-digit, dotted, month-first) as needing entry — never "stable". | `dayCarryPolicy.test.ts` |
| New P1 Duplicate subject ids | `findAnimalIdByLookup` resolves by STORED subject id (renamed animals are found); `subjectIdCollision` is refused at `updateAnimal` (store boundary), shown inline in the profile dialog (save disabled), and the cross-animal batch export refuses days that would share one filename. | `animalCreation.test.js`, `workspace-animal.test.js`, `AnimalProfileDialog.test.jsx`, `ValidationSummary.test.jsx`; e2e "the profile editor refuses a subject id another animal already uses" |
| New P1 Optogenetics editor vs export | One resolver, `resolveDayOptogenetics(animal, day)`, feeds the export merge, the epoch-grid controls and the header chips. The animal Optogenetics section offers the explicit correction "Apply this setup to N recording days…" (confirm → `applyAnimalDefaultsToDays`). | `epochGridViewModel.test.ts` (both directions + pre-ownership fallback), `wiring/__tests__/OptogeneticsContainer.test.jsx` |
| New P2 Change source overwrites description | `reseedDayFromSource` keeps a non-empty recorded description (and its provenance); only an empty one is filled from the source. | `datedFactsBoundaries.test.js` #8b |
| New P2 Effective-date correction leaves stale confirmations | `configurationChoiceStatus` treats only `source: 'explicit'` as conclusive; date-derived confirmations (`effective-date` / `copied` / `migration`) are re-evaluated against the CURRENT effective dates every time, so moving a setup's date after a day un-confirms it without re-pinning its geometry. | `configurationSelection.test.ts`, `datedFactsBoundaries.test.js` #5c |

Also from the earlier review's completion checks: the day-editor overview's team fields now read the
day's own team (source `day`), matching the export (`dayEditorViewModel.test.ts`); the duplicate-day
modal copy no longer promises the old behavior. Catalogs (cameras, rig, task types) remain
identity-locked references by design (documented in the ownership table above) — not day snapshots.

Verification after the fixes: `npx vitest run` **381 files / 5,443 tests pass**; typecheck, eslint
(`--max-warnings 0`), stylelint, `check:schema`, build all exit 0; Playwright **127 pass**, the same
7 pre-existing legacy visual baselines fail. No YAML byte path changed (golden baselines green), so
the converter / Spyglass runs were not repeated.

## Second review response (FIX_RESPONSE_REVIEW.md, `51bc3430`): all 7 findings fixed

| Finding | Fix | Failing-first test |
| --- | --- | --- |
| P1 Delayed receipt ack marks edited metadata as downloaded | The ack is a dedicated, metadata-only store action `acknowledgeReceiptStorage(dayId, {contentHash, exportedAt})`: it flips `yamlStored` only for THAT receipt identity and touches no modification stamp, so an intervening edit stays "Changed since download" and a late ack of an older download never replaces a newer receipt. Also found and fixed a latent second cause: modification stamps are now strictly monotonic (`getCurrentTimestamp`), so an edit in the same millisecond as a download can no longer satisfy the freshness fast path. | `state/__tests__/receiptAcknowledgement.test.js` (edit-before-ack, second download before first ack, stamp monotonicity) |
| P1 Delayed recovery deletes new work | `preservationPending` is true from mount until the discarded original is durably preserved (or preservation failed); autosave, Save and restore all refuse meanwhile (one shared `writeBlocker`), edits stay in memory and are written when the flag clears. `discardUnusableWorkspace` clears the main key only if it still holds the quarantined bytes. | `state/__tests__/pendingPreservation.test.js` (save during pending → refused, then applied; discard leaves replaced bytes alone) |
| P1 Restore overwrites after hand-over | Restore vetoes hand-over while in flight (`restoreInFlightRef`) and re-runs every write guard (ownership, pending, unpreserved) AFTER its asynchronous artifact writes; a stale continuation writes nothing. | `pendingPreservation.test.js` (hand-over refused during restore; lost lease → restore cancelled, storage untouched) |
| P1 Restore bypasses the unpreserved-original guard | Restore uses the same `writeBlocker` as Save/autosave; the backup dialog shows the refusal instead of closing silently. | `pendingPreservation.test.js`; e2e "restoring a backup is refused while the unrestorable original could not be preserved" |
| P2 Derived confirmation ignores the next setup | `configurationChoiceStatus` compares a non-explicit pin against the version the date rule currently selects; a pin the next setup now supersedes is `unconfirmed` with reason `superseded` (`supersededBy`/`supersededFrom`), messaged in validation and the ConfigVersionPanel; geometry untouched; explicit exemption kept. | `configurationSelection.test.ts`, `datedFactsBoundaries.test.js` #5d |
| P2 Restored receipts claim durability | `restoreBackupArtifacts` derives `yamlStored` from `putBlob`'s acknowledged result; the comparison card says when the bytes are not available in this browser instead of "Loading…" forever. | `backupArtifacts.test.js` (durable vs memory-only, then a fresh document) |
| P2 Opto correction is all-or-nothing | The correction is a checklist of the divergent days (date · current setup · downloaded), all ticked by default; only the ticked ids are applied. | `wiring/__tests__/OptogeneticsContainer.test.jsx` |

Verification after these fixes: `npx vitest run` **383 files / 5,455 tests pass** (run as two halves;
the seven legacy integration timeouts that appear only under full-suite load pass in isolation and
are pre-existing); typecheck, eslint (`--max-warnings 0`), stylelint, build all exit 0; Playwright
**128 pass**, the same 7 pre-existing legacy visual baselines fail. No YAML byte path changed.

## Third review response (REVISION_3_REVIEW.md, `3c4458a2`): both restore findings fixed

| Finding | Fix | Failing-first test |
| --- | --- | --- |
| P1 Cancel does not stop an in-flight restore | A restore is EXCLUSIVE (a second call is refused; saves are refused while one is in flight) and CANCELLABLE: `cancelRestore()` invalidates the operation's token, so its continuation commits nothing. The dialog's Cancel / Escape / overlay abort the restore; while in flight it reads "Restoring…" with Replace disabled. | `state/__tests__/restoreAtomicity.test.js` (cancel then saved edit kept; second restore refused; saves refused), `WorkspaceBackupPanel.test.jsx`; e2e "Cancel during a delayed restore aborts it" (held IndexedDB completion, then a saved 777 g edit survives the release) |
| P2 Failed restore partially replaces data | Incoming artifacts are STAGED under `receipt-staging:` keys (`stageBackupArtifacts`), never over the active keys; the restored workspace is written to storage FIRST and only then swapped into memory and the staged bytes promoted (`commitStagedArtifacts`); a failed write / cancellation / tripped guard discards the staging keys and leaves memory, storage and the active receipt bytes untouched. The comparison card verifies stored bytes against the receipt hash before showing them as the previous download. | `restoreAtomicity.test.js` (quota failure after staging: memory 485, storage 485, bytes 485), `pages/DayEditor/__tests__/DownloadStatusCard.test.jsx` (mismatched bytes → unavailable) |

Verification: `npx vitest run` **385 files / 5,463 tests pass** (two halves, as before); typecheck,
eslint, stylelint, build exit 0; Playwright **129 pass**, the same 7 pre-existing legacy visual
baselines fail. No YAML byte path changed.

## Scientific assumptions needing pilot confirmation
1. Subject ids never contain `_` (140/140 corpus ids agree) — the app now blocks it at creation and export.
2. Weight: unknown weight blocks export (converter requires `subject.weight`); baseline is only a dated suggestion.
3. Bad-channel marks are treated as compatible carry-forward within a probe configuration version only.

## Next concrete step
Run the human pilot per `PILOT_RUNBOOK.md`; nothing here is committed yet (commit on request, split by
increment).
