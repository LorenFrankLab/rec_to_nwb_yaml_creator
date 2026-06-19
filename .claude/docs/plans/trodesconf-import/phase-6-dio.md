# Phase 6 — DIO id reconciliation + day picker

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts §5](shared-contracts.md#5-dio-reconciliation)

Make the imported DIO inventory usable in the day editor: reconcile board-native ids
(`Din*`/`MCU_Din*`/`Controller_Din*`) to the editor's `Din/Dout` index, then limit the day picker to the
present (reconciled) channels — instead of always showing the full `Din1…32`/`Dout1…32` range.

**Inputs to read first:**

- [shared-contracts §5](shared-contracts.md#5-dio-reconciliation) — the `reconcileDioId(id)` contract
  (board prefix strip → `Din<N>`/`Dout<N>` parse → `{type, index}` | null).
- [src/pages/DayEditor/BehavioralEventsDisplay.tsx:32-49](../../../../src/pages/DayEditor/BehavioralEventsDisplay.tsx)
  — today presents the full `Din1…32`/`Dout1…32` range (`ECU_DIGITAL_CHANNELS=32`); this is where the
  range becomes the reconciled inventory when present.
- [src/state/workspaceTypes.ts:528](../../../../src/state/workspaceTypes.ts) — `BehavioralEvent` (channel
  field).
- `getConfigDioInventory(snapshot)` (Phase 4) — the day's config-version DIO inventory.

**Contracts referenced:** [DIO id reconciliation](shared-contracts.md#5-dio-reconciliation).

## Tasks

- **`reconcileDioId` (new pure fn)** per [§5](shared-contracts.md#5-dio-reconciliation): strip a leading
  `ECU_`/`MCU_`/`Controller_` (or none), parse `Din<N>`/`Dout<N>` → `{type:'Din'|'Dout', index}` |
  `null`. Verified against the trodes Resources samples **and** the trodes_to_nwb test fixtures
  (`ECU_Din*`/`ECU_Dout*`, `MCU_Din*`, `Controller_Din*` — [appendix §1](appendix.md#1-trodesconf-xml-structure-trodes)).
- **Resolve the inventory in `DioTab` (not `BehavioralEventsDisplay`).** `BehavioralEventsDisplay` only
  receives `dayEvents` (no workspace access — [BehavioralEventsDisplay.tsx:23-30](../../../../src/pages/DayEditor/BehavioralEventsDisplay.tsx));
  `DioTab` has the day + animal/config context ([DioTab.tsx:114](../../../../src/pages/DayEditor/DioTab.tsx)).
  In `DioTab`: read the day's config-version `dioInventory` via `getConfigDioInventory`, reconcile each
  id, build the present `Din`/`Dout` index set, and pass it **down as a new prop** (e.g.
  `availableChannels`). **Empty/absent inventory → pass `null`/undefined**, and `BehavioralEventsDisplay`
  keeps today's full `Din1…32`/`Dout1…32` range (no regression for animals with no import).
- **Limit the picker (in `BehavioralEventsDisplay`, prop-driven).** When `availableChannels` is provided,
  render only those channels (by type) instead of the full 32-range. An existing `behavioral_event` on a
  channel **not** in the set renders a visible "not in this board's inventory — <id>" marker (the
  controlled-ref pattern from `AssociatedVideosEditor`), not a silent drop. An inventory id that
  **doesn't reconcile** (`reconcileDioId → null`) is surfaced by `DioTab` as an informational note (never
  hidden).
- **No auto-created events** (decision #5) — events are still authored/named by the user; the inventory
  only constrains the channel field.
- **Docs.** CHANGELOG: the day DIO editor now limits channels to the imported board inventory.

## Deliberately not in this phase

- Auto-creating `behavioral_events`; changing their day-owned/carry-forward ownership.
- Editing the inventory in the day editor (it's config-level, set by import).

## Validation slice

| Test | Asserts |
| --- | --- |
| `reconcileDioId` | `Din1`→`{Din,1}`; `ECU_Din1`→`{Din,1}`; `ECU_Dout2`→`{Dout,2}`; `MCU_Din3`→`{Din,3}`; `Controller_Din1`→`{Din,1}`; `Dout2`→`{Dout,2}`; an unparseable id → `null`. |
| picker from inventory | a config inventory of `Controller_Din1..8` limits the day Din picker to 1..8; full range still offered when no inventory. |
| stale channel surfaced | a `behavioral_event` on a channel not in the inventory shows the "not in inventory" marker, not blank. |
| unreconcilable id | an inventory id that doesn't reconcile shows an info note (not hidden, not crashing). |
| no-inventory fallback | an animal with no imported inventory keeps the full `Din1…32`/`Dout1…32` range (no regression). |
| `baselines` | byte-identical (exported `behavioral_events` shape unchanged). |

## Fixtures

A day whose animal config carries a reconciled-able `dioInventory` (from a Phase 1 ECU/Controller config)
+ a day with none + an inventory with one unreconcilable id. No real-data slice.

## Review

Dispatch `code-reviewer`. Confirm: `reconcileDioId` handles all sample board prefixes + null; the picker
limits only when an inventory exists (no-inventory unchanged); stale/unreconcilable ids are surfaced, not
dropped; no events auto-created; `baselines` byte-identical; CHANGELOG updated; no plan/phase refs.
