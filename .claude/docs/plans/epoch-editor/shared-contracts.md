# Shared contracts — epoch-editor implementation

[← back to PLAN.md](PLAN.md)

Cross-phase contracts every phase depends on. Each lives here once; phases link in by anchor and
**must not weaken** them. The redesign is a **new input surface over the existing substrate** — almost
every "contract" below is a pointer to code that already exists and must be *reused, not reimplemented*.

- [1. Byte-identity gate (the non-negotiable)](#1-byte-identity-gate)
- [2. Substrate to reuse — never reimplement](#2-substrate-to-reuse)
- [3. Status vocabulary — reuse `dayLifecycle`](#3-status-vocabulary)
- [4. View-model + command wiring](#4-view-model--command-wiring)
- [5. Epoch grid = a join-view over existing arrays](#5-epoch-grid--join-view)
- [6. Data-folder + filename-derivation model (additive)](#6-data-folder--filename-derivation)
- [7. Carry-forward — reuse `createDayRecord`](#7-carry-forward)
- [8. Routing](#8-routing)

---

## 1. Byte-identity gate

The exported YAML shape is **frozen**. Every phase must keep the four golden fixtures byte-for-byte
identical. The gate:

```bash
npx vitest run baselines     # src/__tests__/baselines/golden-yaml.baseline.test.js — .toBe() byte compare
```

Fixtures: `src/__tests__/fixtures/golden/{20230622_sample_metadata.yml, minimal-valid.yml,
realistic-session.yml, 20230622_sample_metadataProbeReconfig.yml}`.

**Rule — do not weaken:** This is a *presentation* redesign. No phase changes `mergeDayMetadata`'s output
for equivalent input. The one merge-adjacent authoring layer (Phase 4's data-folder filename **derivation**)
is **additive** — it must compute the *same* `associated_files[].path` / `associated_video_files[].name` the
merge already emits, and existing/imported files keep their stored values. (The task catalog is already the
live shape — no activation, no merge change.) If a baseline diff appears, the change is wrong until proven a
deliberate, coordinated schema change (it is not, in this plan). Regenerating golden fixtures is **out of
scope** for every phase here.

A change to validation severity/text is allowed (it doesn't touch export); a change to merged YAML is not.
**One new validation rule is explicitly authorized** by this plan — the **video-declaration readiness rule**
(Phase 4): an epoch that has a task but neither a bound video nor an explicit `absent` ("no video recorded")
declaration is flagged as a blocking *readiness* issue. It **adds an issue only — it never reads or writes
the merged YAML** (videos come from `associated_video_files`; the `absent` set lives off-export in
`day.state`), so it cannot move a baseline. Its phase asserts byte-identity explicitly. This is the sole
allowed validation addition; everything else consumes the existing rules.

---

## 2. Substrate to reuse

These already exist, are tested, and are shared between the editing UI and the export gate so they
**cannot drift**. New surfaces call them directly. Reimplementing any of them locally is the one mistake
this plan exists to prevent.

| Concern | Symbol | File:line | Reuse rule |
|---|---|---|---|
| State (read) | `useWorkspace` + `workspaceSelectors.*` | `src/state/useWorkspace.ts:28`, `src/state/workspaceSelectors.ts` | Read via selectors (guarded, never throw). Never reach into raw `workspace.*`. |
| State (write) | `workspaceActions.*` | `src/state/workspaceActions.ts` (`createAnimal:103`, `updateAnimal:185`, `deleteAnimal:212`, `createDay:372`, `duplicateDay:444`, `updateDay:519`, `deleteDay:554`, `createConfigurationSnapshotAndApplyForward:263`, repair: `removeDayReference:603`/`relinkDayReference:639`) | All mutations go through actions. Surfaces emit **commands**, not direct store pokes (see §4). |
| Export merge | `mergeDayMetadata(animal, day)` | `src/state/workspaceUtils.ts:357` | The ONE merge. The epoch grid edits the day arrays; export still calls this. |
| Export gate | `validateDay(day, mergedDay, animal?, animalDays?)` | `src/domain/dayValidationComposer.ts:51` | THE authoritative gate. Every readiness bar / blocked-export / day-status reads this — never a local check. Already folds schema + rules + override + monotonicity + **task-catalog** issues. |
| Schema+rules | `validate(model)` / `validateField(model, path)` | `src/validation/index.ts:22` / `:45` | Field-level inline validation reads `validateField`. |
| Opto completeness | `optoFieldsPresence(fields)` | `src/domain/optoCompleteness.ts:60` | The 4-field meter on the Setup/opto card and the gate share this. |
| Override merge | `classifyGeometryOverride` / `classifyBadChannelsContainer` / `resolveEffectiveDevices` | `src/domain/deviceOverrideMerge.ts:54` / `:69` / `:111` | Failed-channels editor and merge agree via these. |
| Bad channels | `buildProbeWideBadChannelMap`, `toggleMark`, `validBadChannelIds`, `isMultiShankGroup` | `src/domain/badChannels.ts:168` / `:131` / `:201` / `:51` | The probe-wide grid uses these; multi-shank consolidation is `buildProbeWideBadChannelMap`. |
| Monotonicity | `priorBadChannels`, `badChannelRegressions`, `getBadChannelRemovalAcks` | `src/domain/badChannelMonotonicity.ts:73` / `:116` / `:39` | Un-mark confirm + ack + export-block reuse these. |
| DIO collisions | `duplicateBehavioralEventNames` / `…Descriptions` | `src/validation/behavioralEvents.ts:37` / `:18` | DIO tab inline gate. |
| Task epochs | `duplicateTaskEpochs(tasks)` | `src/validation/taskEpochs.ts:19` | Epoch-grid uniqueness badge. |
| Task catalog (ALREADY LIVE) | `getAnimalTaskTypes`, `resolveTaskInstances`, `taskCatalogActions.*` | `src/state/workspaceSelectors.ts`, `src/state/taskCatalog.ts:227`, `src/state/taskCatalogActions.ts` | The catalog is the **live** shape: the day editor writes `day.taskInstances` (`src/pages/DayEditor/TasksEpochsStep.tsx:153`), `mergeDayMetadata` prefers them (`workspaceUtils.ts:371`), `createDayRecord` carries them (`workspaceTransitions.ts:483`), and v1/v2/v3 persistence fixtures + the v2→v3 migrator exist. **Reuse it — there is no activation phase.** |
| DANDI | `isValidSpecies`, `idHasSlash` | `src/validation/dandiSubject.ts:32` / `:45` | Wizard identity inputs reuse these. |
| YAML I/O | `encodeYaml`, `decodeYaml`, `formatDeterministicFilename`, `downloadYamlFile` | `src/io/yaml.ts:38` / `:73` / `:102` / `:122` | Export-preview + import reuse these verbatim. |
| Normalization | `normalizeWorkspaceDevices`, `migrateBadChannelsToDays` | `src/utils/deviceNormalization.ts:625` / `:620` | Lossless / no-laundering; load-time only. |
| Recovery | `dayRecovery.*`, persistence `loadWorkspace` notice path | `src/domain/dayRecovery.ts`, `src/state/persistence.ts:105` | Recovery-review surface (Phase 8) renders these, doesn't recompute. |
| Repair routing | `repairRouting.*` | `src/domain/repairRouting.ts` | Field-level "Fix in …" anchors resolve through this. |

**The task catalog is already the live shape — there is no activation phase** (this was verified in source
during planning; an earlier assumption that it was inert was wrong). `validateDay` already folds the catalog
issues (`dayValidationComposer.ts:86-92`), `mergeDayMetadata` already resolves `taskInstances → tasks`
(`workspaceUtils.ts:371`), `createDayRecord` already carries `taskInstances` (`workspaceTransitions.ts:483`),
the day editor already writes them (`TasksEpochsStep.tsx:153`), and the persisted blob is already v3 with the
v2→v3 migrator + v1/v2/v3 fixtures. The epoch grid (Phase 4) **reuses** all of this — `getAnimalTaskTypes`
for the picker, `taskCatalogActions` for "+ new task type", `resolveTaskInstances`/`updateDay` for write-back.

---

## 3. Status vocabulary

**Reuse `src/domain/dayLifecycle.ts` verbatim — do not coin new strings.** It already names the states the
mockups use:

| Mockup word | `DAY_LIFECYCLE` | Label (`DAY_LIFECYCLE_LABEL`) |
|---|---|---|
| Draft (incomplete) | `DRAFT` | "Draft" |
| Ready (valid, unexported) | `READY` | "Ready to export" |
| — (saved-valid) | `VALIDATED` | "Validated" |
| Exported | `EXPORTED` | "Exported" |
| Needs review/fixing | `NEEDS_FIXING` | "Needs fixing" |

Live readiness outranks a saved flag (`lifecycleForValidDay`, `dayLifecycle.ts:96`); row status resolves
through `src/domain/workflowStatus.ts` (`getDayRowStatus`) and renders via the existing
`DayLifecycleLegend`. **Scopes never share a word** (the mockup discipline): the **epoch-row scope** is
`Complete` / `Incomplete` / `Needs video` (its own scope, never a lifecycle word — `Needs video` is the row
face of the video-declaration readiness rule, [§1](#1-byte-identity-gate) + Phase 4), day lifecycle is the
table above, setup completeness is `configured · N of N`. Phase 0 wraps `DAY_LIFECYCLE_LABEL` in the shared `StatusPill`; it does not redefine
the enum. The mockup's short "Ready" pill = `READY` with a shortened label override (the label is the
surface's to shorten; the *state* is `dayLifecycle`'s).

---

## 4. View-model + command wiring

Pages are **thin renderers** of pure builders; writes are **descriptor commands** resolved by one handler.
This layer is built and tested (workflow-view-models Phases 0–5). New surfaces follow the same pattern.

- Builders: `src/viewModels/{animalWorkspaceViewModel,animalViewModel,dayEditorViewModel,validationSummaryViewModel,dayRowViewModel}.ts` — pure, React-free, return view-models + `WorkflowAction`s.
- Command types: `src/viewModels/types.ts` — `WorkflowCommand { id, target?, payload?, confirmCaveat? }`, `WorkflowAction { label, href?, command?, disabledReason?, intent? }`.
- Catalog (closed union of ids): `src/viewModels/commands/commandCatalog.ts`.
- Resolver: `src/viewModels/commands/commandHandlers.ts` — `commandHandlers({ actions })` → `(command, input?) => void` calling the matching `workspaceAction`.

**Rule — do not weaken:** a new write surface (multi-select export, undo-able delete, epoch add/reorder)
adds a `WorkflowCommand.id` to the catalog + a thin handler that calls an existing `workspaceAction`. No new
business logic in components. View-model builders stay pure (unit-tested without React). When a new command
id is added, the runtime descriptor-coverage check (workflow-view-models Phase 5) must still pass.

---

## 5. Epoch grid = join-view

The mockup's "epoch grid as the spine" is a **presentation join** over the day's existing arrays; it does
**not** introduce a new storage shape. A day already stores, per the state map:

- `tasks[]` / `taskInstances[]` (the live catalog shape) — each with `task_epochs: number[]`
- `associated_files[]` — statescript, `task_epochs?`
- `associated_video_files[]` — `camera_id`, `task_epochs?`
- `fs_gui_yamls[]` — per-epoch opto schedule, `task_epochs`

**Contract:** the grid derives **one row per epoch number** by joining these arrays on epoch, renders the
join, and on edit writes back into the *same arrays* via `updateDay`. Export (`mergeDayMetadata`) is
untouched → byte-identical. The "task sequence you author, with tag/camera/filenames deriving" is an
*editing affordance*; the persisted/exported shape is the existing arrays. The full join + write-back
algorithm is in [designs.md#epoch-grid-join](designs.md#epoch-grid-join).

Orphan-visibility (`useEpochCleanup` contract): the grid **surfaces** epoch refs that don't resolve
(orphaned file/video) via `validateDay`; it never auto-scrubs them, and confirms before an edit would
orphan a ref. Reorder/delete that would orphan prompts first.

---

## 6. Data-folder + filename-derivation

**Decision (confirmed): adopt a day-level data folder + derived filenames, additively, with the stored
YAML shape unchanged.**

- New day-level field `day.dataFolder?: string` (the directory on disk where this day's files live). Set
  once on the Day tab; **carried forward** (add to the carry list in `createDayRecord`, §7).
- Per-epoch statescript/video **filenames derive** from the convention `{date}_{animal}_{epoch:02d}_{tag}`
  (`.stateScriptLog` / `.1.h264`). The full derivation is in
  [designs.md#data-folder-derivation](designs.md#data-folder-derivation).
- On export, the day's `associated_files[].path` is still emitted as a full path = `dataFolder + derivedName`;
  `associated_video_files[].name` is still the derived filename. **The emitted shape is exactly today's** —
  derivation is an authoring convenience that *computes the values that already get stored*.
- **Existing / imported days keep their explicit per-file paths** (no `dataFolder`, or a `manual` mark per
  file). Derivation only governs files the user authors/edits in the grid. A file whose path diverges from
  the derived value shows the `manual` chip + "Override" (the mockup's generated/manual states).

**Rule — do not weaken byte-identity:** for the golden fixtures (which store explicit paths and no
`dataFolder`), nothing derives — they round-trip unchanged. Derivation is opt-in per authored file.

---

## 7. Carry-forward

Reuse `createDayRecord` (`src/state/workspaceTransitions.ts:435`) and `duplicateDay`
(`workspaceActions.ts:444`). What carries today: `tasks`/`taskInstances`, `behavioral_events`, `keywords`,
`technical`, `weight`, and `bad_channels` **only when the source pins the same `configurationVersion`**.
Never carries: `session_id`, `session_description`, `associated_files`, `associated_video_files`,
`fs_gui_yamls` (files re-derive for the new date).

**Phase 3 adds `dataFolder` and extends the carry list with it** (the folder is stable across a block of
days). This is the only carry-forward change in the plan; it keeps the "files don't carry, names re-derive"
rule — the *folder* carries; the *filenames* still derive per date (Phase 4).

---

## 8. Routing

Hand-rolled hash router, `src/hooks/useHashRouter.ts`. Views: `home`, `workspace`, `day`, `validation`,
`animal-view`, `legacy` (`useHashRouter.ts:36-43`). Animal tabs:
`ANIMAL_VIEW_TABS = [days, export, electrode-groups, recording-system, cameras, task-types, optogenetics]`
(`useHashRouter.ts:19`), default `days`. The redesign **keeps these routes**; it restyles the components
they render and threads `?field=…` / `#fix-…` repair anchors (already supported via `useReconfigContext`
and the AnimalView/DayEditor focus handlers). No new router. New deep-link query params (e.g.
`?context=blocking`) extend the existing param parsing, they don't replace the router.
