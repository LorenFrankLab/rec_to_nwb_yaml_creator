# Phase 5 — DIO inventory in the day DIO editor

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Close decision #5's day side: surface the imported config-level DIO inventory in the day
`behavioral_events` editor as a channel picker, so authored events reference real, board-correct
channels instead of free-typed ids — without auto-creating any events.

**Inputs to read first:**

- [src/pages/DayEditor/DioTab.tsx](../../../../src/pages/DayEditor/DioTab.tsx) — the day
  `behavioral_events` editor; where the channel field is entered today.
- [src/state/workspaceTypes.ts:528](../../../../src/state/workspaceTypes.ts) — `BehavioralEvent`
  (the day-owned shape; its channel/`dio_output_name` field).
- `getConfigDioInventory(snapshot)` (added in [Phase 3](phase-3-apply.md)) — the defensive selector for
  the current config version's `dioInventory`.
- [overview Non-Goals](overview.md#non-goals) — DIO inventory is **reference only**; no auto-created
  events.

## Tasks

- **Resolve the inventory for the day.** In `DioTab`, read the day's current config version's
  `dioInventory` via `getConfigDioInventory` (the day → its `configurationVersion` → the matching
  `ConfigurationSnapshot`). Empty/absent inventory (older animals, no import) → fall back to today's
  free-text behavior unchanged (no regression).
- **Channel picker.** When an inventory exists, render the channel field as a `<select>`/datalist limited
  to the inventory ids (`Din1`, `Din17`, `Dout2`, …), grouped/labelled by direction. A `behavioral_event`
  loaded with a channel **not** in the inventory renders a visible, unselectable "not in this board's
  inventory — N" option (mirroring the controlled-ref pattern in
  `AssociatedVideosEditor`/`AssociatedFilesEditor`) so a stale value is seen, not silently blanked.
- **No auto-create.** Events are still added/named by the user (the day-owned, carry-forward model is
  unchanged); the inventory only constrains the channel field.
- **Docs.** CHANGELOG: the day DIO editor now offers the imported channel inventory.

## Deliberately not in this phase

- Auto-creating `behavioral_events` from the inventory (decision #5 — explicitly out).
- Changing the day-owned/carry-forward ownership of `behavioral_events`.
- Editing the inventory in the day editor — it's config-level (set by import); the day only consumes it.

## Validation slice

| Test | Asserts |
| --- | --- |
| `DioTab` — picker from inventory | with a config `dioInventory` of `Din1..Din17`, the channel field offers exactly those (by direction); selecting one writes it to the `behavioral_event`. |
| `DioTab` — no inventory fallback | an animal/day whose config has no `dioInventory` keeps the current free-text field (no regression). |
| `DioTab` — stale channel surfaced | a `behavioral_event` whose channel isn't in the inventory shows the unselectable "not in inventory" option, not a blank. |
| `baselines` | byte-identical (the exported `behavioral_events` shape is unchanged). |

## Fixtures

A day whose animal config carries a `dioInventory` (from a Phase 1 ECU config) + a day whose config has
none. No real-data slice.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The picker is limited to the real inventory; stale channels are surfaced (controlled-ref pattern), not
  blanked; no-inventory days are unchanged.
- No events are auto-created; `behavioral_events` ownership/shape unchanged.
- `baselines` byte-identical; CHANGELOG updated; no plan/phase refs in code/test names.
