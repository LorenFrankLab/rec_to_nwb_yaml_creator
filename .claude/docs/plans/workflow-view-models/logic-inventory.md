# Logic inventory — component-trapped workflow decisions

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

**Phase 0 deliverable (doc-only).** A map of every workflow decision the four modern surfaces
(ValidationSummary, AnimalWorkspace, AnimalView, DayEditor) make *inline today*, where each should
live, and — most importantly — where the [shared view-model vocabulary](shared-contracts.md) **cannot
yet express a decision** (the contract gaps that [phase-1](phase-1-contracts.md) must close before the
builders adopt the types).

This is the spec the Phase 2 builders are checked against. It contains **no source changes**.

## How to read

Each surface has a decision table:

| Column | Meaning |
| --- | --- |
| **Decision** | The workflow choice made (status, severity, label, action, count, recovery, gate). |
| **Where computed today** | `file:line` of the inline code. |
| **Inputs it reads** | The data/functions the decision consumes. |
| **Target home** | `REUSE` (already a pure `src/domain/*`/selector fn — builder just calls it), `EXTRACT` (display/label/action assembly that moves into a Phase-2 builder), or `COMMAND` (a write/intent that moves to the Phase-4 command layer). |
| **Notes** | Caveats; for DayEditor, the Phase-2d sub-slice (1 stepper · 2 Overview fields · 3 bad channels · 4 issues/gate/breadcrumb). |

**Classification legend (Target home):**

