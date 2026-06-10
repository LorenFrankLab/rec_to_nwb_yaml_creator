# Phase 1 — Day sort-on-write (F2) + restore DIO Type+Index control (F5)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The two smallest, highest-value fixes ship first — they prevent silent data problems, have no dependency on
the TypeScript/CSS foundations, and shipping F2 early lets us confirm the "is the unordering actually
user-visible?" open question against the real app. **F2:** recording days become unordered because
`createDay`/`duplicateDay` append to `animal.days` without sorting; make the stored array canonically
date-ordered (defense-in-depth — every reader is then safe). **F5:** the workspace DIO editor lost the
legacy guided **Type + Index** entry; restore it (recognition over recall; prevents a silent downstream
failure) while emitting the identical `description` string.

This is also the first phase, so it **creates `CHANGELOG.md`** (it doesn't exist yet, though CLAUDE.md
references one).

**Inputs to read first:**

- [src/state/useWorkspace.js:420](../../../src/state/useWorkspace.js) — `createDay`: `days: [...getAnimalDayIds(animal), dayId]` (append); duplicate-date throw at `:470`.
- [src/state/useWorkspace.js:500](../../../src/state/useWorkspace.js) — `duplicateDay`: identical append.
- `src/state/useWorkspace.js` `getAnimalDays` (~`:735`) and `src/state/workspaceSelectors.js` `getMostRecentDayId` (~`:99`) — existing sort-on-read; **kept** (redundant safety after this phase).
- [src/element/SelectInputPairElement.jsx:14-49](../../../src/element/SelectInputPairElement.jsx) `splitTextNumber` and [:77-88](../../../src/element/SelectInputPairElement.jsx#L77-L88) (join: `` `${type}${index}` ``) — the legacy parse/join logic to **copy** (this file is frozen legacy — read it, do **not** edit it).
- `src/pages/AnimalEditor/BehavioralEventsSection.jsx` (controlled edit-form inputs ~`:262-267`) — the workspace DIO library editor (free-text "Description of this event" today); the change site.
- `src/valueList.js` `behavioralEventsDescription()` — Type options (`Din/Dout/Accel/Gyro/Mag`).

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1) — F5 keeps storing the single `description` string (`"Din1"`); only the *input method* changes.
- [C4 — tokens/CSS Modules](shared-contracts.md#c4) — not yet introduced (Phase 3); style the new control with the existing token classes for now, leaving a TODO to modularize when Phase 3 lands.

## Tasks

**Setup:**

- Create `CHANGELOG.md` at the repo root (Keep a Changelog format, `## [Unreleased]`). Reconcile the stale CLAUDE.md references that assume it exists. Every later phase appends here.

**F2 — canonical day order:**

- Add a pure helper `sortDayIdsByDate(ids: string[], daysById): string[]` (e.g. in `src/state/workspaceTransitions.js`) — `[...ids].sort((a, b) => String(daysById[a]?.date ?? '').localeCompare(String(daysById[b]?.date ?? '')))` (ISO `YYYY-MM-DD` sorts lexicographically).
- In `createDay` (`useWorkspace.js:420`), build the next days map first, then sort:
  ```js
  const nextDays = { ...prev.days, [dayId]: day };
  const updatedAnimal = { ...animal, days: sortDayIdsByDate([...getAnimalDayIds(animal), dayId], nextDays) };
  return { ...prev, animals: { ...prev.animals, [animalId]: updatedAnimal }, days: nextDays, lastModified: now };
  ```
- Apply the same change in `duplicateDay` (`useWorkspace.js:500`).
- Keep the sort-on-read selectors (don't remove).

**F5 — guided DIO Type + Index entry:**

- Create a new pure util `src/utils/dioDescription.js`: `splitDioDescription(desc) => {type, index}` and `joinDioDescription(type, index) => string`, **copying** the logic from the legacy `splitTextNumber`/join. **Do NOT modify `SelectInputPairElement.jsx`** — it is frozen legacy and will be removed at the eventual cutover; a duplicated inline copy there is acceptable (overview Non-Goals).
- In `BehavioralEventsSection.jsx`, replace the single free-text Description input in the (controlled) edit form with a **Type `<select>`** (options from `behavioralEventsDescription()`) + a numeric input **labelled "DIO line index"** (`type="number" min="0" step="1"`) + an example hint (`InfoIcon`, "DIO info, e.g. Din1"). Adapt to the controlled idiom (`value`/`onChange`): on either control changing, set `description = joinDioDescription(type, index)`; seed both controls from `splitDioDescription(description)` when editing. Keep the `Name` field unchanged. The stored/exported `description` stays the single string (C1).
- Documentation: CHANGELOG entries for F2 and F5 ("Restored guided DIO Type + line-index entry; `description` output unchanged"). If CLAUDE.md documents the DIO field, note `description` is the hardware DIO line name.

## Deliberately not in this phase

- Editing the **frozen legacy** `SelectInputPairElement.jsx` — copy its logic, leave it untouched (Non-Goals).
- Removing the sort-on-read selectors — defense-in-depth, they stay.
- The day-level `BehavioralEventsDisplay` inherited-events placement and the rest of Tasks & Epochs — [Phase 6](phase-6-tasks-epochs-redesign.md).
- Any dataset-tier DIO catalog.

## Validation slice

| Test | Asserts |
| --- | --- |
| unit: `duplicateDay` to an earlier date | `animal.days` is ascending by `date` (assert on the **stored array**, not a sorted view). |
| unit: `createDay` out of chronological order | `animal.days` ends ascending regardless of insertion order. |
| unit: `joinDioDescription('Din', 1)` → `'Din1'`; `splitDioDescription('Dout03')` → `{type:'Dout', index:3}` | the new util parses/joins correctly. |
| component: edit a DIO event | Type+Index controls seed from an existing `description` and write back the identical string. |
| `npx vitest run baselines` | byte-identical — `description` and day export unchanged (C1). |
| `npx vitest run` (full) + `npm run test:e2e` | green. |

## Fixtures

A 2-day animal fixture whose second day is dated earlier than the first (for F2). Reuse existing DIO/event
fixtures. No YAML fixture changes.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:
- F2 sorts on write in **both** `createDay` and `duplicateDay`; a test asserts the **stored** array; sort-on-read selectors untouched.
- F5 logic lives in a **new util**; the legacy `SelectInputPairElement.jsx` is **unmodified**; the new control writes the identical `description`; existing values round-trip into the controls.
- `CHANGELOG.md` created; baselines byte-identical; validation slice passes.
- Docstrings/test/module names don't reference this plan.
