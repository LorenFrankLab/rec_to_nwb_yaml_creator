# Phase 8 — Optogenetics correctness

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#parity-golden-fixture--round-trip-contract)

Goal: make workspace optogenetics sessions configurable and convertible instead of being **silently
dropped**. trodes_to_nwb gates all optogenetics on four keys being present and non-empty, and reads several
keys whose names differ from the schema — so a partial or schema-shaped opto block produces an NWB file
with **no optogenetics at all**, no error. (Opto is rare but, when present, this is silent loss of the
experiment's central manipulation.)

**Inputs to read first:**

- [src/state/workspaceUtils.js:217-244](../../../../src/state/workspaceUtils.js) — `mergeDayMetadata`
  optogenetics emission: `opto_excitation_source` / `optical_fiber` / `virus_injection` /
  `fs_gui_yamls` / `optogenetic_stimulation_software`, and the `FS_GUI_YAML_ORDER` (`:29`) /
  `VIRUS_INJECTION_ORDER` templates.
- [src/pages/AnimalEditor/AnimalEditorStepper.jsx:504-568](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)
  — current workspace Animal Editor steps (Electrode Groups, Channel Maps, Hardware Config only); there is
  no workspace optogenetics entry surface yet.
- [src/components/OptogeneticsFields.jsx](../../../../src/components/OptogeneticsFields.jsx) — legacy-form
  optogenetics UI; useful for field coverage but bound to legacy `formData`, not workspace animal/day state.
- trodes_to_nwb `convert_optogenetics.py` (GitHub `main`) — the gate and the field reads:
  - the all-or-nothing gate over `["virus_injection","opto_excitation_source","optical_fiber",
    "optogenetic_stimulation_software"]` (each must be present **and** `len(...) > 0`), else **silently
    returns** (`logger.info("No available optogenetic metadata")`);
  - `make_virus_injection` reads **`volume_in_uL`** (capital L) — schema property is `volume_in_ul`;
  - the gate reads **`optogenetic_stimulation_software`** — schema property is `opto_software`;
  - `opto_excitation_source` with `len > 1` → `raise ValueError`; named devices must exist in
    `device_metadata` or `ValueError`.
- [src/nwb_schema.json](../../../../src/nwb_schema.json) — opto sections; `fs_gui_yamls` items require
  `camera_id` (which `FS_GUI_YAML_ORDER` omits); `opto_software`; `volume_in_ul`.
- [src/validation/rulesValidation.js:69-86](../../../../src/validation/rulesValidation.js) — the existing
  opto all-or-nothing rule (verify it covers the same four keys as the converter).

**Contracts referenced:**

- [User mental-model contract](shared-contracts.md#user-mental-model-contract) — optogenetics is a recording
  manipulation with an explicit on/off state, not hidden optional metadata.
- [Parity, golden-fixture & round-trip contract](shared-contracts.md#parity-golden-fixture--round-trip-contract)
  — opto output changes; gate on the in-app schema + opto-completeness rules. The opto round-trip (which
  actually proves the NWB contains the optogenetics objects) is **deferred** to the pre-cutover task and is
  the most important opto check to run there, since the failure mode is a *silent* downstream drop.
- [UX mistake-prevention contract](shared-contracts.md#ux-mistake-prevention-contract) — optogenetics has an
  explicit enabled/off state and no hidden partial configuration.

## Tasks

- **Task 0 — add the workspace optogenetics entry path.** The workspace export can emit
  `animal.optogenetics` and `day.fs_gui_yamls`, but the workspace editor currently exposes no optogenetics
  step. Add a workspace-bound optogenetics surface that writes `animal.optogenetics` and `day.fs_gui_yamls`
  through workspace actions. An import/fixture-only path is not sufficient for this phase: opto is in scope,
  so a user-configurable workspace session must exist. The UX starts with an explicit "Optogenetics enabled"
  control: off means no opto metadata is expected; on reveals and requires the four converter-required
  sections plus FsGUI camera/epoch references.
- **Task 1 — emit the keys the converter actually reads.** Ensure the export emits
  `optogenetic_stimulation_software` (the converter's gate key; the app already does — keep it) and
  `virus_injection[].volume_in_uL` (capital L — the converter reads this). During the schema/converter
  transition, also emit the schema spellings (`opto_software`, `virus_injection[].volume_in_ul`) with the
  same values so app AJV and `trodes_to_nwb` can both pass. Add a test that an opto session's merged output
  carries both spelling pairs with non-empty, equal values.
- **Task 2 — flag/repair the schema↔converter key mismatch.** `optogenetic_stimulation_software` vs schema
  `opto_software`, and `volume_in_uL` vs schema `volume_in_ul`, are **trodes_to_nwb-internal mismatches**:
  the converter reads one spelling, the schema declares the other. Emitting the converter spelling makes
  conversion work but can fail schema validation if the schema-required spelling is absent (and vice-versa).
  Resolve deliberately: emit both spellings in this app until **both** bundled schemas and the converter
  agree on one canonical spelling, then remove the compatibility duplicate in a coordinated follow-up.
  Document the decision; do not silently pick one and leave the other broken.
- **Task 3 — validate all-or-nothing completeness (no silent drop).** Extend/confirm `rulesValidation`'s
  opto rule so that **if any optogenetics field is present, all four converter-required sections must be
  present and non-empty** (matching the converter's gate) — error severity, so the export gate blocks a
  partial opto session instead of letting it convert to an opto-less file. Also error if
  `opto_excitation_source` has more than one entry (converter `ValueError`).
- **Task 4 — `fs_gui_yamls` shape.** Add `camera_id` to `FS_GUI_YAML_ORDER` and ensure fs_gui creation
  collects it (schema-required, currently omitted). Drop non-schema UI-control keys (e.g.
  `state_script_parameters`) with an explicit sanitizer; `reorderKeys` is lossless and will otherwise
  preserve unknown keys even if they are removed from the order list. Validate epoch references.
- **Task 5 — fixtures + docs + in-app gate.** Add/maintain an opto new-path fixture; update
  `docs/REFACTOR_CHANGELOG.md`; gate on schema + the opto-completeness rule. Add the opto sample to the
  deferred pre-cutover round-trip checklist (it must prove the NWB actually contains optogenetics).

## Deliberately not in this phase

- **Non-opto export correctness** — phases 1–7.
- **Redesigning the opto UI** beyond collecting the required fields and enforcing completeness.
- **Adding new opto device types** or changing the opto schema beyond the key-mismatch reconciliation in
  Task 2 (which is coordinated, not unilateral).

## Validation slice

| Test | Asserts |
| --- | --- |
| `workspace optogenetics can be configured` *(integration)* | the workspace editor writes `animal.optogenetics` and `day.fs_gui_yamls`; export no longer relies on import-only or synthetic state. |
| `opto enabled state controls required fields` *(integration)* | opto off exports empty/no-opto state without errors; opto on reveals required sections and blocks save/export until all converter-required sections and FsGUI references are complete. |
| `opto session emits converter and schema keys` *(unit)* | a configured opto session's merged output has non-empty equal pairs: `optogenetic_stimulation_software`/`opto_software` and `virus_injection[].volume_in_uL`/`volume_in_ul`. |
| `partial optogenetics is an error` *(unit)* | a session with some opto fields but missing one of the four required sections yields an error-severity issue (the export gate blocks it); a complete opto session passes; a no-opto session yields nothing. |
| `more than one excitation source is an error` *(unit)* | two `opto_excitation_source` entries error. |
| `fs_gui_yamls carries camera_id` *(unit)* | the merged `fs_gui_yamls` items include `camera_id`; sanitizer removes `state_script_parameters` even though `reorderKeys` preserves unknown keys. |
| `opto session is schema-valid and complete` *(unit/integration)* | a complete opto sample is schema-valid and passes the all-or-nothing completeness rule. (Proving the NWB *actually contains* the optogenetics objects is the deferred pre-cutover round-trip — the highest-value opto check there, given the silent-drop failure mode.) |
| `golden-yaml.baseline.test.js` (existing) | byte-identical — legacy fixtures unchanged (the opto always-on keys already match legacy). |

## Fixtures

A complete optogenetics workspace session (virus_injection, opto_excitation_source, optical_fiber,
optogenetic_stimulation_software, fs_gui_yamls) synthesized for pure merge/unit tests and configured through
the workspace UI in integration tests; new-path opto fixture per the parity contract. (A minimal opto
`.rec` + generated YAML is needed only for the deferred pre-cutover round-trip, not this phase.)

## Review

`pr-review-toolkit:code-reviewer`; `ux-reviewer`; `pr-review-toolkit:silent-failure-hunter` (this whole
phase is about a silent downstream drop). Confirm: the workspace opto editor has an explicit enabled/off
state and no hidden partial configuration; the converter-expected keys are emitted; the schema↔converter
mismatch is resolved and documented (not papered over); all-or-nothing completeness blocks partial opto;
the opto sample is on the deferred pre-cutover round-trip checklist (which must prove the NWB actually
contains optogenetics); legacy baselines unchanged; no plan/phase strings.
