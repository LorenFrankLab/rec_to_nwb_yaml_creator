# Phase 5 — Date-of-birth format: store a schema-valid timestamp and give a repair path

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#schema-device-output-contract)

Goal: stop newly-created workspace animals from being unexportable because their `date_of_birth` is a
bare `YYYY-MM-DD` the schema rejects (Finding G), and give the new editor a way to fix an existing
date-only value.

**Inputs to read first:**

- [src/pages/Home/AnimalCreationForm.jsx:415-421](../../../../src/pages/Home/AnimalCreationForm.jsx) —
  `<input type="date">`, stores `YYYY-MM-DD`.
- [src/pages/Home/index.jsx:60-70](../../../../src/pages/Home/index.jsx) — DOB flows into the created
  `subject.date_of_birth` (`:64`) verbatim.
- [src/nwb_schema.json:494-501](../../../../src/nwb_schema.json) — the `date_of_birth` pattern; requires a
  `T`-separated timestamp (`YYYY-MM-DDTHH:MM[:SS[.ffffff]]`).
- [src/components/SubjectFields.jsx:96-108](../../../../src/components/SubjectFields.jsx) — the legacy
  form's correct handling: `new Date(value).toISOString()` on blur. Mirror this.
- [src/pages/DayEditor/OverviewStep.jsx:180-190](../../../../src/pages/DayEditor/OverviewStep.jsx) — DOB
  shown read-only; no repair path today.
- [src/state/useWorkspace.js:183-220](../../../../src/state/useWorkspace.js) — `updateAnimal({ subject })`
  for the repair path.

**Contracts referenced:**

- [Schema device-output contract](shared-contracts.md#schema-device-output-contract) — DOB must be the
  schema's timestamp form.
- [Parity & golden-fixture contract](shared-contracts.md#parity--golden-fixture-contract) — DOB string
  changes new-path output for affected fixtures; update deliberately; legacy baselines stay.

## Tasks

- **Task 1 — normalize DOB on creation (Open Question 2).** When the creation form's date-only value is
  written into `subject.date_of_birth`, normalize it to the schema's timestamp form. Recommended:
  midnight normalization producing a seconds-precision (or `toISOString()`) value matching the pattern,
  mirroring `SubjectFields.jsx`. Keep the `<input type="date">` UX; convert on save/blur, not by forcing
  the user to type a time. Do the conversion in one place (the creation handler) so the stored subject is
  always schema-valid.
- **Task 2 — repair path for existing animals.** Make `OverviewStep`'s (or the Animal Editor's) DOB field
  editable, writing through `updateAnimal({ subject: { date_of_birth } })` with the same normalization, so
  an animal created before this fix (or imported with a date-only DOB) can be corrected in-app rather than
  becoming a permanent dead end. Keep the rest of inherited subject display as-is unless editing DOB.
- **Task 3 — fixtures + docs.** Update any new-path fixture whose animal DOB was date-only; confirm the
  normalized value matches the schema pattern. Update `docs/REFACTOR_CHANGELOG.md`. Assert
  `schemaValidation(mergeDayMetadata(...))` passes the DOB pattern for a newly-created animal.

## Deliberately not in this phase

- **Other subject fields** — only DOB is schema-pattern-sensitive here; don't broaden the editable subject
  surface beyond what the repair path needs.
- **Import-side DOB coercion** — the import path already runs through schema validation (phase 7 fixes its
  partial-exclusion bug). If an imported DOB is date-only, the repair path (Task 2) covers it; don't add a
  separate import coercion here.
- **Time-zone semantics / precision beyond the schema** — out of scope; match the pattern, nothing more.

## Validation slice

| Test | Asserts |
| --- | --- |
| `creation normalizes a date-only DOB to a schema-valid timestamp` *(unit)* | a `YYYY-MM-DD` creation value is stored as a `T`-timestamp matching the schema pattern; `schemaValidation` raises no DOB error. |
| `created animal exports a schema-valid DOB end-to-end` *(integration)* | create animal via the form → `mergeDayMetadata(...).subject.date_of_birth` matches the pattern. |
| `DOB repair path fixes an existing date-only value` *(integration)* | an animal with a stored `YYYY-MM-DD` DOB can be edited in the new editor to a valid timestamp via `updateAnimal`. |
| `golden-yaml.baseline.test.js` (existing) | byte-identical — legacy fixtures unchanged. |

All Vitest; creation/repair are integration (render the form / editor).

## Fixtures

The creation form + `makeConfiguredWorkspace()`; an animal fixture with a date-only DOB for the repair
test; new-path fixtures updated per the parity contract.

## Review

`pr-review-toolkit:code-reviewer`; `ux-reviewer` (the repair path must be discoverable and the
normalization invisible/non-surprising to the user). Confirm: normalization in one place; schema validity
proven; repair path actually writes through `updateAnimal`; no broadened subject-edit scope; fixture diff
intentional; legacy baselines unchanged; no plan/phase strings.
