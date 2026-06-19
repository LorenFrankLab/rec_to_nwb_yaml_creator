# Overview — Scope, integration, invariants, risks

[← back to PLAN.md](PLAN.md)

## Current codebase integration points

The work is confined to the Day Editor's Tasks & Files surface and the pure view-model that feeds it.

- [src/pages/DayEditor/EpochsTab.tsx](../../../../src/pages/DayEditor/EpochsTab.tsx) — the epoch grid +
  per-epoch details drawer. Touched by every phase: file/summary chip coloring + zero-count filters
  (P1), the drawer video row (P2), the floating `<aside>` → `<Modal>` (P3), the `reassignTask` write
  path (P4), row density + conditional camera column (P5). The collapsed-row chip classes are at
  `EpochsTab.tsx:1042-1056`; the summary filter strip at `EpochsTab.tsx:606-682`; the drawer video
  editor at `EpochsTab.tsx:1290-1363`; `reassignTask` at `EpochsTab.tsx:313-316`; the focus effect at
  `EpochsTab.tsx:161-173`.
- [src/pages/DayEditor/EpochsTab.module.css](../../../../src/pages/DayEditor/EpochsTab.module.css) —
  the chip/summary color classes (`summaryNeedsAttention:90`, `summaryReview:96`,
  `fileSummaryMissing:339`, `fileStateMissing:777`) and the `detailsPanel` fixed-position block
  (`:512-526`). P1 + P3 + P5.
- [src/viewModels/epochGridViewModel.ts:231-298](../../../../src/viewModels/epochGridViewModel.ts) —
  the pure per-row join. P1 adds a row `gateState` (non-video dimensions); P2 adds `videoCameraState`
  (3-state) and folds it into `gateState`; P4 adds `filenameTagMismatch`. The existing fields
  (`status`, `videoPresence`, `statescriptNaming`, `tag`) are **unchanged** — new fields are additive
  so export and existing tests are untouched.
- [src/domain/epochGeneratedFiles.ts:35-118](../../../../src/domain/epochGeneratedFiles.ts) —
  `fallbackCameraId` returns `0` when the animal has no camera, and `addMissingGeneratedVideos` /
  `countMissingGeneratedVideos` / `expectedCameraIds` use it — so the bulk "Generate missing → Videos
  (N)" path mints videos pointing at a non-existent camera `0`. P2 fixes this.
- [src/pages/DayEditor/AssociatedVideosEditor.tsx](../../../../src/pages/DayEditor/AssociatedVideosEditor.tsx)
  — a fully-built day video editor (camera `<select>` + task-epoch `<select>` + stale-id handling +
  both repair anchors) that is **imported nowhere in non-test source** (dead code since the
  epoch-centric redesign). P2 revives it as the Unassigned-videos repair surface and extracts a shared
  `VideoCameraSelect` from it.
- [src/components/Modal/Modal.tsx](../../../../src/components/Modal/Modal.tsx) — the accessible dialog
  primitive: ESC, overlay-click, body-scroll lock, focus trap, focus return, optional sticky footer.
  It does **not** set `inert`/`aria-hidden` on the background and does **not** portal. P3 reuses it as
  the details container; making the background truly inert is a separate shared-Modal follow-up (see
  Open Questions), not a P3 task.
- [src/components/ui/StatusPill.tsx:79-87](../../../../src/components/ui/StatusPill.tsx) —
  `EpochStatusPill` (the drawer-header pill). P1 feeds it the gate-aware state.
- [src/pages/DayEditor/DayEditorFrame.tsx:69-108](../../../../src/pages/DayEditor/DayEditorFrame.tsx)
  (`sectionForRepair`), `:243-266` (the `focusRequest` → `data-field-path` focus effect),
  `:371-407` (`handleFix`/`canFixIssue`) — P2 relies on these; the routing already lands on the
  `tasks` tab, but the target anchor doesn't exist yet.
- [src/pages/DayEditor/AssociatedVideosEditor.tsx:129-163](../../../../src/pages/DayEditor/AssociatedVideosEditor.tsx)
  — the **existing** controlled camera `<select>` (stale-camera handling, `data-field-path`
  anchor). P2 mirrors this exact pattern into the drawer; the file itself is **not changed**.
- [src/components/Modal/Modal.tsx](../../../../src/components/Modal/Modal.tsx) — the accessible dialog
  primitive (ESC, overlay-click, body-scroll lock, focus trap, focus return, optional sticky footer).
  P3 reuses it; it is **not changed**.
- [src/domain/fileNaming.ts](../../../../src/domain/fileNaming.ts) — `deriveStatescriptName`,
  `deriveVideoName`, `deriveStatescriptPath`, `isDerivedStatescript`, `isDerivedVideo`. P4 reuses
  these to detect and repair a stale tag; not changed.
