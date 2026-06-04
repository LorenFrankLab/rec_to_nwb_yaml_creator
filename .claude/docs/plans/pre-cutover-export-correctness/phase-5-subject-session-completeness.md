# Phase 5 — Subject & session completeness for schema + DANDI

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#dandi-conformance-contract)

Goal: make the workspace emit every **required** subject/session field the bundled schema needs *and*
satisfy the **DANDI subject blockers** (NWB Inspector dandi-config CRITICAL checks). A UI-built session
today is missing `weight`, can emit an empty subject `description`, emits a date-only `date_of_birth`, lets
the custom species escape pass arbitrary non-empty text, and can emit an empty `experiment_description` —
each makes the file invalid or DANDI-unpublishable with no in-app remedy.

**Inputs to read first:**

- [src/pages/Home/AnimalCreationForm.jsx:300-430](../../../../src/pages/Home/AnimalCreationForm.jsx) —
  the subject fields collected at creation (species/sex/genotype/dob; `description` exists in state but has
  no rendered input) — **no `weight`**; DOB is `type="date"` → `YYYY-MM-DD` (`:415-421`); the species
  dropdown defaults to Latin binomials but the "other" path only checks non-empty.
- [src/pages/Home/index.jsx:60-91](../../../../src/pages/Home/index.jsx) — builds the `subject` and calls
  `createAnimal`; DOB flows verbatim (`:64`).
- [src/state/useWorkspace.js:133-163](../../../../src/state/useWorkspace.js) — `createAnimal` subject
  defaults (no `weight`).
- [src/state/workspaceUtils.js:170-179](../../../../src/state/workspaceUtils.js) — `mergeDayMetadata`
  emits `experiment_description: day.session.experiment_description || ''` (no animal fallback) and
  `weight: day.session.weight ?? animal.subject.weight` (both undefined today).
- [src/nwb_schema.json:409-501](../../../../src/nwb_schema.json) — subject `required` incl. `description`,
  `weight`; `sex` enum; `species` free-text (example `"Rat"`); `date_of_birth` `T`-timestamp pattern.
- [src/components/SubjectFields.jsx:96-108](../../../../src/components/SubjectFields.jsx) — legacy DOB
  `new Date(value).toISOString()` to mirror.
- [src/pages/DayEditor/OverviewStep.jsx:120-190](../../../../src/pages/DayEditor/OverviewStep.jsx) — DOB
  shown read-only; `experiment_description` "leave blank" hint (currently false — no fallback).

**Contracts referenced:**

