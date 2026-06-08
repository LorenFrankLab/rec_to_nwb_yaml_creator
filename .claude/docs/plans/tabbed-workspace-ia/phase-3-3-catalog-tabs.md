# Phase 3-3 — Catalog/library tabs + AnimalView corruption banner + opto chip

[charter](phase-3-setup-tabs.md) · [overview](overview.md) · depends on [3-1](phase-3-1-extract-wiring.md), [3-2](phase-3-2-ephys-tabs.md)

Mount the remaining four setup containers into their tabs and **hoist the 3-field corruption banner to the
`AnimalView` level** (charter decision 1) so it can no longer hide a sibling field's corruption now that
its three fields span three tabs.

**Inputs to read first:**

- [charter → tab→content map + decision 1](phase-3-setup-tabs.md).
- `RecordingSystemContainer`, `CamerasContainer`, `DioContainer`, `OptogeneticsContainer` from [3-1](phase-3-1-extract-wiring.md).
- [AnimalView/index.jsx:116-173](../../../../src/pages/AnimalView/index.jsx) — header + body where the banner mounts above the panels.
- [HardwareConfigStep.jsx:203-207](../../../../src/pages/AnimalEditor/HardwareConfigStep.jsx) — current 3-field `RawCorruptionBanner` render (the code being relocated); [RawCorruptionBanner.jsx](../../../../src/components/RawCorruptionBanner.jsx) — self-hides when clean.
- [sectionStatus.js](../../../../src/domain/sectionStatus.js) — `getAnimalSectionStatus(animal, 'optogenetics')` (returns `SECTION_STATUS.TODO` when opto is unconfigured) is the PUBLIC, already-wired "is opto set up?" signal — the same one the section-nav ring uses. (`hasOptogenetics` is private to this module; don't import it.) [optoStatus.js:42-69](../../../../src/domain/optoStatus.js) `describeDayOptoState` is the per-DAY protocol state — NOT the animal-setup signal; don't use it for the chip.

## Tasks

- **Render the four containers in `AnimalView`** for `recording-system`, `cameras`, `dio`, `optogenetics`,
  replacing the placeholder ([AnimalView/index.jsx:160-170](../../../../src/pages/AnimalView/index.jsx)).
  After this phase, all six setup tabs (+ `days`) are real; only `export` remains a placeholder (→ [3-5](phase-3-5-validation-export-tab.md)).
- **Scope descriptors:** recording-system → "**Shared across ALL days** (no per-day version)" (Task 3.2
  honesty caveat — do NOT group it under any "apply to days as needed" heading); cameras → "Catalog —
  referenced per day"; dio → "Library — opt in per day"; optogenetics → see chip below.
- **Hoist the 3-field `RawCorruptionBanner` to `AnimalView`** (charter decision 1). Render it once, above
  the tab panels (inside the `animal-view-body` or just under the header at [AnimalView/index.jsx:116-124](../../../../src/pages/AnimalView/index.jsx)), with `fields={['cameras','data_acq_device','configurationHistory']}` and the shared `handleRepair` (the `useAnimalFieldUpdate` hook from 3-1). **Remove** its render from `HardwareConfigStep`/the container so it isn't shown twice. It self-hides when clean, so it costs nothing on a healthy animal but is visible from every setup tab when any of the three fields is corrupt.
- **Optogenetics status chip (opto).** When the animal has no optogenetics setup
  (`getAnimalSectionStatus(animal, 'optogenetics') === SECTION_STATUS.TODO`, the public API from
  [sectionStatus.js](../../../../src/domain/sectionStatus.js) — reuse it, don't reach for the private
  `hasOptogenetics`), the optogenetics tab shows a neutral status chip ("Not used — no stimulation") so an
  empty opto tab reads as a valid state, not an error. This is the animal-SETUP signal; the per-day
  protocol state stays `describeDayOptoState` ([optoStatus.js:42-69](../../../../src/domain/optoStatus.js)),
  unchanged.

## Deliberately not in this phase

- **The `export` tab + per-day effective-setup review** — [3-5](phase-3-5-validation-export-tab.md).
- **Subject/profile header + reconfig banner** — [3-4](phase-3-4-profile-context.md).
- **Warning-escape on export** — [3-6](phase-3-6-warning-ack.md).
- **Repair `?field=` landing on cameras vs recording-system** — [Phase 3a](phase-3a-repair-routing.md) (that's where the camera-vs-data-acq routing granularity changes).

## Validation slice

| Test | Asserts |
| --- | --- |
| four containers render in their tabs | `#/animal/:id/{recording-system,cameras,dio,optogenetics}` each show their section, not the placeholder |
| recording-system honesty | the recording-system tab shows "shared across all days"; no "apply per day" framing |
| camera identity-safety via the tab | saving a diverging/ referenced camera from the cameras tab still triggers the in-modal block / decision dialog (same as 3-1, now through the tab) |
| banner at AnimalView level | corrupt `cameras` (non-array) shows the `RawCorruptionBanner` from the `recording-system` tab AND the `dio` tab (sibling-field visibility); it renders exactly once |
| banner removed from HardwareConfigStep path | no duplicate banner when the legacy stepper renders |
| opto chip when unused | an opto-free animal's optogenetics tab shows "Not used — no stimulation"; a configured one does not |
| `npx vitest run baselines` | 125 byte-identical |

## Fixtures

`buildRealisticWorkspace()`; an animal variant with `cameras: 'nope'` (corrupt) for the banner test; an opto-configured variant (non-empty `optogenetics.opto_excitation_source`) and an opto-free variant for the chip test.

## Review

Dispatch `pr-review-toolkit:code-reviewer` against the diff. Confirm:

- All six setup tabs real; `export` still placeholder; legacy stepper still works.
- The corruption banner renders **once** at AnimalView level and is visible from a non-owning tab (the documented risk is closed); it's gone from the HardwareConfigStep render path (no double render).
- Camera identity-safety unchanged through the tab; opto chip reflects animal setup, not day protocol.
- 125 baselines byte-identical; lint 0 errors; build green; names free of plan-milestone references.