- [src/pages/DayEditor/TasksFilesSection.tsx:50-73](../../../../src/pages/DayEditor/TasksFilesSection.tsx)
  and [src/pages/DayEditor/AssociatedFilesEditor.tsx:166-173](../../../../src/pages/DayEditor/AssociatedFilesEditor.tsx)
  — the duplicated supplemental-files headings/copy and sub-nav (P5). `TasksFilesSection` is also where
  P2 mounts the new **Unassigned videos** surface.

## Scope and dependency policy

### Goals

- Color and status on this surface mean exactly what they say: **error-red ⇒ blocks export**;
  **amber ⇒ valid-but-review** (a missing *expected* statescript, a manual name); **neutral ⇒ to-do /
  optional** (a video not added, a sleep statescript a lab doesn't log). No tier over- or under-signals.
- No repair dead-ends: any issue the readiness bar lets you click "Fix" on lands on a control that can
  actually resolve it.
- The details editor never occludes page controls.
- A task reassignment never silently ships a filename whose tag disagrees with the task.

### Non-Goals

- **No change to exported YAML.** Not a single golden baseline byte moves. (See invariant below.)
- **No new validation rules.** P1/P2 reuse the existing `validateDay` gate — the `dangling_camera_ref`
  ([referenceRules.ts:217-231](../../../../src/validation/rules/referenceRules.ts)), `missing_camera`,
  `orphaned_video` ([referenceRules.ts:274-297](../../../../src/validation/rules/referenceRules.ts)),
  and schema required-checks — and change only the *presentation/reachability* of those issues, not the
  gate itself.
- **No change to the shared `Modal` primitive in this plan.** P3 *uses* `Modal` as-is. Making the
  background truly `inert` for assistive tech needs a portal + `inert` change to `Modal` (blast radius:
  every dialog), tracked as a follow-up (Open Questions), not done here.
- **No workspace data-model / persistence change.** `day.state` off-export fields and the
  `taskInstances`/`associated_*` arrays keep their shapes.
- Not touching the frozen legacy form, the section rail's section set, or the supplemental-file
  preset list.
- Not the broader "scope tiers" / tabbed-IA redesigns tracked in other plans.

### Dependency policy

No new dependencies. All primitives needed (`Modal`, `EpochStatusPill`, `GeneratedValue`,
`AssociatedVideosEditor`'s pattern, `useUndoToast`, `ConfirmDialog`) already exist in the repo.

## Metrics

- `npx vitest run baselines` stays green at every phase boundary (the data-corruption gate).
- A freshly-templated W-track day with no files yet shows **zero** error-red chips for not-generated
  statescripts/optional videos; only genuinely export-blocking states are red.
- The "video references a missing camera" issue is fixable from the readiness bar in ≤2 clicks
  (Fix → camera select focused).
- `jest-axe`/manual: the details modal traps focus, is dismissable by Esc + scrim, and restores focus
  to the opener.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Recoloring hides a genuinely blocking state (esp. a blank video camera, which the schema blocks). | The 3-state `videoCameraState` makes blank a blocking `unselected`, not "valid". Red is driven strictly by gate signals (`needs_video`, duplicate, `unselected`/`dangling` camera) — narrowed, never removed. |
| The view-model re-derives partial gate logic, so it can drift from `validateDay`. | The [§3 parity test](shared-contracts.md#3-parity) pins view-model `blocking` ⇔ the corresponding `validateDay` issue for each dimension; any phase adding a `blocking` dimension adds its parity assertion. |
| Adding `cameras` read + new fields to `buildEpochGrid` perturbs derivation. | New fields are purely additive; existing fields are byte-asserted by the view-model tests and the golden baselines. The cameras read reuses `getAnimalCameras`. |
| Reviving `AssociatedVideosEditor` (dead code) regresses. | It still has tests; P2 re-runs them, adds a render test in the new Unassigned-videos surface, and extracts only the camera `<select>` into a shared `VideoCameraSelect` (one source of truth). |
| Modal conversion breaks the repair-focus landing (P2 focuses a control inside the panel). | P3 ships **after** P2; P3 re-runs P2's landing test against the modal. `Modal` auto-focuses its first focusable; the phase verifies the targeted control still wins via the token-guarded focus effect. A visible "Done" button is required (Esc/backdrop alone is too hidden for a dense editor). |
| Re-derive (P4) rewrites a deliberately manual filename. | Re-derive only ever touches files classified `generated` by `isDerivedStatescript`/`isDerivedVideo`; `manual` names are left verbatim, and the action is behind a confirm + undo. |
| P4 reads a stale `grid` immediately after `reassignTask` (the commit is async). | P4 detects the mismatch via the view-model field (correct on the next render) and repairs via an explicit action; any synchronous prompt computes the new tag from the **proposed** task name, never the rendered `grid`. |

## Rollout Strategy

No feature flag. These are presentation/affordance changes to an already-shipping surface; each phase
merges to `modern` once its baseline + review gate passes, per the project's per-phase workflow
(branch off `modern` → TDD → full gate → `code-reviewer` → `git merge --ff-only`, not pushed unless
asked). Nothing changes for a user who doesn't open the Day Editor.

## Open Questions

1. **How loud is a missing statescript?** RESOLVED (corpus + user). A statescript is **expected** on
   every run/task epoch (corpus: 84% present, ~universal where labs log at all) and on sleep epochs
   **only when the animal's prior same-config days logged sleep statescripts** (corpus: sleep coverage
   is 21% overall and bimodal/per-lab — rhino/denisse/shijie always log, alison/jguidera/ebroyles/rio
   never do, by intent). A missing **expected** statescript is a **loud warning** (amber chip + a
   section "N expected statescripts not added → Generate" strip), **not** red and **not** a hard block;
   a missing **un-expected** sleep statescript stays quiet ("optional"). Presentation-only — **no**
   `validateDay` rule. See [shared-contracts §1](shared-contracts.md#1-severity-vocabulary)
   "Statescript expectation".
   - *Sub-option (deferred):* escalating this warning into the **global readiness bar** / day-lifecycle
     rollup (so it's loud outside the Tasks & Files screen too) would require a warning-severity
     `validateDay` rule — a deliberate scope expansion beyond P1's presentation-only signal. Default:
     screen-loud only; revisit if users miss it.
2. **Details panel model (P3).** RESOLVED — modal sheet (scrim + focus trap + scroll-lock + focus
   return + a visible Done button), per the user's decision. Note: `Modal` traps *focus* and blocks
   *pointer* via the scrim, but does not mark the background `inert` for assistive tech — see #3.
3. **Make the shared `Modal` background truly inert?** Deferred. The honest fix is `createPortal` +
   `inert`/`aria-hidden` on the app root while any modal is open — a change to the shared `Modal`
   affecting every dialog (`ConfirmDialog`, `TaskTypeModal`, …). Out of scope for this Tasks & Files
   plan; tracked as a standalone a11y enhancement. P3 describes `Modal`'s behavior accurately rather
   than overclaiming "inert".
4. **Drive row severity from mapped `validateDay` issues instead of re-deriving in the view-model?**
   Deferred — a larger refactor (thread issue→epoch/video mapping into the grid). For now the
   view-model derives the gate dimensions it needs and the [§3 parity test](shared-contracts.md#3-parity)
   prevents drift. Revisit if a third consumer needs the same mapping.
5. **Does the app derive the statescript `name` the way the corpus does?** Deferred finding (not in any
   phase yet). Corpus: the statescript **`path` basename** follows the long stem
   `{date}_{subj}_{NN}_{tag}.stateScriptLog` ~universally (videos likewise, 93.6%), but the **`name`**
   field is a short human label (`statescript_r1`, `statescript Sleep1`) in ~83% of files, not the long
   stem — whereas the app's `deriveStatescriptName` puts the long stem in `name`. Downstream keys on
   `path` + `task_epochs`, so this is cosmetic, but the auto-generated `name` reads unlike the
   convention. Also: real tag schemes vary per lab (denisse numbers all statescripts `s1..sN`
   regardless of task; alison uses `r1..rN` for runs only), and some labs nest files in per-epoch
   subfolders. Implication: derivation should be a *sensible editable default*, not assumed canonical —
   the Override/Revert affordance (already present) is load-bearing. A future tweak could make the
   derived `name` the short label and keep the long stem in the `path` basename.
   - **Trodes basis (authoritative):** both the StateScript log
     (`{recording-completeBaseName}.stateScriptLog`, `trodes/Modules/stateScript/mainwindow.cpp:1115`)
     and the camera video (`{recording-base}.{cameraInstance}.h264` + `.videoTimeStamps`,
     `trodes/Modules/cameraModule/src/mainwindow.cpp:2401-2434`, `videoDisplay.cpp:357,6502`) inherit
     the **recording's base name and folder**; the recording base name is experimenter-chosen (no
     Trodes token template — `trodes/Trodes/src-main/mainWindow.cpp:3255`). So the extensions + the
     recording-stem **basename** are correct by construction, but the **folder** is wherever the
     recording lives. The per-epoch **subfolder** layout (denisse:
     `.../20251013_Jasper_01_s1/…_01_s1.stateScriptLog`) arises because each epoch is recorded as its
     **own `.rec` in its own folder** (modern Trodes org); the flat layout (alison 2021) is the old
     one-folder-per-day org. `deriveStatescriptPath` joins a flat `dataFolder/name`, so the derived
     *path* can diverge from the real layout even when the basename matches — another reason the path is
     an editable default, not a guarantee.

## Estimated Effort

Small-to-medium, front-loaded into P1. Rough diff sizing: P1 ~150 LOC (view-model + CSS + chip
wiring + tests), P2 ~120 LOC (drawer camera row + focus-effect extension + tests), P3 ~80 LOC (aside →
Modal + CSS removal + tests), P4 ~140 LOC (mismatch detection + re-derive confirm + tests), P5 ~90 LOC
(markup/CSS cleanup + tests). No phase is large.
