# Phase 6 — Byte-for-byte legacy-export parity

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared contracts](shared-contracts.md)

Upgrade the new workspace export from **semantic** parity (Phase 5: parses to the same metadata) to
**byte-for-byte** parity with the legacy export. After this phase, `encodeYaml(mergeDayMetadata(animal,
day))` is textually identical to what the legacy single-page form exports for the same data — so when
[Phase 11](phase-11-cutover-v3.md) flips the new UI to default, the bytes a user downloads are
indistinguishable from current production output. This is a **behavior-preserving reorder** of the
single most safety-critical function in the workspace; it gets its own phase precisely because a subtle
mistake here is exactly the silent scientific-data corruption the whole project guards against.

**Why this is separate from Phase 5 (verified 2026-06-03):** `encodeYaml` preserves insertion order
(it does not sort). The legacy export encodes the flat `formData` object whose key order comes from
`defaultYMLValues`; `mergeDayMetadata` builds its own object in a *different* key order and with a
*different* always-on key set (e.g. legacy `formData` always carries empty `opto_excitation_source` /
`optical_fiber` / `virus_injection` / `fs_gui_yamls` / `optogenetic_stimulation_software` keys because
they are in `defaultYMLValues`, whereas `mergeDayMetadata` emits optogenetics keys *only* when
`animal.optogenetics` is present). Nested objects (`subject`, `device`, each `electrode_groups[]`,
`ntrode_electrode_group_channel_map[]`, `cameras[]`, `tasks[]`) also have their own key orders that must
match. None of this affects `trodes_to_nwb`/Spyglass (they parse YAML, order-independent) — it is a
textual-regression / auditability upgrade, not a correctness fix.

**Depends on:** [Phase 5](phase-5-validation-export.md) only (the new export path + semantic-parity
tests exist). It is sequenced **immediately after** export and **before** the later phases, so every
subsequent phase (store decomposition, validation summary, probe wizard, a11y, cutover) inherits byte
parity and is guarded by the parity tests. Note `mergeDayMetadata` lives in `src/state/workspaceUtils.js`,
**not** `store.js`, so this does not depend on the Phase 7 store decomposition — but the later
decomposition (and the probe-wizard work that feeds `configurationHistory`) MUST preserve the byte
parity established here, which the parity tests then enforce.

**On sequencing (why a whole phase, not folded into Phase 5):** the reorder of the single most
safety-critical function gets a dedicated diff, a `silent-failure-hunter` review, and the legacy-export
reference harness — rather than being buried inside the larger export feature. Placing it right after
Phase 5 (rather than just before cutover) closes the byte-divergence window as early as possible: from
here on, the new and legacy export paths emit identical bytes. The genuinely uncertain part
(always-on-key reconciliation against the real legacy bytes) needs the harness regardless.

**Inputs to read first:**

