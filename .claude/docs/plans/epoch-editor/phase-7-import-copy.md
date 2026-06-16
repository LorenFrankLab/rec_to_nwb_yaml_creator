# Phase 7 — Import & repair + copy-from-animal

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

The **Import & repair** teaching-validation screen (parse a YAML, decide new-animal vs existing-day, flag
every non-conforming field with a suggested fix, block on required-but-missing, list benign normalizations,
never silently drop) and the **copy-from-animal** flow (reuse a same-rig animal's setup). Designs:
[import-repair.html](import-repair.html), [copy-from-animal.html](copy-from-animal.html).

**Inputs to read first:**

- The existing import dialog (grep `ImportYamlDialog`) — current YAML import to reshape into the repair screen.
- [src/io/yaml.ts:73](../../../src/io/yaml.ts) — `decodeYaml`.
- [src/validation/index.ts:22](../../../src/validation/index.ts) (`validate`) + the rules that drive the suggested fixes: [dandiSubject.ts:32,45](../../../src/validation/dandiSubject.ts) (species/sex/slash), `src/validation/rules/electrodeGroupRules.ts` (NULL/`NotInBrain` location), `src/validation/rules/identityRules.ts` (experimenter shape).
- [src/utils/deviceNormalization.ts](../../../src/utils/deviceNormalization.ts) — the **no-laundering** contract: corrupt values preserved verbatim for validation to surface (the repair screen shows them, doesn't auto-fix).
- [src/state/workspaceSelectors.ts:253](../../../src/state/workspaceSelectors.ts) — `getCopyableDioSources`; and the copy-from-animal affordance already in `BehavioralEventsStep`.
- [src/state/workspaceActions.ts](../../../src/state/workspaceActions.ts) — `createAnimal`/`createDay`/`updateAnimal` for committing an import; the day-vs-animal decision routes here.

**Contracts referenced:**

- [Substrate to reuse](shared-contracts.md#2-substrate-to-reuse) — the suggested fixes are the *same* validation predicates; no second validator. No-laundering is preserved.
- [Byte-identity gate](shared-contracts.md#1-byte-identity-gate) — an imported-then-exported clean file round-trips byte-identical (`decodeYaml`→model→`mergeDayMetadata`→`encodeYaml`).

## Tasks

- Import & repair screen: file picker → `decodeYaml` → map to the workspace model → run `validate` (+ the targeted rule predicates) to produce, per non-conforming field, a **suggested fix** (`Rat`→`Rattus norvegicus` via `isValidSpecies`'s canon, `Male`→`M`, `"541g"`→`541 g`, NULL/`NotInBrain` locations, experimenter `Last, First` shape, conflicting `volume_in_uL`/`volume_in_ul` *values* — reconcile, never drop the shim key). Each row Accept/Edit. **Required-but-missing** (e.g. `date_of_birth`) blocks import. Benign normalizations (`task_epoch`→`task_epochs`, key quoting/order) auto-applied **and listed**. Nothing silently dropped — unmappable values stay flagged (no-laundering).
- New-animal vs existing-day decision (match on normalized `subject_id`): commit via `createAnimal`(+setup) or `createDay`(+`updateDay`); show the existing-animal conflict path.
- Import **success** state: "new animal created" / "day added" result with a link to it.
- Copy-from-animal flow: pick a same-rig source (`getCopyableDioSources` for DIO; analogous selectors for probes/cameras/task-types/opto), choose which setup to copy (identity, days, DIO **not** copied), name the new animal, continue to setup (hand to the wizard, Phase 6). Reuse the existing copy affordance logic.
- Wire entries: Animals home / wizard "Import a YAML…" → import screen; "Copy from another animal" → copy flow.
- CHANGELOG: import & repair screen + copy-from-animal.

## Deliberately not in this phase

- Auto-fixing corruption — the screen **suggests** and the user accepts; no silent laundering (`deviceNormalization` preserves verbatim).
- Re-deriving import file paths into the data-folder model — imported days keep their explicit paths (`manual`, per [Phase 4](phase-4-epoch-grid.md)); derivation is opt-in for authored files only.
- Recovery-on-load review — that's [Phase 8](phase-8-recovery-empty-polish.md) (different trigger: persisted-blob load, not user file import).

## Validation slice

| Test | Asserts |
| --- | --- |
| `ImportRepair.test.tsx` | each non-conforming field gets the correct suggested fix from the shared predicate; required-missing blocks import; benign normalizations listed + applied; nothing silently dropped; new-animal vs existing-day routing |
| `importRoundTrip.test.ts` | a clean golden YAML imported then exported is **byte-identical** (`decodeYaml`→model→`mergeDayMetadata`→`encodeYaml`) |
| `CopyFromAnimal.test.tsx` | source picker (`getCopyableDioSources` etc.); copies probes/cameras/tasks/opto, **not** identity/days/DIO; routes to the wizard |
| `baselines` | unchanged; import round-trip byte-identical |

## Fixtures

A legacy non-conforming YAML (free-text species, `Male`, `"541g"`, NULL locations, `Alison Comrie`
experimenter, missing `date_of_birth`) for the repair flow; a clean golden YAML for the round-trip; a
same-rig source animal for copy-from.

## Review

Dispatch `code-reviewer`. Confirm: suggested fixes use the shared validation predicates (no second
validator); no-laundering preserved (unmappable values surface, not auto-erased); required-missing blocks;
import round-trip byte-identical; copy-from excludes identity/days/DIO; lint/typecheck/e2e/baselines green.
