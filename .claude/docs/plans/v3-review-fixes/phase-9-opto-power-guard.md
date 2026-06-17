# Phase 9 — Optogenetics power range guard

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The one **silent NWB corruption** the app doesn't yet guard. In the corpus, `power_in_W: 200` appears in
**70/71** real opto excitation blocks — the laser model's max *milliwatts* (e.g. `LuxX+ 638-200`) typed
into the Watts field. trodes_to_nwb writes it **verbatim** to `ExcitationSource.power_in_W` with no range
check ([../../research/yaml-corpus-2/05-downstream-trodes-nwb.md](../../research/yaml-corpus-2/05-downstream-trodes-nwb.md)),
so a ~10,000× error lands in the archived/DANDI NWB. `optoRules.ts` has **no power check today**. The form
placeholder actively misleads (`'e.g. 10'` — i.e. 10 W). Opto is sparse (one group), so this is a
warn-to-confirm, not a hard block.

**Inputs to read first:**

- [src/validation/rules/optoRules.ts](../../../../src/validation/rules/optoRules.ts) — `optogeneticsRules`; currently validates opto *presence/completeness* (via `optoFieldsPresence`) but **no `power_in_W` magnitude check**. Add the rule here; it is registered at [src/validation/rulesValidation.ts:30](../../../../src/validation/rulesValidation.ts).
- [src/nwb_schema.json:36042-36050](../../../../src/nwb_schema.json) — `opto_excitation_source/items/power_in_W` (the field; real power lives in `fs_gui_yamls/items/power_in_mW` at `:36412`).
- [src/pages/AnimalEditor/OptogeneticsStep.tsx:56](../../../../src/pages/AnimalEditor/OptogeneticsStep.tsx) — `{ name: 'power_in_W', label: 'Source power (W)', placeholder: 'e.g. 10' }` — the misleading placeholder.
- [src/domain/optoCompleteness.ts](../../../../src/domain/optoCompleteness.ts) — the opto-presence helper, so the new rule only runs when opto is actually present (don't flag the empty-`[]` scaffolding files).

## Tasks

- **Add a `power_in_W` magnitude rule** to `optogeneticsRules`. When opto is present and any
  `opto_excitation_source[].power_in_W` is implausibly large for a laser source — threshold ≈ **`> 1` W**
  (typical is 0.002–0.05 W = 2–50 mW; the corpus's only correct value was `0.077`) — emit a
  **warning-severity, confirm-able** issue: *"`power_in_W: {v}` is ~{v/0.02}× a typical optogenetic
  source (2–50 mW). If you meant milliwatts, enter {v/1000}. Confirm Watts to keep."* Warn, not block —
  a genuine high-power source must be enterable. (Optionally also flag `0`/empty when opto is present.)
- **Fix the misleading placeholder.** `OptogeneticsStep.tsx:56` → a unit-honest placeholder/help
  (e.g. `'e.g. 0.01 (= 10 mW)'`) so the field doesn't *invite* the 200 W error. Keep the label "(W)".
- **Docs.** CHANGELOG "Added": a power-range sanity check on `opto_excitation_source.power_in_W`
  (warns when a milliwatt value looks typed into the Watts field); fixed the misleading source-power
  placeholder.

## Deliberately not in this phase

- The opto-presence DRY refactor (`fsGuiReferences` → `optoFieldsPresence`) — **Phase 2** owns it
  (same file neighborhood, different concern: presence vs magnitude).
- Hard-blocking opto on power — it's a confirm-able warning; a real high-power source stays enterable.
- `power_in_mW` (fs_gui) range checking — out of scope here (different field, different typical range);
  list as a deferred follow-up if desired.

## Validation slice

| Test | Asserts |
| --- | --- |
| `optoRules` (extend) | opto present with `power_in_W: 200` → a **warning** (not error), message names the mW alternative; `power_in_W: 0.05` → no issue; opto **absent** / all-`[]` scaffolding → no issue (presence-gated) |
| `optoRules` (extend) | the warning is confirm-able and does **not** block export (severity warning, not error) |
| `baselines` | byte-identical (the golden opto fixture's power is in range, e.g. `0.077`, so no new issue fires) |

## Fixtures

Reuse the existing opto fixtures; add one with `opto_excitation_source: [{ power_in_W: 200 }]` and one with
`0.05`. Confirm the golden sample's opto power (`0.077`) stays issue-free.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The rule is presence-gated (no nag on the 110 empty-`[]` scaffolding files) and warning-severity (export not blocked).
- The threshold/message is defensible and confirm-able; `baselines` byte-identical.
- The placeholder no longer suggests a Watts-scale number.
- Full gate green; no trivial tests; CHANGELOG updated.
