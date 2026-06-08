# Phase 1 — Carry-forward day creation

[← PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

A new day defaults its day-owned content (tasks, behavioral events, keywords, weight, experiment description, technical) from the animal's most recent existing day — reviewable, default-on toggle to opt out. **Merge-neutral**: a carried day exports identically to a hand-entered one. All new params are trailing-optional (no breaking change). Bad channels are NOT carried here — that rides with phase 5 (config-version-guarded).

**Inputs to read first:**

- `src/state/workspaceTransitions.js:288` — `createDayRecord(animal, animalId, dayId, date, session, now)`; the day-owned fields (`tasks: []`, `behavioral_events: []`, `keywords: []`, `technical: {…}`) are the blanks to seed (≈ :295-328).
- `src/state/useWorkspace.js:392` — `createDay: (animalId, date, session) => {…}` calling `createDayRecord(...)`.
- `src/pages/AnimalWorkspace/RecordingDaysTab.jsx:131` — `handleCreateDays(dates)`; the `actions.createDay(...)` call ≈ :150. `selectedAnimal`, `days`, `actions` are in scope.
- `src/state/workspaceSelectors.js:89-112` — `getAnimalDayIds` and the day-owned selectors.

**Contracts referenced:** [`getMostRecentDayId`](shared-contracts.md#getmostrecentdayidanimal-days--referenced-by-phase-1-phase-5), [`createDayRecord(..., carryFrom)`](shared-contracts.md#createdayrecordanimal-animalid-dayid-date-session-now-carryfrom--null--referenced-by-phase-1-phase-5) — phase 1 implements the carry of session/keywords/tasks/behavioral_events/technical (NOT bad channels).

## Tasks

- **Add `getMostRecentDayId`** to `src/state/workspaceSelectors.js` after `getAnimalDayIds` — code in [shared-contracts.md](shared-contracts.md#getmostrecentdayidanimal-days--referenced-by-phase-1-phase-5).
- **`createDayRecord` carry-forward** (`workspaceTransitions.js:288`): add trailing `carryFrom = null`; import the day-owned selectors at the top (`import { getConfigHistory, getDayTasks, getDayKeywords, getDayBehavioralEvents } from './workspaceSelectors';`); seed the day-owned fields from `carryFrom` when present (deep-cloned via `structuredClone`):
  - `session.experiment_description` / `session.weight` ← caller's `session.*` if defined, else `carryFrom.session.*`; `session_id`/`session_description` always from the caller (date-derived).
  - `keywords`/`tasks`/`behavioral_events` ← `structuredClone(getDay…(carryFrom))` else `[]`.
  - `technical` ← `structuredClone(carryFrom.technical)` when it's a record, else the existing animal-defaults seed.
  - `associated_files`/`associated_video_files` always `[]` (session-specific). Full code: see the carry-forward block in [shared-contracts.md](shared-contracts.md) semantics — write it inline in `createDayRecord`.
- **`createDay` option** (`useWorkspace.js:392`): accept trailing `options = {}`; `const carryFrom = options.carryForwardFromDayId ? prev.days[options.carryForwardFromDayId] || null : null;` and pass `carryFrom` to `createDayRecord(...)`. An unknown id → null → blank day (no throw).
- **`RecordingDaysTab` toggle + bulk wiring**: `import { getMostRecentDayId } from '../../state/workspaceSelectors';`; `const mostRecentDayId = getMostRecentDayId(selectedAnimal, days);` + `const [carryForward, setCarryForward] = useState(true);`. In `handleCreateDays`, add a 4th arg to the existing `createDay` call: `{ carryForwardFromDayId: carryForward && mostRecentDayId ? mostRecentDayId : undefined }`. Render a `<label>` toggle near the "Add Recording Days" trigger, only when `mostRecentDayId` exists, labelled "Start each new day from the last day ({date}) — review & adjust per day".
- **CHANGELOG** (`docs/REFACTOR_CHANGELOG.md`): one entry — carry-forward day creation; day-owned fields carried (list them); default-on toggle / opt-out; merge-neutral, baselines byte-identical; trailing-optional params (no breaking change).

## Deliberately not in this phase

- **Bad-channel carry-forward** — phase 5 (config-version-guarded; bad channels become day-only there).
- **Chained bulk seeding** — all bulk days seed from the same pre-batch source (simpler, reviewable); not day-N-from-day-N-1.

## Validation slice

| Test | Asserts |
| --- | --- |
| `getMostRecentDayId` latest | days 06-20/06-21/06-22 (any order) → the 06-22 id |
| `getMostRecentDayId` empty/corrupt | `[]` → null; dangling id → null; `null` animal → null (no throw) |
| `createDayRecord` no carryFrom | tasks/keywords/behavioral_events `[]`; technical from animal defaults; experiment_description undefined (back-compat) |
| `createDayRecord` with carryFrom | tasks/behavioral_events/keywords/technical equal source AND are not the same reference (cloned); experiment_description/weight from source |
| `createDayRecord` never carries id/desc/files | session_id/session_description from caller; associated_files/associated_video_files `[]` |
| `createDay` with carryForwardFromDayId | new day tasks equal source tasks |
| `createDay` no options | new day tasks `[]` (back-compat) |
| `RecordingDaysTab` toggle default-on | checkbox checked when a prior day exists; creating a day copies prior tasks (assert via live-store probe) |
| baselines | `npx vitest run baselines` → byte-identical |

## Fixtures

Synthesized inline (a `remy` animal with a one-version `configurationHistory`, `technicalDefaults`, and one prior day carrying tasks/behavioral_events/keywords/technical). The `RecordingDaysTab` test renders under `StoreProvider` and reads the new day via a small probe; confirm the calendar date-cell label format against `CalendarDayCreator`, and if the harness clock isn't in the fixture's month either navigate the calendar there or assert at the `handleCreateDays` level. No real-data slice (store/UI logic).

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm: tasks implemented as specified; nothing from "Deliberately not in this phase" added (no bad-channel carry); baselines byte-identical (the merge-neutrality gate); carry-forward tests assert cloned-not-aliased and the exact field set (not tautologies); shared setup in fixtures; docstrings/test names don't reference this plan; existing `createDay`/`createDayRecord` call sites still pass and behave identically.
