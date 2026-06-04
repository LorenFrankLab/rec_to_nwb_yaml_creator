# Phase 8 — Optogenetics correctness

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#parity-golden-fixture--round-trip-contract)

Goal: make optogenetics sessions convert correctly instead of being **silently dropped**. trodes_to_nwb
gates all optogenetics on four keys being present and non-empty, and reads several keys whose names differ
from the schema — so a partial or schema-shaped opto block produces an NWB file with **no optogenetics at
all**, no error. (Opto is rare but, when present, this is silent loss of the experiment's central
manipulation.)

**Inputs to read first:**

- [src/state/workspaceUtils.js:217-244](../../../../src/state/workspaceUtils.js) — `mergeDayMetadata`
  optogenetics emission: `opto_excitation_source` / `optical_fiber` / `virus_injection` /
  `fs_gui_yamls` / `optogenetic_stimulation_software`, and the `FS_GUI_YAML_ORDER` (`:29`) /
  `VIRUS_INJECTION_ORDER` templates.
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

- [Parity, golden-fixture & round-trip contract](shared-contracts.md#parity-golden-fixture--round-trip-contract)
  — opto output changes; **run the mandatory round-trip** on an opto sample (convert → inspector → dandi).

## Tasks

- **Task 1 — emit the keys the converter actually reads.** Ensure the export emits
  `optogenetic_stimulation_software` (the converter's gate key; the app already does — keep it) and
  `virus_injection[].volume_in_uL` (capital L — the converter reads this). Add a test that an opto session's
  merged output carries these exact keys with non-empty values.
- **Task 2 — flag/repair the schema↔converter key mismatch.** `optogenetic_stimulation_software` vs schema
  `opto_software`, and `volume_in_uL` vs schema `volume_in_ul`, are **trodes_to_nwb-internal mismatches**:
  the converter reads one spelling, the schema declares the other. Emitting the converter spelling makes
  conversion work but can fail schema validation (and vice-versa). Resolve deliberately: prefer the
  converter spelling for conversion correctness, and **coordinate a fix to the shared `nwb_schema.json`**
  (both repos' bundled copies) so schema and converter agree. Document the decision; do not silently pick
  one and leave the other broken.
- **Task 3 — validate all-or-nothing completeness (no silent drop).** Extend/confirm `rulesValidation`'s
  opto rule so that **if any optogenetics field is present, all four converter-required sections must be
  present and non-empty** (matching the converter's gate) — error severity, so the export gate blocks a
  partial opto session instead of letting it convert to an opto-less file. Also error if
  `opto_excitation_source` has more than one entry (converter `ValueError`).
- **Task 4 — `fs_gui_yamls` shape.** Add `camera_id` to `FS_GUI_YAML_ORDER` and ensure fs_gui creation
  collects it (schema-required, currently omitted); drop any non-schema key (e.g. `state_script_parameters`)
  the template lists. Validate epoch references.
- **Task 5 — fixtures + docs + round-trip.** Add/maintain an opto new-path fixture; update
  `docs/REFACTOR_CHANGELOG.md`; **run the mandatory round-trip on an opto sample** and paste the output.

## Deliberately not in this phase

- **Non-opto export correctness** — phases 1–7.
- **Redesigning the opto UI** beyond collecting the required fields and enforcing completeness.
- **Adding new opto device types** or changing the opto schema beyond the key-mismatch reconciliation in
  Task 2 (which is coordinated, not unilateral).

## Validation slice

| Test | Asserts |
| --- | --- |
| `opto session emits converter-expected keys` *(unit)* | a configured opto session's merged output has `optogenetic_stimulation_software` and `virus_injection[].volume_in_uL` non-empty. |
| `partial optogenetics is an error` *(unit)* | a session with some opto fields but missing one of the four required sections yields an error-severity issue (the export gate blocks it); a complete opto session passes; a no-opto session yields nothing. |
| `more than one excitation source is an error` *(unit)* | two `opto_excitation_source` entries error. |
| `fs_gui_yamls carries camera_id` *(unit)* | the merged `fs_gui_yamls` items include `camera_id` and no `state_script_parameters`. |
| `opto session passes the round-trip` *(integration, mandatory)* | an opto sample → `create_nwbs` ok, the NWB file actually contains the optogenetics objects (not silently dropped), `nwbinspector --config dandi` zero CRITICAL, `dandi validate` exit 0. |
| `golden-yaml.baseline.test.js` (existing) | byte-identical — legacy fixtures unchanged (the opto always-on keys already match legacy). |

## Fixtures

A complete optogenetics workspace session (virus_injection, opto_excitation_source, optical_fiber,
optogenetic_stimulation_software, fs_gui_yamls) synthesized for the unit tests; a minimal opto `.rec` +
generated YAML for the round-trip; new-path opto fixture per the parity contract.

## Review

`pr-review-toolkit:code-reviewer`; `pr-review-toolkit:silent-failure-hunter` (this whole phase is about a
silent downstream drop). Confirm: the converter-expected keys are emitted; the schema↔converter mismatch
is resolved and documented (not papered over); all-or-nothing completeness blocks partial opto; the
round-trip proves the NWB file actually contains optogenetics; legacy baselines unchanged; no plan/phase
strings.
