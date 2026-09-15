**Metadata entry app review — 14 September 2026**

The animal/day workspace is a useful direction, and the epoch grid is a substantial improvement over the legacy form. I would fix the persistence and historical-data issues below before making this the default application. Passing the current tests does not establish that an export matches its recording files or faithfully preserves the facts of an earlier day.

The governing design rule should be: **reuse definitions and suggest previous values; preserve what was actually recorded on each date.** Frequency of change and ownership are different questions. A field that rarely changes is not necessarily safe to resolve from today's animal record.

This review covers the `modern` branch at `57b3b41b`, the local `trodes_to_nwb` checkout at `6603412`, and the local Spyglass checkout at `c65a5098`. I read the supplied analysis, independently scanned the three data folders, exercised the actual import planners against the collected files, inspected the running application in isolated Chromium contexts, and ran the checks listed below. Application source was not changed.

**Findings to address first**

P1 means address before relying on the new workflow for production metadata. P2 means a significant efficiency or maintainability improvement. These are review priorities, not claims that every user encounters every problem.

| Priority | Finding | Practical consequence |
|---|---|---|
| P1 | F1. Export filenames do not match the converter's session grouping | A valid YAML download is not associated with its `.rec` files |
| P1 | F2. Backfilled days select the newest configuration and latest-day source | Earlier sessions can acquire later geometry and recording facts |
| P1 | F3. Focused text is outside the autosave/unsaved-work model | “Saved” can coexist with edits that disappear on reload |
| P1 | F4. Two tabs overwrite entire workspace snapshots | A later save silently loses the other tab's work |
| P1 | F5. Some legitimate historical differences cannot be represented | Import/re-export replaces the original session team or setup |
| P1 | F6. Export status survives changes to exported content | A modified day still appears exported |
| P1 | F7. Carry-forward mixes measurements, paths, and incomplete setup choices | A copied day can silently use an old weight or the wrong rig |
| P1 | F8. The only saved workspace can be discarded without a recovery copy | Corruption or an incompatible version can remove recoverable work |
| P2 | F9. Historical import still requires substantial manual repair | Many scientists must edit YAML outside the app to begin |
| P2 | F10. Daily work is visually subordinate to configuration and descriptions | Routine entry and catch-up take more navigation than necessary |

**F1 — Export the filename the converter actually groups with the recording.**

The download formatter uses `MMDDYYYY` and lowercases the subject. The converter extracts the filename's date as an integer and preserves the animal token, then groups by `(date, animal)`. It does not reinterpret the date or case-fold the animal. Directly calling the local scanner produced:

| Filename | Converter group |
|---|---|
| `20230622_Sample_01_a1.rec` | `(20230622, 'Sample')` |
| `06222023_sample_metadata.yml` | `(6222023, 'sample')` |
| `20230622_sample_metadata.yml` | `(20230622, 'sample')` |
| `20230622_Sample_metadata.yml` | `(20230622, 'Sample')` |

This affects the standard directory-scanning conversion workflow unless someone renames the download. New-animal creation also lowercases the *exported subject ID*, not just the internal lookup key. Underscores are accepted in app subject IDs, but the current scanner expects exactly three underscore-separated metadata filename components.

Use the recording's `YYYYMMDD` and exact animal token. Keep a normalized lookup key separate from the scientific ID. Validate the complete file convention against the supported converter, including allowed ID characters. Add a contract test that places the real app download alongside a sample recording and checks they enter the same scanner group.

