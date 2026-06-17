# Phase 2 — Fail-closed data-acq merge + opto-presence DRY

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Two export-semantics fixes in the same neighborhood, both byte-safe for valid input. The merge stops
*silently substituting a different acquisition device* for a dangling reference (it currently relies
on a sibling validator failing closed by convention), and the last un-converted opto-presence check is
routed through the shared strict predicate.

**Inputs to read first:**

- [src/state/workspaceUtils.ts:286-300](../../../../src/state/workspaceUtils.ts) — `resolveDayDataAcqDevice`; the `|| catalog[0]` fallback.
- [src/state/workspaceUtils.ts:221-244](../../../../src/state/workspaceUtils.ts) — `resolveDayConfig`, the geometry sibling that THROWS on a dangling config-version pin (the target pattern).
- [src/domain/dayOverrideValidation.ts:333-358](../../../../src/domain/dayOverrideValidation.ts) — `danglingDataAcqRefIssue` (the `error`-severity validator that currently backstops the substitution), folded into `validateDay` at [src/domain/dayValidationComposer.ts:84](../../../../src/domain/dayValidationComposer.ts).
- [src/domain/optoCompleteness.ts:60](../../../../src/domain/optoCompleteness.ts) — `optoFieldsPresence` (the strict `Array.isArray(v) && v.length > 0` predicate).
- [src/validation/rules/referenceRules.ts:275-280](../../../../src/validation/rules/referenceRules.ts) — `fsGuiReferences` inlining `?.length > 0`.
- [src/validation/rules/optoRules.ts:34](../../../../src/validation/rules/optoRules.ts) — the sibling already migrated to `optoFieldsPresence` (the model to mirror).

## Tasks

- **Fail-closed `resolveDayDataAcqDevice`.** When `day.data_acq_device_name` is set but resolves to no
  catalog device, do NOT substitute `catalog[0]`. Match the geometry sibling: throw a descriptive error
  (symmetric with `resolveDayConfig`, and every export path already catches merge throws into a visible
  `failed`/`skipped`/`merge-error` state). Keep the existing behavior when `dayName` is absent (fall back
  to `catalog[0]` is fine — no day-level choice was made) and when it resolves (unchanged). This removes
  the "merge fails open while a separate validator fails closed" coupling so a future caller that skips
  validation can't ship the wrong device silently.
- **Route `fsGuiReferences` through `optoFieldsPresence`.** Replace the inline
  `model.opto_excitation_source?.length > 0 && …` (referenceRules.ts:275-280) with
  `optoFieldsPresence(model)` (import from `src/domain/optoCompleteness`), matching `optoRules.ts:34`.
  This is the last un-converted consumer of the opto-presence invariant; it removes the lockstep risk
  (a corrupt non-array with a truthy `.length` would otherwise read as "present" here).
- **Docs.** CHANGELOG "Fixed": the merge no longer substitutes a different acquisition device for a
  dangling `data_acq_device_name`; opto-presence is checked consistently.

## Deliberately not in this phase

- The task-catalog collision (Phase 3) — a different silent-swap, separate mechanism.
- Broadening the data-acq model or the validator — only the fallback direction changes.

## Validation slice

| Test | Asserts |
| --- | --- |
| `workspaceUtils` merge test (extend) | a day with a `data_acq_device_name` that resolves → the named device (unchanged); with an UNRESOLVABLE name → throws a descriptive merge error, never substitutes `catalog[0]`; with NO name → first catalog device (unchanged) |
| `referenceRules`/`rulesValidation` test (extend) | with a corrupt non-array opto field (e.g. `opto_excitation_source: 'x'`), `fsGuiReferences` no longer reads it as "present" (and export stays blocked) |
| existing `optoRules` tests | unchanged — the strict predicate is the same one already used |
| `baselines` | byte-identical (golden fixtures store resolvable devices, so the changed branch is never exercised) |

## Fixtures

Synthesize inline: a day whose `data_acq_device_name` is absent from the animal's catalog (dangling),
a resolvable day, and a no-name day — minimal `{ animal: { devices: { data_acq_device: [...] } }, day }`
records. Reuse the existing opto-rule fixtures for the second task.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The dangling-ref branch fails closed; the resolvable + no-name branches are unchanged.
- `npx vitest run baselines` byte-identical; the export-path catch sites still surface the throw as a visible state (no swallowed success).
- `fsGuiReferences` uses `optoFieldsPresence` and the opto export-block still fires.
- Full gate green; no trivial tests; CHANGELOG updated.
