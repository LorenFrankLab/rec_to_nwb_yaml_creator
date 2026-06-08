# Phase 3 — Extend "Copy from animal" to cameras + recording system

[← PLAN.md](PLAN.md) · [overview](overview.md)

Today "Copy from animal" copies only electrode groups + channel maps. Extend it to also copy the **cameras** catalog and the **recording-system** (`data_acq_device`) catalog — a lab's rig is shared across animals. **Merge-neutral** (it writes animal-level catalogs that already exist). Re-run the cross-animal identity guards on copy so a divergent name surfaces.

**Inputs to read first:**

- `src/pages/AnimalEditor/CopyFromAnimalDialog.jsx:26` — props `{ open, currentAnimalId, animals, onCopy, onCancel }`; `handleCopy` (:89) emits `onCopy({ electrode_groups, ntrode_electrode_group_channel_map })` (≈ :127). Add selectable sections (checkboxes) + include cameras / data_acq_device in the emitted payload.
- `src/pages/AnimalEditor/wiring/ElectrodeGroupsContainer.jsx` — `handleCopyConfirm` is defined at `:256` (applies via `actions.updateAnimal(animalId, { devices: {...} })`); the dialog render + `onCopy={handleCopyConfirm}` wiring is at `:309-313`.
- `src/pages/AnimalEditor/identitySafety.js` — `collectCameraIdentities` / `collectDataAcqIdentities` + `findIdentityDivergence` (run on the copied cameras / data_acq_device).
- `src/state/workspaceSelectors.js` — `getAnimalCameras`, `getDataAcqDevices` (read the source animal's catalogs).

## Tasks

- **Generalize `CopyFromAnimalDialog`**: after selecting a source animal, show checkboxes for the available sections — "Electrode groups + channel maps", "Cameras" (when the source has cameras), "Recording system" (when the source has `data_acq_device`). Default all checked. `handleCopy` emits only the checked sections: `{ electrode_groups?, ntrode_electrode_group_channel_map?, cameras?, data_acq_device? }` (deep-cloned; electrode groups/maps keep the existing new-id remapping).
- **Host it for cameras + recording system**: the dialog is currently only in `ElectrodeGroupsContainer`. Either (a) lift it to a shared animal-setup entry that writes all selected sections in one `updateAnimal`, or (b) keep it in `ElectrodeGroupsContainer` but have `handleCopyConfirm` apply cameras/`data_acq_device` too. Prefer (a) — one "Copy from animal" affordance covering the whole rig. Confirm the host location against the AnimalView setup surfaces before wiring.
- **Identity guard on copy**: before writing copied cameras / `data_acq_device`, run `findIdentityDivergence` against the dataset registry; if a copied name diverges from an existing identity, surface the existing divergence UI rather than silently overwriting.
- **CHANGELOG** entry: copy-from-animal now covers cameras + recording system; identity-guarded.

## Deliberately not in this phase

- Behavioral-events / optogenetics copy — out of scope here (separate, lower-frequency).
- The dataset tier (which would make copy-from-animal largely moot) — decision-gated, see [overview](overview.md).

## Validation slice

| Test | Asserts |
| --- | --- |
| copy cameras only | only `cameras` written; electrode groups untouched when unchecked |
| copy recording system | `data_acq_device` catalog copied (deep clone) |
| copy electrode groups (regression) | existing behaviour intact — new ids remapped |
| divergence on copy | a copied camera/data-acq name that diverges from the dataset surfaces the guard; write blocked |
| baselines | byte-identical |

## Fixtures

Inline: two animals — a source with cameras + `data_acq_device` + electrode groups, and a target. `StoreProvider`-rendered container tests + a live-store probe on the target animal.

## Review

Dispatch `code-reviewer`. Confirm: unchecked sections are NOT copied; deep-cloned (no aliasing into the source); identity guard runs on copied cameras/data-acq; the electrode-group regression holds; baselines byte-identical.
