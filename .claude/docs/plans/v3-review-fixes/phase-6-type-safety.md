# Phase 6 — Type-safety: derive the closed status unions + a boundary guard

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Three closed string sets are typed as `Record<string,string>` (or hand-written unions maintained
separately from their value object), so the view-model boundary "translation" is an **unchecked
cast**, not a validated narrowing — and the type can drift from its values. This phase propagates the
exemplary `commandCatalog` pattern (`as const satisfies` + `keyof typeof` derivation) to the three
laggards and adds a runtime guard where the cast reads from `unknown`-sourced data. **Type-only +
test changes — zero runtime/byte change** (the consts keep their exact string literals).

**Inputs to read first:**

- [src/viewModels/commands/commandCatalog.ts:25-61](../../../../src/viewModels/commands/commandCatalog.ts) — the model: `as const satisfies Readonly<Record<…>>` + `WorkflowCommandId = keyof typeof …`.
- [src/domain/dayRecovery.ts:71-77](../../../../src/domain/dayRecovery.ts) — `DAY_STATUS: Readonly<Record<string,string>>`; consumed by `isExportableDayStatus`/`isPresentRecordStatus` (`:103,118`) and `DayClassificationRow.status: string` (`:50`).
- [src/domain/stepStatus.ts:16,65-70](../../../../src/domain/stepStatus.ts) — `StepStatus` union (hand-written) and `STEP_STATUS` value object (separate `as const`, no `keyof typeof` link).
- [src/domain/dayLifecycle.ts:26-34](../../../../src/domain/dayLifecycle.ts) — `DAY_LIFECYCLE` frozen object typed only via a `@type` JSDoc.
- [src/viewModels/types.ts:62-67](../../../../src/viewModels/types.ts) — `DayStatus` union (currently redeclared); [:268,388-393](../../../../src/viewModels/types.ts) — the four hand-written lifecycle unions.
- The cast sites: [src/viewModels/validationSummaryViewModel.ts:107](../../../../src/viewModels/validationSummaryViewModel.ts) (`row.status as DayStatus`), [src/viewModels/animalWorkspaceViewModel.ts:213](../../../../src/viewModels/animalWorkspaceViewModel.ts) (`status as DayStatus`).

## Tasks

- **`DAY_STATUS` → `as const` + derive.** Change `DAY_STATUS` to `Object.freeze({ … } as const)` and
  `export type DayStatus = typeof DAY_STATUS[keyof typeof DAY_STATUS]`. Type
  `DayClassificationRow.status`, `isExportableDayStatus`/`isPresentRecordStatus`, and
  `indexedRecordStatus`'s return as `DayStatus`. In `viewModels/types.ts`, **import** `DayStatus` from
  the domain instead of redeclaring it (one definition).
- **Add a boundary guard for the `unknown`-sourced casts.** Export `isDayStatus(x): x is DayStatus`
  from `dayRecovery.ts` and use it at the two cast sites (`validationSummaryViewModel.ts:107`,
  `animalWorkspaceViewModel.ts:213`) so a status outside the closed set is narrowed/handled rather than
  asserted. (The classifier itself only emits members, but the value flows from `record.status`
  originating in `unknown` persisted data — defense-in-depth at the boundary.)
- **`StepStatus` derive from `STEP_STATUS`.** Replace the hand-written union with
  `export type StepStatus = typeof STEP_STATUS[keyof typeof STEP_STATUS]` so the type and value object
  can't drift; confirm the producer functions still type-check.
- **`DAY_LIFECYCLE` derive + reuse.** Make `DAY_LIFECYCLE` `as const`, derive
  `type DayLifecycle = typeof DAY_LIFECYCLE[keyof typeof DAY_LIFECYCLE]`, and replace the four inline
  lifecycle unions in `viewModels/types.ts` with the derived type. (`chipVariant: string` at
  `types.ts:256` stays `string` — it's a deliberately un-collapsed surface variant, documented.)
- **(Optional, Low) one `RepairCommandDescriptor` interface** for `repairRouting.ts`'s
  `repairCommand?: unknown`, replacing the three divergent inline casts
  (`animalWorkspaceViewModel.ts:418`, `dayEditorViewModel.ts:581,607`). Only if it lands cleanly;
  otherwise defer.
- **Docs.** No user-facing doc change (internal types). A CHANGELOG "Changed (internal)" note is optional.

## Deliberately not in this phase

- Any behavior change — the consts keep their exact string values; this only tightens types and adds a guard.
- Broader TS strictness migration (out of scope).

## Validation slice

| Test | Asserts |
| --- | --- |
| `npm run typecheck` | passes; a deliberately-wrong `DAY_STATUS`/`StepStatus`/lifecycle literal at a consumer is now a compile error (spot-check during dev, not a committed test) |
| `dayRecovery` unit (extend) | `isDayStatus('ok')` true, `isDayStatus('OK')`/`isDayStatus('bogus')` false; the derived `DayStatus` values equal the prior string literals (`DAY_STATUS.OK === 'ok'` etc.) |
| existing recovery/validation/day-row VM tests | unchanged (runtime behavior identical) |
| `baselines` | byte-identical (no runtime change) |

## Fixtures

None new — type changes verified by `typecheck` + the existing VM/domain test suites.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The three enums derive their unions (`keyof typeof`); `DayStatus` has ONE definition (imported into the VM); the cast sites use `isDayStatus`.
- Runtime values unchanged (the const literals are identical); `npx vitest run baselines` byte-identical; `npm run typecheck` clean; full gate green.
- No behavior change slipped in; no plan-milestone references in code.
