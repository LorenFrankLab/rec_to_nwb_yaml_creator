# Phase 2 — Duplicate day

[← PLAN.md](PLAN.md) · [overview](overview.md)

Clone an existing recording day to a new date (e.g. "same protocol, next session"). **Merge-neutral.** A duplicate pins the **source's** configuration version (not latest) so it reproduces the source exactly.

**Inputs to read first:**

- `src/state/useWorkspace.js:392` — `createDay`; the duplicate action sits beside it and reuses `createDayRecord` + `generateDayId` + `getCurrentTimestamp`.
- `src/state/workspaceTransitions.js:288` — `createDayRecord(..., carryFrom)` (phase 1) — duplicate passes the source day as `carryFrom`, then overrides `configurationVersion`.
- `src/pages/AnimalWorkspace/RecordingDaysTab.jsx` — the day-row list; the existing "Delete recording day …" control (≈ :437/:531) is the sibling for the new "Duplicate day…" item.

**Contracts referenced:** [`createDayRecord(..., carryFrom)`](shared-contracts.md#createdayrecordanimal-animalid-dayid-date-session-now-carryfrom--null--referenced-by-phase-1-phase-5).

## Tasks

- **`duplicateDay(sourceDayId, newDate)` action** in `useWorkspace.js`: resolve `source = prev.days[sourceDayId]` (throw if absent), `animalId = source.animalId`, `dayId = generateDayId(animalId, newDate)` (throw if exists). Build with `createDayRecord(animal, animalId, dayId, newDate, { session_id: \`${animalId}_${newDate.replace(/-/g,'')}\`, session_description: source.session?.session_description ?? '' }, now, source)`, then **override the pinned version to the source's** so the duplicate matches: return the day as `{ ...built, configurationVersion: source.configurationVersion }`. Append `dayId` to the animal's `days`. (Carries the phase-1 field set; `deviceOverrides` carry is added by phase 5, where same-config-version makes it safe.)
- **Row action**: add a "Duplicate day…" item next to "Delete day…" in `RecordingDaysTab`. It opens a minimal date picker (reuse `CalendarDayCreator` in single-select mode, or a `<input type="date">` constrained to not collide with an existing day) → `actions.duplicateDay(dayId, chosenDate)`.
- **CHANGELOG** entry: duplicate-day; clones day-owned content + pins the source's config version; merge-neutral.

## Deliberately not in this phase

- Carrying `deviceOverrides.bad_channels` — phase 5 (adds it to the carry mechanism, safe here because a duplicate keeps the same config version).
- Multi-duplicate / "duplicate to N dates" — single-target only.

## Validation slice

| Test | Asserts |
| --- | --- |
| `duplicateDay` clones day-owned content | new day tasks/behavioral_events/keywords/technical/experiment_description/weight equal source; cloned not aliased |
| `duplicateDay` pins source config version | new `configurationVersion` === source's (NOT necessarily latest) |
| `duplicateDay` derives session id/desc | session_id derived from animalId+newDate; not the source's session_id |
| `duplicateDay` guards | absent source → throws; colliding date → throws |
| row action wiring | clicking "Duplicate day…" + choosing a date creates the duplicate (live-store probe) |
| baselines | 125 byte-identical |

## Fixtures

Inline: a `remy` animal with a configured prior day (tasks/technical) pinned to a config version. Store-level tests via `renderHook`/`StoreProvider`; the row-action test via `StoreProvider` + a probe.

## Review

Dispatch `code-reviewer`. Confirm: the duplicate pins the source's config version (not latest — this is the easy bug); no `deviceOverrides` carry (that's phase 5); guards throw; baselines byte-identical; docstrings/test names don't reference this plan.
