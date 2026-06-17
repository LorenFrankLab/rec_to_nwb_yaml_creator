# Phase 11 — Controlled-vocab & subject nudges

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

A cluster of small, high-leverage validation nudges grounded in the corpus, scoped to the fields the app
does **not** already guard. Verified-against-source so we don't rebuild: `device_type` is already validated
against the full **12-probe** catalog ([src/ntrode/probeCatalog.ts:75-96](../../../../src/ntrode/probeCatalog.ts)),
and free-text `species` (`Rat`) is already rejected ([src/validation/rules/dandiSubjectRules.ts:24-36](../../../../src/validation/rules/dandiSubjectRules.ts), `invalid_species`). The real gaps: experimenter name-shape
(a Spyglass ingest constraint), genotype-vs-strain, placeholder `subject_id`, and a `location` typo nudge.
Evidence: [../../research/yaml-corpus-2/06-spyglass-constraints.md](../../research/yaml-corpus-2/06-spyglass-constraints.md),
[cat-B-subject-vocab.md](../../research/yaml-corpus-2/cat-B-subject-vocab.md),
[cat-C-electrodes-probes-refs.md](../../research/yaml-corpus-2/cat-C-electrodes-probes-refs.md).

**Inputs to read first:**

- [src/validation/rules/dandiSubjectRules.ts](../../../../src/validation/rules/dandiSubjectRules.ts) — `dandiSubjectConformance`: already rejects free-text species + slashes in `subject_id`/`session_id`. Add the genotype-vs-strain + placeholder-id nudges here (same subject-field neighborhood).
- [src/validation/rules/identityRules.ts](../../../../src/validation/rules/identityRules.ts) — identity divergence rules; the natural home for an `experimenter_name`-shape rule (it already encodes Spyglass identity semantics). Registered at [src/validation/rulesValidation.ts:46-47](../../../../src/validation/rulesValidation.ts).
- [src/validation/rules/electrodeGroupRules.ts:105-160](../../../../src/validation/rules/electrodeGroupRules.ts) — `empty_location` (error, every group) + the existing same-location-different-case **warning** (`:149`). Add an edit-distance typo nudge alongside the case warning. **See Open Question** on active-scoping the empty-location error.
- [CLAUDE.md](../../../../CLAUDE.md) "Current Supported Device Types" — the doc lists **8**; the code catalog has **12**. Stale-doc fix only (no code change).

## Tasks

- **Experimenter name-shape rule** (Spyglass `decompose_name` raises unless exactly `First Last` or
  `Last, First`). Add a **warning**: an `experimenter_name` (each entry, if a list) that is neither shape
  (e.g. 3 tokens, middle initial, single token) → flag with the two valid shapes, since a non-conforming
  name **loses experimenter linkage** in Spyglass (`common_lab.py:386-405`). Do not block; unusual-but-real
  names must remain enterable.
- **Genotype-vs-strain nudge.** Warn when `subject.genotype` contains strain tokens (`Long Evans`/
  `Long-Evans`/`Sprague`/`Wistar`) — the strain belongs in `description`, not genotype (332 corpus files
  mis-file it). Soft, with a "move to description?" hint; do not auto-rewrite.
- **Placeholder `subject_id` nudge.** Warn when `subject_id` ∈ {`12345`, `54321`, `subject_id`} — a
  shipped template default (real session dirs carry these). Soft warning, "set the real subject id".
- **`location` typo nudge.** Alongside the existing case-fragmentation warning, add a small
  edit-distance check against the set of locations already used in this animal/workspace (and a short
  canonical list) so `hippcoampus`→`hippocampus` is nudged. Warning only; canonical casing stays the
  user's choice.
- **Doc fix.** Update CLAUDE.md "Current Supported Device Types" from 8 to the 12 the catalog actually
  has (no code change). Add the 12-probe list as the source of truth.
- **Docs.** CHANGELOG "Added": experimenter name-shape, genotype-vs-strain, placeholder-id, and
  location-typo nudges.

## Deliberately not in this phase

- Widening / changing the **device_type catalog** — it already has all 12 probes and is validated; the
  only stale artifact is the CLAUDE.md doc (fixed above). The `screw`/`single_electrode` hardware class is
  a genuine product decision — see Open Question, not a catalog edit.
- The **species** guard — already implemented (`invalid_species`).
- The task-catalog name collision — **Phase 3**.
- **Active-scoping the `empty_location` error** (so it doesn't fire on deliberately-unused/all-bad
  tetrodes) — needs a first-class "disabled group" concept; tracked as an Open Question, not done here.

## Validation slice

| Test | Asserts |
| --- | --- |
| `identityRules`/name-shape (new) | `Last, First` and `First Last` → clean; `First M Last` / single-token / 3-token → warning with the two valid shapes |
| `dandiSubjectRules` (extend) | `genotype: 'Long Evans Rat'` → strain nudge; `genotype: 'PV-Cre'` → clean; `subject_id: '54321'` → placeholder nudge; a real id → clean |
| `electrodeGroupRules` (extend) | `location: 'hippcoampus'` with `hippocampus` used elsewhere → typo nudge; an exact match → clean; the existing case-fragmentation warning unchanged |
| existing `dandiSubjectRules`/species tests | unchanged (species rule untouched) |
| `baselines` | byte-identical (the golden subjects use conforming names/genotype/ids/locations) |

## Fixtures

Synthesize subjects with `genotype: 'Long Evans Rat'` vs `'Wild Type'`; `subject_id: '54321'` vs a real
id; `experimenter_name: ['Last, First', 'First M Last']`; electrode groups with `location: 'hippcoampus'`
amid `'hippocampus'`.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- No change to the species rule or the probe catalog (already complete); only the CLAUDE.md doc list is updated.
- The nudges are warning-severity (don't block a legitimate edge case) with actionable messages; baselines byte-identical.
- The name-shape rule matches Spyglass's two accepted shapes exactly.
- Full gate green; no trivial tests; CHANGELOG updated.
