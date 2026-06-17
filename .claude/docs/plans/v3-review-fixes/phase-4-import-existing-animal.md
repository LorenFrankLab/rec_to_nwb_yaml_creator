# Phase 4 — Import-onto-existing-animal integrity

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Two import-path (Phase-7 era) silent edges. (a) Adding a day to an *existing* animal writes the day's
camera/data-acq references without merging the source's catalogs, so the added day can reference
cameras/devices the animal doesn't have. (b) A `task_epoch`/`task_epochs` dual-key conflict is labeled
a benign "no values changed" normalization but drops the singular value when the two differ.

**Inputs to read first:**

- [src/pages/ImportRepair/index.tsx:163-175](../../../../src/pages/ImportRepair/index.tsx) — forces `{ [subjectId]: 'add' }` for an existing subject.
- [src/state/yamlImportApply.ts:270-340](../../../../src/state/yamlImportApply.ts) — `addToExistingAnimal` (documented "does NOT merge catalogs") + `dayOwnedUpdates` (writes `session`/`tasks`/`associated_files`/`associated_video_files`, the latter carrying `camera_id`).
- [src/state/importRepair.ts:348-420](../../../../src/state/importRepair.ts) — `detectBenignNormalizations` labels `task_epoch`→`task_epochs` as benign; `applyBenignNormalizations` keeps `task_epochs` and `delete`s `task_epoch` (`:416`), losing the singular value if both exist and differ. Compare with the `volume_in_uL`/`volume_in_ul` *reconcile* path in the same file (the precedent to mirror).
- [src/domain/dayValidationComposer.ts:51](../../../../src/domain/dayValidationComposer.ts) + the cross-reference rules — the gate that *would* flag a dangling camera/data-acq ref on the merged day (so this is "surface it at import" not "prevent a crash").

## Tasks

- **Surface un-mergeable references on existing-animal add.** Before committing an `add`, compute
  which of the imported day's referenced cameras / `data_acq_device_name` are absent from the EXISTING
  animal's catalogs (the import doesn't merge them by default). If any are missing, surface them in the
  Import & Repair review as **blocking** repair items (consistent with the screen's true-validate gate)
  and require an explicit resolution before import:
  - **Bring referenced catalog entry into this animal** — allowed only when the source camera/device can
    be added without an id/name identity conflict in the existing animal. Apply this as a targeted,
    selected merge of the referenced entry before creating/updating the imported days.
  - **Map/fix the day reference** — when the target has a conflicting id/name or the user does not want
    to import the source catalog entry, require the day reference to be changed to a valid existing
    camera/device (or cleared where the domain permits it).
  After applying those resolutions, re-run the same merged-day validation/gating before commit; never
  commit a day that will dangle. Reuse the existing repair-row rendering + import gate
  (`validate(applyImportRepairs(...))` already gates; extend the precheck so a known-dangling-on-merge
  ref blocks rather than imports-then-fails-downstream).
- **Reconcile `task_epoch`/`task_epochs` conflicts (Open Q2).** In `detectBenignNormalizations`, when
  a file/video item has BOTH `task_epoch` and `task_epochs` with **different** values, do NOT classify
  it benign — emit a reconcile `RepairItem` (mirroring the `volume_in_uL`/`volume_in_ul` conflict
  path) that surfaces both values and the chosen resolution. Keep the genuinely-benign case (only
  `task_epoch` present, or both present and equal) as the silent normalization it is. `applyBenign…`
  must not `delete` a diverging singular value without it having been surfaced.
- **Docs.** CHANGELOG "Fixed": importing a YAML onto an existing animal no longer adds a day with
  references the animal lacks (surfaced + blocked); conflicting `task_epoch`/`task_epochs` values are
  reconciled, not silently dropped.

## Deliberately not in this phase

- Merging full catalogs automatically on `add` (a model change) — only *surface* the gap and let the user opt in per-reference.
- The task-catalog name-collision (Phase 3) — different mechanism.
- The new-animal import path (it imports the source's own catalogs; the gap is specific to `add`).

## Validation slice

| Test | Asserts |
| --- | --- |
| `importRepair` unit (extend) | item with both `task_epoch` and `task_epochs` EQUAL → benign (unchanged); DIFFERENT → a reconcile item, not "no values changed", and `applyImportRepairs` never silently drops the singular value |
| import-onto-existing precheck (new) | an imported day referencing a camera/`data_acq_device_name` absent from the existing animal → a blocking repair item; the import button is gated until resolved |
| import-onto-existing resolution (new) | "bring referenced catalog entry" adds only the selected missing camera/device when there is no id/name conflict, then the merged day validates and imports; an id/name conflict forces map/fix instead of auto-merging |
| `importRoundTrip`/existing `yamlImport` tests | unchanged for the clean case (a self-consistent import still adds without friction) |
| `baselines` | byte-identical |

## Fixtures

Synthesize: (a) an existing animal with cameras `[0]` only + an import plan whose day references camera
`3` and a `data_acq_device_name` the animal lacks; (b) file/video items with `{task_epoch:2,
task_epochs:3}` (conflict) and `{task_epoch:2}` (benign). Reuse `buildImportRepairPlan` fixtures.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The dual-key conflict is surfaced (not benign) only when values differ; the benign case is unchanged; no silent drop.
- An existing-animal import with a dangling-on-merge ref is blocked at the screen, not imported-then-broken.
- The clean import path is unchanged (round-trip + existing import tests green); baselines byte-identical.
- Full gate green; no trivial tests; CHANGELOG updated.