- **REUSE** — the rule is already pure domain truth. Builders **compose** it; they do not reinvent it.
  A decision that *should* be REUSE but is reimplemented inline is a **domain gap** (see
  [§ Domain gaps](#domain-gaps)) — fixing it is an explicit domain change, never smuggled into a builder.
  REUSE is restricted to `src/domain/*` and `src/state` selectors — pure functions a builder can import.
  Page-local helpers (in `src/pages/**`), React hooks, and components are **not** REUSE even when pure:
  they are EXTRACT (fold into the builder) or *promote to domain*, because a pure builder must never depend
  on a page/hook/component.
- **EXTRACT** — composition / display assembly / action wiring currently in a component → a Phase-2 builder.
- **COMMAND** — a write expressed as nested-object edits or an inline handler → a Phase-4 command wrapper.

**Citation verification:** six `file:line` citations were spot-read against the source before this doc
was committed (`validationSummaryRows.ts:57` `deriveChip`, `:89` `dayChipDisplay`;
`AnimalView/index.tsx:513-517` ring precedence; `DayEditorStepper.tsx:196-208` step-status map;
`DayList.tsx:180-187` orphan "Re-link to export" override; `OverviewStep.tsx:256-277` weight
inherited-value display) — all accurate. Line numbers are accurate as of branch `wvm-phase0-inventory`;
they will drift with edits — treat them as anchors, not contracts.

---

## ValidationSummary

Files: `src/pages/ValidationSummary/index.tsx`, `validationSummaryRows.ts`,
`useValidationSummaryActions.ts`, `DayStatusTable.tsx`, `EffectiveDayReview.tsx`,
`BatchExportPreflight.tsx`, `ExportReport.tsx`

| Decision | Where computed today (file:line) | Inputs it reads | Target home | Notes |
| --- | --- | --- | --- | --- |
| Day recovery classification (ok / dangling / orphan-no-owner / wrong-owner / recovered-unlinked) | validationSummaryRows.ts:192 (loop over `classifyWorkspaceDays`), branches 196/205/212/226 | workspace.animals, workspace.days | REUSE `classifyWorkspaceDays` + `DAY_STATUS` (dayRecovery) | Already pure; row builder only DECORATES each classified day. |
| Per-day validation chip (valid/error/incomplete) from step statuses | validationSummaryRows.ts:57 `deriveChip`; called at :233 | `computeStepStatus(dayRecord, merged, animal, animalDays)` | REUSE `computeStepStatus` (domain/validation); `deriveChip` is a **page-local** pure helper (validationSummaryRows.ts) → EXTRACT/promote into the builder, not a domain dependency | `deriveChip` is already a pure exported helper in this file; reused by `useValidationSummaryActions` :309 too. |
| Chip variant + label derivation (Ready/Validated/Exported/Re-link/Error labels) | validationSummaryRows.ts:89 `dayChipDisplay`; consumed at DayStatusTable.tsx:160 | `chip`, `day.state`, {unreadable, missingRecord, orphaned} | EXTRACT `buildDayRowViewModel` (chip→statusLabel) — internally REUSE `lifecycleForValidDay` + `DAY_LIFECYCLE_LABEL` (dayLifecycle) | Pure already, but display assembly that belongs in the day-row VM. Maps to `DayRowViewModel.status`/`statusLabel`. |
| Day status → label/chip CSS variant string (`status-chip--${variant}`) | DayStatusTable.tsx:167 | `dayChipDisplay` result | EXTRACT `buildDayRowViewModel` | Variant string ('ready'/'validated'/'exported'/'error'/'incomplete') is the CSS modifier; should be a VM field. |
| Readiness counts (valid / error / incomplete tally) | index.tsx:61-67 | `rows[].chip` | EXTRACT `buildValidationSummaryViewModel` (counts) | Inline `forEach` accumulator over chips; export readiness summary counts. |
| Export-Valid button enabled/disabled + disabledReason | index.tsx:94-95 | `counts.valid`, `counts.error` | EXTRACT `buildValidationSummaryViewModel` (action state) → `WorkflowAction.disabledReason` | "No valid days to export — fix errors first." Maps cleanly to `WorkflowAction`. |
| Export policy: which rows are exportable (recovery `ok` only) | useValidationSummaryActions.ts:185-187 (`chip==='valid' && isExportableDayStatus`); also :117 (validate filter) | `row.chip`, `row.status` | REUSE `isExportableDayStatus` (dayRecovery) | Read, not re-decided; the predicate is pure domain. |
| Validate-All target set (only `ok` recording days; skip recovered/wrong-owner/dangling) | useValidationSummaryActions.ts:117 | `rows[].status` via `isExportableDayStatus` | COMMAND `validateAllDays` (intent) — selection REUSE `isExportableDayStatus` | Selection logic is reusable; the per-day write is a command. |
| Persist `day.state.validated` per day | useValidationSummaryActions.ts:142-156 (`actions.updateDay`) | `day.state`, `chip` | COMMAND `setDayValidated` (per-day) under `validateAllDays` batch | Nested-object edit (`{...currentState, validated}`) → command-layer intent. |
| Corrupt `day.state` guard (truthy non-record → skip + report, don't launder) | useValidationSummaryActions.ts:129-141 | `day.state`, `isRecord` | EXTRACT (validate-error classification) + COMMAND (the skip) | Decides "corrupt vs absent" before writing; classification is pure, the skip is part of the command. |
| Validate-All result message (validated N / N of M failed + skipped note) | useValidationSummaryActions.ts:160-174 | `validatable.length`, `validateErrors.length`, `rows.length` | EXTRACT `buildValidateAllSummary` (message) | Pluralization + skipped-note assembly; pure display. |
| Batch-export preflight assembly (per-day: config version, groups, failed channels, cameras, opto, warnings) | useValidationSummaryActions.ts:203-231 | `mergeDayMetadata`, `getDayWorkflowStatus`, merged.ntrode_…, `describeDayOptoState`, `validateDay` | EXTRACT `buildBatchPreflight` — REUSE `mergeDayMetadata`, `getDayWorkflowStatus`, `describeDayOptoState`, `validateDay` | Counts (failedChannels reduce, groups/cameras length) are inline assembly; underlying truth is reused. |
| Outstanding-warning set for preflight ack (filter severity==='warning') | useValidationSummaryActions.ts:216 (filter) + 234-236 (`warningItems`) | `validateDay(...)` results | EXTRACT `buildBatchPreflight` (warnings) — REUSE `validateDay` severity field | Maps to `IssueViewModel.severity==='warning'` aggregation. |
| Blocking vs warning split (errors block export; warnings only require ack) | useValidationSummaryActions.ts:185 (valid-only) + 216 (warning filter); BatchExportPreflight.tsx:34 (confirmDisabled) | `row.chip`, `validateDay` severities, `warningItems.length`, `warningsAcknowledged` | EXTRACT (preflight VM) — REUSE `validateDay`; ack gate COMMAND | Errors excluded upstream (chip!=='valid'); warnings gate Confirm. |
| Confirm-export disabled reason (unacked warnings) | BatchExportPreflight.tsx:34; guarded again at useValidationSummaryActions.ts:254 | `warningItems.length`, `warningsAcknowledged` | EXTRACT (preflight VM `WorkflowAction.disabledReason`) + COMMAND `runBatchExport` guard | Defense-in-depth: VM expresses disable, command re-guards. |
| Stale-at-confirm re-check: recovery status changed since preflight | useValidationSummaryActions.ts:273-303 | `classifyWorkspaceDays(workspace)` (live), tuple `statusKey`, `isExportableDayStatus` | COMMAND `runBatchExport` (re-derivation) — REUSE `classifyWorkspaceDays`, `isExportableDayStatus` | Live re-classification at action time; the policy check is reused, the orchestration is the command. |
| Stale-at-confirm re-check: day no longer valid / unreadable | useValidationSummaryActions.ts:304-327 | `computeStepStatus`+`mergeDayMetadata`+`deriveChip` (live) | COMMAND `runBatchExport` — REUSE `computeStepStatus`/`deriveChip` | Re-validation distinguishes "no longer valid" from "became unreadable (throw)". |
| Shadow-export parity gate + strict-mode skip/override | useValidationSummaryActions.ts:259 (`isFeatureEnabled('shadowExportStrict')`), 330-367 | `checkShadowExport`, `isFeatureEnabled`, `strict` | COMMAND `runBatchExport` — REUSE `checkShadowExport`, `isFeatureEnabled` | skip(strict)/override(strict-off) branching is orchestration; parity truth is reused. |
| Export filename + download | useValidationSummaryActions.ts:344-348 | `mergeDayMetadata`, `day.experimentDate`, `formatDeterministicFilename`, `downloadYamlFile` | COMMAND `runBatchExport` — REUSE `formatDeterministicFilename`/`mergeDayMetadata` | Injects filename-only EXPERIMENT_DATE key (merge doesn't carry it). |
| Persist `day.state.exported` after download | useValidationSummaryActions.ts:355-361 | `day.state` | COMMAND `markDayExported` (per-day) under `runBatchExport` | Nested-object edit → command intent. |
| Batch export result message (Exported N files / M not exported) | useValidationSummaryActions.ts:381-386 | `exported`, `rows.length`, `validRows.length` | EXTRACT `buildBatchExportSummary` (message) | Pure pluralized display. |
| Per-day scan summary (config version, session description, cameras, calibration, opto) | validationSummaryRows.ts:244-255 | merged (via `mergeDayMetadata`), `getDayWorkflowStatus`, `describeDayOptoState`, `describeCameraCalibration` | EXTRACT `buildDayRowViewModel` (scan) — REUSE `getDayWorkflowStatus`, `describeDayOptoState`, `mergeDayMetadata` | `describeCameraCalibration` (rows.ts:120) is already a pure local helper. |
| Camera-calibration summary text (name + m/px, "+K more" truncation) | validationSummaryRows.ts:120-131 | merged.cameras | EXTRACT `buildDayRowViewModel` — already pure helper `describeCameraCalibration` | CAMERA_CALIBRATION_LIMIT=3 constant local. |
| Unified config-version label ("config vN (latest/historical)") | validationSummaryRows.ts:303 `describeConfigVersionLabel`; consumed DayStatusTable.tsx:117/133, BatchExportPreflight.tsx:52 | `version`, `historical` (from `getDayWorkflowStatus`) | EXTRACT `buildDayRowViewModel`/preflight VM — already pure `describeConfigVersionLabel` | Reused across 3 surfaces; the historical flag is REUSE `getDayWorkflowStatus`. |
| Cross-day context for bad-channel monotonicity (date-sorted ok day records per animal) | validationSummaryRows.ts:157-167 `buildAnimalDaysByKey`; called rows.ts:190, actions.ts:202/280 | `classifyWorkspaceDays`, `DAY_STATUS.OK`, date sort | REUSE `classifyWorkspaceDays`+`DAY_STATUS` inside helper; helper itself EXTRACT (mirrors `getAnimalDays`) | Re-implements the ok-only date-sorted view `getAnimalDays`/`getConfigHistory` provide — see [Domain gaps](#domain-gaps) + Duplication. |
| Subject label coercion (subject_id / animal.id → string) | validationSummaryRows.ts:285 `subjectLabel`; used everywhere | `getAnimalSubject(animal).subject_id`, `animal.id` | EXTRACT `buildDayRowViewModel` — REUSE `getAnimalSubject` (workspaceSelectors) | Coerced to string to avoid React-child throw. |
| Day-reference repair routing (remove / unlink / relink / no-target) decision | DayStatusTable.tsx:182-233 | `missingRecord`, `wrongOwner`, `orphaned`, `ownerMissing` | EXTRACT `buildDayRowViewModel` (`actions[]`) + COMMAND `removeDayReference`/`unlinkDayReference`/`relinkDayReference` | The branch picks WHICH repair affordance; the writes are existing store actions → commands. Maps to `DayRowViewModel.actions[]`. |
| Open-editor href derivation | DayStatusTable.tsx:215 (`#/day/${day.id}`) | `day.id` | EXTRACT `buildDayRowViewModel` (`href`) | Maps to `DayRowViewModel.href`. |
| Orphan "not in day list" / wrong-owner "belongs to X" note text | DayStatusTable.tsx:76-91 | `orphaned`, `wrongOwner`, `describeOwner(day.animalId)` | EXTRACT `buildDayRowViewModel` (recovery note) — REUSE `describeOwner` (dayRecovery) | Maps to `DayRowViewModel.recovery`. |
| Inline relink-needed page note (any orphan present) | index.tsx:196 (`rows.some(row => row.orphaned)`) | `rows[].orphaned` | EXTRACT `buildValidationSummaryViewModel` (page-level note flag) | Surfaces a recovery state at page scope. |
| Empty-state branching (no days; scoped vs global wording) | index.tsx:123-134 | `rows.length`, `scoped` | EXTRACT `buildValidationSummaryViewModel` (empty state) | Empty/recovery display state. |
| Effective-day-review read-only setup (what THIS day used; rig constants) | EffectiveDayReview.tsx:34-45 | `getDayWorkflowStatus`, `getConfigHistory`, `buildPreflightSummary`, `resolveRigConstant`, `mergeDayMetadata` | REUSE those + EXTRACT caption/rig-constant strings (49-69) | Already fully delegated to pure helpers; only display labels are inline. |
| Inherited/default value display ("differs from current default") | EffectiveDayReview.tsx:66/68 | `resolveRigConstant(...).status === 'differs'` | REUSE `resolveRigConstant` (rigConstants) | Inherited/default decision already pure; only the text suffix is inline. |
| Section status (per-section ready/todo/error) | N/A — not computed on this surface | — | N/A | ValidationSummary works at DAY granularity (chips/lifecycle); section status lives on the Animal setup surfaces. |
| Next repair target (`repairTargetForIssue`) | N/A — not invoked here | — | N/A | Routes DAY-level repairs (remove/unlink/relink refs) + points to the Day Editor; per-issue repair routing is inside the Day Editor. |
| Animal-level vs day-level ownership (`ownershipForIssue`) | N/A — not invoked here | — | N/A | `validateDay` results surface only as warning ack labels (actions.ts:216); ownership/`reachesBeyondDay` not consulted here. |

### Contract gaps (ValidationSummary)

- Per-day status chip refinement (Ready-to-export / Validated / Exported / Re-link-to-export) — `DayRowViewModel.status: WorkflowSeverity` collapses ready/validated/exported all to `ready`, and can't express the orphan "Re-link to export" blocker — proposed: add `lifecycle?: 'ready'|'validated'|'exported'` and `exportEligibility?: 'eligible'|'blocked-needs-relink'` (or a `blockedReason?`) to `DayRowViewModel`.
- Batch preflight per-day scan (config version+historical, electrode groups, failed channels, cameras, opto, warnings[]) — no shared type holds this "what will this file contain" record — proposed: add `DayPreflightViewModel { dayId, label, configLabel, groups, failedChannels, cameras, opto, warnings: IssueViewModel[], error? }`.
- Recovery state on a row — `DayRowViewModel.recovery` is named but unshaped; needs status + ownerDescription + chosen repair — proposed: define `recovery: { status: DayStatus; ownerDescription?: string; repair?: WorkflowAction }`.
- Multiple per-day repair affordances (Open editor + Add to day list can coexist; missing-record offers only Remove reference) — proposed: confirm `DayRowViewModel.actions: WorkflowAction[]` is the carrier and `href` is the primary "open editor" link only.
- Validate-All / batch-export result messages + their five per-day report buckets (skipped/overridden/failed/stale/validate-error) — no shared field — proposed: add `BatchRunResult { message; reports: { kind; items: { dayId; subjectId; date; detail? }[] }[] }`.

### Duplication candidates (ValidationSummary)

- `buildAnimalDaysByKey` (validationSummaryRows.ts:157) re-derives the per-animal ok-only date-sorted day-record list — the same set `getAnimalDays` returns and the Day Editor threads into its export gate. Risk of drift if sort/filter rules diverge → see [Domain gaps](#domain-gaps).
- `deriveChip(computeStepStatus(...))` runs in BOTH validationSummaryRows.ts:233 (render row) and useValidationSummaryActions.ts:309 (export-confirm re-validate). Same fn, intentional fresh-read at confirm — not accidental.
- `describeDayOptoState(merged).label` computed at rows.ts:254 (scan) and actions.ts:213 (preflight). One row/preflight builder removes the repetition.
- `describeConfigVersionLabel` invoked from three surfaces — already one shared helper (no logic drift) but the surrounding scan-cell markup is duplicated between the scoped `<details>` and unscoped `<span>` branches.
- Lifecycle persistence `{...prevState, <flag>}` appears for `validated` (actions.ts:145) and `exported` (actions.ts:357) — candidate for one `setDayLifecycleFlag` command.

---

## AnimalWorkspace

Files: `src/pages/AnimalWorkspace/index.tsx`, `AnimalSetupCard.tsx`, `DayList.tsx`,
`RecordingDaysTab.tsx`, `ExistingDataReview.tsx`, `DuplicateDayModal.tsx`

| Decision | Where computed today (file:line) | Inputs it reads | Target home | Notes |
| --- | --- | --- | --- | --- |
| Animal card day-count (records present, indexed + recovered) | index.tsx:174 | animalId, animal, days | REUSE `getPresentDayCount` (dayRecovery) | `{n} day/days` plural is EXTRACT (next row). |
| Day-count pluralization "day"/"days" | index.tsx:184; ExistingDataReview.tsx:53 | dayCount | EXTRACT buildAnimalCardViewModel / buildExistingDataReviewViewModel | Same plural rule in two files (see Duplication). |
| Empty-state vs picker selection (has any animals) | index.tsx:39,126 | animalIds.length | EXTRACT buildAnimalPickerViewModel | `hasAnimals` gate; empty-state copy + create/import affordances vs list. |
| Create/import affordances (empty-state + header buttons) | index.tsx:131-145,151-168 | showCreate, hasAnimals | EXTRACT buildAnimalPickerViewModel (actions[]) | Pure label/href/handler assembly → WorkflowAction list. |
| Per-card overflow menu items (Open / Edit profile / Delete) | index.tsx:190-208 | animalId | EXTRACT buildAnimalCardViewModel (actions[]) | Open is href-like (`#/animal/:id/days`); Edit/Delete are intents. |
| Handshake redirect `?animal=<id>` → days route | index.tsx:88-98 | hash query, animals | EXTRACT (router/effect) | Validity check `animals[animalParam]`; navigation, not a write. |
| Handshake `?create=1` → open create panel | index.tsx:102-105 | hash query | EXTRACT (router/effect) | Opens local UI state; transient param stripped. |
| Create animal from inline form (dup-id guard, then navigate) | index.tsx:73-82 | formData, animals | COMMAND createAnimal | `buildAnimalFromForm` (domain/animalCreation) REUSE; write + nav is the command. |
| Delete animal (guarded) | index.tsx:62-66 | pendingDeleteAnimalId | COMMAND deleteAnimal | Type-to-confirm dialog. |
| Edit profile / update animal subject | index.tsx:231 | pendingProfileAnimalId, subject | COMMAND updateAnimal | |
| Per-section setup status: blocking vs todo vs done | AnimalSetupCard.tsx:46,71-75 | animal, days, section.key | REUSE `getAnimalBlockingSections` + `getAnimalSectionStatus` + `SECTION_STATUS` | Tri-state is reuse; the label/verb/modifier mapping is EXTRACT (next rows). |
| Section stateLabel ("Needs fixing"/"To do"/"Done") | AnimalSetupCard.tsx:75 | blocking, todo | EXTRACT buildSetupCardSection (→ SectionViewModel.status/label) | Severity maps: blocking→error, todo→todo, done→ready. |
| Section actionVerb ("Fix"/"Set up"/"Review") + href | AnimalSetupCard.tsx:76,91,94 | blocking, todo, animalId, section.key | EXTRACT buildSetupCardSection (→ SectionViewModel.action) | href `#/animal/:id/:section`; aria-label `${verb} ${label}`. |
| Section row CSS modifier (blocking/todo/done) | AnimalSetupCard.tsx:79-83 | blocking, todo | EXTRACT buildSetupCardSection (status drives className) | Presentational; derivable from status. |
| Setup-card static section list (keys/labels/hints) | AnimalSetupCard.tsx:15-20 | (constant) | EXTRACT (config constant in builder) | 4 sections + hints. |
| "Copy from another animal…" affordance shown | AnimalSetupCard.tsx:55; RecordingDaysTab.tsx:335 | hasOtherAnimals (>0) | EXTRACT buildSetupCardViewModel | `hasOtherAnimals` computed in RecordingDaysTab.tsx:335; consumed in card. |
| Whether to show the setup card (animal not "established") | RecordingDaysTab.tsx:348-349 | subject_id present, dayCount>0 | EXTRACT buildRecordingDaysViewModel (showSetupCard) | `getAnimalSubject` REUSE; "established" composite is EXTRACT. |
| Whether to show existing-data review state | RecordingDaysTab.tsx:354-359 | rawIssues, daysCorrupt, orphan/wrongOwner counts | EXTRACT buildRecordingDaysViewModel (showReview) | `validateRawAnimal` REUSE; the OR-composite is EXTRACT. |
| Day classification (ok / dangling / recovered / wrong-owner) | RecordingDaysTab.tsx:116-119 | selectedAnimalId, animal, days | REUSE `classifyAnimalDays` (dayRecovery) | Memoized; feeds DayList, counts, review. |
| Exportable OK day records, date-sorted (bad-channel context) | RecordingDaysTab.tsx:132-139 | classification | EXTRACT buildRecordingDaysViewModel (derived list) | Filter OK + sort by date; passed to getDayRowStatus per row → see [Domain gaps](#domain-gaps). |
| Orphan / wrong-owner day-id lists | RecordingDaysTab.tsx:140-147 | classification | REUSE `classifyAnimalDays` (filter by DAY_STATUS) | Filtering on domain status constants. |
| Corrupt days-index detection | RecordingDaysTab.tsx:109-110 | animal.days not array | EXTRACT buildRecordingDaysViewModel (daysCorrupt) | Inline `!Array.isArray` shape check → candidate to fold into dayRecovery ([Domain gaps](#domain-gaps)). |
| Present-day count (records, not index length) | RecordingDaysTab.tsx:343 | classification, isPresentRecordStatus | REUSE `isPresentRecordStatus` (dayRecovery) | Count assembly EXTRACT; predicate reuse. |
| Config-history count | RecordingDaysTab.tsx:344 | selectedAnimal | REUSE `getConfigHistory` (workspaceSelectors) | `.length` trivial EXTRACT. |
| Existing-days list for calendar collision guard | RecordingDaysTab.tsx:264-275 | classification, isPresentRecordStatus | REUSE `isPresentRecordStatus` + `classifyAnimalDays` | Maps present records → dates. |
| Carry-forward source = most recent day | RecordingDaysTab.tsx:105 | selectedAnimal, days | REUSE `getMostRecentDayId` (workspaceSelectors) | Drives toggle visibility + create payload. |
| Carry-forward toggle default / visibility | RecordingDaysTab.tsx:94,381-391 | mostRecentDayId, carryForward | EXTRACT buildRecordingDaysViewModel | Default ON; hidden when no prior day. |
| Per-day-row status → variant + label | DayList.tsx:172,180-191 | animal, rec, mergedDay, animalDays | REUSE `getDayRowStatus` (workflowStatus) | Lifecycle reuse; orphan-override + humanize are EXTRACT (next rows). |
| Merge day metadata for status (try/catch → null on corrupt) | DayList.tsx:165-171 | animal, rec | REUSE `mergeDayMetadata` (workspaceUtils) | Throw caught; `getDayRowStatus(…, null)` yields needs-fixing. Error→null handling is EXTRACT. |
| Orphan "claims export ready" override → "Re-link to export" | DayList.tsx:180-187 | rowStatus.variant, isOrphan, DAY_LIFECYCLE | EXTRACT buildDayRowViewModel | Maps READY/VALIDATED/EXPORTED on an orphan → DRAFT "Re-link to export". |
| Humanize "Needs fixing — {reason}" label | DayList.tsx:24-31,191 | displayStatus.label | REUSE `humanizeValidationMessage` | The split/prefix wrapper (`humanizeNeedsFixingLabel`) is display-only EXTRACT around the reuse. |
| Day-row recovery branch (dangling / wrong-owner / ok / orphan render) | DayList.tsx:96,121,147,225 | status (DAY_STATUS) | REUSE `DAY_STATUS` (dayRecovery) | Branch keyed on domain status; per-branch copy/actions EXTRACT (→ DayRowViewModel.recovery). |
| Wrong-owner "Belongs to {owner}" copy | DayList.tsx:128,137 | record.animalId | REUSE `describeOwner` (dayRecovery) | Owner label reuse; surrounding sentence EXTRACT. |
| Session-description preview (present-only, trimmed) | DayList.tsx:153,156-159 | rec, getDaySession | REUSE `getDaySession` (workspaceSelectors) | Trim/present-only EXTRACT (→ DayRowViewModel.sessionDescription). |
| Per-row actions: Duplicate / Delete (OK rows only) | DayList.tsx:225-251 | status===OK, date, dayId, session, dayHasArtifacts | EXTRACT buildDayRowViewModel (actions[]) | `dayHasArtifacts` REUSE; only OK rows get these. |
| Unlink wrong-owner day (repair) | DayList.tsx:136; RecordingDaysTab.tsx:446 | animalId, dayId | COMMAND unlinkDayReference | Dispatched to store action. |
| Create day(s) from calendar (batch, dup guard, carry-forward) | RecordingDaysTab.tsx:220-254 | dates, days, mostRecentDayId, carryForward | COMMAND createDay | sessionId/dayId derivation + per-day carry-forward payload. |
| Duplicate day (collision guard + store throw surfacing) | RecordingDaysTab.tsx:183-201 | source, duplicateDate, getExistingDays | COMMAND duplicateDay | Collision check vs existing dates; error surfaced in DuplicateDayModal. |
| Delete day (owner passed explicitly) | RecordingDaysTab.tsx:152-160 | pendingDeleteDay, selectedAnimalId | COMMAND deleteDay | Owner named because corrupt-import record may lack animalId. |
| Delete-day confirm message + downloaded-artifacts caveat | RecordingDaysTab.tsx:455-467 | pendingDeleteDay.hasArtifacts, DOWNSTREAM_NOT_DELETED_NOTE | EXTRACT (message assembly) | `DOWNSTREAM_NOT_DELETED_NOTE` REUSE (animalDeleteCascade); composition EXTRACT. |
| Copy-from-animal apply (append + re-normalize per section) | RecordingDaysTab.tsx:286-328 | payload, selectedAnimal | COMMAND copyFromAnimal (→ updateAnimal) | `getAnimal*` selectors + `normalize*` REUSE; merge-and-write is the command. |
| Raw-shape repair execute in place | RecordingDaysTab.tsx:208-215 | issue.repairCommand, selectedAnimal | COMMAND applyRepairCommand | `applyRepairCommand` (state/repairCommands) executor. |
| Existing-data review lead copy (corrupt vs clean) | ExistingDataReview.tsx:56-59 | hasCorruption | EXTRACT buildExistingDataReviewViewModel | Branch on corruption flag. |
| Corrupt-days note + orphan/wrong-owner notices (pluralized) | ExistingDataReview.tsx:64-92 | daysCorrupt, orphanDayIds, wrongOwnerDayIds | EXTRACT buildExistingDataReviewViewModel (notices[]) | Several plural branches; href `#/animal/:id/export`. |
| Corrupt-index → can't-show-days empty state | DayList.tsx:72-85 | classification.length, daysCorrupt | EXTRACT buildDayListViewModel (empty-state) | Two empty copies: corrupt vs "No recording days yet". |
| Duplicate-day modal copy + error display | DuplicateDayModal.tsx:54-73 | source, date, error | EXTRACT (presentational) | Pure render; error string set by COMMAND duplicateDay. |
| Animal-level vs day-level ownership (wrong-owner / orphan attribution) | DayList.tsx:128,137; RecordingDaysTab.tsx:152-160 | record.animalId, classification (DAY_STATUS) | REUSE `describeOwner` + `classifyAnimalDays` (dayRecovery) | "Belongs to {owner}" copy + unlink/relink repair; delete-day names the owner explicitly because a corrupt-import record may lack `animalId`. |
| Export readiness (animal-level / batch gate) | N/A — links to `#/animal/:id/export`; never derives export readiness here (DayList.tsx:104,180-187 only read per-row lifecycle) | — | N/A | Whole-animal/batch export gate lives on the Export surface. |
| Inherited/default values | N/A — only `carryForward` seeding + copy-from-animal append; device defaults REUSE `normalize*` | — | N/A | Carry-forward is a create-payload option, not a value derivation. |
| Button enabled/disabled reasons | N/A — no control disabled-with-reason; dup-id/collision guards silently no-op or surface inline error | — | N/A | `WorkflowAction.disabledReason` unused here. |

### Contract gaps (AnimalWorkspace)

- Corrupt days-index detection (RecordingDaysTab.tsx:109-110) — no domain function returns this — proposed: a `daysIndexCorrupt` flag on the VM **and** a `getDaysIndexStatus` in dayRecovery so the builder doesn't re-implement the shape guard (this is also a [Domain gap](#domain-gaps)).
- Orphan "Re-link to export" override (DayList.tsx:180-187) — no field marks "valid metadata, not exportable until re-linked" distinct from the lifecycle variant — proposed: `DayRowViewModel.exportEligibility: 'eligible' | 'blocked-needs-relink'` (same gap as ValidationSummary).
- Setup-card actionVerb "Fix"/"Set up"/"Review" (AnimalSetupCard.tsx:76) — `SectionViewModel.action` carries a `label` but not an explicit verb/intent — proposed: add `action.intent: 'fix' | 'setup' | 'review'` to `SectionViewModel`.
- Day-row recovery copy (DayList.tsx:96-145) — `DayRowViewModel.recovery` unshaped — proposed: `recovery: { status: DAY_STATUS; message: string; repair?: WorkflowAction }` (same gap as ValidationSummary; align the shapes).
- Delete-day artifacts caveat (RecordingDaysTab.tsx:462) — no VM field for "this delete has downstream-not-deleted consequences" — proposed: add `confirmCaveat?: string` (or `warnsDownstream: boolean`) to the delete `WorkflowCommand`/action.

### Duplication candidates (AnimalWorkspace)

- Day-count pluralization "day"/"days" computed in index.tsx:184, ExistingDataReview.tsx:53, and DayList copy — one helper/field.
- Present-day count derived two ways: index.tsx:174 via `getPresentDayCount`; RecordingDaysTab.tsx:343 via `classification.filter(isPresentRecordStatus).length`. Should agree but computed independently.
- `hasOtherAnimals` (RecordingDaysTab.tsx:335) vs `hasAnimals` (index.tsx:39) — both inline animal-map cardinality checks.
- Export-tab href `#/animal/:id/export` repeated in DayList.tsx:104, ExistingDataReview.tsx:78,102 — route helper / VM `href` would dedupe.

---

## AnimalView

Files: `src/pages/AnimalView/index.tsx`, `ConfigVersionContext.tsx`, `SectionNav.module.css` (the
section-nav is rendered **inline in index.tsx** — there is no standalone `SectionNav.tsx`; the
DayEditor's separate `DayEditorSectionNav.tsx` was read for the duplication comparison),
`src/domain/sectionStatus.ts`

| Decision | Where computed today (file:line) | Inputs it reads | Target home | Notes |
| --- | --- | --- | --- | --- |
| SECTION_GROUPS structure (grouped tab keys + labels, display order) | index.tsx:70-88 | static literal | EXTRACT buildAnimalSectionViewModels (groups) | Drives nav order + `TAB_LABEL`. Mirrored as `key`/`label` of `SectionViewModel`. |
| TAB_LABEL map (tab key → display label) | index.tsx:91-93 | SECTION_GROUPS | EXTRACT buildAnimalSectionViewModels | Reused as panel `aria-label` + placeholder heading. |
| Per-tab status ring: blocking (red ●) | index.tsx:515 (`blockingSections.has`), memo 279-284 | `getAnimalBlockingSections(animal, days)` | REUSE `getAnimalBlockingSections` (sectionStatus.ts:131) | Builder calls it; maps to `severity:'error'`. |
| Per-tab status ring: todo (hollow ○) | index.tsx:516-517 | `getAnimalSectionStatus`, SECTION_STATUS.TODO, `!isBlocking` | REUSE `getAnimalSectionStatus` + `SECTION_STATUS` (sectionStatus.ts:92,27) | The `!isBlocking &&` precedence is the EXTRACT part. |
| Status-ring precedence (blocking outranks todo → severity) | index.tsx:513-517 | isBlocking, isTodo | EXTRACT buildAnimalSectionViewModels (status) | Collapses two booleans to one `status`. No neutral 'todo' ring distinct from 'warning' (gap). |
| Per-tab `aria-label` ("— blocks export" / "— not set up") | index.tsx:518-522 | isBlocking, isTodo, item.label | EXTRACT buildAnimalSectionViewModels (summary/label) | Display label assembly inline. |
| Active-tab resolution (which item is current) | index.tsx:512 (`tab === item.key`), aria-current 528 | `tab` prop, item.key | EXTRACT buildAnimalSectionViewModels (or keep in component) | `tab` resolved upstream by parseHashRoute (not in file). |
| URL canonicalization (bare/unknown `:tab` → replaceState) | index.tsx:393-400 | hash, animalId, tab | EXTRACT (router effect — `history.replaceState`, not a store write) | Side-effecting history write; rule lives in parseHashRoute (out of file). |
| `?field=` repair anchor matching (requested field → owning section anchor) | index.tsx:357-362, normalizeFieldPath 119-120, TAB_FIELD_ANCHOR 108-114 | `routeContext.field`, `data-field-path` DOM attrs, TAB_FIELD_ANCHOR | EXTRACT resolveFieldAnchorTab + REUSE `animalSetupTabForFieldPath` (used sectionStatus.ts:153) | App-local normalize+match duplicates the domain `animalSetupTabForFieldPath` — see Duplication + [Domain gaps](#domain-gaps). |
| `?field=` scroll + transient highlight + focus-first-control | index.tsx:350-385 | matched DOM element, `repair-target-highlight` | EXTRACT (view effect, stays in component) | DOM side-effect; the which-section decision is the extractable part. |
| Section status (todo/none per setup section) | sectionStatus.ts:92-97 (called index.tsx:517) | SETUP_SECTION_IS_CONFIGURED, selectors | REUSE `getAnimalSectionStatus` | Already pure. |
| Export readiness / blocking vs warning | index.tsx:282 (blockingSections) + 294-295 (`r.chip === 'valid'`) | getAnimalBlockingSections; buildAnimalRows | REUSE `getAnimalBlockingSections` (domain); `buildAnimalRows` is **page-local** (validationSummaryRows.ts) → Phase-2a builder owns it (EXTRACT/promote), not a domain dependency | Reads error-severity blockers + "N ready"; full readiness in ValidationSummary. Warning-severity sections NOT surfaced (gap). |
| Next repair target | N/A — delegates repair to `<ValidationSummary animalKey>` (index.tsx:195) + `handleRepair` (270,503) | — | REUSE `repairTargetForIssue` (inside sectionStatus.ts:150) | Repair routing owned by ValidationSummary + useAnimalFieldUpdate. |
| Section count: days ("N") | index.tsx:293 | `getPresentDayCount(animalId, animal, days)` | REUSE `getPresentDayCount` (dayRecovery) | Memo 291-311. |
| Section count: export ("N ready") | index.tsx:294-296 | `buildAnimalRows`, `r.chip==='valid'` | EXTRACT/promote (`buildAnimalRows` is page-local; Phase-2a owns it) | The `.filter(chip==='valid').length` reduction is the small EXTRACT. |
| Section counts: setup sections (electrode-groups/recording-system/cameras) | index.tsx:300-302 | `getAnimalSetupCounts(animal)` | REUSE `getAnimalSetupCounts` (sectionStatus.ts:108) | Already pure. |
| Section count: optogenetics ("used"/"incomplete") | index.tsx:308-309 | `getAnimalOptoCompleteness(animal)`, OPTO_COMPLETENESS.COMPLETE | REUSE `getAnimalOptoCompleteness` + `OPTO_COMPLETENESS` (sectionStatus.ts:56,37); EXTRACT the COMPLETE→'used'/else→'incomplete' label | Count slot suppressed for NONE (todo ring owns it); label assembly inline. |
| Opto "Not used — no stimulation" neutral chip (valid empty state) | index.tsx:217-226 | `getAnimalOptoCompleteness === NONE` | REUSE `getAnimalOptoCompleteness` + EXTRACT chip text | Keyed to NONE specifically (PARTIAL is "incomplete"). |
| Per-tab scope sentence (TAB_SCOPE) | index.tsx:54-64, rendered 563-567 | static literal | EXTRACT buildAnimalSectionViewModels (summary) | Display copy; only extracted tabs have entries. |
| Per-tab field anchor (TAB_FIELD_ANCHOR for `data-field-path`) | index.tsx:108-114, rendered 569 | static literal | EXTRACT (anchor map) | Coarse per-tab anchor; pairs with the `?field=` matcher. |
| Inherited/default values | N/A — AnimalView reads animal-owned setup directly; day-level carry-forward lives in DayEditor/mergeDayMetadata | — | REUSE `mergeDayMetadata` (transitively, inside getAnimalBlockingSections) | — |
| Animal-level vs day-level ownership | index.tsx:282 filters via `repairTargetForIssue(issue).surface !== 'animal'` inside getAnimalBlockingSections (sectionStatus.ts:150) | issue → ownership surface | REUSE `repairTargetForIssue` / `ownershipForIssue` | AnimalView only consumes the `'animal'`-surface result set. |
| Button enabled/disabled reasons | N/A — ⋮ menu items always enabled (index.tsx:468-482); export-disable lives in ValidationSummary/ExportStep | — | N/A | No `disabledReason` produced. |
| Unsaved-edit nav guard: intercept decision | index.tsx:154-160 `shouldInterceptNavDiscard` (exported pure), called 438 | targetKey, currentTab, pendingEdits, event modifiers/button | EXTRACT/relocate (page-local pure fn → domain; see D5) | Already a pure exported fn; move out of the component file. |
| Discard-and-navigate (write/intent) | index.tsx:444-449 `confirmDiscardAndNavigate` + 440 | pendingNavTab, animalId | EXTRACT (router + clears local pending-edit view-state — not a store write) | Sets `window.location.hash`; inline handler. |
| Empty/corrupt recovery: animal-not-found | index.tsx:402-425 | `animal` null check (synchronous hydrate) | EXTRACT (render branch) | "animal missing → not-found escape"; no async loading state. |
| Empty/corrupt recovery: raw-collection corruption banner | index.tsx:100 (CORRUPTION_BANNER_FIELDS), rendered 500-504 | animal raw fields cameras/data_acq_device/configurationHistory | EXTRACT (banner owns its decision) + COMMAND handleRepair | Banner above panels so a sibling tab's corruption isn't hidden. |
| Reconfiguration context banner placement | index.tsx:490-494 | `useReconfigContext()` routeContext, animal, days | EXTRACT (component effect — `useReconfigContext` is a React hook, not builder-consumable) | Banner owns its render decision. |
| ConfigVersionContext history line assembly | ConfigVersionContext.tsx:21-44 (render-null 24, sort 25, sentence 38-41) | `getConfigHistory(animal)` | REUSE `getConfigHistory` + EXTRACT describeConfigBoundary (sentence) | <2 versions → render nothing; per-boundary sentence is inline display. |
| Field update / repair persistence | index.tsx:270 (`useAnimalFieldUpdate`), used 503/575/596 | animalId, field, value, issue.repairCommand | COMMAND updateAnimalField / applyRepair (useAnimalFieldUpdate.ts:17,22) | Already a hook; write intent maps to WorkflowCommand. |

### Contract gaps (AnimalView)

- Todo (hollow ○) ring — `'todo'` IS in `WorkflowSeverity`, but `SectionViewModel.status` needs to render it **neutral** (color-free), distinct from `warning` — proposed: document that `SectionViewModel.status: 'todo'` renders neutral (no warning color).
- Blocking-with-count vs todo-hides-count — a section can be blocking (●) AND carry a count, while todo hides the count — proposed: add `SectionViewModel.showCount: boolean` (or nullable `issueCount?` with "suppress for todo").
- Opto count semantics ("used"/"incomplete"/suppressed) — `issueCount:number` can't hold the non-numeric opto count nor the COMPLETE/PARTIAL/NONE→label mapping — proposed: add `SectionViewModel.countLabel?: string` (pre-rendered token) so opto's "used"/"incomplete" and "N ready"/"N" flow through one field.
- Per-tab scope sentence (TAB_SCOPE) — no field for the under-heading framing line — proposed: add `SectionViewModel.scope?: string`.
- Field anchor (TAB_FIELD_ANCHOR / `data-field-path`) — no home in any contract type — proposed: add `SectionViewModel.fieldAnchor?: string`.
- Nav-discard guard — reads raw mouse-event modifiers; no contract type expresses "modified/non-primary click falls through" — proposed: a `NavDiscardDecision { intercept: boolean }` (or fold into command preconditions).
- Warning-severity sections — this surface computes only error (●) + todo (○) + none; NO warning (amber) section state exists even though `WorkflowSeverity` includes `'warning'` — proposed: note in shared-contracts that AnimalView's ring is currently error|todo|none; a future amber ring needs a `getAnimalWarningSections` analog (a [Domain gap](#domain-gaps) if pursued).

### Duplication candidates (AnimalView)

- `?field=` → owning-tab resolution done two ways: app-local `normalizeFieldPath` + `TAB_FIELD_ANCHOR` DOM matching (index.tsx:108-120,357-362) vs the domain `animalSetupTabForFieldPath` (sectionStatus.ts:153 for blocking attribution). The dot's tab and the deep-link's tab use different mappings — drift risk.
- Section-nav rendering: inline in AnimalView (index.tsx:507-555) vs the parallel `DayEditorSectionNav.tsx` — `<a href>` vs `<button onNavigate>`, 2-signal ●/○ vs 4-state ✓/⚠/✗/○, different status vocabularies (`SECTION_STATUS` vs `StepStatus`). Not unified.
- Opto completeness: `getAnimalOptoCompleteness` is one source but deliberately re-implements the export gate's `partial_configuration` four-field rule via shared `optoFieldsPresence`. Shared predicate (not a true dup) — flagged because nav count + setup-card status + export gate all depend on it staying authoritative.

---

## DayEditor

Files: `src/pages/DayEditor/index.tsx`, `DayEditorContext.tsx`, `DayEditorStepper.tsx`,
`OverviewStep.tsx`, `ValidationStep.tsx`, `BadChannelsEditor.tsx`, `Breadcrumb.tsx`,
`IssueOwnershipHint.tsx`, `RepairActions.tsx`, `ReadOnlyField.tsx`, `stepGate.ts`, `validation.ts`,
`ExportStep.tsx`, `MalformedCollectionNotice.tsx`, `OverrideCleanupSection.tsx`,
`ConfigVersionPanel.tsx`, `DayEditorSectionNav.tsx`

Sub-slices for Phase 2d (per [phase-2d](phase-2d-day-editor-vm.md)): **2d-1** shell / steps / breadcrumb ·
**2d-2** overview field sources (inherited/default) · **2d-3** issues / repair / export gate ·
**2d-4** bad-channel monotonicity / ack.

| Decision | Where computed today (file:line) | Inputs it reads | Target home | Notes (sub-slice) |
| --- | --- | --- | --- | --- |
| Per-step status map (overview/devices/epochs/behavioral/validation/export → valid/incomplete/error/pending) | DayEditorStepper.tsx:196-208 | day, mergedDay, animal, animalDays | REUSE `computeStepStatus` (domain/validation) | 2d-1 Inline only is the fail-closed fallback (all `incomplete`, export `error`) when day/mergedDay missing → EXTRACT `buildDayStepStatusVM`. |
| Fail-closed step-status when day/merge unavailable | DayEditorStepper.tsx:197-206 | day, mergedDay (null-checks) | EXTRACT `buildDayStepStatusVM` | 2d-1 Hand-written literal; should be the builder's null branch. |
| To-fix count badge on Validation nav item | DayEditorStepper.tsx:213-218 | day, mergedDay, animal, animalDays | EXTRACT `buildDayStepStatusVM` (issueCount) — REUSE `validateDay` | 2d-1 Filters `validateDay` to `severity==='error'`; maps to `SectionViewModel.issueCount`. |
| Section nav glyph (✓/⚠/✗/○) per status | DayEditorSectionNav.tsx:85-92 `getStatusIcon` | StepStatus | EXTRACT `buildDayStepStatusVM` | 2d-1 Status→glyph mapping inline. |
| Section nav accessible status label (Complete/Incomplete/Has errors/Not started) | DayEditorSectionNav.tsx:99-106 `getStatusLabel` | StepStatus | EXTRACT `buildDayStepStatusVM` | 2d-1 Maps to a per-step `statusLabel`. No StepViewModel exists → contract gap. |
| Show "N to fix" count only on Validation item when >0 | DayEditorSectionNav.tsx:51-54 | item.id, toFixCount | EXTRACT `buildDayStepStatusVM` | 2d-1 Which section shows the count + "N to fix" phrasing is inline. |
| Active section / current step | DayEditorStepper.tsx:105,470; DayEditorSectionNav.tsx:48 | local `currentStep` state | EXTRACT (local view-state — not a store write) | 2d-1 Local UI state; nav writes are an intent (free navigation, no gating). |
| Section pager next/prev enabled + ordering | DayEditorStepper.tsx:111-120,423-426 | stepOrderRef, currentStep | EXTRACT `buildDayStepStatusVM` (order) + EXTRACT (router/view-state nav — not a store write) | 2d-1 `hasPrev`/`hasNext` are `disabledReason` candidates; order array hard-coded twice (111 + 423). |
| Export readiness (ready vs blocked) on Validation summary | ValidationStep.tsx:62-63 | stepStatus | REUSE `isExportEnabled` + `exportBlockReason` (domain/stepGate) | 2d-3 The ✓/✗ + readiness CSS class (92-101) is EXTRACT. |
| Readiness message (Exported / Validated / Ready to export) | ValidationStep.tsx:69-79 | day.state via `lifecycleForValidDay` | REUSE `lifecycleForValidDay` + `DAY_LIFECYCLE`/`_LABEL` | 2d-3 Lifecycle reused; sentence templating EXTRACT `buildDayReadinessVM`. |
| Blocked-reason copy (incomplete-steps vs errors) | ValidationStep.tsx:96-101 | blockReason, errorCount | EXTRACT `buildDayReadinessVM` | 2d-3 Chooses between two block messages. |
| Summary counts line (N errors, N warnings, N notes) | ValidationStep.tsx:51-53,85-89 | issues (validateDay) bucketed | EXTRACT `buildDayIssuesVM` (counts) | 2d-3 Pluralization inline. |
| Authoritative export gate (download enabled/disabled) | ExportStep.tsx:113,124,332 | stepStatus, validationErrors, dayExportable | REUSE `isExportEnabled` + `validateDay` + `getAnimalDayIds` | 2d-3 `exportBlocked = errors>0 \|\| !gateOpen \|\| !dayExportable` is an AND of 3 reused predicates → EXTRACT `buildDayExportGateVM`. |
| Export blocked-reason text (validation errors vs required setup vs merge error vs not-in-index) | ExportStep.tsx:240-264 | mergeError, dayExportable, validationErrors.length | EXTRACT `buildDayExportGateVM` | 2d-3 Four distinct banner branches; each a `disabledReason`. |
| Step-status blockers list (which prereq step not 'valid', + owner=animal/day + field hint) | ExportStep.tsx:133-150 | stepStatus, merged.electrode_groups | EXTRACT `buildDayExportGateVM` (blockingSteps) | 2d-3 Devices-incomplete→animal-owner routing + `electrode_groups` field hint is inline; overlaps `getAnimalBlockingSections`. |
| Blocking-step button label (Fix in Animal Setup vs Fix in `{step}`) | ExportStep.tsx:282-284 | owner, STEP_LABELS | EXTRACT `buildDayExportGateVM` | 2d-3 `WorkflowAction.label`; reuses `STEP_LABELS`. |
| Export lifecycle status line (Validated/Exported/Ready) | ExportStep.tsx:234-238 | day.state via `lifecycleForValidDay` | REUSE `lifecycleForValidDay` + `DAY_LIFECYCLE_LABEL` | 2d-3 Same vocabulary as Validation readiness; label lookup inline. |
| Preflight summary (build when unblocked) | ExportStep.tsx:152-173 | merged, configVersion, isHistorical, warningCount | REUSE `buildPreflightSummary` + `resolveDayConfig` + `getDayWorkflowStatus` + `validateDay` | 2d-3 Assembled from 4 domain calls; "only when !exportBlocked" gating inline. |
| Download action (encoder-stability check, write, lifecycle persist) | ExportStep.tsx:175-221 | checkShadowExport, isFeatureEnabled, fileName, day.state | COMMAND `exportDay` | 2d-3 Hard-stop on `exportBlocked`; strict-mode block vs override; `updateDay({state:{...,exported:true}})`. |
| Issues grouped by severity (error/warning/info buckets) | ValidationStep.tsx:49,195-211 `groupBySeverity` | issues[].severity | EXTRACT `buildDayIssuesVM` | 2d-3 Unknown severity → info; maps to `IssueViewModel[]` partition. |
| Issues grouped by workflow category within severity | ValidationStep.tsx:141; RepairActions.tsx:115 | issues | REUSE `groupIssuesByWorkflowCategory` (domain/workflowCategories) | 2d-3 Used in two surfaces identically. |
| Which issues get a repair action (error-severity only) | ValidationStep.tsx:143,172; RepairActions.tsx:93 | severity, onNavigate | EXTRACT `buildDayIssuesVM` | 2d-3 "errors block → only errors get repair/ownership hint" gating inline in 2 places. |
| Is an issue repairable (has editable target) | RepairActions.tsx:26-28 `isRepairable` | issue via `repairTargetForIssue` | REUSE `repairTargetForIssue` (domain/repairRouting) | 2d-3 Maps to `IssueViewModel.repair` presence. |
| Repair button dedup key | RepairActions.tsx:40-47 `repairButtonKey` | repairTargetForIssue, issue.repairCommand/focusPath/path | EXTRACT `buildDayIssuesVM` | 2d-3 Collapses duplicate buttons; (surface,step,focus,command) key is reusable. |
| Repair target / route (animal vs day step, label, focusPath) | RepairActions.tsx:154-194 | issue via `repairTargetForIssue` | REUSE `repairTargetForIssue` | 2d-3 `navTarget` + `focusTarget` selection is thin EXTRACT over reuse. |
| Execute repair command vs navigate (button mode) | RepairActions.tsx:164-176; DayEditorStepper.tsx:353-379 | issue.repairCommand, onRepair | COMMAND `applyRepair` | 2d-3 Routes through `applyRepairCommand`; stepper assembles `RepairCommandContext`. |
| Repair-routed navigation + field focus (skip-section-focus, focus token) | DayEditorStepper.tsx:255-311; handleStepNavigate | target, fieldPath, ownerKey | EXTRACT (router + focus effect — not a store write; the repair *write* is the separate `applyRepair` row) | 2d-3 `'animal'` target → builds animal hash via `animalSetupTabForFieldPath` (REUSE); else sets currentStep + focusRequest. |
| Issue ownership pattern + reachesBeyondDay flag | IssueOwnershipHint.tsx:24-32 | issue via `ownershipForIssue` | REUSE `ownershipForIssue` (domain/workflowOwnership) | 2d-3 Maps to `IssueViewModel.ownership` + `reachesBeyondDay`. |
| Bad-channel un-mark monotonicity blocker (prior-bad, needs confirm) | BadChannelsEditor.tsx:104-105,151-154,234-237 `isPriorBadUnmark` | priorBadByNtrode[key], channel | REUSE `badChannelMonotonicity` (priorBadByNtrode computed there) | 2d-4 Decision reads a precomputed prop; deferring behind confirm is COMMAND `unmarkBadChannel` (with ack). |
| Bad-channel mark/un-mark write (single-shank) | BadChannelsEditor.tsx:145-156 `toggleMark` | badChannels[key], channelNum, isChecked | COMMAND `setBadChannels` | 2d-4 `toggleMark` REUSE (domain/badChannels); `onUpdate` write is the intent. |
| Bad-channel acknowledge-removal (off-export ack) | BadChannelsEditor.tsx:111-116 `confirmPendingUnmark` | pendingUnmark, onAcknowledgeRemoval | COMMAND `acknowledgeBadChannelRemoval` | 2d-4 Writes `day.state.badChannelRemovalAcks`; confirm dialog gating component-local. |
| Multi-shank probe-wide bad-channel migration + atomic batch write | BadChannelsEditor.tsx:120,187-255 | deviceType, ntrodes, badChannels via `buildProbeWideBadChannelMap`/`isMultiShankGroup` | REUSE `badChannels` (build/isMultiShank/probeElectrodeIdSet) + COMMAND `setBadChannels` (batch) | 2d-4 Decision logic REUSE; `onBatchUpdate` is the COMMAND (single atomic write to avoid race). |
| Invalid (out-of-range/non-integer) bad-channel marks → removal control | BadChannelsEditor.tsx:244,373 `invalidBadChannelMarks` | currentBadChannels, probeIdSet/channels | REUSE `invalidBadChannelMarks` (domain/badChannels) | 2d-4 Detection REUSE; per-value removal is COMMAND `removeInvalidBadChannelMark`. |
| Later-row corruption notice (multi-shank consolidation flag) | BadChannelsEditor.tsx:202-205 `hasLaterRowCorruption` | badChannels per later ntrode | EXTRACT `buildBadChannelsVM` | 2d-4 Inline `.filter(len>0)` over later rows; status flag for the migration notice. |
| Bad-channel error/warning per ntrode display | BadChannelsEditor.tsx:193,374-375 | errors[key], warnings[key] (props) | EXTRACT `buildBadChannelsVM` | 2d-4 Severities arrive as props; per-ntrode display partition inline. |
| Overview inherited-value display: session weight (day value vs animal baseline fallback vs none) | OverviewStep.tsx:258-277 | session.weight, subject.weight | EXTRACT `buildOverviewFieldsVM` | 2d-2 Three-way help text + placeholder by source. **No inherited/default field VM type exists → contract gap.** Reads via `getDaySession`/`getAnimalSubject` (REUSE). |
| Overview inherited-value display: experiment_description (day vs animal fallback) | OverviewStep.tsx:222 | session.experiment_description, animal.experiment_description | EXTRACT `buildOverviewFieldsVM` | 2d-2 `defaultValue` falls back to animal value inline; same inherited/default pattern. |
| Overview read-only inherited fields (Session ID derived, Subject ID/Sex/Genotype, experimenter/lab/institution) | OverviewStep.tsx:181-185,329-331,407-418; ReadOnlyField.tsx:24-46 | session, subject, experimenters, derived `ownerKey_dayDateKey` | EXTRACT `buildOverviewFieldsVM` | 2d-2 Session ID help is derived; ReadOnlyField is dumb. Inherited-vs-derived distinction is the gap. |
| Subject blast-radius copy ("updates all N days") | OverviewStep.tsx:63,322-324,309 | `getAnimalDayIds(animal).length` | EXTRACT `buildOverviewFieldsVM` | 2d-2 Count via REUSE `getAnimalDayIds`; the "Affects more than this day" framing parallels `reachesBeyondDay` — could reuse that field. |
| Species format validity (inline error) | OverviewStep.tsx:361-371 `isValidSpecies` | input value | REUSE `isValidSpecies` (validation/dandiSubject) | 2d-2 Decision REUSE; inline `speciesError` + write-through is COMMAND `updateSubjectField`. |
| Subject field write-through to animal | OverviewStep.tsx:343-346,370,392; DayEditorStepper.tsx:384-390 | field, value, ownerKey | COMMAND `updateSubjectField` | 2d-2 `handleSubjectUpdate` writes `animal.subject` via owner store key. |
| Day field write (nested path, intermediate repair) | DayEditorStepper.tsx:316-346 `handleFieldUpdate`; OverviewStep handleBlur | fieldPath, value, day | COMMAND `updateDayField` | 2d-2 Path-split + immutable nested write + corrupt-intermediate replacement is generic write plumbing. |
| Per-field on-blur validation (Overview) | OverviewStep.tsx:103-134; validation.ts:22-36 | mergedDay clone patched at exported path, fieldPath | REUSE `validateField` (validation/) | 2d-2 The nested→exported path remap (`session.` strip) is inline assembly → EXTRACT. |
| Focus-target expands inherited section during render | OverviewStep.tsx:86-94 | focusRequest.fieldPath startsWith `subject.` | EXTRACT (local view-state; focus effect — not a store write) | 2d-2 Adjust-state-from-props; the "subject.* → expand" decision is repair-routing driven. |
| Breadcrumb items (Workspace → Animal → Day) | OverviewStep.tsx:141-145; Breadcrumb.tsx | ownerKey, day.date | EXTRACT `buildDayBreadcrumbVM` | 2d-1 Item list assembled inline; Breadcrumb is dumb (last = current, no href). |
| Day-not-found / animal-not-found / no-day-id error states | DayEditorStepper.tsx:405-415 | dayId, day, animal, `describeOwner` | EXTRACT `buildDayEditorShellVM` | Recovery. `describeOwner` REUSE; three early-return messages inline. |
| Owner-key resolution (animalId vs indexing-animal fallback vs unresolved) | DayEditorStepper.tsx:134-159 | day.animalId, animalsMap, `getAnimalDayIds` | EXTRACT `resolveDayOwner` (REUSE-candidate selector) | Recovery. Mirrors dayRecovery WRONG_OWNER/orphan but reimplemented inline → [Domain gap](#domain-gaps). |
| Merge tolerance (corrupt animal config → null, fail closed) | DayEditorStepper.tsx:165-177; ExportStep.tsx:66-91 | animal, day via `mergeDayMetadata` | REUSE `mergeDayMetadata` | Recovery. try/catch + console.error + null/empty-stub fallback duplicated. |
| Malformed day-collection notice (tasks/etc loaded as non-array) | MalformedCollectionNotice.tsx:26-31; OverviewStep.tsx:152-158 | day[key] non-array, RAW_DAY_ARRAY_FIELDS | EXTRACT `buildDayRecoveryVM` + COMMAND `resetDayCollection` | Recovery. Detection inline; reset `onReset(key,[])` is the intent. Field list REUSE `RAW_DAY_ARRAY_FIELDS`. |
| Raw session-record corruption banner (reset session) | OverviewStep.tsx:164; RawCorruptionBanner.tsx | day, fields=['session'], onRepair | EXTRACT (shared `RawCorruptionBanner` component owns the render decision — a component, not domain truth; promote detection to domain if a builder needs it) + COMMAND `applyRepair` | Recovery. Decision in the shared banner; reset is a repairCommand. |
| Stale/malformed/shadowing deviceOverrides cleanup controls | OverrideCleanupSection.tsx:39,67 | day.deviceOverrides, resolvedNtrodeIds via `classifyDeviceOverrides` | REUSE `classifyDeviceOverrides` (domain/deviceOverrides) + COMMAND `removeDeviceOverride` | Recovery/2d-4. Classification REUSE; removals are intents; per-key label text EXTRACT. |
| Config-version pin warning + pin repair (unpinned day, multi-version animal) | ConfigVersionPanel.tsx:77,104-111 | day.configurationVersion, `getConfigHistory(animal)` | REUSE `getConfigHistory` + COMMAND `pinDayConfigVersion` | 2d-3 "warn iff version==null && history>1" inline; pin button `disabledReason` iff no selection. |
| Config-version latest/historical tag + applied-to-N copy | ConfigVersionPanel.tsx:60-75 | reconfig.isLatest, snapshot, appliedCount | EXTRACT `buildConfigVersionVM` | 2d-3 The latest/historical tag + help + applied-count copy is inline. |
| Save indicator status | DayEditorStepper.tsx:462; SaveIndicator | persistence | N/A — read-only display of store persistence; no severity/ownership decision | Driven by debounced autosave state. |
| Copyable DIO sources (seed blank first day) | DayEditorStepper.tsx:190-193 | model.workspace, ownerKey via `getCopyableDioSources` | REUSE `getCopyableDioSources` (workspaceSelectors) | Behavioral Events sub-editor input; no status decision in DayEditor itself. |

### Contract gaps (DayEditor)

- Stepper step status — no `StepViewModel` type; `SectionViewModel` lacks per-step `statusLabel`/glyph and nav order/active — proposed: add `StepViewModel { id; label; status: StepStatus; statusLabel; glyph; issueCount?; active; href? }` + ordered `steps: StepViewModel[]`.
- Overview inherited/default field display (weight day-vs-animal-baseline-fallback-vs-none; experiment_description; derived session_id) — no field-level inherited/default VM type — proposed: add `FieldValueViewModel { fieldPath; value; source: 'day' | 'inherited' | 'default' | 'derived'; inheritedFrom?; fallbackValue?; helpText?; readOnly }`.
- Export gate disabled reason — `WorkflowAction.disabledReason` is a flat string, but the gate has 4 distinct causes (validation errors / incomplete steps / merge error / not-in-day-index) each with its own copy and repair set — proposed: add `ExportGateViewModel { open; reason?: 'validation-errors' | 'incomplete-steps' | 'merge-error' | 'unlinked-day'; blockingIssues: IssueViewModel[]; blockingSteps: SectionViewModel[]; message }`.
- Bad-channel monotonicity blocker/ack — `IssueViewModel` carries the export-blocking `bad_channel_unfailed_without_ack` issue, but no VM expresses the *per-channel pending un-mark* state — proposed: add `BadChannelMarkViewModel { ntrodeId; channel; marked; priorBad; requiresAck; acked }` (or `confirmRequired`/`ackTarget` on the `unmarkBadChannel` command).
- Breadcrumb — no breadcrumb VM type — proposed: add `BreadcrumbViewModel { items: { label; href? }[] }` (Breadcrumb.tsx already consumes exactly this shape).
- Recovery / shell states (no-day-id, day-not-found, animal-not-found, owner-unresolved) — `DayRowViewModel.recovery` describes a day in a list, not the editor shell's load failure — proposed: add `DayEditorShellViewModel { state: 'ok' | 'no-day-id' | 'day-not-found' | 'animal-not-found'; message?; ownerKey? }`.
- Migration / cleanup notices (later-row bad-channel corruption, malformed collections, stale device overrides) — advisory non-issue states with a reset COMMAND, not severity-bearing `IssueViewModel`s — proposed: add `RecoveryNoticeViewModel { kind; message; repair: WorkflowCommand }[]`.

### Duplication candidates (DayEditor)

- Owner-key resolution (DayEditorStepper.tsx:134-159) reimplements the WRONG_OWNER/orphan partition `dayRecovery.classifyAnimalDays` already encodes — [Domain gap](#domain-gaps).
- Merge-tolerance fail-closed (try/catch `mergeDayMetadata` → fallback) duplicated DayEditorStepper.tsx:165-177 and ExportStep.tsx:66-91 with slightly different fallbacks (`null` vs `{}`).
- Export gate computed in three places — DayEditorStepper.tsx:213-218 (nav count), ValidationStep.tsx:62-63 (readiness), ExportStep.tsx:124 (download gate) — each re-runs `computeStepStatus`/`validateDay`/`isExportEnabled`. Intentional defense-in-depth; one VM builder guarantees they can't disagree.
- Repair-button dedup + workflow-category grouping implemented twice — ValidationStep.tsx:147-162 (`seenRepairKeys`) and RepairActions.tsx:90-98 (`seenTargets`) — parallel copies of the same helpers.
- Lifecycle readiness phrasing (`lifecycleForValidDay`) assembled in ValidationStep.tsx:69-79 and ExportStep.tsx:234-238 with different sentence templates around the same label.
- Invalid-bad-channel removal exists twice in BadChannelsEditor (single-shank :169-173 `onUpdate`, multi-shank :251-255 `onBatchUpdate`) — same intent, two write paths for the atomic-batch race.

---

## Consolidated contract gaps (the Phase-1 spec)

The single most valuable Phase-0 output: every place the [shared vocabulary](shared-contracts.md)
cannot express a real decision, deduplicated across surfaces. **These are the proposed
`shared-contracts.md` / `types.ts` changes Phase 1 must incorporate before the builders adopt the
types.** Each is a CONTRACT change (a new type/field); the separate [Domain gaps](#domain-gaps)
section lists rules a builder would otherwise have to reinvent.

| # | Gap | Surfaces | Proposed contract change |
| --- | --- | --- | --- |
| C1 | Day lifecycle distinction (`ready`/`validated`/`exported`) collapses under `WorkflowSeverity`; orphan "Re-link to export" unrepresentable | ValidationSummary, AnimalWorkspace | `DayRowViewModel.lifecycle?: 'ready' \| 'validated' \| 'exported'` + `exportEligibility?: 'eligible' \| 'blocked-needs-relink'` |
| C2 | `DayRowViewModel.recovery` named but unshaped | ValidationSummary, AnimalWorkspace | `recovery: { status: DayStatus; ownerDescription?: string; message?: string; repair?: WorkflowAction }` (align both surfaces) |
| C3 | Multiple per-day repair affordances (open + add-to-list; remove-only) | ValidationSummary | confirm `DayRowViewModel.actions: WorkflowAction[]` carries 0..N; `href` = primary open-editor link only |
| C4 | "What this file will contain" preflight record | ValidationSummary, DayEditor | `DayPreflightViewModel { dayId; label; configLabel; groups; failedChannels; cameras; opto; warnings: IssueViewModel[]; error? }` |
| C5 | Batch run result + per-day report buckets | ValidationSummary | `BatchRunResult { message; reports: { kind; items: { dayId; subjectId; date; detail? }[] }[] }` |
| C6 | Section action verb/intent separate from label | AnimalWorkspace, AnimalView | `SectionViewModel.action.intent?: 'fix' \| 'setup' \| 'review'` |
| C7 | `'todo'` must render **neutral**, distinct from `'warning'` | AnimalView | document `SectionViewModel.status: 'todo'` = neutral (no warning color) in shared-contracts |
| C8 | Count display varies (todo hides; opto is non-numeric "used"/"incomplete"; "N ready") | AnimalView | `SectionViewModel.countLabel?: string` (pre-rendered token) **and/or** `showCount?: boolean` / nullable `issueCount?` |
| C9 | Per-tab scope sentence | AnimalView | `SectionViewModel.scope?: string` |
| C10 | Per-tab field anchor for `?field=` deep-link | AnimalView | `SectionViewModel.fieldAnchor?: string` |
| C11 | Per-step view model (status + statusLabel + glyph + count + order + active) | DayEditor | `StepViewModel { id; label; status: StepStatus; statusLabel; glyph; issueCount?; active; href? }` + ordered `steps[]` |
| C12 | Field-level inherited/default/derived value display | DayEditor | `FieldValueViewModel { fieldPath; value; source: 'day' \| 'inherited' \| 'default' \| 'derived'; inheritedFrom?; fallbackValue?; helpText?; readOnly }` |
| C13 | Export gate with 4 distinct causes + blocking issues + blocking steps | DayEditor | `ExportGateViewModel { open; reason?: 'validation-errors' \| 'incomplete-steps' \| 'merge-error' \| 'unlinked-day'; blockingIssues: IssueViewModel[]; blockingSteps: SectionViewModel[]; message }` |
| C14 | Per-channel pending bad-channel un-mark (priorBad / requiresAck / acked) | DayEditor | `BadChannelMarkViewModel { ntrodeId; channel; marked; priorBad; requiresAck; acked }` (or `confirmRequired`/`ackTarget` on the `unmarkBadChannel` command) |
| C15 | Breadcrumb | DayEditor | `BreadcrumbViewModel { items: { label; href? }[] }` |
| C16 | Editor shell load-failure recovery (distinct from list-row recovery) | DayEditor | `DayEditorShellViewModel { state: 'ok' \| 'no-day-id' \| 'day-not-found' \| 'animal-not-found'; message?; ownerKey? }` |
| C17 | Advisory recovery/cleanup notices with a reset command (not severity-bearing issues) | DayEditor, AnimalWorkspace | `RecoveryNoticeViewModel { kind; message; repair: WorkflowCommand }[]` |
| C18 | Destructive-command caveat ("downstream not deleted") | AnimalWorkspace | `WorkflowCommand.confirmCaveat?: string` (or `warnsDownstream?: boolean`) |
| C19 | Nav-discard intercept decision (modified/non-primary click falls through) | AnimalView | minor: `NavDiscardDecision { intercept: boolean }` or fold into command preconditions; can stay component-local |

**Phase-1 recommendation:** land the small, certain additions to the existing types in
[shared-contracts.md](shared-contracts.md) now — **C1, C2, C6, C7, C8, C12, C13, C15, C16, C18** —
because they extend types the builders use directly. Treat **C4, C5, C11, C14, C17** as *new* VM types
introduced by the builder that owns them (preflight/batch by 2a; step VM, field VM, gate, bad-channel,
and recovery notices by 2d) — define them in `types.ts` in Phase 1 as the inventory specifies, so 2a–2d
don't each invent a divergent shape. **C3, C9, C10, C19** are confirmations/minor and can be settled in
the relevant builder's PR.

## Domain gaps

Decisions that *should* be REUSE (pure domain truth) but are currently **reimplemented inline** in a
component. Per [overview Non-Goals](overview.md#non-goals), a builder must NOT reinvent these — fixing
each is an **explicit, separately-reviewed domain change**, not something smuggled into a Phase-2
builder. If a builder needs one of these before its domain home exists, that dependency is called out in
the builder's phase file.

| # | Domain gap | Reinvented at | Existing nearest truth | Proposed |
| --- | --- | --- | --- | --- |
| D1 | Corrupt days-index shape check (`!Array.isArray(animal.days)`) | RecordingDaysTab.tsx:109-110 | `dayRecovery` classifies day *records*, not the index container | add `getDaysIndexStatus(animal)` (or extend `classifyAnimalDays`) to `dayRecovery` |
| D2 | Owner-key resolution (animalId → indexing-animal fallback → unresolved) | DayEditorStepper.tsx:134-159 | `classifyAnimalDays` (WRONG_OWNER/orphan) encodes the same partition | promote to a `state/workspaceSelectors` `resolveDayOwner(day, workspace)` or a `dayRecovery` fn |
| D3 | Per-animal ok-only date-sorted day-record list re-derived | validationSummaryRows.ts:157-167 `buildAnimalDaysByKey` | `getAnimalDays` already returns this for one animal | reuse `getAnimalDays` per animal (or add a workspace-wide `getAnimalDaysByKey`) |
| D4 | `?field=` → owning-tab two different mappings | AnimalView index.tsx:108-120,357-362 (DOM `data-field-path`) vs domain `animalSetupTabForFieldPath` (sectionStatus.ts:153) | `animalSetupTabForFieldPath` is the authoritative map | route the deep-link through `animalSetupTabForFieldPath`; drop the DOM-anchor heuristic |
| D5 | `shouldInterceptNavDiscard` pure logic lives in a component file | AnimalView index.tsx:154-160 | none — it is already pure, just mislocated | relocate to `src/domain/` (no behavior change) |
| D6 | Warning-severity sections unmapped (no amber ring) | AnimalView (only error+todo computed) | `getAnimalBlockingSections` (error only) | *if* an amber ring is later wanted: add `getAnimalWarningSections` — not needed for Phases 0–5 parity |

> D6 is **not** a Phase 0–5 requirement — Phases 0–5 reproduce today's behavior, which has no amber
> section ring. It is recorded so the Phase-6 UI work knows the domain support it would need.

## Cross-surface duplication (highest-value consolidations)

Decisions computed in **more than one** surface with slightly different logic — the consolidations that
the view-model layer most directly pays off:

1. **Day status → label/lifecycle** — `dayChipDisplay` (ValidationSummary) and the
   `getDayRowStatus` + orphan-override + `humanizeNeedsFixingLabel` chain (AnimalWorkspace DayList) both
   turn a day's lifecycle into a status word, with the *same* orphan "Re-link to export" special case
   written twice (validationSummaryRows.ts:78-83 / DayList.tsx:180-187). → one shared `dayRowViewModel`
   helper (Phase 2a owns it; 2b consumes it) — the plan's headline consolidation.
2. **Export gate** — recomputed three times inside DayEditor (nav count / readiness / download) and
   again at ValidationSummary batch-confirm. Same predicates (`computeStepStatus`/`validateDay`/
   `isExportEnabled`); a gate VM guarantees they can't disagree.
3. **Config-version label** — `describeConfigVersionLabel` is already one shared helper but is wrapped
   in duplicated scan-cell markup across DayStatusTable / BatchExportPreflight / EffectiveDayReview /
   ConfigVersionPanel.
4. **Opto state label** — `describeDayOptoState`/`getAnimalOptoCompleteness` consumed in row scan,
   preflight, nav count, and setup card; all depend on `optoFieldsPresence` staying authoritative.
5. **Present-day count** — `getPresentDayCount` (one path) vs `classification.filter(isPresentRecordStatus)`
   (another) inside AnimalWorkspace — two routes to the same number.
6. **Lifecycle-flag persistence** — `{...state, validated}` / `{...state, exported}` written inline in
   ValidationSummary and DayEditor; candidate for one `setDayLifecycleFlag` command (Phase 4).
7. **Merge-tolerance fail-closed** — try/catch around `mergeDayMetadata` duplicated in DayList,
   DayEditorStepper, ExportStep with slightly different null fallbacks.