- [src/state/workspaceUtils.js:34-107](../../../../src/state/workspaceUtils.js) — `mergeDayMetadata`. The
  object literal at `:42-100` defines the **top-level key order**; the nested spreads (`subject` at
  `:55-59`, etc.) define nested order. This is what this phase reorders. Preserve the `structuredClone`
  return (the [`mergeDayMetadata` ownership invariant](shared-contracts.md#mergedaymetadata-contract)).
- [src/valueList.js](../../../../src/valueList.js) — `defaultYMLValues` (and `emptyFormData`): the
  canonical legacy `formData` key order, top-level and nested. **This is the target order.** Capture the
  exact key sequence (top-level + every nested object/array-item shape).
- [src/features/importExport.js:244-293](../../../../src/features/importExport.js) — `exportAll(model)`:
  the legacy export. It encodes `structuredClone(formData)`, so the legacy export bytes == `encodeYaml`
  of a `formData`-shaped object. The legacy **import** path (same module / `src/features/…`) maps a YAML
  file back into `formData` order — useful for building the reference (parse fixture → legacy formData →
  `encodeYaml` = the legacy-export bytes for that data).
- [src/io/yaml.js:37](../../../../src/io/yaml.js) — `encodeYaml`. **Do not change it** (changing the
  encoder is forbidden — golden baselines would shift; see CLAUDE.md Regression Prevention Protocol).
- [src/__tests__/baselines/golden-yaml.baseline.test.js](../../../../src/__tests__/baselines/golden-yaml.baseline.test.js)
  and the 4 fixtures in [src/__tests__/fixtures/golden/](../../../../src/__tests__/fixtures/golden/) —
  the within-path encoder/format guard. Stays byte-identical (this phase does not touch `encodeYaml`).
- The Phase 5 new-path snapshot fixture and semantic-parity tests — this phase tightens them from
  deep-equal to byte-identical-against-legacy where achievable.

**Contracts referenced:**

- [`mergeDayMetadata` contract](shared-contracts.md#mergedaymetadata-contract) — this phase **fulfils**
  the deferred byte-for-byte goal named there. Update that contract's "Parity invariant" once delivered
  (semantic → byte-for-byte) and keep the ownership/`structuredClone` invariant intact.
- [YAML parity / shadow-export contract](shared-contracts.md#yaml-parity--shadow-export-contract) — the
  "Byte-for-byte legacy parity (deferred)" safeguard becomes active here. The within-path golden guard
  and the new-path snapshot both remain; this phase adds the **legacy-export reference harness** as the
  cross-path byte-for-byte proof.

## Tasks

- **Capture the legacy-export reference — and prove it is real, not a tautology.** Add a test helper
  that, for a given valid fixture, produces the legacy export bytes: build the legacy `formData` (via the
  legacy import path, or constructed to `defaultYMLValues` order) and `encodeYaml(structuredClone(formData))`.
  This is the byte target. **Guard against a self-referential reference:** before trusting it, (a) assert
  the legacy import→export round-trip is itself byte-stable, and (b) ground the reference against an
  actual checked-in legacy-export artifact (capture one real legacy export and commit it) so the harness
  compares the new path to *true production bytes*, not to a second derivation of the same code path. Do
  **not** use the hand-authored golden fixtures as the target directly — they are authored in yet another
  order and are not legacy-export output. **Also resolve, with this reference as arbiter, whether the
  legacy export even populates `EXPERIMENT_DATE_in_format_mmddYYYY`** (Phase 5 found it absent from
  `formData`); if the legacy filename also degrades, that is a pre-existing legacy bug to note, not a
  parity failure of the new path.
- **Align `mergeDayMetadata`'s key order to `defaultYMLValues`.** Reorder the merged object literal
  (top-level) and every nested object (`subject`, `device`, `electrode_groups[]`,
  `ntrode_electrode_group_channel_map[]`, `cameras[]`, `tasks[]`, optogenetics shapes) so the encoded
  output matches the legacy export key-for-key, byte-for-byte. **Behavior-preserving:** same keys, same
  values — only insertion order changes. Keep the `structuredClone` return.
- **Reconcile the always-on key set.** Decide, with the reference harness as arbiter, whether
  `mergeDayMetadata` must emit the optogenetics / `fs_gui_yamls` keys unconditionally (as legacy
  `formData` does) to be byte-identical, or whether legacy export omits them for non-opto data. Match
  whatever the legacy export actually produces. Document the resolution in the function docstring.
- **Tighten the parity tests** (Phase 5 left them at semantic deep-equal): for each fixture where the
  legacy reference is reproducible, assert `encodeYaml(mergeDayMetadata(animal, day))` is **byte-identical
  to the legacy-export reference**. Keep a deep-equal fallback only where a fixture genuinely cannot be
  represented as a single day (document why).
- **Update contracts/docs.** Flip the `mergeDayMetadata` "Parity invariant" in
  [shared-contracts.md](shared-contracts.md#mergedaymetadata-contract) from semantic to byte-for-byte,
  and note in `docs/REFACTOR_CHANGELOG.md` that the new export path is now byte-identical to legacy.

## Deliberately not in this phase

- **No change to `encodeYaml`, the schema, or any golden fixture.** Parity is achieved by reordering
  `mergeDayMetadata`'s output construction only. A golden-baseline diff is a blocker, never a regenerate.
- **No cutover / flag flips** — [Phase 11](phase-11-cutover-v3.md).
- **No new export features** (batch/summary were Phase 8).

## Validation slice

| Test | Asserts |
| --- | --- |
| `legacy-parity: sample fixture byte-identical` *(integration)* | Build the workspace for `20230622_sample_metadata.yml`; `encodeYaml(mergeDayMetadata(animal, day))` is byte-identical to the **legacy-export reference** for the same data. |
| `legacy-parity: realistic / minimal / probe-reconfig byte-identical` *(integration)* | Same harness for the other three fixtures (or documented deep-equal fallback where a fixture isn't a single representable day). |
| `nested key order matches legacy` | `subject`, `device`, an `electrode_groups[]` item, an `ntrode[]` item, a `cameras[]` item, and a `tasks[]` item each encode their keys in `defaultYMLValues` order. |
| `always-on key set matches legacy` | A non-optogenetics day encodes exactly the legacy key set (resolve opto/`fs_gui_yamls` presence to match legacy). |
| `behavior preserved: values unchanged` | `decodeYaml` of the new output deep-equals the Phase 5 semantic baseline (only order changed, no value drift). |
| `golden baselines unchanged` | `golden-yaml.baseline.test.js` still byte-identical for all 4 fixtures. |

Mark the build→export comparisons as integration; key-order assertions are unit tests on
`mergeDayMetadata` output. Use Vitest.

## Fixtures

- Reuse the 4 golden fixtures as data sources and the Phase 5 workspace builder.
- Add the **legacy-export reference helper** (parse fixture → legacy `formData` → `encodeYaml`) under
  `src/__tests__/fixtures/` so both the new path and the legacy path are encoded from the same data.

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** Validation slice + `npx vitest run` (no regressions) + `npx vitest run baselines`
  (byte-identical). The legacy-export reference harness is the headline proof; `encodeYaml`, the schema,
  and the golden fixtures are untouched.
- **Reviewers:** `pr-review-toolkit:code-reviewer` (always), plus `silent-failure-hunter` (a reorder that
  silently drops/renames a key is the failure mode) and `pr-test-analyzer` (the parity harness must
  compare against the real legacy bytes, not a tautology).
- **Checklist (§6):** behavior-preserving (values identical, only order changed); no `encodeYaml`/schema/
  fixture changes; the `mergeDayMetadata` parity contract updated; no plan/phase/milestone strings in
  code/test/module names or docstrings.