- [Schema device-output contract](shared-contracts.md#schema-device-output-contract) — DOB timestamp form.
- [DANDI conformance contract](shared-contracts.md#dandi-conformance-contract) — species binomial/URI,
  sex enum (already OK), no-slash ids, age-or-DOB.
- [Parity, golden-fixture & round-trip contract](shared-contracts.md#parity-golden-fixture--round-trip-contract)
  — these change new-path output; update fixtures deliberately; **run the mandatory round-trip** (this
  phase is the one DANDI most directly validates).

## Tasks

- **Task 1 — `date_of_birth` timestamp (Q2 decided: midnight-normalize).** Normalize the date-picker value
  with `new Date(value).toISOString()` on save (mirror `SubjectFields.jsx`). Add an in-editor **repair
  path** (editable DOB writing through `updateAnimal({ subject: { date_of_birth } })`) for animals created
  before this fix. Keep the `type="date"` UX.
- **Task 2 — collect required subject fields.** Add/render a non-empty subject `description` input and add a
  `weight` field to animal creation (and/or per-day session weight in OverviewStep), default them in
  `createAnimal`, so `mergeDayMetadata` exports a non-empty `subject.description` and numeric `weight`.
  Both are schema-`required`.
- **Task 3 — `species` as a Latin binomial (Q4 decided).** Keep/extend the controlled dropdown of Latin
  binomials (`Rattus norvegicus`, `Mus musculus`, …) plus an "other (binomial)" escape, and validate the
  final emitted value (including custom "other") against
  `^([A-Z][a-z]+ [a-z]+|http://purl\.obolibrary\.org/obo/NCBITaxon_\d+)$`. Free text (`Rat`) must be
  rejected (DANDI CRITICAL). Provide a repair path for existing animals.
- **Task 4 — no-slash `subject_id` / `session_id`.** Reject `/` in `subject_id` (creation) and
  `session_id` (DANDI CRITICAL `check_*_id_no_slashes`). `session_id` is auto-derived from animal id + date
  — ensure the derivation can't introduce a slash.
- **Task 5 — non-empty `experiment_description`.** Do **not** omit this key: `trodes_to_nwb` indexes
  `metadata["experiment_description"]` directly during NWB initialization. Implement the animal-level
  default the OverviewStep hint promises and/or require a non-empty day value, then export a non-empty
  string. Fix the false "leave blank" hint.
- **Task 6 — in-app DANDI subject rule + schema patterns.** Add a validation rule (and/or `nwb_schema.json`
  patterns, coordinated with trodes_to_nwb's bundled copy) for species form + no-slash ids, so the export
  gate (phase 1) blocks a DANDI-invalid subject. Note `sex` is already an `M/F/U/O` enum (compliant).
- **Task 7 — fixtures + docs + round-trip.** Update new-path fixtures (timestamp DOB, subject description,
  weight present, binomial species, non-empty experiment description). Update `docs/REFACTOR_CHANGELOG.md`.
  **Run the mandatory round-trip**
  (`create_nwbs` → `nwbinspector --config dandi` zero CRITICAL → `dandi validate` exit 0 → Spyglass smoke)
  on a corrected sample and paste the output.

## Deliberately not in this phase

- **Device/probe output** — phases 2–4. **Cross-reference / channel / location validation** — phase 6.
- **Broadening the editable subject surface** beyond what completeness + the repair paths need.
- **`age`/`age__reference`** — DOB already satisfies the DANDI age check; add `age` only if a no-DOB path
  is needed.

## Validation slice

| Test | Asserts |
| --- | --- |
| `creation stores a schema-valid timestamp DOB` *(unit)* | a `YYYY-MM-DD` value becomes a `T`-timestamp; `schemaValidation` raises no DOB error. |
| `subject.description is collected and exported` *(integration)* | a created animal's `mergeDayMetadata(...).subject.description` is non-empty; schema raises no subject-description error. |
| `subject.weight is collected and exported` *(integration)* | a created animal's `mergeDayMetadata(...).subject.weight` is a number; schema raises no `weight` error. |
| `species must be a Latin binomial` *(unit)* | `Rat` and a custom non-binomial are rejected; `Rattus norvegicus` and an NCBI URI pass; the export gate blocks a free-text species. |
| `subject_id / session_id reject slashes` *(unit)* | a `/` in either is rejected; derived `session_id` never contains one. |
| `empty experiment_description does not produce an invalid export` *(unit)* | a blank value is filled from the animal default or blocked before export; the exported key remains present and non-empty. |
| `created animal passes the downstream round-trip` *(integration, mandatory)* | a corrected sample → `create_nwbs` ok, `nwbinspector --config dandi` zero CRITICAL, `dandi validate` exit 0, Spyglass smoke ingest clean. |
| `golden-yaml.baseline.test.js` (existing) | byte-identical — legacy fixtures unchanged. |

## Fixtures

The creation form + `makeConfiguredWorkspace()`; animals with a date-only DOB / free-text species / no
weight for the repair + validation tests; a minimal `.rec` + generated YAML for the round-trip; new-path
fixtures updated per the parity contract.

## Review

`pr-review-toolkit:code-reviewer`; `ux-reviewer` (the species dropdown + repair paths must be discoverable
and the normalization invisible). Confirm: every required/blocking field is collected and exported; species
validation rejects free text; round-trip output pasted in the PR; fixture diffs intentional; legacy
baselines unchanged; no plan/phase strings.
