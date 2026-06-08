# Phase 4 — Per-day "cameras used" checklist

[← PLAN.md](PLAN.md) · [overview](overview.md)

Today a camera counts as "used" by a day only if a task / video / fs-gui row happens to reference its id — there's no upfront, glanceable selection. Add an explicit day-level checklist. **Additive and baseline-safe**: an optional `day.cameras_used` id set is UNIONed with today's inferred references, so with no explicit set stored the exported camera set is unchanged (no fixture has it).

**Inputs to read first:**

- `src/state/cameraUsage.js` — `referencedCameraKeys(day)` (builds the used set from `tasks[].camera_id` / `associated_video_files[].camera_id` / `fs_gui_yamls[].camera_id`) and `resolveDayCameraUsage(animal, day)`. The union point is `referencedCameraKeys`.
- `src/pages/DayEditor/DevicesStep.jsx` — the day "Devices & Failed Channels" step is the natural home for the checklist (it already shows the day's recording system); confirm against the step's render before placing it.
- `src/state/workspaceSelectors.js` — `getAnimalCameras` (the catalog to render as checkboxes).

## Tasks

- **Union the explicit set into `referencedCameraKeys`**: read an optional `day.cameras_used` (array of ids) and `add(...)` each id alongside the existing task/video/fs-gui ids. For existing data `day.cameras_used` is undefined → no change. Keep it shape-safe (tolerate a non-array).
- **Day-level checklist UI** in the Day Editor (DevicesStep): render the animal's cameras (`getAnimalCameras`) as checkboxes; checked ids → `onFieldUpdate('cameras_used', [...ids])` (a day field, like the other day overrides). Pre-check any camera already referenced by a task/video (so the checklist reflects reality on open).
- **(Optional, keep minimal) narrow downstream pickers**: the task/video camera dropdowns may offer `cameras_used` first. Defer if it complicates the diff — the export-correctness win is the explicit set + union.
- **CHANGELOG** entry: explicit per-day cameras-used checklist; additive; baselines byte-identical.

## Deliberately not in this phase

- Making `cameras_used` the SOLE source (replacing inference) — that would change export for existing data. Union only.
- A dataset-level camera catalog — decision-gated.

## Validation slice

| Test | Asserts |
| --- | --- |
| `referencedCameraKeys` unions explicit set | a `cameras_used: [1]` with no task ref → key for camera 1 present |
| no explicit set (regression) | `cameras_used` absent → identical key set to today |
| `resolveDayCameraUsage` with explicit set | exports the unioned catalog cameras, catalog order |
| checklist writes the field | checking a camera calls `onFieldUpdate('cameras_used', [...])`; pre-checks referenced cameras on open |
| baselines | 125 byte-identical (no fixture sets `cameras_used`) |

## Fixtures

Inline: an animal with a 2-camera catalog and a day; unit-test `referencedCameraKeys`/`resolveDayCameraUsage` directly; the checklist via a DevicesStep render with `onFieldUpdate` mock.

## Review

Dispatch `code-reviewer`. Confirm: the union is additive (regression test proves identical output without the field); baselines byte-identical; the checklist reflects existing references on open; `cameras_used` is read shape-safely; docstrings/test names don't reference this plan.
