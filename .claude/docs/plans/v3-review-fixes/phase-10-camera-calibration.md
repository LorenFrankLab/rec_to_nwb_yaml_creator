# Phase 10 — Camera calibration hygiene

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Spyglass `CameraDevice` is keyed on `camera_name` alone, in a **global lab-wide namespace**, and the
camera's px→cm calibration (`meters_per_pixel`) is bound to that name — so a re-zoomed/repositioned camera
that keeps the same name silently inherits the wrong calibration (wrong position/velocity → wrong place
fields). Evidence + the downstream mechanism:
[../../research/yaml-corpus-2/09-cameras-video-downstream.md](../../research/yaml-corpus-2/09-cameras-video-downstream.md),
[09-cameras-video-corpus.md](../../research/yaml-corpus-2/09-cameras-video-corpus.md) (24 names map to ≥2
calibrations; 15 vary within one animal; 16 rows have `meters_per_pixel: 0`).

**Already covered — do not rebuild:** the **within-file** "reused `camera_name` must carry identical
metadata" guard exists — [src/validation/rules/identityRules.ts:56-60](../../../../src/validation/rules/identityRules.ts)
checks the camera divergence signature **including `meters_per_pixel`** (`divergent_camera_identity`, "Use a
new camera name"). So this phase closes only the gaps that rule can't see: a zero/implausible calibration,
placeholder names, and the **cross-day / catalog-merge** case (the within-file rule never compares day-1's
camera to day-2's).

**Inputs to read first:**

- [src/validation/rules/identityRules.ts:56-60](../../../../src/validation/rules/identityRules.ts) — the existing camera-name divergence check (signature already includes `meters_per_pixel`). The model to mirror, not duplicate.
- [src/nwb_schema.json:716-724](../../../../src/nwb_schema.json) — `cameras/items/meters_per_pixel` (type/constraints; confirm whether a `minimum`/`exclusiveMinimum` exists today — it likely does not, so `0` passes). Do **not** change the shared schema in this phase; add an app validation rule unless a separate cross-repo schema migration is explicitly approved.
- [src/state/yamlImportApply.ts:270-340](../../../../src/state/yamlImportApply.ts) — `addToExistingAnimal`/`dayOwnedUpdates` (the camera-catalog merge point for the cross-day case). **Coordinate with Phase 4**, which is already surfacing un-mergeable camera refs on existing-animal add — the cross-day calibration mismatch is the same merge boundary.
- The camera catalog in the workspace model (`src/state/workspaceTypes.ts`, `workspaceSelectors.ts`) and the camera editor (`src/pages/AnimalEditor/CamerasSection.tsx`) — to confirm cameras are an **animal-level** catalog (one calibration per name), so app-authored data is structurally safe and the exposure is import + edit.

## Tasks

- **Require `meters_per_pixel > 0`.** Add an app validation rule so a `0`/blank
  calibration is a blocking issue (16 corpus rows silently break position conversion). Add a soft
  **plausibility nudge** outside a defensible range (corpus spans ~0.0014–0.20) — warn, don't block.
- **Reject placeholder camera names.** A `camera_name` of `1`/`camera`/`XXX`/empty (19.3% of corpus
  files) is a blocking repair item with a "name this camera" action — placeholder names are exactly what
  collide in the global namespace.
- **Surface cross-day calibration divergence on import.** Extend the Phase-4 existing-animal merge
  precheck (or the catalog merge): when an imported day's `camera_name` already exists in the animal's
  camera catalog with a **different `meters_per_pixel`** (or other identity field), surface it as the same
  `divergent_camera_identity` repair — *"re-zoomed? give this camera a distinct name"* — defaulting to no
  silent overwrite of the existing calibration. (The within-file rule already covers the single-file case;
  this is the across-days extension.)
- **Prefill the standardized camera hardware.** Today `CameraModal` seeds every field blank
  ([src/pages/AnimalEditor/CameraModal.tsx:49-53](../../../../src/pages/AnimalEditor/CameraModal.tsx)) — the
  cause of the corpus's `unknown`/`unknown2` make/model/lens pollution. The lab is overwhelmingly one rig:
  manufacturer **Allied Vision** (Manta), model **Manta G-158C**, lens **Theia SL183M** (corpus: G-158C
  448 / Theia SL183M 448, dominant when not left blank). Prefill those three on a **new** camera
  (overridable), and offer the recurring names (`HomeBox_camera`, `SleepBox_camera`,
  `HaightRight_HaightLeft_camera`, `sleep_camera`, `maze_camera`, …) as datalist autocomplete. Leave
  `meters_per_pixel` a required per-camera entry (it legitimately varies — the aliasing field above).
  Recognition over recall; this directly retires the `unknown` make/model/lens class.
- **Docs.** CHANGELOG: new cameras prefill the standard Allied Vision Manta G-158C / Theia SL183M hardware
  and suggest recurring names; a zero/implausible `meters_per_pixel` and placeholder camera names are now
  caught; a camera reused across an animal's days with a different calibration is surfaced (Spyglass keys
  cameras by name, so a re-zoom needs a new name).

## Deliberately not in this phase

- The within-file `divergent_camera_identity` check — **already implemented** (identityRules.ts).
- The cameras-table **layout** (sticky Actions / horizontal scroll) — **Phase 1**.
- Adding `exclusiveMinimum`/`minimum` to `nwb_schema.json` — a shared-schema change that needs schema-sync
  and trodes_to_nwb coordination. This phase is app validation only.
- A lab-wide camera registry / cross-animal namespace enforcement (the global Spyglass namespace) — a
  model change; surface within an animal only. Track as a deferred follow-up.

## Validation slice

| Test | Asserts |
| --- | --- |
| camera calibration rule (new) | `meters_per_pixel: 0` / missing → blocking issue; a plausible value (e.g. `0.002`) → none; an implausible magnitude → a warning |
| placeholder-name rule (new) | `camera_name` of `1`/`camera`/`XXX`/`''` → a blocking repair item; a real name → none |
| import cross-day divergence (extend Phase-4 precheck) | importing a day whose `camera_name` matches an existing catalog camera with a **different** `meters_per_pixel` → a `divergent_camera_identity` repair, not a silent overwrite; identical calibration → clean |
| `identityRules` existing tests | unchanged (the within-file rule is not modified) |
| `baselines` | byte-identical (golden cameras carry valid, distinct calibrations) |

## Fixtures

Synthesize: cameras with `meters_per_pixel` of `0`, `0.002`, `5`; names `1`, `XXX`, `HomeBox_camera`; and
an existing animal whose catalog has `maze_camera @ 0.0025` + an import plan adding a day with
`maze_camera @ 0.0016`.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- No duplication of the existing within-file `divergent_camera_identity` rule; the new checks are the calibration-zero, placeholder-name, and cross-day-merge cases only.
- The cross-day surfacing reuses the Phase-4 merge boundary (no second, divergent merge path).
- `meters_per_pixel > 0` blocks via app validation; the plausibility band warns; no schema diff; baselines byte-identical.
- Full gate green; no trivial tests; CHANGELOG updated.