Evidence: [download formatter](../../../src/io/yaml.ts#L102), [animal creation](../../../src/domain/animalCreation.ts#L72), [converter scanner](/Users/edeno/Documents/GitHub/trodes_to_nwb/src/trodes_to_nwb/data_scanner.py:44), [converter grouping](/Users/edeno/Documents/GitHub/trodes_to_nwb/src/trodes_to_nwb/convert.py:279), [required metadata lookup](/Users/edeno/Documents/GitHub/trodes_to_nwb/src/trodes_to_nwb/convert.py:331).

**F2 — Resolve configuration and copy source using the recording date.**

`createDayRecord` pins the last configuration in the array without consulting the new day's date. The calendar's default-on carry-forward option uses the animal's latest existing day for every selected date. Neither selection means “the setup/source applicable before this recording.”

I reproduced a June 25 day receiving configuration v2 dated July 1 and values copied from July 2. The pin is structurally valid, so checking that the referenced version exists does not catch the chronological mistake. “Duplicate day” does preserve the source configuration, but that separate command does not fix normal calendar creation.

Choose the revision effective on the recording date and the nearest eligible earlier source day. If no applicable revision is known, keep the day as an incomplete draft and request its setup. For a batch spanning a reconfiguration, show which dates receive each version before committing. Keep recording date, setup effective date, and metadata-entry timestamp separate.

Evidence: [configuration selection](../../../src/state/workspaceTransitions.ts#L506), [calendar creation](../../../src/pages/AnimalWorkspace/RecordingDaysTab.tsx#L283), [duplicate-day alternative](../../../src/state/workspaceActions.ts#L447).

**F3 — Autosave must include the value currently being typed.**

Daily textareas and several inputs write to the store only on blur. The save indicator and unload guard observe persisted workspace state, so they cannot see those pending DOM edits. Cmd/Ctrl+S is suppressed while an input is focused and does not call save.

Browser reproduction: save a weight change; type a new session description without leaving the textarea; press Cmd+S; wait beyond the autosave debounce. The input held the new description, storage held the old one, the interface said “Saved just now,” and the unload event was not guarded. Reload restored the old description.

Track editable drafts on input, debounce durable writes, and distinguish typing from completed validation. Make explicit Save flush the current field. Include wizard, modal, and import-repair drafts in the unsaved-work policy as appropriate. A blur handler remains useful for validation; it should not be the sole record of the user's work.

Evidence: [daily inputs](../../../src/pages/DayEditor/DayTab.tsx#L169), [textarea](../../../src/pages/DayEditor/DayTab.tsx#L198), [shortcut guard](../../../src/hooks/useGlobalShortcuts.ts#L65), [persistence](../../../src/state/useWorkspacePersistence.ts#L86).

**F4 — Add concurrency protection before a second tab can save.**

Every save serializes the entire workspace to one `localStorage` key. The application does not subscribe to external storage changes or detect a stale writer.

Browser reproduction: open the same day in two tabs; save a description in tab A; change weight in tab B. Tab B's save restored the older description while retaining its new weight. This can also lose edits to different days or animals because the replaced unit is the whole workspace.

A practical first fix is an explicit single-editor lock or a revision conflict that prevents an outdated tab from writing. A durable implementation should use transactional record updates and detect conflicting revisions. Listening for the [browser storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) can notify other tabs, but a notification alone is not conflict resolution.

Evidence: [whole-workspace write](../../../src/state/persistence.ts#L186), [autosave payload](../../../src/state/useWorkspacePersistence.ts#L100).

**F5 — Preserve session experimenters and version the setup that can change.**

The exporter always reads experimenters and optogenetics setup from the current animal. Batch import explicitly resolves differing experimenters and optogenetics with “latest date wins.” It displays a divergence warning, but the resulting model still cannot preserve those separate historical facts. Two otherwise valid files with different experimenters imported without rejection into one animal with the later team.

This is supported by actual files. Within the same `denisse/stelmo/Emmett` series, January 18, 2026 names two experimenters and February 4 names three. Seth has the same kind of difference between January 21 and January 23. These are counterexamples to treating the team as animal-invariant; the files do not establish whether each difference was intentional or a correction.


Keep an experiment/team default for convenience and a session-owned actual experimenter list. Distinguish implanted optogenetics facts, equipment/software configuration, and stimulation used in particular epochs. Historical imports should preserve differing values until a user explicitly reconciles them. The existing camera workflow already offers a useful “new identity versus correction” distinction; extend that approach where needed instead of replacing it.

Evidence: [live merge](../../../src/state/workspaceUtils.ts#L381), [latest-wins import](../../../src/state/yamlImportPlan.ts#L582), [existing camera protection](../../../src/pages/AnimalEditor/wiring/CamerasContainer.tsx#L140), [Emmett January file](/Users/edeno/Downloads/collected_metadata_yamls/denisse/stelmo/Emmett/20260118/20260118_Emmett_metadata.yml), [Emmett February file](/Users/edeno/Downloads/collected_metadata_yamls/denisse/stelmo/Emmett/20260204/20260204_Emmett_metadata.yml).

**F6 — Track whether the current content is the content last exported.**

Export stores `state.exported = true`; ordinary edits leave it true. Live validation catches newly invalid data, but valid changes such as a corrected weight still qualify for the “Exported” label. I reproduced a change from 520 to 530 leaving both `validated` and `exported` true. Animal edits can alter the merged export too; a temporary “needs re-export” toast is not a persistent record of that difference.

Store an export receipt with timestamp, filename, app/schema/converter contract versions, and a hash of the canonical exported content. Derive “Changed since export” by comparing current content with that receipt. Preserve the previous exported snapshot or bytes so a scientist can inspect exactly what changed. Do not imply that initiating a browser download proves conversion or Spyglass insertion succeeded.

Evidence: [export bookkeeping](../../../src/domain/exportDay.ts#L76), [day update](../../../src/state/workspaceTransitions.ts#L624), [lifecycle resolution](../../../src/domain/dayLifecycle.ts#L121), [re-export toast](../../../src/pages/AnimalView/index.tsx#L284).

**F7 — Define a copy policy per kind of value.**

The normal carry-forward path copies weight and the complete data-folder string but omits the chosen `data_acq_device_name`. The exporter then falls back to the first rig. In the reproduction, the source used “Second rig,” while the new day resolved the first catalog entry. The copied folder was `/data/20230702/` even for a June 25 backfill. That folder subsequently determines generated statescript paths.

Separately, a day without an entered weight can export the animal baseline and be “Ready.” The interface explains the baseline fallback, which is helpful, but a carried weight becomes an ordinary session value without a recorded measurement date or carry provenance.

Use three explicit behaviors: copy stable definitions/references; derive date-dependent paths from a folder template or file manifest; show previous measurements as suggestions with their dates. Require an intentional decision before representing a previous weight as today's measurement. Preserve or explicitly choose the recording system when copying. Do not auto-propagate a correction to a completed past day into later observations.

Evidence: [carry policy](../../../src/state/workspaceTransitions.ts#L559), [rig fallback](../../../src/state/workspaceUtils.ts#L280), [weight fallback](../../../src/state/workspaceUtils.ts#L406), [statescript path generation](../../../src/domain/fileNaming.ts#L97).

**F8 — Preserve recoverable storage and support workspace backup.**

There is no workspace backup/restore flow that preserves drafts, configuration history, and provenance. Downloading individual YAMLs is not an equivalent backup. On an unusable or incompatible persisted envelope, hydration displays a notice and removes the only stored blob. The notice is honest, but it arrives after the recovery source is discarded.

Quarantine the original bytes, offer recovery/download, and retain the last known good checkpoint. Add a versioned workspace backup/import operation that works even when days are not exportable. Show “Saved on this browser” rather than implying a shared durable account. For recording-computer-to-office-computer use, a portable workspace is the minimum viable transfer; shared synchronization can follow if the lab needs it.

IndexedDB is a better candidate as workspaces grow: Web Storage is synchronous and has a relatively small quota. Moving storage engines does not itself supply backup or concurrency control. [MDN Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), [storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Evidence: [discard path](../../../src/state/useWorkspacePersistence.ts#L58), [persistence implementation](../../../src/state/persistence.ts#L186).

**F9 — Make repair a resumable workflow and batch repeated corrections.**

Running the actual `buildImportRepairPlan`, benign normalization, and single-file `planImport` functions against the 1,681 distinct parsed collected files gave:

| Current import outcome | Files |
|---|---:|
| Ready without repair/review | 442 (26.3%) |
| Have field-repair items | 1,208 (71.9%) |
| Have at least one “Needs source-file editing” blocker | 779 (46.3%) |

The last two categories overlap. These numbers describe compatibility with today's app, not the validity of the original experiments or whether old converter versions accepted them. No planner calls threw. Required fields, species/sex representations, camera placeholders, and old electrode structures account for substantial work.

The existing repair screen explains problems and separates safe formatting changes from decisions; keep that. Add a persisted repair queue and “apply this reviewed correction to these matching files” with a before/after preview. Preserve raw originals. Support structured repair of the common legacy cases inside the app, keeping export blocked until complete. Currently repair files/resolutions live in component state and structurally blocked files remain outside the workspace.

Evidence: [repair state](../../../src/pages/ImportRepair/index.tsx#L165), [external-edit dead end](../../../src/pages/ImportRepair/index.tsx#L650), [planner](../../../src/state/importRepair.ts#L1176), [measured evidence](evidence.json).

**F10 — Put today's decisions first and make backfill directly reachable.**

The updated screens are readable, and the epoch table becomes cards at 390 px without document-level horizontal overflow. However, the daily page prioritizes a folder and two long descriptions ahead of weight. On a phone, the stacked navigation and status chrome consume substantial vertical space before epoch entry. The new-animal wizard exposes seven steps, including setup that may not apply, and says the scientist will only revisit shared setup on re-implant; that wording is too strong for cameras, tasks, and teams.

Move date, current weight, actual experimenters, epoch sequence, and changes since the selected source to the first daily screen. Keep an editable experiment-description default in a compact expandable area. Use a compact mobile section selector. Keep optional setup genuinely optional and label it “Not used” when appropriate. Preserve the wizard's Save draft option.

The calendar correctly opens near the existing recording timeline, which helps catch-up. For a new animal it opens in the current month and only has previous/next month and Today navigation. Add direct date entry and a month/year jump; entering a first June 2023 session in September 2026 otherwise entails 39 previous-month activations. Add “Log today” and a clear “Choose recording date” alternative.

The root URL still opens the legacy form and hides workspace navigation. This appears deliberate during development, so it is a release-cutover requirement rather than an accidental routing bug. Until the default changes, the ordinary entry URL does not deliver the new workflow.

Evidence: [daily desktop](daily-desktop.png), [epoch desktop](epochs-desktop.png), [epoch phone](epochs-mobile.png), [calendar controls](../../../src/components/CalendarDayCreator/CalendarHeader.tsx#L34), [default route](../../../src/hooks/useHashRouter.ts#L69).

**What the data establishes—and what it does not**

Independent inventory reproduced the supplied report's 1,814 collected files, 1,799 successful parses, 15 parse errors, and 1,681 distinct parsed file contents. All 325 YAMLs in `all_rat_metadata_yaml` duplicate collected contents. The converter test-data folder contains eight YAMLs: three subject-metadata files and five other configuration files. Treating these folders as three independent populations would overstate the evidence.

The supplied report groups longitudinal data by **experimenter × subject ID**, then reports no experimenter changes. That is a consequence of the grouping, so it cannot justify animal-level ownership of experimenters.

My exploratory grouping used exact subject IDs and dates extracted from filenames, with byte-identical files deduplicated. Among 128 subject IDs with multiple dates, raw values differed across dates for weight in 47, cameras in 50, tasks in 122, behavioral events in 33, and probe geometry/maps excluding bad-channel marks in 33. Acquisition scale did not differ within those groups. These are signals for where the model needs flexibility, not rates of physical change: old formats, missing values, spelling, copies of a date, and reused subject IDs can affect the counts. Camera-array differences do not necessarily mean recalibration; task differences include epoch assignments.

DOB, genotype, and species variation should trigger reconciliation of identity facts, not be treated as routine biological changes. Conversely, a constant weight in copied YAMLs is not proof that weight never changed. Likewise, the corpus does not prove that every bad-channel designation is a permanent hardware failure. Carry previous exclusions visibly; distinguish persistent failure from session-specific quality judgments if scientists use both meanings.

**Recommended ownership model**

| Layer | Examples | Reuse and change rule |
|---|---|---|
| Experiment defaults | Lab/institution, experiment description, protocol templates, default team | Reuse across animals; apply template changes to future entries unless named existing sessions are explicitly corrected |
| Animal identity | Exact subject ID, species, sex, DOB, genotype | Enter once; corrections show affected sessions and preserve audit history |
| Dated implant/configuration | Probe geometry, channel mapping, reference configuration, implanted fibers/injections | Each recording pins an effective revision; physical change creates a new revision |
| Rig/catalog revision | Acquisition system, scale/units, camera calibration, reusable DIO wiring | Select the version actually used; preserve existing camera new-identity protection |
| Recording day | Recording date, measured weight, actual experimenters, notes, selected rig/configuration | Store historical facts and their provenance; previous values are suggestions where appropriate |
| Epoch | Sequence, task/environment, camera use, files, stimulation protocol/power | Pick reusable definitions and record actual assignments and exceptions |
| Review/export history | Bad-channel assessment, corrections, reviewed values, exported-content receipt | Distinguish current readiness from what was previously checked/exported |

This does not require a large new “Experiment” screen immediately. It requires explicit boundaries in the data and copy policies. Add a project/template UI when multiple experiments need it.

Keep provenance such as `copied from June 22`, `recorded June 25`, `entered September 14`, `configuration v1`, and `reviewed by…` outside the converter YAML unless its contract supports those fields. A saved export snapshot should retain that provenance in the workspace.

**A faster workflow using the diary idea**

Borrow the familiar dated diary, recent choices, reusable plans, and copy action from the user's MyFitnessPal analogy. The useful unit is a recording day with an ordered set of epochs.

1. **First setup:** import existing metadata, choose an experiment template, or create an animal. Capture identity and the setup actually used; allow incomplete drafts. Prefer extracting available facts from a recording manifest/header over asking the scientist to type them.
2. **Routine day:** open the animal and Log today, or select the actual recording date. Present the chosen source date and applicable setup. Enter weight and actual team; select a saved epoch sequence and adjust exceptions. Show changed channels, camera/calibration choices, DIO differences, and optogenetic conditions when relevant.
3. **Catch-up:** select a date range or import a file manifest. Show one row per date with source, setup version, weight, epoch count, missing facts, and export freshness. Paste a column of dated weights and batch-apply reviewed stable facts. Resolve each date against its own effective configuration.
4. **Export review:** show only unresolved issues, deliberate deviations, and changes since last export. Group repeated issues so the user can fix one shared cause. Download a ZIP plus a manifest/receipt for a batch instead of initiating many separate browser downloads.

Retain undo for reversible day/epoch edits and targeted confirmation for changing data used by completed sessions. Avoid making every routine keystroke a confirmation. Distinguish “planned,” “recorded but incomplete,” and “metadata ready”; a copied plan is not evidence that every planned epoch happened. W3C's guidance supports avoiding redundant entry within a process and making stored-data changes reversible, checked, or confirmable; it does not mandate reusing measurements across days. [Redundant entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html), [error prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html).

**Architecture and web implementation**

Preserve the existing pure workspace transitions, centralized merge/encoder, schema-plus-domain validation, configuration snapshots, migration framework, repair routing, and shared dialog behavior. The current camera identity workflow and epoch-reference cleanup are particularly relevant to downstream correctness. A new framework or state library is not a prerequisite for fixing the findings.

Make the following focused changes:

- **Strengthen the converter contract.** The bundled schema matches the local converter after removing the app-only version field. That is useful but insufficient: CI's downstream integration job compares schemas rather than converting an app export. Add scanner and header-map tests, then a small actual NWB fixture with assertions for subject, electrodes/bad-channel flags, camera calibration, task epochs, and optogenetic objects. Add a separate Spyglass integration lane against a disposable test database. The converter reads maps/references from the recording header, and Spyglass keys cameras by `camera_name` and checks task-description consistency; these behaviors extend beyond JSON Schema. [Header validation](/Users/edeno/Documents/GitHub/trodes_to_nwb/src/trodes_to_nwb/convert_rec_header.py:104), [Spyglass camera identity](/Users/edeno/Documents/GitHub/spyglass/src/spyglass/common/common_device.py:290), [Spyglass task consistency](/Users/edeno/Documents/GitHub/spyglass/src/spyglass/common/common_task.py:64).
- **Separate metadata validity from file verification.** The app can generate plausible paths but does not establish that those files exist or that they match the actual epochs/header. A selected manifest or small companion validation command would prevent more expensive mistakes than additional free-text validation. Label unverified files honestly; do not imply “Ready” proves downstream insertion.
- **Make canonical types accurate.** `ElectrodeGroup.targeted_location` is typed as `number[]`, although the schema/fixtures use a region string; coordinate types also differ. Optogenetic interfaces use generic `power`, `coordinates`, and `volume` fields that do not match the serialized unit-bearing keys. Fix these contracts and distinguish raw imported data from validated canonical data. The current type-check pass does not prove these boundaries agree. [Workspace types](../../../src/state/workspaceTypes.ts#L177), [export field definitions](../../../src/state/workspaceUtils.ts#L67).
- **Reduce loading and render scope.** The production build emitted one 1,240.63 kB JS chunk (330.94 kB gzip) and 160.27 kB CSS. Lazy-load the legacy editor and infrequent import/setup views. The single context value includes the complete model and persistence status; memoizing that object does not prevent subscribers from rerendering when either dependency changes. Separate persistence/actions and use narrower data subscriptions if profiling warrants it. Profile a realistic 200-day study, bulk import, and a high-channel-count animal before choosing further optimizations. [Provider](../../../src/state/StoreContext.tsx#L103), [React context behavior](https://react.dev/reference/react/useContext).
- **Extract cohesive editor behaviors.** `EpochsTab.tsx` is 1,437 lines; the wizard is 901 and ImportRepair is 913. Extract epoch actions/details/file editing and the import queue while keeping one owner of validation and export rules. Line counts are maintainability signals, not proof of a performance defect.
- **Align release documentation.** README, feature-flag comments, `App.tsx` comments, and POST_V3 follow-ups disagree in places about cutover and retired features. The README still documents an old import-conflict limitation that the current repair/apply code addresses. Define the supported converter revision, public entry route, storage guarantees, and actual workflow in one maintained guide. Remove obsolete `react-scripts` rationale from `.npmrc` after checking whether the peer-dependency exception is still necessary.

The inspected code did not expose YAML through obvious raw-HTML/eval rendering paths. This was not a penetration test or dependency-advisory audit. For a large import, bound input size and provide progress/cancellation; avoid moving potentially expensive full-corpus planning onto the main interaction path without measurement.

**Verification and limits**

| Check performed | Result |
|---|---|
| Full Vitest run | 361 files, 5,294 tests passed |
| TypeScript | Passed |
| ESLint warnings-as-errors command | Passed; tooling emitted stale-browser-data/AST diagnostic messages |
| Production build | Passed; large-chunk warning |
| Selected existing browser suites | 22 passed: workflows, export, responsive accessibility, mistake prevention |
| Manual scripted browser checks | Reproduced focused-input loss, two-tab overwrite, and domain backfill/carry/export-state cases; no page errors |
| Desktop and 390 px inspection | Daily and epoch pages inspected; no document-width overflow in checked mobile states |
| Axe scan | One repeated target-size flag on the UCSF footer link; review the inline-text exception before calling it a WCAG failure |
| Corpus/import planner sweep | Counts above; no planner throws |
| App/converter schema comparison | Equal except the app-only version field |
| Local converter filename scanner | Confirmed grouping mismatch |

Screenshots use repository fixture data, not a user's browser workspace. The automated accessibility scan is not a complete keyboard/screen-reader or WCAG conformance assessment. Only Chromium was exercised. No full NWB conversion or live Spyglass database insertion was run; upstream conclusions are based on inspected local source and the targeted scanner execution. No scientist usability sessions were conducted, so speed gains remain hypotheses to measure.

**Recommended delivery order**

First fix filename compatibility, focused-input saving, concurrent writes, backfill selection, and copy policy, with regression cases at those boundaries. Add workspace recovery and persistent export freshness before rollout. Then preserve historical experimenters/setup during import and streamline the daily/catch-up UI. Follow with resumable batch repair, manifests, and targeted architecture work.

Before release, ask several scientists to complete four observed tasks: log a routine day; backfill a date before a probe change; import a mixed historical batch; and correct a previously exported day. Measure time, fields re-entered, navigation, unresolved misunderstandings, and whether the output matches the intended historical facts. A reasonable initial design target is routine entry in roughly a minute once setup exists; that target has not been demonstrated by this review.
